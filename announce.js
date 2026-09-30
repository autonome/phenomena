import http from 'node:http';
import crypto from 'node:crypto';

const MAX_BODY_BYTES = 32 * 1024;

// fits in one Discord message alongside the "as of" line
const USAGE_MAX_CHARS = 1800;

const EMBED_LIMITS = {
  title: 256,
  description: 4096,
  maxFields: 25,
  fieldName: 256,
  fieldValue: 1024,
  footer: 2048,
  total: 6000,
};

// constant-time check: unequal length is rejected outright, since
// timingSafeEqual throws (rather than returning false) on a length mismatch
function isAuthorized(req, token) {
  const header = req.headers['authorization'];
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
    return false;
  }

  const provided = Buffer.from(header.slice('Bearer '.length));
  const expected = Buffer.from(token);

  if (provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(provided, expected);
}

// reads the request body, rejecting once it grows past `limit` bytes.
// keeps draining the stream to `end` rather than destroying the socket, so
// the response can still be written on a keep-alive connection
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        if (!settled) {
          settled = true;
          reject(Object.assign(new Error('payload too large'), { tooLarge: true }));
        }
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (!settled) {
        settled = true;
        resolve(Buffer.concat(chunks));
      }
    });

    req.on('error', (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
  });
}

// validates the announcement shape against Discord's embed limits, returning
// either {ok: true, embed} or {ok: false, reason}
function validateAnnouncement(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, reason: 'body must be a JSON object' };
  }

  const { title, description, url, fields, footer } = body;

  if (typeof title !== 'string' || title.length === 0) {
    return { ok: false, reason: 'title is required' };
  }
  if (title.length > EMBED_LIMITS.title) {
    return { ok: false, reason: `title exceeds ${EMBED_LIMITS.title} characters` };
  }

  if (description !== undefined) {
    if (typeof description !== 'string') {
      return { ok: false, reason: 'description must be a string' };
    }
    if (description.length > EMBED_LIMITS.description) {
      return { ok: false, reason: `description exceeds ${EMBED_LIMITS.description} characters` };
    }
  }

  if (url !== undefined) {
    if (typeof url !== 'string') {
      return { ok: false, reason: 'url must be a string' };
    }
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, reason: 'url is not a valid URL' };
    }
    if (parsed.protocol !== 'https:') {
      return { ok: false, reason: 'url must be https' };
    }
  }

  let fieldsOut;
  if (fields !== undefined) {
    if (!Array.isArray(fields)) {
      return { ok: false, reason: 'fields must be an array' };
    }
    if (fields.length > EMBED_LIMITS.maxFields) {
      return { ok: false, reason: `fields exceeds ${EMBED_LIMITS.maxFields} entries` };
    }

    fieldsOut = [];
    for (const field of fields) {
      if (typeof field !== 'object' || field === null) {
        return { ok: false, reason: 'each field must be an object' };
      }
      const { name, value, inline } = field;

      if (typeof name !== 'string' || name.length === 0) {
        return { ok: false, reason: 'field name is required' };
      }
      if (name.length > EMBED_LIMITS.fieldName) {
        return { ok: false, reason: `field name exceeds ${EMBED_LIMITS.fieldName} characters` };
      }
      if (typeof value !== 'string' || value.length === 0) {
        return { ok: false, reason: 'field value is required' };
      }
      if (value.length > EMBED_LIMITS.fieldValue) {
        return { ok: false, reason: `field value exceeds ${EMBED_LIMITS.fieldValue} characters` };
      }
      if (inline !== undefined && typeof inline !== 'boolean') {
        return { ok: false, reason: 'field inline must be a boolean' };
      }

      fieldsOut.push(inline !== undefined ? { name, value, inline } : { name, value });
    }
  }

  if (footer !== undefined) {
    if (typeof footer !== 'string') {
      return { ok: false, reason: 'footer must be a string' };
    }
    if (footer.length > EMBED_LIMITS.footer) {
      return { ok: false, reason: `footer exceeds ${EMBED_LIMITS.footer} characters` };
    }
  }

  const total = title.length
    + (description?.length ?? 0)
    + (footer?.length ?? 0)
    + (fieldsOut ?? []).reduce((sum, f) => sum + f.name.length + f.value.length, 0);
  if (total > EMBED_LIMITS.total) {
    return { ok: false, reason: `embed exceeds ${EMBED_LIMITS.total} total characters` };
  }

  const embed = { title };
  if (description !== undefined) embed.description = description;
  if (url !== undefined) embed.url = url;
  if (fieldsOut !== undefined) embed.fields = fieldsOut;
  if (footer !== undefined) embed.footer = { text: footer };

  return { ok: true, embed };
}

// factory so the HTTP handling can be exercised without a real Discord
// client: `getChannel(name)` receives the body's optional `channel` field,
// undefined for the default channel, and is async, returning the channel to
// post to (or a falsy value when one isn't available). `usageStore`, when
// given, enables PUT /folknet/usage; it needs `set(text)`
function createAnnounceServer({ token, getChannel, usageStore }) {
  return http.createServer(async (req, res) => {
    const { method } = req;
    const { pathname } = new URL(req.url, 'http://localhost');

    const respond = (status, body, contentType = 'application/json') => {
      if (body === undefined) {
        res.writeHead(status);
        res.end();
      } else {
        res.writeHead(status, { 'Content-Type': contentType });
        res.end(contentType === 'application/json' ? JSON.stringify(body) : body);
      }
      console.log(`${method} ${pathname} ${status}`);
    };

    if (method === 'GET' && pathname === '/health') {
      respond(200, 'ok', 'text/plain');
      return;
    }

    if (method === 'POST' && pathname === '/announce') {
      if (!isAuthorized(req, token)) {
        respond(401, { error: 'unauthorized' });
        return;
      }

      let raw;
      try {
        raw = await readBody(req, MAX_BODY_BYTES);
      } catch (err) {
        respond(err.tooLarge ? 413 : 400, { error: err.tooLarge ? 'payload too large' : 'could not read body' });
        return;
      }

      let body;
      try {
        body = raw.length > 0 ? JSON.parse(raw.toString('utf8')) : {};
      } catch {
        respond(400, { error: 'invalid JSON' });
        return;
      }

      const validated = validateAnnouncement(body);
      if (!validated.ok) {
        respond(400, { error: validated.reason });
        return;
      }

      const { channel: channelName } = body;
      if (channelName !== undefined
          && (typeof channelName !== 'string' || !/^[a-z0-9-]{1,32}$/.test(channelName))) {
        respond(400, { error: 'channel must be a short lowercase name' });
        return;
      }

      let channel;
      try {
        channel = await getChannel(channelName);
      } catch {
        channel = null;
      }
      if (!channel) {
        respond(503, { error: 'channel unavailable' });
        return;
      }

      try {
        const message = await channel.send({ embeds: [validated.embed] });
        respond(200, { ok: true, id: message.id });
      } catch {
        respond(502, { error: 'failed to send announcement' });
      }
      return;
    }

    if (usageStore && method === 'PUT' && pathname === '/folknet/usage') {
      if (!isAuthorized(req, token)) {
        respond(401, { error: 'unauthorized' });
        return;
      }

      let raw;
      try {
        raw = await readBody(req, MAX_BODY_BYTES);
      } catch (err) {
        respond(err.tooLarge ? 413 : 400, { error: err.tooLarge ? 'payload too large' : 'could not read body' });
        return;
      }

      let body;
      try {
        body = JSON.parse(raw.toString('utf8'));
      } catch {
        respond(400, { error: 'invalid JSON' });
        return;
      }

      const text = body?.text;
      if (typeof text !== 'string' || text.length === 0) {
        respond(400, { error: 'text is required' });
        return;
      }
      if (text.length > USAGE_MAX_CHARS) {
        respond(400, { error: `text exceeds ${USAGE_MAX_CHARS} characters` });
        return;
      }

      usageStore.set(text);
      respond(200, { ok: true });
      return;
    }

    respond(404, { error: 'not found' });
  });
}

export { createAnnounceServer, validateAnnouncement };
