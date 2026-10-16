// Which station a foreground program counts as. Keys are lower-case process names without .exe.
const BUILT_IN = {
  code: ['code', 'cursor', 'windsurf', 'devenv', 'rider64', 'idea64', 'pycharm64', 'webstorm64', 'clion64', 'goland64',
    'unity', 'unity hub', 'godot', 'sublime_text', 'notepad++', 'zed', 'androidstudio64', 'studio64', 'unrealeditor'],
  terminal: ['windowsterminal', 'wt', 'powershell', 'pwsh', 'cmd', 'wezterm-gui', 'alacritty', 'mintty', 'conhost', 'tabby', 'hyper'],
  web: ['chrome', 'msedge', 'firefox', 'brave', 'opera', 'arc', 'vivaldi', 'zen'],
  art: ['photoshop', 'aseprite', 'krita', 'clipstudiopaint', 'illustrator', 'blender', 'figma', 'gimp-2.10', 'paintdotnet', 'medibangpaintpro', 'affinity designer', 'affinity photo', 'pixelorama'],
  write: ['winword', 'notion', 'obsidian', 'onenote', 'typora', 'excel', 'powerpnt', 'wps', 'logseq'],
  read: ['acrobat', 'acrord32', 'sumatrapdf', 'kindle', 'foxitpdfreader'],
  game: ['steam', 'epicgameslauncher', 'battle.net', 'riotclientservices', 'leagueclient'],
  music: ['spotify', 'music.ui', 'applemusic', 'foobar2000', 'kkbox', 'tidal'],
  chat: ['discord', 'line', 'slack', 'teams', 'ms-teams', 'telegram', 'whatsapp', 'messenger', 'zoom', 'signal'],
  ignore: ['explorer', 'electron', 'deskmates', 'searchhost', 'searchapp', 'shellexperiencehost', 'startmenuexperiencehost', 'lockapp',
    'applicationframehost', 'textinputhost', 'taskmgr', 'systemsettings', ''],
};

const LOOKUP = {};
for (const [station, names] of Object.entries(BUILT_IN)) for (const n of names) LOOKUP[n] = station;

function stationForApp(app, overrides = {}) {
  const key = String(app || '').toLowerCase();
  return overrides[key] || LOOKUP[key] || null;
}

module.exports = { BUILT_IN, stationForApp };
