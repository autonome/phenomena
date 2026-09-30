# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Phenomena is a Discord bot that archives messages from opted-in users (with "fascinator" role) to a private GitHub repository for the User & Agents community.

## Commands

### Development
```bash
npm install          # Install dependencies
npm run debug        # Run with nodemon for development
npm start           # Run in production mode
```

### Deployment
Runs on Railway, built from the `Dockerfile`. The service is linked to this
directory in the Railway CLI config, and normally redeploys from a push to the
`railway` branch on GitHub; `railway up` deploys the working directory instead.
```bash
railway up          # Deploy the working directory
railway logs        # View production logs
railway run -- CMD  # Run CMD locally with the service's env vars
```
`fly.toml` and `.github/workflows/fly-deploy.yml` are leftovers from the
earlier Fly.io deployment and are not used.

## Architecture

The bot uses GitHub as a database, storing Discord content as text files:
- Messages: `msgs/{message-id}.txt` 
- Daily URL digests: `urls/{YYYY-MM-DD}.txt`

Key modules:
- **index.js**: Discord event handlers, message archiving logic
- **github.js**: GitHub API wrapper for file operations
- **clean.js**: Privacy utilities for removing usernames
- **matchURLs.js**: URL extraction from messages

## Environment Variables

Required in `.env`:
- `DISCORD_TOKEN`: Bot authentication
- `DISCORD_CLIENT_ID`: Discord application ID
- `DISCORD_GUILD_ID`: Target Discord server
- `GH_TOKEN`: GitHub personal access token with repo write permissions

## Important Notes

- The bot only archives messages from users with the "fascinator" role (✨ emoji)
- Usernames are replaced with "(user)" for privacy
- Archive repository: `ua-community/ua-discord-archive` (private)
- Users self-assign the "fascinator" role by reacting ✨ to the reaction-role message (`index.js` `messageReactionAdd` / `messageReactionRemove`, gated on `reactionRoleMessageId`)
- Uses ES modules - ensure `"type": "module"` in package.json