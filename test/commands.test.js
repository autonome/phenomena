import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleMention } from '../commands.js';
import { createUsageStore } from '../usage.js';

const BOT = '123';
const MIN = 60 * 1000;

function storeAt(text, at) {
  return { get: () => ({ text, at }), set() {} };
}

test('non-folknet mention returns null', () => {
  const usageStore = createUsageStore();
  assert.equal(handleMention(`<@${BOT}> hello there`, BOT, { usageStore }), null);
  assert.equal(handleMention(`<@${BOT}>`, BOT, { usageStore }), null);
});

test('usage with nothing stored', () => {
  const usageStore = createUsageStore();
  assert.equal(handleMention(`<@${BOT}> folknet usage`, BOT, { usageStore }), 'No usage reported yet.');
});

function usageCard(text, footer) {
  return { embeds: [{ title: 'Rig usage', description: text, footer: { text: footer } }] };
}

test('usage with a fresh report is a card', () => {
  const now = 1_000_000_000;
  const usageStore = storeAt('cpu 40%', now - 5 * MIN);
  assert.deepEqual(
    handleMention(`<@${BOT}> folknet usage`, BOT, { usageStore, now }),
    usageCard('cpu 40%', 'as of 5 min ago'),
  );
});

test('usage reported under a minute ago says just now', () => {
  const now = 1_000_000_000;
  const usageStore = storeAt('cpu 40%', now - 10 * 1000);
  assert.deepEqual(
    handleMention(`<@${BOT}> folknet usage`, BOT, { usageStore, now }),
    usageCard('cpu 40%', 'as of just now'),
  );
});

test('usage with a stale report is marked', () => {
  const now = 1_000_000_000;
  const usageStore = storeAt('cpu 40%', now - 45 * MIN);
  assert.deepEqual(
    handleMention(`<@${BOT}> folknet usage`, BOT, { usageStore, now }),
    usageCard('cpu 40%', 'as of 45 min ago (stale: the rig has not reported since)'),
  );
});

test('folknet with no or an unknown subcommand lists the commands', () => {
  const usageStore = createUsageStore();
  assert.equal(handleMention(`<@${BOT}> folknet`, BOT, { usageStore }), 'folknet commands: usage');
  assert.equal(handleMention(`<@${BOT}> folknet nope`, BOT, { usageStore }), 'folknet commands: usage');
});

test('both mention forms and any case are accepted', () => {
  const usageStore = createUsageStore();
  assert.equal(handleMention(`<@!${BOT}> FolkNet Usage`, BOT, { usageStore }), 'No usage reported yet.');
  assert.equal(handleMention(`folknet usage <@${BOT}>`, BOT, { usageStore }), 'No usage reported yet.');
});
