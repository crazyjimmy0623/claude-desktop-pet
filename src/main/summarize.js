// Turns a raw Claude Code hook payload into the small event the renderer needs.
// Tool inputs can be huge (Write content), so only short display strings survive.
const path = require('path');

const READ_TOOLS = new Set(['Read', 'Grep', 'Glob', 'LS', 'NotebookRead', 'ToolSearch', 'Skill']);
const WEB_TOOLS = new Set(['WebFetch', 'WebSearch']);
const TERMINAL_TOOLS = new Set(['Bash', 'PowerShell', 'BashOutput', 'KillShell', 'Monitor']);
const AGENT_TOOLS = new Set(['Agent', 'Task']);
const WRITE_TOOLS = new Set(['TodoWrite', 'TaskCreate', 'TaskUpdate']);

function clip(value, max) {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function baseName(p) {
  return p ? path.win32.basename(path.posix.basename(String(p))) : '';
}

// mcp__server__tool → tool
function shortToolName(name) {
  const m = /^mcp__.+?__(.+)$/.exec(name || '');
  return m ? m[1] : name || '';
}

// Which room station (and strip pose) a tool call looks like.
function stationForTool(name) {
  if (AGENT_TOOLS.has(name)) return 'meeting';
  if (READ_TOOLS.has(name)) return 'read';
  if (WEB_TOOLS.has(name)) return 'web';
  if (TERMINAL_TOOLS.has(name)) return 'terminal';
  if (WRITE_TOOLS.has(name)) return 'write';
  if (name === 'AskUserQuestion') return 'wait';
  if (name?.startsWith('mcp__')) return /(read|get|search|list|look|find|query|fetch)/i.test(name) ? 'read' : 'terminal';
  return 'code';
}

function toolDetail(input) {
  if (!input || typeof input !== 'object') return '';
  if (input.file_path || input.notebook_path) return baseName(input.file_path || input.notebook_path);
  if (input.description) return clip(input.description, 28);
  if (input.command) return clip(input.command, 28);
  if (input.pattern) return clip(input.pattern, 24);
  if (input.url) {
    try { return new URL(input.url).hostname; } catch { return clip(input.url, 24); }
  }
  if (input.query) return clip(input.query, 24);
  if (input.skill) return clip(input.skill, 24);
  if (input.path) return baseName(input.path);
  return '';
}

function summarize(p) {
  if (!p || typeof p !== 'object' || !p.hook_event_name || !p.session_id) return null;
  const ev = {
    event: p.hook_event_name,
    session: String(p.session_id),
    cwd: p.cwd || '',
    project: baseName(p.cwd) || 'Claude',
    agentId: p.agent_id || '',
  };
  switch (p.hook_event_name) {
    case 'UserPromptSubmit':
      ev.prompt = clip(p.prompt, 60);
      break;
    case 'PreToolUse':
    case 'PostToolUse':
    case 'PostToolUseFailure':
    case 'PermissionRequest':
      ev.tool = shortToolName(p.tool_name);
      ev.rawTool = p.tool_name || '';
      ev.station = stationForTool(p.tool_name);
      ev.detail = toolDetail(p.tool_input);
      break;
    case 'Notification':
      ev.message = clip(p.message, 60);
      ev.notificationType = p.notification_type || '';
      break;
    case 'SessionStart':
      ev.source = p.source || '';
      break;
    case 'SessionEnd':
      ev.reason = p.reason || '';
      break;
    case 'PreCompact':
      ev.trigger = p.trigger || '';
      break;
  }
  return ev;
}

module.exports = { summarize, stationForTool, clip };
