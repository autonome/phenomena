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

## Announcements

Lets an external build pipeline post one announcement to a fixed channel, since nothing outside Discord can otherwise make the bot post.

Set `ANNOUNCE_TOKEN` to enable the HTTP server (it's off if unset). Env vars:

- `ANNOUNCE_TOKEN` - bearer token required on `POST /announce`
- `NEV_CHANNEL_ID` - id of the channel announcements are posted to
- `PORT` - port to listen on (defaults to 3000)

`GET /health` returns `200 ok`.

`POST /announce` requires `Authorization: Bearer $ANNOUNCE_TOKEN` and a JSON body (max 32 KB):

```json
{
  "title": "string, required, up to 256 characters",
  "description": "string, optional, up to 4096 characters",
  "url": "https url, optional",
  "fields": [{ "name": "string, up to 256 chars", "value": "string, up to 1024 chars", "inline": false }],
  "footer": "string, optional, up to 2048 characters",
  "channel": "optional short lowercase name, e.g. \"folknet\"; posts to <NAME>_CHANNEL_ID instead of NEV_CHANNEL_ID"
}
```

At most 25 fields, and the embed's total character count can't exceed 6000. Invalid input gets a `400` with a short reason. A successful post returns `200 { "ok": true, "id": "<message id>" }`.

`PUT /folknet/usage` (same bearer token) takes `{"text": "<1 to 1800 characters>"}` and keeps it in memory in `usage.js`; `commands.js` answers `@phenomena folknet usage` with that text and its age (marked stale after 30 minutes), or `No usage reported yet.` after a restart.

```sh
curl -X POST "$ANNOUNCE_URL/announce" \
  -H "Authorization: Bearer $ANNOUNCE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "New build", "description": "Details here", "url": "https://example.com/build/123"}'
```
