import assert from 'node:assert';
import { addFileToRepo, getFileFromRepo } from '../github.js';

const calls = [];
let responder;
globalThis.fetch = async (url, init) => {
  calls.push({ url, init });
  return responder(url, init, calls.length);
};

const res = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => body,
});

// 1. empty body on a 200 (the crash in issue #1) is retried, not thrown at JSON.parse
responder = (url, init, n) => n === 1 ? res(200, '') : res(200, JSON.stringify({ content: { sha: 'abc' } }));
calls.length = 0;
const put = await addFileToRepo('t', 'o', 'r', 'msgs/x.txt', 'new msg', 'hello');
assert.strictEqual(calls.length, 2, 'empty body should be retried');
assert.strictEqual(put.content.sha, 'abc');

// 2. persistent empty body surfaces a descriptive error instead of a JSON SyntaxError
responder = () => res(200, '');
calls.length = 0;
await assert.rejects(
  () => addFileToRepo('t', 'o', 'r', 'msgs/x.txt', 'new msg', 'hello'),
  err => {
    assert.match(err.message, /empty body/);
    assert.strictEqual(calls.length, 3);
    return true;
  }
);

// 3. getFileFromRepo returns sha AND content (the digest bug: it used to
//    return a bare string, so `file.sha` was undefined and every write
//    to today's file was rejected for a missing sha)
responder = () => res(200, JSON.stringify({
  sha: 'deadbeef',
  content: Buffer.from('https://a.example\nhttps://b.example', 'utf-8').toString('base64'),
}));
const file = await getFileFromRepo('t', 'o', 'r', 'urls/2026-08-21.txt');
assert.deepStrictEqual(file, {
  exists: true,
  sha: 'deadbeef',
  content: 'https://a.example\nhttps://b.example',
});

// 4. missing file reports as missing rather than as an error object
responder = () => res(404, JSON.stringify({ message: 'Not Found' }));
assert.deepStrictEqual(
  await getFileFromRepo('t', 'o', 'r', 'urls/nope.txt'),
  { exists: false, sha: null, content: null }
);

// 5. a stale-sha rejection carries its status so the caller can re-read and
//    retry, and is NOT retried in place (the sha would still be stale)
responder = () => res(409, JSON.stringify({ message: 'is at 1234 but expected 5678' }));
calls.length = 0;
await assert.rejects(
  () => addFileToRepo('t', 'o', 'r', 'urls/x.txt', 'new url(s)', 'a', 'oldsha'),
  err => err.status === 409
);
assert.strictEqual(calls.length, 1, 'a replace must not be retried with the same sha');

// 5b. creating a new file IS retried through a branch-head 409
responder = (url, init, n) =>
  n < 3 ? res(409, JSON.stringify({ message: 'is at 1234 but expected 5678' }))
        : res(201, JSON.stringify({ content: { sha: 'new' } }));
calls.length = 0;
const created = await addFileToRepo('t', 'o', 'r', 'msgs/y.txt', 'new msg', 'hi');
assert.strictEqual(calls.length, 3, 'a create should retry through 409');
assert.strictEqual(created.content.sha, 'new');

// 5c. a create that keeps hitting 409 gives up and reports it
responder = () => res(409, JSON.stringify({ message: 'is at 1234 but expected 5678' }));
calls.length = 0;
await assert.rejects(
  () => addFileToRepo('t', 'o', 'r', 'msgs/z.txt', 'new msg', 'hi'),
  err => err.status === 409
);
assert.strictEqual(calls.length, 3, 'a create should stop after 3 attempts');

// 6. utf-8 content round-trips (atob used to mangle non-ascii)
responder = () => res(200, JSON.stringify({
  sha: 's', content: Buffer.from('✨ héllo', 'utf-8').toString('base64'),
}));
assert.strictEqual((await getFileFromRepo('t', 'o', 'r', 'p')).content, '✨ héllo');

console.log('all github.js checks passed');
