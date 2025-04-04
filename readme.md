# Discord bot for Userandagents.com

Phenomena is a bot for the [User & Agents](https://userandagents.com) Discord.

Currently it:
- Archives messages from users who've opted-in
- Archives links from users who've opted in

In the future it will:
- Send digests of shared links
- What else?

The archive of messages and links:
- Currently is a private Github repo
- Community needs to discuss whether to make public or not

In the future the archive could:
- Be used to train a model for a U&A aggregate brain
- Be exposed via RAG or as an MCP server etc
- Be indexed and searchable
- Be the official historical record for the birth of wondrous things

## How it works

Bot high level view
- Node.js
- Deployed to Fly.io
- [DiscordJS](https://discordjs.guide/) for all the Discord stuff
- Github API for archiving

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
