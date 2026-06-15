/**
 * CortexPrism Slack / Discord Channel Adapter Plugin
 *
 * Cortex agent as a bot in Slack and Discord channels — respond to
 * @mentions, send notifications, push daily standup summaries.
 *
 * #21 in the official plugin registry.
 */

import type { Tool, ToolContext, PluginContext, ToolCallResult } from "cortex/plugins";

// ---------------------------------------------------------------------------
// Module-level config
// ---------------------------------------------------------------------------

interface SlackDiscordConfig {
  slackBotToken: string;
  slackAppToken: string;
  discordBotToken: string;
  defaultSlackChannel: string;
  defaultDiscordChannelId: string;
  standupTime: string;
}

let config: SlackDiscordConfig = {
  slackBotToken: "",
  slackAppToken: "",
  discordBotToken: "",
  defaultSlackChannel: "",
  defaultDiscordChannelId: "",
  standupTime: "09:00",
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SLACK_API_BASE = "https://slack.com/api";
const DISCORD_API_BASE = "https://discord.com/api/v10";
const DEFAULT_TIMEOUT = 15_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSlackHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${config.slackBotToken}`,
    "Content-Type": "application/json; charset=utf-8",
    "User-Agent": "CortexPrism-SlackDiscord/1.0.0",
  };
}

function getDiscordHeaders(): HeadersInit {
  return {
    Authorization: `Bot ${config.discordBotToken}`,
    "Content-Type": "application/json",
    "User-Agent": "CortexPrism-SlackDiscord/1.0.0",
  };
}

function checkSlackToken(): string | null {
  if (!config.slackBotToken) return "Slack bot token not configured. Set slackBotToken in plugin settings.";
  return null;
}

function checkDiscordToken(): string | null {
  if (!config.discordBotToken) return "Discord bot token not configured. Set discordBotToken in plugin settings.";
  return null;
}

async function slackApi<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const tokenErr = checkSlackToken();
  if (tokenErr) throw new Error(tokenErr);

  const response = await fetch(`${SLACK_API_BASE}/${method}`, {
    method: "POST",
    headers: getSlackHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
  });

  const data = await response.json() as { ok: boolean; error?: string } & T;
  if (!data.ok) throw new Error(`Slack API error: ${data.error || "Unknown error"}`);
  return data;
}

async function discordApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const tokenErr = checkDiscordToken();
  if (tokenErr) throw new Error(tokenErr);

  const response = await fetch(`${DISCORD_API_BASE}${path}`, {
    ...options,
    headers: { ...getDiscordHeaders(), ...(options.headers as Record<string, string> || {}) },
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord API error (${response.status}): ${text}`);
  }

  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Tool: slack_send_message
// ---------------------------------------------------------------------------

const slackSendMessage: Tool = {
  definition: {
    name: "slack_send_message",
    description: "Send a message to a Slack channel or user.",
    params: [
      { name: "channel", type: "string", description: "Slack channel ID or name", required: true },
      { name: "text", type: "string", description: "Message text (supports Slack mrkdwn)", required: true },
      { name: "thread_ts", type: "string", description: "Thread timestamp to reply in a thread", required: false },
      { name: "blocks", type: "string", description: "JSON string of Slack Block Kit blocks", required: false },
    ],
    capabilities: ["network:fetch"],
  },

  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    const toolName = "slack_send_message";
    try {
      if (!args.channel || typeof args.channel !== "string") {
        return { toolName, success: false, output: "", error: "channel must be a non-empty string", durationMs: Date.now() - start };
      }
      if (!args.text || typeof args.text !== "string") {
        return { toolName, success: false, output: "", error: "text must be a non-empty string", durationMs: Date.now() - start };
      }

      const body: Record<string, unknown> = { channel: args.channel, text: args.text, mrkdwn: true };
      if (args.thread_ts) body.thread_ts = args.thread_ts;
      if (args.blocks && typeof args.blocks === "string") {
        try { body.blocks = JSON.parse(args.blocks); } catch {
          return { toolName, success: false, output: "", error: "Invalid blocks JSON", durationMs: Date.now() - start };
        }
      }

      const result = await slackApi<{ ts: string; channel: string }>("chat.postMessage", body);

      return {
        toolName, success: true,
        output: JSON.stringify({ channel: result.channel, ts: result.ts, sent: true }),
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName, success: false, output: "",
        error: `Send message failed: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool: slack_read_channel
// ---------------------------------------------------------------------------

const slackReadChannel: Tool = {
  definition: {
    name: "slack_read_channel",
    description: "Read recent messages from a Slack channel.",
    params: [
      { name: "channel", type: "string", description: "Slack channel ID or name", required: true },
      { name: "limit", type: "number", description: "Number of messages (default: 20)", required: false },
      { name: "oldest", type: "string", description: "Oldest message timestamp to include", required: false },
    ],
    capabilities: ["network:fetch"],
  },

  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    const toolName = "slack_read_channel";
    try {
      if (!args.channel || typeof args.channel !== "string") {
        return { toolName, success: false, output: "", error: "channel must be a non-empty string", durationMs: Date.now() - start };
      }

      const body: Record<string, unknown> = { channel: args.channel, limit: Math.min((args.limit as number) || 20, 100) };
      if (args.oldest) body.oldest = args.oldest;

      const result = await slackApi<{ messages: Array<Record<string, unknown>>; has_more: boolean }>("conversations.history", body);

      const messages = (result.messages || []).map((msg) => ({
        ts: msg.ts, user: msg.user || "unknown",
        text: msg.text || "", thread_ts: msg.thread_ts,
      }));

      return {
        toolName, success: true,
        output: JSON.stringify({ channel: args.channel, messages, has_more: result.has_more }),
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName, success: false, output: "",
        error: `Read channel failed: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool: slack_list_channels
// ---------------------------------------------------------------------------

const slackListChannels: Tool = {
  definition: {
    name: "slack_list_channels",
    description: "List all channels the Slack bot has access to.",
    params: [
      { name: "types", type: "string", description: "Comma-separated channel types", required: false },
    ],
    capabilities: ["network:fetch"],
  },

  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    const toolName = "slack_list_channels";
    try {
      const types = (args.types as string) || "public_channel,private_channel";

      const result = await slackApi<{ channels: Array<Record<string, unknown>> }>("conversations.list", { types, limit: 200 });

      const channels = (result.channels || []).map((ch) => ({
        id: ch.id, name: ch.name, is_private: ch.is_private,
        num_members: ch.num_members, topic: (ch.topic as { value: string })?.value || "",
      }));

      return {
        toolName, success: true,
        output: JSON.stringify({ channels }),
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName, success: false, output: "",
        error: `List channels failed: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool: slack_add_reaction
// ---------------------------------------------------------------------------

const slackAddReaction: Tool = {
  definition: {
    name: "slack_add_reaction",
    description: "Add an emoji reaction to a Slack message.",
    params: [
      { name: "channel", type: "string", description: "Slack channel ID", required: true },
      { name: "timestamp", type: "string", description: "Message timestamp", required: true },
      { name: "emoji", type: "string", description: "Emoji name without colons", required: true },
    ],
    capabilities: ["network:fetch"],
  },

  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    const toolName = "slack_add_reaction";
    try {
      if (!args.channel || !args.timestamp || !args.emoji ||
          typeof args.channel !== "string" || typeof args.timestamp !== "string" || typeof args.emoji !== "string") {
        return { toolName, success: false, output: "", error: "channel, timestamp, and emoji are required", durationMs: Date.now() - start };
      }

      await slackApi("reactions.add", { channel: args.channel, timestamp: args.timestamp, name: args.emoji });

      return {
        toolName, success: true,
        output: JSON.stringify({ channel: args.channel, timestamp: args.timestamp, reaction: args.emoji, ok: true }),
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName, success: false, output: "",
        error: `Add reaction failed: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool: discord_send_message
// ---------------------------------------------------------------------------

const discordSendMessage: Tool = {
  definition: {
    name: "discord_send_message",
    description: "Send a message to a Discord channel.",
    params: [
      { name: "channel_id", type: "string", description: "Discord channel ID (snowflake)", required: true },
      { name: "content", type: "string", description: "Message text", required: true },
      { name: "embeds", type: "string", description: "JSON string of Discord embed objects", required: false },
      { name: "reply_to", type: "string", description: "Message ID to reply to", required: false },
    ],
    capabilities: ["network:fetch"],
  },

  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    const toolName = "discord_send_message";
    try {
      if (!args.channel_id || typeof args.channel_id !== "string") {
        return { toolName, success: false, output: "", error: "channel_id must be a non-empty string", durationMs: Date.now() - start };
      }
      if (!args.content || typeof args.content !== "string") {
        return { toolName, success: false, output: "", error: "content must be a non-empty string", durationMs: Date.now() - start };
      }

      const body: Record<string, unknown> = { content: args.content };
      if (args.embeds && typeof args.embeds === "string") {
        try { body.embeds = JSON.parse(args.embeds); } catch {
          return { toolName, success: false, output: "", error: "Invalid embeds JSON", durationMs: Date.now() - start };
        }
      }
      if (args.reply_to && typeof args.reply_to === "string") {
        body.message_reference = { message_id: args.reply_to };
      }

      const result = await discordApi<{ id: string; channel_id: string }>(
        `/channels/${args.channel_id}/messages`,
        { method: "POST", body: JSON.stringify(body) },
      );

      return {
        toolName, success: true,
        output: JSON.stringify({ id: result.id, channel_id: result.channel_id, sent: true }),
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName, success: false, output: "",
        error: `Send message failed: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool: discord_read_channel
// ---------------------------------------------------------------------------

const discordReadChannel: Tool = {
  definition: {
    name: "discord_read_channel",
    description: "Read recent messages from a Discord channel.",
    params: [
      { name: "channel_id", type: "string", description: "Discord channel ID", required: true },
      { name: "limit", type: "number", description: "Number of messages (default: 50)", required: false },
      { name: "before", type: "string", description: "Get messages before this message ID", required: false },
    ],
    capabilities: ["network:fetch"],
  },

  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    const toolName = "discord_read_channel";
    try {
      if (!args.channel_id || typeof args.channel_id !== "string") {
        return { toolName, success: false, output: "", error: "channel_id must be a non-empty string", durationMs: Date.now() - start };
      }

      const limit = Math.min((args.limit as number) || 50, 100);
      let url = `/channels/${args.channel_id}/messages?limit=${limit}`;
      if (args.before && typeof args.before === "string") url += `&before=${args.before}`;

      const messages = await discordApi<Array<Record<string, unknown>>>(url);

      const parsed = messages.map((msg) => ({
        id: msg.id,
        author: (msg.author as { username: string })?.username || "unknown",
        content: msg.content || "",
        timestamp: msg.timestamp || "",
      }));

      return {
        toolName, success: true,
        output: JSON.stringify({ channel_id: args.channel_id, messages: parsed }),
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName, success: false, output: "",
        error: `Read channel failed: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool: send_daily_standup
// ---------------------------------------------------------------------------

const sendDailyStandup: Tool = {
  definition: {
    name: "send_daily_standup",
    description: "Generate and send a daily standup summary to Slack and/or Discord.",
    params: [
      { name: "platform", type: "string", description: "Platform(s) to send to", required: false, enum: ["slack", "discord", "both"] },
      { name: "slack_channel", type: "string", description: "Slack channel override", required: false },
      { name: "discord_channel_id", type: "string", description: "Discord channel override", required: false },
      { name: "custom_message", type: "string", description: "Optional custom message", required: false },
    ],
    capabilities: ["network:fetch"],
  },

  execute: async (args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    const toolName = "send_daily_standup";
    try {
      const platform = (args.platform as string) || "both";
      const today = new Date().toISOString().split("T")[0];
      const standupText = args.custom_message
        ? (args.custom_message as string)
        : `*Daily Standup — ${today}*\n\n_Automated standup from Cortex._\n\nConfigure \`send_daily_standup\` with a custom_message for updates.`;

      const results: string[] = [];

      if (platform === "slack" || platform === "both") {
        if (config.slackBotToken) {
          try {
            const slackChannel = (args.slack_channel as string) || config.defaultSlackChannel;
            if (slackChannel) {
              await slackApi("chat.postMessage", { channel: slackChannel, text: standupText, mrkdwn: true });
              results.push(`Slack: sent to ${slackChannel}`);
            } else {
              results.push("Slack: no channel configured");
            }
          } catch (err) {
            results.push(`Slack: failed — ${err instanceof Error ? err.message : String(err)}`);
          }
        } else {
          results.push("Slack: token not configured");
        }
      }

      if (platform === "discord" || platform === "both") {
        if (config.discordBotToken) {
          try {
            const discordChannel = (args.discord_channel_id as string) || config.defaultDiscordChannelId;
            if (discordChannel) {
              await discordApi(`/channels/${discordChannel}/messages`, {
                method: "POST", body: JSON.stringify({ content: standupText }),
              });
              results.push(`Discord: sent to ${discordChannel}`);
            } else {
              results.push("Discord: no channel configured");
            }
          } catch (err) {
            results.push(`Discord: failed — ${err instanceof Error ? err.message : String(err)}`);
          }
        } else {
          results.push("Discord: token not configured");
        }
      }

      return {
        toolName, success: true,
        output: JSON.stringify({ date: today, platform, results }),
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        toolName, success: false, output: "",
        error: `Standup failed: ${error instanceof Error ? error.message : String(error)}`,
        durationMs: Date.now() - start,
      };
    }
  },
};

// ---------------------------------------------------------------------------
// Tool: webhook_listen_status
// ---------------------------------------------------------------------------

const webhookListenStatus: Tool = {
  definition: {
    name: "webhook_listen_status",
    description: "Check the status of Slack/Discord configurations.",
    params: [],
    capabilities: [],
  },

  execute: async (_args: Record<string, unknown>, _ctx: ToolContext): Promise<ToolCallResult> => {
    const start = Date.now();
    const status = {
      slack: {
        configured: config.slackBotToken.length > 0,
        botTokenSet: config.slackBotToken.length > 0,
        appTokenSet: config.slackAppToken.length > 0,
        defaultChannel: config.defaultSlackChannel || "(not set)",
      },
      discord: {
        configured: config.discordBotToken.length > 0,
        botTokenSet: config.discordBotToken.length > 0,
        defaultChannel: config.defaultDiscordChannelId || "(not set)",
      },
      standup: {
        scheduledTime: config.standupTime,
        configured: (config.slackBotToken.length > 0 || config.discordBotToken.length > 0) &&
                   (config.defaultSlackChannel.length > 0 || config.defaultDiscordChannelId.length > 0),
      },
    };

    return {
      toolName: "webhook_listen_status", success: true,
      output: JSON.stringify(status),
      durationMs: Date.now() - start,
    };
  },
};

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export async function onLoad(ctx: PluginContext): Promise<void> {
  const slackBotToken = await ctx.config.get<string>("slackBotToken");
  const slackAppToken = await ctx.config.get<string>("slackAppToken");
  const discordBotToken = await ctx.config.get<string>("discordBotToken");
  const defaultSlackChannel = await ctx.config.get<string>("defaultSlackChannel");
  const defaultDiscordChannelId = await ctx.config.get<string>("defaultDiscordChannelId");
  const standupTime = await ctx.config.get<string>("standupTime");

  config = {
    slackBotToken: slackBotToken ?? "",
    slackAppToken: slackAppToken ?? "",
    discordBotToken: discordBotToken ?? "",
    defaultSlackChannel: defaultSlackChannel ?? "",
    defaultDiscordChannelId: defaultDiscordChannelId ?? "",
    standupTime: standupTime ?? "09:00",
  };

  ctx.logger.info("[cortex-plugin-slack-discord] Loaded");
  if (config.slackBotToken) ctx.logger.info("[cortex-plugin-slack-discord] Slack integration enabled");
  if (config.discordBotToken) ctx.logger.info("[cortex-plugin-slack-discord] Discord integration enabled");
}

export async function onUnload(_ctx: PluginContext): Promise<void> {}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const tools: Tool[] = [
  slackSendMessage,
  slackReadChannel,
  slackListChannels,
  slackAddReaction,
  discordSendMessage,
  discordReadChannel,
  sendDailyStandup,
  webhookListenStatus,
];
