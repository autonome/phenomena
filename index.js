import fs from 'node:fs';
import path from 'node:path';
import {
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

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, readyClient => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

/*
Message {
  channelId: '1352159794559189112',
  guildId: '1309454711392305192',
  id: '1356649632549306562',
  createdTimestamp: 1743520877731,
  type: 0,
  system: false,
  content: 'test',
  author: User {
    id: '364757227833131011',
    bot: false,
    system: false,
    flags: UserFlagsBitField { bitfield: 0 },
    username: 'dietrich1',
    globalName: 'dietrich (UTC+1)',
    discriminator: '0',
    avatar: '3504189c77bfb50325ca8c70f36b4413',
    banner: undefined,
    accentColor: undefined,
    avatarDecoration: null,
    avatarDecorationData: null
  },
  pinned: false,
  tts: false,
  nonce: '1356649631051677696',
  embeds: [],
  components: [],
  attachments: Collection(0) [Map] {},
  stickers: Collection(0) [Map] {},
  position: null,
  roleSubscriptionData: null,
  resolved: null,
  editedTimestamp: null,
  reactions: ReactionManager { message: [Circular *1] },
  mentions: MessageMentions {
    everyone: false,
    users: Collection(0) [Map] {},
    roles: Collection(0) [Map] {},
    _members: null,
    _channels: null,
    _parsedUsers: null,
    crosspostedChannels: Collection(0) [Map] {},
    repliedUser: null
  },
  webhookId: null,
  groupActivityApplication: null,
  applicationId: null,
  activity: null,
  flags: MessageFlagsBitField { bitfield: 0 },
  reference: null,
  interactionMetadata: null,
  interaction: null,
  poll: null,
  messageSnapshots: Collection(0) [Map] {},
  call: null
}
*/
client.on('messageCreate', async (msg) => {
  // for all messages from users with role
  if (msg.member.roles.cache.has(fascinatorRoleId)) {
    console.log('✨ msg detected, processing msg...', msg.id);

    // remove usernames
    const cleaned = clean(msg.content);

    // upload msg to github
    const path = `msgs/${msg.id}.txt`;
    await addFileToRepo(githubToken, path, 'new msg', cleaned);
    console.log('done.');

    // detect urls and upload to github
    const newURLs = matchURLs(msg.content);

    if (newURLs.length > 0) {
      console.log('URLs detected, processing urls...');

      // path for today's link file
      const path = `urls/${todayStr()}.txt`;

      // get sha if file for today exists
      const file = await getFileFromRepo(githubToken, path);
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
        await addFileToRepo(githubToken, path, 'new url(s)', content, sha);
      }

      console.log('done.');
    }
  }

  /*
  // for testing: reply to messages directly addressing the bot
  if (msg.content.startsWith(`<@${client.user.id}>`)) {
    await msg.reply('WHAT?!');
  }
  */
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

/*
import http from 'http';
const hostname = '0.0.0.0';
const port = 3000;

http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.write("Hello, world!");
    res.end();
}).listen(port, hostname, () => {
    console.log(`App is running on port ${port}`);
});
*/
