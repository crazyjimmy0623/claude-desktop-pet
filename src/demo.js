// Fake hook payloads so the pet can be tried without a live Claude session.
const ROOT = 'C:\\Projects\\';

function runDemo(send) {
  const tag = Math.random().toString(36).slice(2, 7);
  const A = `demo-a-${tag}`;
  const B = `demo-b-${tag}`;
  const C = `demo-c-${tag}`;
  const a = { session_id: A, cwd: ROOT + 'my-platformer' };
  const b = { session_id: B, cwd: ROOT + 'claude-desktop-pet' };
  const c = { session_id: C, cwd: ROOT + 'web-api' };
  const tool = (base, name, input) => ({ ...base, tool_name: name, tool_input: input });

  const script = [
    [0, { ...a, hook_event_name: 'SessionStart', source: 'startup' }],
    [700, { ...b, hook_event_name: 'SessionStart', source: 'startup' }],
    [1400, { ...c, hook_event_name: 'SessionStart', source: 'startup' }],
    [2500, { ...a, hook_event_name: 'UserPromptSubmit', prompt: '幫我把玩家跳躍的手感調得更俐落一點' }],
    [4500, { ...tool(a, 'Read', { file_path: 'Assets/Scripts/PlayerController.cs' }), hook_event_name: 'PreToolUse' }],
    [3000, { ...b, hook_event_name: 'UserPromptSubmit', prompt: '研究一下 hook 文件' }],
    [5000, { ...tool(b, 'Agent', { description: '搜尋 hook 文件' }), hook_event_name: 'PreToolUse' }],
    [5200, { ...b, hook_event_name: 'SubagentStart', agent_id: 'x1' }],
    [5600, { ...b, hook_event_name: 'SubagentStart', agent_id: 'x2' }],
    [7000, { ...tool(a, 'Read', {}), hook_event_name: 'PostToolUse' }],
    [7300, { ...tool(a, 'Edit', { file_path: 'Assets/Scripts/PlayerController.cs' }), hook_event_name: 'PreToolUse' }],
    [8000, { ...c, hook_event_name: 'UserPromptSubmit', prompt: '跑一下測試' }],
    [9000, { ...tool(c, 'Bash', { command: 'npm test -- --watch=false' }), hook_event_name: 'PreToolUse' }],
    [9600, { ...tool(c, 'Bash', { command: 'npm test -- --watch=false' }), hook_event_name: 'PermissionRequest' }],
    [11000, { ...tool(a, 'Edit', {}), hook_event_name: 'PostToolUse' }],
    [11500, { ...a, hook_event_name: 'Stop' }],
    [14000, { ...b, hook_event_name: 'SubagentStop', agent_id: 'x1' }],
    [15000, { ...tool(c, 'Bash', {}), hook_event_name: 'PostToolUse' }],
    [15400, { ...tool(c, 'WebSearch', { query: 'Unity coyote time' }), hook_event_name: 'PreToolUse' }],
    [16500, { ...b, hook_event_name: 'SubagentStop', agent_id: 'x2' }],
    [17000, { ...tool(b, 'Agent', {}), hook_event_name: 'PostToolUse' }],
    [17500, { ...b, hook_event_name: 'Stop' }],
    [19000, { ...c, hook_event_name: 'Stop' }],
    [26000, { ...b, hook_event_name: 'SessionEnd', reason: 'prompt_input_exit' }],
    [40000, { ...a, hook_event_name: 'SessionEnd', reason: 'prompt_input_exit' }],
    [41000, { ...c, hook_event_name: 'SessionEnd', reason: 'prompt_input_exit' }],
  ];
  for (const [at, payload] of script) setTimeout(() => send(payload), at);
}

module.exports = { runDemo };
