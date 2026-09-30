// holds the latest rig usage summary in memory, since Phenomena can't reach
// the rig and the summary is pushed to it. A restart forgets the report.
function createUsageStore() {
  let latest = null;

  return {
    set(text) {
      latest = { text, at: Date.now() };
    },
    get() {
      return latest;
    },
  };
}

export { createUsageStore };
