import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { tools } from '../../mod.ts';
import type { PluginContext, ToolContext } from '../../types.ts';

// Mock PluginContext
const mockContext: PluginContext & ToolContext = {
  pluginId: 'cortex-plugin-slack-discord',
  pluginDir: '/tmp/plugins/cortex-plugin-slack-discord',
  state: {
    get: async () => null,
    set: async () => {},
    delete: async () => {},
    list: async () => ({}),
  },
  config: {
    get: async () => null,
    set: async () => {},
    getAll: async () => ({}),
  },
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  },
  host: {
    registerTool: () => {},
    unregisterTool: () => {},
  },
  sessionId: 'test-session',
  workingDir: '/tmp',
  agentId: 'test-agent',
  workspaceDir: '/tmp',
};

function findTool(name: string) {
  const tool = tools.find((t) => t.definition.name === name);
  if (!tool) throw new Error(`Tool "${name}" not found`);
  return tool;
}

Deno.test('tools array — exports all tools', () => {
  assertEquals(tools.length >= 1, true);
});

Deno.test('slack_send_message — rejects empty channel', async () => {
  const tool = findTool('slack_send_message');
  const result = await tool.execute({ 'channel': '' }, mockContext);
  assertEquals(result.success, false);
  assertEquals(result.success, false);
});

Deno.test('slack_read_channel — rejects empty channel', async () => {
  const tool = findTool('slack_read_channel');
  const result = await tool.execute({ 'channel': '' }, mockContext);
  assertEquals(result.success, false);
  assertEquals(result.success, false);
});

Deno.test('slack_list_channels — tool is defined with name and description', () => {
  const tool = findTool('slack_list_channels');
  assertEquals(typeof tool.definition.description, 'string');
  assertEquals(tool.definition.description.length > 0, true);
});

Deno.test('slack_add_reaction — rejects empty channel', async () => {
  const tool = findTool('slack_add_reaction');
  const result = await tool.execute({ 'channel': '' }, mockContext);
  assertEquals(result.success, false);
  assertEquals(result.success, false);
});

Deno.test('discord_send_message — rejects empty channel_id', async () => {
  const tool = findTool('discord_send_message');
  const result = await tool.execute({ 'channel_id': '' }, mockContext);
  assertEquals(result.success, false);
  assertEquals(result.success, false);
});

Deno.test('discord_read_channel — rejects empty channel_id', async () => {
  const tool = findTool('discord_read_channel');
  const result = await tool.execute({ 'channel_id': '' }, mockContext);
  assertEquals(result.success, false);
  assertEquals(result.success, false);
});

Deno.test('send_daily_standup — tool is defined with name and description', () => {
  const tool = findTool('send_daily_standup');
  assertEquals(typeof tool.definition.description, 'string');
  assertEquals(tool.definition.description.length > 0, true);
});

Deno.test('webhook_listen_status — tool is defined with name and description', () => {
  const tool = findTool('webhook_listen_status');
  assertEquals(typeof tool.definition.description, 'string');
  assertEquals(tool.definition.description.length > 0, true);
});

Deno.test('all tools return durationMs', async () => {
  for (const tool of tools) {
    const args: Record<string, unknown> = {};
    const result = await tool.execute(args, mockContext);
    assertEquals(typeof result.durationMs, 'number');
    assertEquals(result.durationMs >= 0, true);
  }
});
