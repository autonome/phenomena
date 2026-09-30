const STALE_AFTER_MINUTES = 30;

// answers a mention of the bot that carries a command, returning the reply
// string, or null when the message isn't a command (the caller then falls
// back to its default reply)
function handleMention(content, botId, { usageStore, now = Date.now() } = {}) {
  const words = content
    .replaceAll(`<@${botId}>`, ' ')
    .replaceAll(`<@!${botId}>`, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words[0]?.toLowerCase() !== 'folknet') {
    return null;
  }

  if (words[1]?.toLowerCase() !== 'usage') {
    return 'folknet commands: usage';
  }

  const report = usageStore?.get();
  if (!report) {
    return 'No usage reported yet.';
  }

  const minutes = Math.floor((now - report.at) / 60000);
  let age = minutes < 1 ? 'just now' : `${minutes} min ago`;
  if (minutes > STALE_AFTER_MINUTES) {
    age += ' (stale: the rig has not reported since)';
  }
  return `${report.text}\nas of ${age}`;
}

export { handleMention };
