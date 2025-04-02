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
const __dirname = import.meta.dirname;

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

const fascinatorRoleId = '1356666056201998426';
const reactionRoleMessageId = '1356979729764450555';

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

const commands = new Collection();
client.commands = commands;

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);

    const command = (await import(filePath)).default;

    if (command.data.name != 'ping') {
      break;
    }

    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
  }
}

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);
  //console.log('Interaction received', interaction.commandName, command);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
    }
  }
});

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// and deploy your commands!
(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: Array.from(commands.values()).map(command => command.data.toJSON()) },
    );

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
    console.log(error.rawError.errors[0].name._errors);
  }
})();

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, readyClient => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

/*
const events = [
  'applicationCommandPermissionsUpdate',
  'autoModerationActionExecution',
  'autoModerationRuleCreate',
  'autoModerationRuleDelete',
  'autoModerationRuleUpdate',
  'channelCreate',
  'channelDelete',
  'channelPinsUpdate',
  'channelUpdate',
  'debug',
  'emojiCreate',
  'emojiDelete',
  'emojiUpdate',
  'entitlementCreate',
  'entitlementDelete',
  'entitlementUpdate',
  'error',
  'guildAuditLogEntryCreate',
  'guildAvailable',
  'guildBanAdd',
  'guildBanRemove',
  'guildCreate',
  'guildDelete',
  'guildIntegrationsUpdate',
  'guildMemberAdd',
  'guildMemberAvailable',
  'guildMemberRemove',
  'guildMembersChunk',
  'guildMemberUpdate',
  'guildScheduledEventCreate',
  'guildScheduledEventDelete',
  'guildScheduledEventUpdate',
  'guildScheduledEventUserAdd',
  'guildScheduledEventUserRemove',
  'guildUnavailable',
  'guildUpdate',
  'interactionCreate',
  'inviteCreate',
  'inviteDelete',
  'messageCreate',
  'messageDelete',
  'messageDeleteBulk',
  'messagePollVoteAdd',
  'messagePollVoteRemove',
  'messageReactionAdd',
  'messageReactionRemove',
  'messageReactionRemoveAll',
  'messageReactionRemoveEmoji',
  'messageUpdate',
  'presenceUpdate',
  'ready',
  'roleCreate',
  'roleDelete',
  'roleUpdate',
  'shardDisconnect',
  'shardError',
  'shardReady',
  'shardReconnecting',
  'shardResume',
  'stageInstanceCreate',
  'stageInstanceDelete',
  'stageInstanceUpdate',
  'stickerCreate',
  'stickerDelete',
  'stickerUpdate',
  'subscriptionCreate',
  'subscriptionDelete',
  'subscriptionUpdate',
  'threadCreate',
  'threadDelete',
  'threadListSync',
  'threadMembersUpdate',
  'threadMemberUpdate',
  'threadUpdate',
  'typingStart',
  'userUpdate',
  'voiceChannelEffectSend',
  'voiceStateUpdate',
  'warn',
  'webhooksUpdate',
  'webhookUpdate',
];

for (const event of events) {
  client.on(event, (...args) => console.log(...args));
}
*/

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
  if (msg.member.roles.cache.has(fascinatorRoleId)) {
    console.log('Fascinator detected, do something fun...');
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
