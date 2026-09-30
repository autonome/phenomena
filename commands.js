const STALE_AFTER_MINUTES = 30;

// answers a mention of the bot that carries a command, returning the reply
// (a string, or a message payload with an embed), or null when the message isn't a command (the caller then falls
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
  // an embed, like the announcements: smaller text than a plain reply
  return { embeds: [{ title: 'Rig usage', description: report.text, footer: { text: `as of ${age}` } }] };
}

export { handleMention };
