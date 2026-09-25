import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAnnounceServer } from '../announce.js';

const TOKEN = 'test-token-abc';

function startServer({ token = TOKEN, getChannel } = {}) {
  const server = createAnnounceServer({ token, getChannel });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

function post(url, { headers = {}, body } = {}) {
  return fetch(`${url}/announce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const noChannel = async () => { throw new Error('getChannel should not be called'); };

test('GET /health returns 200 ok', async () => {
  const { server, url } = await startServer({ getChannel: noChannel });
  const res = await fetch(`${url}/health`);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'ok');
  server.close();
  server.closeAllConnections();
});

test('unknown route returns 404', async () => {
  const { server, url } = await startServer({ getChannel: noChannel });
  const res = await fetch(`${url}/nope`);
  assert.equal(res.status, 404);
  server.close();
  server.closeAllConnections();
});

test('missing Authorization header is rejected', async () => {
  const { server, url } = await startServer({ getChannel: noChannel });
  const res = await post(url, { body: { title: 'hi' } });
  assert.equal(res.status, 401);
  server.close();
  server.closeAllConnections();
});

test('wrong token is rejected', async () => {
  const { server, url } = await startServer({ getChannel: noChannel });
  const res = await post(url, {
    headers: { Authorization: 'Bearer wrong-token' },
    body: { title: 'hi' },
  });
  assert.equal(res.status, 401);
  server.close();
  server.closeAllConnections();
});

test('oversize body is rejected with 413', async () => {
  const { server, url } = await startServer({ getChannel: noChannel });
  const res = await post(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: { title: 'hi', description: 'x'.repeat(40 * 1024) },
  });
  assert.equal(res.status, 413);
  server.close();
  server.closeAllConnections();
});

test('invalid shape is rejected with 400', async () => {
  const { server, url } = await startServer({ getChannel: noChannel });
  const res = await post(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: { title: 'x'.repeat(300) },
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /title/);
  server.close();
  server.closeAllConnections();
});

test('too many fields is rejected with 400', async () => {
  const { server, url } = await startServer({ getChannel: noChannel });
  const fields = Array.from({ length: 26 }, (_, i) => ({ name: `n${i}`, value: 'v' }));
  const res = await post(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: { title: 'hi', fields },
  });
  assert.equal(res.status, 400);
  server.close();
  server.closeAllConnections();
});

test('non-https url is rejected with 400', async () => {
  const { server, url } = await startServer({ getChannel: noChannel });
  const res = await post(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: { title: 'hi', url: 'http://example.com' },
  });
  assert.equal(res.status, 400);
  server.close();
  server.closeAllConnections();
});

test('valid request sends the expected embed and returns 200', async () => {
  const sent = [];
  const fakeChannel = {
    send: async (payload) => {
      sent.push(payload);
      return { id: 'msg-123' };
    },
  };
  const { server, url } = await startServer({ getChannel: async () => fakeChannel });

  const res = await post(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: {
      title: 'hello',
      description: 'world',
      footer: 'from the pipeline',
      fields: [{ name: 'a', value: 'b', inline: true }],
    },
  });

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, id: 'msg-123' });
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0], {
    embeds: [{
      title: 'hello',
      description: 'world',
      fields: [{ name: 'a', value: 'b', inline: true }],
      footer: { text: 'from the pipeline' },
    }],
  });
  server.close();
  server.closeAllConnections();
});

test('channel unavailable returns 503', async () => {
  const { server, url } = await startServer({ getChannel: async () => null });
  const res = await post(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: { title: 'hi' },
  });
  assert.equal(res.status, 503);
  server.close();
  server.closeAllConnections();
});

test('send failure returns 502', async () => {
  const fakeChannel = { send: async () => { throw new Error('discord is down'); } };
  const { server, url } = await startServer({ getChannel: async () => fakeChannel });
  const res = await post(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: { title: 'hi' },
  });
  assert.equal(res.status, 502);
  server.close();
  server.closeAllConnections();
});

test('valid request with a named channel calls getChannel with that name', async () => {
  const sent = [];
  const requestedNames = [];
  const fakeChannel = {
    send: async (payload) => {
      sent.push(payload);
      return { id: 'msg-123' };
    },
  };
  const { server, url } = await startServer({
    getChannel: async (name) => {
      requestedNames.push(name);
      return fakeChannel;
    },
  });

  const res = await post(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: { title: 'hi', channel: 'folknet' },
  });

  assert.equal(res.status, 200);
  assert.equal(sent.length, 1);
  assert.deepEqual(requestedNames, ['folknet']);
  server.close();
  server.closeAllConnections();
});

test('valid request without a channel calls getChannel with undefined', async () => {
  const fakeChannel = { send: async () => ({ id: 'msg-123' }) };
  const requestedNames = [];
  const { server, url } = await startServer({
    getChannel: async (name) => {
      requestedNames.push(name);
      return fakeChannel;
    },
  });

  const res = await post(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: { title: 'hi' },
  });

  assert.equal(res.status, 200);
  assert.deepEqual(requestedNames, [undefined]);
  server.close();
  server.closeAllConnections();
});

test('invalid channel name is rejected with 400 without calling getChannel', async () => {
  const { server, url } = await startServer({ getChannel: noChannel });
  const res = await post(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: { title: 'hi', channel: 'Bad Name!' },
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.match(data.error, /channel/);
  server.close();
  server.closeAllConnections();
});
