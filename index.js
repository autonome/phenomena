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
import { addFileToRepo, getFileFromRepo } from './github.js';
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

client.on('messageCreate', async (msg) => {
  // ignore myself always
  if (msg.author.id == client.user.id) {
    return;
  }

  //console.log('messageCreate event detected:', msg);

  // if dm or bot mentioned
  if (msg.channel.type === ChannelType.DM || msg.mentions.has(client.user.id)) {
    //console.log('💬 dm detected:', msg.id);
    msg.reply('Hello! I am Phenomena, the User & Agents Archive bot. I archive messages and URLs from this server. To enable or disable archiving, go to <id:customize> for the U&A server.');
  }

  // otherwise, for all messages from users with role
  else if (msg.member.roles && msg.member.roles.cache.has(fascinatorRoleId)) {
    //console.log('✨ msg detected, processing msg...', msg.id);

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

      // path for today's link file
      const path = `urls/${todayStr()}.txt`;

      // get sha if file for today exists
      const file = await getFileFromRepo(githubToken, owner, repo, path);
      const sha = file.hasOwnProperty('sha') ? file.sha : null;

      // get URLs already saved today
      const oldURLs = [];
      if (sha) {
        const response = await fetch(file.download_url);
        const txt = await response.text();
        oldURLs.push(...txt.split('\n'));
      }

      // check if there's a delta or not
      const setsAreEqual = (a, b) => a.size === b.size && [...a].every(value => b.has(value));
      const uniqueNew = new Set(newURLs);
      const uniqueOld = new Set(oldURLs);

      // if the new urls are already saved, do nothing
      // otherwise merge the new and old urls
      // and upload, replacing the old file
      if (!setsAreEqual(uniqueNew, uniqueOld)) {
        const uniqueMerged = [...new Set([...uniqueNew, ...uniqueOld])];
        const content = uniqueMerged.join('\n');
        await addFileToRepo(githubToken, owner, repo, path, 'new url(s)', content, sha);
      }

      //console.log('done.');
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

