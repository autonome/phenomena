const matchURLs = (str) => {
  // Captures URLs that start with either "http://" or "https://".
  // Does not support non-HTTP protocol schemes.
  // Handles URLs enclosed in parentheses by capturing both begin/end parentheses
  // for later removal.
  const expr = /\(?https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

  const res = [...str.matchAll(expr)];

  const matches = res.map(match => match[0]);

  const urls = matches.map(str => {
    // if begins and ends with parens, remove them both
    if (str.startsWith('(') && str.endsWith(')')) {
      return str.slice(1, -1);
    }
    return str;
  });
  
  return urls;
}

export default matchURLs;
