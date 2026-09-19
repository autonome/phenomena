const apiBase = 'https://api.github.com';

// GitHub sometimes answers with an empty body (5xx, dropped connection,
// rate limiting), which turns a bare res.json() into
// "Unexpected end of JSON input". Parse defensively, retry transient
// failures, and hand callers back a plain {ok, status, data}.
async function request(auth, url, init = {}, retries = 2) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
    }

    let res;
    let text;

    try {
      res = await fetch(url, {
        ...init,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${auth}`,
        },
      });
      text = await res.text();
    } catch (err) {
      lastError = err;
      continue;
    }

    let data = null;
    if (text.length > 0) {
      try {
        data = JSON.parse(text);
      } catch (err) {
        lastError = new Error(
          `GitHub ${init.method ?? 'GET'} ${url} returned ${res.status} with an unparseable body`
        );
        continue;
      }
    }

    // transient: server errors, rate limiting, or a success with no payload
    if (res.status >= 500 || res.status === 429 || (res.ok && data === null)) {
      lastError = new Error(
        `GitHub ${init.method ?? 'GET'} ${url} returned ${res.status} with an empty body`
      );
      continue;
    }

    return { ok: res.ok, status: res.status, data };
  }

  throw lastError;
}

function requestFailed(method, path, status, data) {
  const err = new Error(`GitHub ${method} ${path} failed: ${status} ${data?.message ?? ''}`.trim());
  err.status = status;
  return err;
}

async function addFileToRepo(auth, owner, repo, path, message, content, sha = null) {

  // encode utf-8 content to base64
  const encodedContent = Buffer.from(content, 'utf-8').toString('base64');

  const body = {
    message: message,
    content: encodedContent
  };

  // doing a replace
  if (sha !== null) {
    body.sha = sha;
  }

  // GitHub answers 409 when the branch head moved while the write was in
  // flight, which happens whenever two writes land close together. creating a
  // new file can simply be retried; replacing one can't, because the caller
  // has to re-read the file's sha and merge again before trying.
  // the 409 status is the signal to retry on — the delay only spaces out
  // attempts against the remote API, which is the only place this ordering
  // can be resolved.
  const creating = sha === null;
  const attempts = creating ? 3 : 1;

  let result;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, 400 * 2 ** (attempt - 1)));
    }

    result = await request(
      auth,
      `${apiBase}/repos/${owner}/${repo}/contents/${path}`,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      }
    );

    if (result.ok || result.status !== 409) {
      break;
    }
  }

  if (!result.ok) {
    throw requestFailed('PUT', path, result.status, result.data);
  }

  return result.data;
}

// function to get the contents of a file from the repo.
// always returns {exists, sha, content} so callers can tell an existing
// file (and its sha, needed to replace it) from a missing one.
async function getFileFromRepo(auth, owner, repo, path) {
  const { ok, status, data } = await request(
    auth,
    `${apiBase}/repos/${owner}/${repo}/contents/${path}`,
    { method: 'GET' }
  );

  if (status === 404) {
    return { exists: false, sha: null, content: null };
  }

  if (!ok) {
    throw requestFailed('GET', path, status, data);
  }

  return {
    exists: true,
    sha: data.sha,
    content: data.content ? Buffer.from(data.content, 'base64').toString('utf-8') : '',
  };
}

// function to delete a file from the repo
async function deleteFileFromRepo(auth, owner, repo, path, sha) {
  // If sha is not provided, get it first
  if (!sha) {
    const file = await getFileFromRepo(auth, owner, repo, path);

    if (!file.sha) {
      throw new Error(`Could not get SHA for file: ${path}`);
    }

    sha = file.sha;
  }

  const { ok, status, data } = await request(
    auth,
    `${apiBase}/repos/${owner}/${repo}/contents/${path}`,
    {
      method: 'DELETE',
      body: JSON.stringify({
        message: `Delete ${path}`,
        sha: sha
      })
    }
  );

  if (!ok) {
    throw requestFailed('DELETE', path, status, data);
  }

  return data;
}

async function createIssue(auth, owner, repo, title, body) {
  const { ok, status, data } = await request(
    auth,
    `${apiBase}/repos/${owner}/${repo}/issues`,
    {
      method: 'POST',
      body: JSON.stringify({ title, body })
    }
  );

  if (!ok) {
    throw requestFailed('POST', 'issues', status, data);
  }

  return data;
}

export {
  addFileToRepo,
  getFileFromRepo,
  deleteFileFromRepo,
  createIssue
};
