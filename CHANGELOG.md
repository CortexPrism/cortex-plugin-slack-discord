# Changelog — Slack / Discord Channel Adapter

## [1.0.0] — 2026-06-15

### Added
- Initial plugin scaffold: Cortex agent as a bot in Slack and Discord
- **8 tools**: `slack_send_message`, `slack_read_channel`, `slack_list_channels`, `slack_add_reaction`, `discord_send_message`, `discord_read_channel`, `send_daily_standup`, `webhook_listen_status`
- Slack API integration: chat.postMessage, conversations.history, conversations.list, reactions.add
- Discord API integration (v10): channel messaging with embed and reply support
- Cross-platform daily standup: generate and send to Slack, Discord, or both
- Slack Block Kit and Discord embed support via JSON parameters
- Thread reply support on both platforms
- Configuration status checker (`webhook_listen_status`)
- Socket Mode readiness (Slack App Token support for real-time events)

### Changed
- (v1.0.0-rc1) Refactored to use spec-compliant `ToolContext` in all execute functions
- (v1.0.0-rc1) Moved all tokens to `onLoad` lifecycle hook (closure pattern, never hardcoded)
- (v1.0.0-rc1) Fixed manifest `ui.settings` with proper `secret` types, organized in Slack/Discord/Scheduling sections
- (v1.0.0-rc1) Replaced `network:https` with valid `network:fetch` capability

### Dependencies
- Cortex >=1.0.0
- Deno v2.0+ runtime
- Slack Bot Token (xoxb-...) and optional App Token (xapp-...)
- Discord Bot Token
