async function upload(auth, message, content) {
  const owner = 'ua-community';
  const repo = 'ua-discord-archive';
  const path = `msgs/${Date.now()}.txt`;

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
        //sha: existingFile.sha,
      }),
    }
  )).json();

  return res;
}

export {
  upload
};
