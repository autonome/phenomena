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
async function getFileFromRepo(auth, owner, repo, path) {
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

  // If successful, decode content
  if (res.content) {
    return atob(res.content);
  }

  return res;
}

// function to delete a file from the repo
async function deleteFileFromRepo(auth, owner, repo, path, sha) {
  // If sha is not provided, get it first
  if (!sha) {
    const fileInfo = await (await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${auth}`
        }
      }
    )).json();

    if (!fileInfo.sha) {
      throw new Error(`Could not get SHA for file: ${path}`);
    }

    sha = fileInfo.sha;
  }

  const res = await (await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: 'DELETE',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${auth}`
      },
      body: JSON.stringify({
        message: `Delete ${path}`,
        sha: sha
      })
    }
  )).json();

  return res;
}

export {
  addFileToRepo,
  getFileFromRepo,
  deleteFileFromRepo
};
