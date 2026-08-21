import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  ChannelType,
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  MessageFlags,
  Partials,
  REST,
  Routes } from 'discord.js';
import 'dotenv/config';
import { addFileToRepo, getFileFromRepo, createIssue } from './github.js';
import clean from './clean.js';
import matchURLs from './matchURLs.js';
const __dirname = import.meta.dirname;

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const githubToken = process.env.GH_TOKEN;

const owner = 'ua-community';
const repo = 'ua-discord-archive';

const botId = '1356506282114158623';
const fascinatorRoleId = '1356666056201998426';
const reactionRoleMessageId = '1356979729764450555';

// string of today's date in YYYY-MM-DD format
const todayStr = () => {
  const today = new Date();
  const str = new Date(today.getTime() - (today.getTimezoneOffset() * 60000))
    .toISOString().split('T')[0];
  return str;
};

// generate short unique id
const shortId = () => crypto.randomBytes(4).toString('hex');

async function reportCrash(label, err) {
  const title = `[crash] ${label}: ${err?.message ?? String(err)}`.slice(0, 250);
  const body = [
    `**When:** ${new Date().toISOString()}`,
    `**Type:** ${label}`,
    '',
    '```',
    err?.stack ?? String(err),
    '```',
  ].join('\n');
  try {
    await createIssue(githubToken, owner, repo, title, body);
  } catch (e) {
    console.error('failed to file crash issue:', e);
  }
}

// archiving failures are per-message and can repeat, so file at most one
// issue an hour rather than one per failed message
let lastArchiveFailureReport = 0;
async function reportArchiveFailure(err) {
  const hour = 60 * 60 * 1000;
  if (Date.now() - lastArchiveFailureReport < hour) {
    return;
  }
  lastArchiveFailureReport = Date.now();
  await reportCrash('archive failure', err);
}

// merge new URLs into today's digest file, keeping what's already there.
// retries when another message updates the file between the read and the
// write, which GitHub rejects as a sha conflict.
async function addURLsToDigest(newURLs) {
  const path = `urls/${todayStr()}.txt`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const file = await getFileFromRepo(githubToken, owner, repo, path);

    // URLs already saved today
    const oldURLs = new Set(
      file.exists ? file.content.split('\n').filter(url => url.length > 0) : []
    );

    const merged = [...new Set([...oldURLs, ...newURLs])];

    // nothing new to save
    if (merged.length === oldURLs.size) {
      return;
    }

    try {
      await addFileToRepo(
        githubToken, owner, repo, path, 'new url(s)', merged.join('\n'), file.sha
      );
      return;
    } catch (err) {
      // 409/422 mean the sha we read is stale: re-read and merge again
      if (err.status !== 409 && err.status !== 422) {
        throw err;
      }
    }
  }

  throw new Error(`could not update ${path} after 3 attempts`);
}

process.on('uncaughtException', async (err) => {
  console.error('uncaughtException:', err);
  await reportCrash('uncaughtException', err);
  process.exit(1);
});

process.on('unhandledRejection', async (err) => {
  console.error('unhandledRejection:', err);
  await reportCrash('unhandledRejection', err);
  process.exit(1);
});

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.Reaction
  ],
});

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, readyClient => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.on('error', async (err) => {
  console.error('client error:', err);
  await reportCrash('discord client error', err);
});

client.on('messageCreate', async (msg) => {
  // ignore myself always
  if (msg.author.id == client.user.id) {
    return;
  }

  //console.log('messageCreate event detected:', msg);

  // if dm
  if (msg.channel.type === ChannelType.DM) {
    msg.reply('Hello! I am Phenomena, the User & Agents Archive bot. I archive messages and URLs from this server. To enable or disable archiving, go to <id:customize> for the U&A server.');
  }

  // if bot mentioned (but not via @everyone/@here)
  else if (msg.mentions.has(client.user.id) && !msg.mentions.everyone) {
    const pirateLines = [
      'Arrr! Quit rattlin\' me bones, I be busy archivin\' treasure!',
      'Shiver me timbers! What do ye want, landlubber?',
      'Yarrr, ye rang? I be knee-deep in messages, matey!',
      'Blimey! Can\'t a bot plunder URLs in peace?',
      'Avast! I be Phenomena, keeper of the digital booty!',
      'Yo ho ho! Ye summoned the wrong bot, scallywag!',
      'By Davy Jones\' locker, I be archivin\' as fast as me hooks allow!',
      'Aye aye! But I ain\'t takin\' orders from the likes of ye!',
      'Walk the plank! ...or just let me archive in peace.',
      'Ahoy! The seas be rough and the messages be many!',
    ];
    msg.reply(pirateLines[Math.floor(Math.random() * pirateLines.length)]);
  }

  // otherwise, for all messages from users with role
  else if (msg.member?.roles?.cache.has(fascinatorRoleId)) {
    //console.log('✨ msg detected, processing msg...', msg.id);

    try {
      // remove usernames
      const cleaned = clean(msg.content);

      // prepare message with metadata
      const messageData = `${cleaned}`;

      // upload msg to github
      const path = `msgs/${shortId()}.txt`;
      await addFileToRepo(githubToken, owner, repo, path, 'new msg', messageData);
      //console.log('done.');

      // detect urls and upload to github
      const newURLs = matchURLs(msg.content);

      if (newURLs.length > 0) {
        //console.log('URLs detected, processing urls...');
        await addURLsToDigest(newURLs);
        //console.log('done.');
      }
    } catch (err) {
      // a GitHub hiccup loses one message, it shouldn't take the bot down
      console.error('failed to archive message:', err);
      await reportArchiveFailure(err);
    }
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  // Rehydrate the reaction object if it was partial
  if (reaction.partial) {
    // If the message this reaction belongs to was removed, the fetching might
    // result in an API error which should be handled
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('Something went wrong when fetching the message:', error);
      // Return as `reaction.message.author` may be undefined/null
      return;
    }
  }

  if (reaction.message.id === reactionRoleMessageId
      && reaction.emoji.name === '✨')
  {
    const role = reaction.message.guild.roles.cache.get(fascinatorRoleId);
    reaction.message.guild.members.fetch(user.id).then(user => user.roles.add(role))
  }
});

client.on('messageReactionRemove', async (reaction, user) => {
  // Rehydrate the reaction object if it was partial
  if (reaction.partial) {
    // If the message this reaction belongs to was removed, the fetching might
    // result in an API error which should be handled
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('Something went wrong when fetching the message:', error);
      // Return as `reaction.message.author` may be undefined/null
      return;
    }
  }

  if (reaction.message.id === reactionRoleMessageId
      && reaction.emoji.name === '✨')
  {
    const role = reaction.message.guild.roles.cache.get(fascinatorRoleId);
    reaction.message.guild.members.fetch(user.id).then(user => user.roles.remove(role))
  }
});

// Log in to Discord with your client's token
client.login(token);

