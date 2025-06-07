import 'dotenv/config';
import { addFileToRepo, getFileFromRepo } from './github.js';
import clean from './clean.js';
import fs from 'fs/promises';
import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  MessageFlags,
  Partials,
  REST,
  Routes } from 'discord.js';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const githubToken = process.env.GH_TOKEN;

const owner = 'ua-community';
const repo = 'ua-discord-archive';

// set of user ids
const userIds = [
];

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

// Login to Discord
await client.login(token);

// Cache for guild and channels
let cachedGuild = null;
let cachedChannels = null;

// Get user ID for a given message ID using Discord API
async function getUserIdForMessage(messageId) {
  //try {
    // Get the guild (use cache if available)
    if (!cachedGuild) {
      console.log(`Fetching guild ${guildId} from server...`);
      cachedGuild = await client.guilds.fetch(guildId);
      if (!cachedGuild) {
        console.log(`Guild ${guildId} not found`);
        return null;
      }
    }
    
    // Get all text channels in the guild (use cache if available)
    if (!cachedChannels) {
      console.log(`Fetching channels for guild ${guildId}...`);
      cachedChannels = cachedGuild.channels.cache.filter(channel => channel.isTextBased());
    }
    
    // Search for the message in each channel
    for (const channel of cachedChannels.values()) {
      try {
        const message = await channel.messages.fetch(messageId);
        if (message) {
          console.log(`Found message ${messageId} by ${message.author.id} in channel ${channel.name}`);
          return message.author.id;
        }
        else {
          //console.log(`Message ${messageId} not found in channel ${channel.name}`);
        }
      } catch (error) {
        // Message not found in this channel, continue to next
        //console.log(`Error fetching message ${messageId} in channel ${channel.name}:`, error.message);
        //continue;
      }
    }
    
    //console.log(`Message ${messageId} not found in any channel`);
    return null;
  /*
  } catch (error) {
    console.error(`Error getting user ID for message ${messageId}:`, error.message);
    return null;
  }
  */
}

// Get all filenames from the 'msgs' folder in the repo using Trees API
async function getAllMessageFilenames() {
  try {
    // First, get the default branch to find the latest commit SHA
    const repoResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${githubToken}`
        }
      }
    );
    
    if (!repoResponse.ok) {
      throw new Error(`GitHub API error: ${repoResponse.status} ${repoResponse.statusText}`);
    }
    
    const repoData = await repoResponse.json();
    const defaultBranch = repoData.default_branch;
    
    // Get the latest commit SHA for the default branch
    const branchResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/branches/${defaultBranch}`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${githubToken}`
        }
      }
    );
    
    if (!branchResponse.ok) {
      throw new Error(`GitHub API error: ${branchResponse.status} ${branchResponse.statusText}`);
    }
    
    const branchData = await branchResponse.json();
    const treeSha = branchData.commit.sha;
    
    // Get the tree with recursive flag to get all files
    const treeResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${githubToken}`
        }
      }
    );
    
    if (!treeResponse.ok) {
      throw new Error(`GitHub API error: ${treeResponse.status} ${treeResponse.statusText}`);
    }
    
    const treeData = await treeResponse.json();
    
    // Filter for files in the msgs folder
    const filenames = treeData.tree
      .filter(item => 
        item.type === 'blob' && 
        item.path.startsWith('msgs/') && 
        item.path.endsWith('.txt')
      )
      .map(item => item.path.replace('msgs/', ''));
    
    return filenames;
  } catch (error) {
    console.error('Error getting message filenames:', error.message);
    return [];
  }
}

// iterate over messages
async function findMsgsFromUsers(userIds) {
  const outputPath = './message-authors.json';
  
  // Check if file exists
  try {
    await fs.access(outputPath);
    console.log('Reading existing message-authors.json file...');
    const fileContent = await fs.readFile(outputPath, 'utf8');
    const allMessages = JSON.parse(fileContent);
    
    // Filter messages from the specified userIds
    const results = allMessages.filter(msg => userIds.includes(msg.userId));
    console.log(`Found ${results.length} messages from specified users in existing file`);
    
    return results;
  } catch (error) {
    // File doesn't exist, fetch from API
    console.log('File not found, fetching from Discord API...');
  }
  
  // Fetch from API if file doesn't exist
  const filenames = await getAllMessageFilenames();
  console.log(`Found ${filenames.length} message files in the repo`);
  
  const results = [];
  
  // Process only first 10 messages for testing
  const limit = 2000;
  const filesToProcess = filenames.slice(0, limit);
  
  console.log(`Processing ${filesToProcess.length} message files...`);
  for (let i = 0; i < filesToProcess.length; i++) {
    const filename = filesToProcess[i];
    const messageId = filename.replace('.txt', '');
    const userId = await getUserIdForMessage(messageId);
    if (userId && userIds.includes(userId)) {
      console.log(`Found message ${messageId} from user ${userId} (in userIds list)`);
      results.push({
        messageId: messageId,
        userId: userId
      });
    }
    /*
    else if (userId && !userIds.includes(userId)) {
      //console.log(`Skipping message ${messageId} from user ${userId} (not in userIds list)`);
    } else {
      //console.log(`Skipping message ${messageId}, user not found`);
    }
    */
    
    console.log(`Progress: ${i + 1}/${filesToProcess.length} messages processed`);
  }
  
  // Write only messages from specified userIds to file
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
  console.log(`Wrote ${results.length} message records from specified users to ${outputPath}`);
  console.log(`Found ${results.length} messages from specified users`);
  
  return results;
}

client.once(Events.ClientReady, async readyClient => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);

  //
  console.log('Searching for messages from users:', userIds);
  const results = await findMsgsFromUsers(userIds);
  console.log('Results:', results);
  console.log(`Total messages found: ${results.length}`);
  //

  /*
  //1357781019599569066
  // actual user id: 106036643932155904
  const msgId = '1375541870922567745';
  const userId = await getUserIdForMessage(msgId);
  console.log(`User ID for message ${msgId}:`, userId);
  */
  process.exit(0);
});

console.log('done.');
