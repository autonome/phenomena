export default (text) => {
  // remove all usernames of format '<@1356506282114158623>'
  text = text.replace(/<@(\d+)>/g, '(user)');
  return text;
}
