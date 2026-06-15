# CortexPrism Slack / Discord Channel Adapter

Cortex agent as a bot in Slack and Discord channels — respond to @mentions, send notifications, push daily standup summaries, and trigger workflows directly from chat.

## Installation

```bash
cortex plugin install cortex-plugin-slack-discord
```

Or install from local development:

```bash
git clone https://github.com/CortexPrism/cortex-plugin-slack-discord.git
cd cortex-plugin-slack-discord
cortex plugin install .
```

## Setup

### Slack Setup

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Create a new app → **From scratch**
3. Add **OAuth scopes**: `chat:write`, `channels:read`, `channels:history`, `reactions:write`
4. Install to workspace and copy the **Bot User OAuth Token** (`xoxb-...`)
5. For Socket Mode (real-time events): Enable Socket Mode, copy the **App-Level Token** (`xapp-...`)

### Discord Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application → Add a bot
3. Under **Bot**, copy the token
4. Under **OAuth2 → URL Generator**, select `bot` + `Send Messages` + `Read Message History`
5. Use the generated URL to invite the bot to your server

### Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `slackBotToken` | string (secret) | — | Slack Bot User OAuth Token (`xoxb-...`) |
| `slackAppToken` | string (secret) | — | Slack App-Level Token for Socket Mode (`xapp-...`) |
| `discordBotToken` | string (secret) | — | Discord bot token from Developer Portal |
| `defaultSlackChannel` | string | — | Default Slack channel for standups and notifications |
| `defaultDiscordChannelId` | string | — | Default Discord channel ID for standups and notifications |
| `standupTime` | string | `09:00` | UTC time for daily standup (HH:MM) |

## Tools

### Slack

#### `slack_send_message`
Send a message to a Slack channel or user.

```json
{
  "channel": "#general",
  "text": "Build *v2.3.1* has been deployed :rocket:",
  "thread_ts": "1234567890.123456"
}
```

#### `slack_read_channel`
Read recent messages from a Slack channel.

```json
{
  "channel": "#engineering",
  "limit": 20
}
```

#### `slack_list_channels`
List all available channels.

```json
{ "types": "public_channel,private_channel" }
```

#### `slack_add_reaction`
Add an emoji reaction to a message.

```json
{
  "channel": "C01234567",
  "timestamp": "1234567890.123456",
  "emoji": "white_check_mark"
}
```

### Discord

#### `discord_send_message`
Send a message to a Discord channel.

```json
{
  "channel_id": "123456789012345678",
  "content": "Deploy complete. All tests passing.",
  "embeds": "[{\"title\":\"Build Status\",\"color\":65280}]"
}
```

#### `discord_read_channel`
Read recent messages from a Discord channel.

```json
{
  "channel_id": "123456789012345678",
  "limit": 50,
  "before": "123456789012345678"
}
```

### Cross-Platform

#### `send_daily_standup`
Generate and send a daily standup summary.

```json
{
  "platform": "both",
  "custom_message": "Today we shipped the auth refactor and started on the API v2 migration."
}
```

#### `webhook_listen_status`
Check the configuration status of Slack and Discord integrations.

```json
{}
```

## Usage Examples

### Daily Standup Automation

```
> Send the daily standup to both Slack and Discord

send_daily_standup → { platform: "both" }
→ Posted to #daily-standup (Slack) and #standups (Discord)
```

### PR Notifications

```
> Notify the team about a new PR

slack_send_message → {
  channel: "#engineering",
  text: "New PR for review: <https://github.com/...|Auth Service Refactor> by @alice"
}
→ Message sent with reaction :eyes:
```

## Capabilities

| Capability | Purpose |
|------------|---------|
| `network:fetch` | Slack and Discord API access for messaging and channel operations |
| `events:listener` | Real-time event handling for bot mentions and interactions |

## Development

```bash
deno task test
deno fmt && deno lint

# Test Slack
cortex plugin call cortex-plugin-slack-discord slack_list_channels '{}'

# Test Discord
cortex plugin call cortex-plugin-slack-discord discord_read_channel '{"channel_id":"123456789012345678"}'
```

## License

MIT

## Events

This plugin subscribes to the Cortex event bus for real-time processing:

| Event | Purpose |
|-------|---------|
|  | Trigger notifications when tools complete |
|  | Detect new agent sessions |
|  | Trigger cleanup on session end |
|  | Send standup summaries after agent turns |
