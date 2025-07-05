# Discord bot for Userandagents.com

Phenomena is a bot for the [User & Agents](https://userandagents.com) Discord.

For users who've opted in to a specific role, the bot archives content to a Github repo:

- Archives messages to `./msgs/{msg-id}.txt`
- Archives links into daily digests in `./links/{YY-MM-DD}.txt`

The archive of messages and links:

- Currently is a private Github repo
- All usernames are replaced with `(user)`
- U&A community needs to discuss whether to make public or not

In the future the archive could:

- Be usedto send periodic digests of shared links
- Be used to train a model for a U&A aggregate brain
- Be exposed via RAG or as an MCP server etc
- Be indexed and searchable
- Be the official historical record for the birth of wondrous things

## How it works

Bot high level view
- Node.js
- Deployed to Fly.io
- [DiscordJS](https://discordjs.guide/) for all the Discord stuff
- Github API for storage
- All data stored as text files

Discord config
- Created a role called `fascinator` with an emoji of ✨
- Put a message in `#start-here` explaining how this works and what it does
- Created Discord app of `bot` type, with a slew of permissions

Github config
- Created new token under the U&A org
- Has fine-grained write permissions

Discord bot actions
- Listens to all messages
  - Detects ✨ reactions to the `#start-here` message, and assigns the user the `fascinator` role
  - Archives each message from any ✨ user, saving it to `msgs/{discordMessageId}.txt`
  - Pulls URLs from messages from any ✨ user, adding them to `urls/{YYYY-MM-DD}.txt`


## Deployment

The bot is service agnostic, should work on either service, parallelized or not.

Railway (current)
- test locally w/ remote vars: `railway run npm start`
- deploy changes: `railway up`

Fly.io (prev)
- designed to work w/ >1 instance (Fly.io's default is 2)
- deploys on new commits to main
- update manually: `fly deploy`
- turn off: `flyctl scale count 0`
- deploy after turning off: `flyctl scale count 1`
