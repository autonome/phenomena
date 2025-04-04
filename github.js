async function addFileToRepo(auth, path, message, content, sha = null) {
  const owner = 'ua-community';
  const repo = 'ua-discord-archive';

  const body = {
    message: message,
    content: btoa(content),
  };

  // doing a replace
  if (sha !== null) {
    body.sha = sha;
  }

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
      body: JSON.stringify(body),
    }
  )).json();

  return res;
}

// function to get the contents of a file from the repo
async function getFileFromRepo(auth, path) {
  const owner = 'ua-community';
  const repo = 'ua-discord-archive';

  const res = await (await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${auth}`
      }
    }
  )).json();

  return res;
}

export {
  addFileToRepo,
  getFileFromRepo
};
