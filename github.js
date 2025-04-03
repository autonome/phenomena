async function addFileToRepo(auth, path, message, content) {
  const owner = 'ua-community';
  const repo = 'ua-discord-archive';

  /*
  // we could pay a round-trip penalty here, in case another process already
  // wrote to this path... but why? see below.
  const existingFile = await (await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${auth}`
      }
    }
  )).json();
  */

  // if file exists at path already, this fails w/ "Invalid request"
  // so consider this a one-round-trip penalty for not adding
  // a proper queuing system 😜
  const res = await (await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${auth}`
      },
      body: JSON.stringify({
        message: message,
        content: btoa(content),
      }),
    }
  )).json();

  return res;
}

export {
  addFileToRepo
};
