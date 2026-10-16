// Everything collectable, plus achievements and activity stations.
// Loaded by the main process (require) and by renderers (<script>, exposes window.Catalog).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Catalog = factory();
})(typeof self !== 'undefined' ? self : this, () => {
  // What a character can be doing. Strip mode picks a pose + prop; room mode walks to a matching furniture station.
  const STATIONS = {
    code: { name: '寫程式', icon: '💻', pose: 'type', prop: 'laptop' },
    terminal: { name: '下指令', icon: '⚡', pose: 'hammer', prop: 'anvil' },
    read: { name: '閱讀', icon: '📖', pose: 'read', prop: 'book' },
    web: { name: '上網', icon: '🌐', pose: 'read', prop: 'book' },
    write: { name: '寫作', icon: '📜', pose: 'type', prop: 'laptop' },
    art: { name: '畫畫', icon: '🎨', pose: 'paint', prop: 'easel' },
    game: { name: '玩遊戲', icon: '🎮', pose: 'hammer', prop: null },
    music: { name: '聽音樂', icon: '🎵', pose: 'dance', prop: null },
    chat: { name: '聊天', icon: '💬', pose: 'type', prop: 'laptop' },
    meeting: { name: '開會', icon: '🧑‍🤝‍🧑', pose: 'rest', prop: null },
    wait: { name: '等待', icon: '❗', pose: 'wait', prop: null },
    rest: { name: '休息', icon: '🛋️', pose: 'sleep', prop: null },
    coffee: { name: '喝咖啡', icon: '☕', pose: 'rest', prop: null },
  };

  const RARITY = {
    starter: { name: '初始', color: '#9aa3b5', weight: 0 },
    common: { name: '普通', color: '#7cc47f', weight: 60 },
    rare: { name: '稀有', color: '#5aa7ff', weight: 30 },
    epic: { name: '史詩', color: '#c27bff', weight: 10 },
  };

  const ITEMS = [
    // Characters
    { id: 'skin:knight', type: 'skin', rarity: 'starter', name: '騎士', desc: 'Deskmates 的創始成員' },
    { id: 'skin:office', type: 'skin', rarity: 'starter', name: '上班族', desc: '準時打卡，偶爾摸魚' },
    { id: 'skin:mage', type: 'skin', rarity: 'starter', name: '法師', desc: '把 bug 變成 feature' },
    { id: 'skin:cat', type: 'skin', rarity: 'starter', name: '貓貓', desc: '會踩鍵盤' },
    { id: 'skin:robot', type: 'skin', rarity: 'starter', name: '機器人', desc: '嗶嗶，任務完成' },
    { id: 'skin:ninja', type: 'skin', rarity: 'epic', name: '忍者', desc: '悄悄地 commit' },
    { id: 'skin:chef', type: 'skin', rarity: 'epic', name: '廚師', desc: '義大利麵程式碼專家' },
    { id: 'skin:astronaut', type: 'skin', rarity: 'epic', name: '太空人', desc: '在雲端工作' },
    // Accessories
    { id: 'acc:partyhat', type: 'accessory', rarity: 'common', name: '派對帽' },
    { id: 'acc:flower', type: 'accessory', rarity: 'common', name: '小花' },
    { id: 'acc:glasses', type: 'accessory', rarity: 'common', name: '眼鏡' },
    { id: 'acc:bow', type: 'accessory', rarity: 'common', name: '蝴蝶結' },
    { id: 'acc:headphones', type: 'accessory', rarity: 'rare', name: '耳機' },
    { id: 'acc:sunglasses', type: 'accessory', rarity: 'rare', name: '墨鏡' },
    { id: 'acc:halo', type: 'accessory', rarity: 'rare', name: '光環' },
    { id: 'acc:crown', type: 'accessory', rarity: 'epic', name: '王冠' },
    // Floors
    { id: 'floor:cyber', type: 'floor', rarity: 'starter', name: '金屬網格' },
    { id: 'floor:neon', type: 'floor', rarity: 'common', name: '霓虹地磚' },
    { id: 'floor:wood', type: 'floor', rarity: 'starter', name: '木地板' },
    { id: 'floor:tile', type: 'floor', rarity: 'starter', name: '磁磚' },
    { id: 'floor:carpet', type: 'floor', rarity: 'common', name: '地毯' },
    { id: 'floor:stone', type: 'floor', rarity: 'common', name: '石磚' },
    { id: 'floor:marble', type: 'floor', rarity: 'rare', name: '大理石' },
    { id: 'floor:grass', type: 'floor', rarity: 'rare', name: '草地' },
    // Walls
    { id: 'wall:cyber', type: 'wall', rarity: 'starter', name: '霓虹金屬牆' },
    { id: 'wall:cream', type: 'wall', rarity: 'starter', name: '米色牆' },
    { id: 'wall:brick', type: 'wall', rarity: 'common', name: '紅磚牆' },
    { id: 'wall:navy', type: 'wall', rarity: 'common', name: '深藍牆' },
    { id: 'wall:mint', type: 'wall', rarity: 'rare', name: '薄荷牆' },
    // Furniture
    { id: 'obj:desk', type: 'furniture', rarity: 'starter', name: '電腦桌' },
    { id: 'obj:server', type: 'furniture', rarity: 'starter', name: '伺服器' },
    { id: 'obj:bookshelf', type: 'furniture', rarity: 'starter', name: '書櫃' },
    { id: 'obj:globe', type: 'furniture', rarity: 'starter', name: '地球儀' },
    { id: 'obj:table', type: 'furniture', rarity: 'starter', name: '會議桌' },
    { id: 'obj:bell', type: 'furniture', rarity: 'starter', name: '櫃台鈴' },
    { id: 'obj:sofa', type: 'furniture', rarity: 'starter', name: '沙發' },
    { id: 'obj:coffee', type: 'furniture', rarity: 'starter', name: '咖啡機' },
    { id: 'obj:plant', type: 'furniture', rarity: 'starter', name: '盆栽' },
    { id: 'obj:window', type: 'furniture', rarity: 'starter', name: '窗戶' },
    { id: 'obj:easel', type: 'furniture', rarity: 'common', name: '畫架' },
    { id: 'obj:rug', type: 'furniture', rarity: 'common', name: '小地毯' },
    { id: 'obj:lamp', type: 'furniture', rarity: 'common', name: '立燈' },
    { id: 'obj:clock', type: 'furniture', rarity: 'common', name: '時鐘' },
    { id: 'obj:poster', type: 'furniture', rarity: 'common', name: '海報' },
    { id: 'obj:whiteboard', type: 'furniture', rarity: 'common', name: '白板' },
    { id: 'obj:vending', type: 'furniture', rarity: 'common', name: '販賣機' },
    { id: 'obj:catbed', type: 'furniture', rarity: 'common', name: '貓窩' },
    { id: 'obj:arcade', type: 'furniture', rarity: 'rare', name: '街機' },
    { id: 'obj:piano', type: 'furniture', rarity: 'rare', name: '鋼琴' },
    { id: 'obj:aquarium', type: 'furniture', rarity: 'rare', name: '水族箱' },
    { id: 'obj:trophy', type: 'furniture', rarity: 'rare', name: '獎盃櫃' },
    { id: 'obj:fireplace', type: 'furniture', rarity: 'epic', name: '壁爐' },
    { id: 'obj:neon', type: 'furniture', rarity: 'epic', name: '霓虹燈' },
  ];

  const ACHIEVEMENTS = [
    { id: 'first_turn', name: '第一個任務', desc: 'AI 夥伴完成第一個回合', reward: 5, test: (s) => s.turns >= 1 },
    { id: 'turns_100', name: '百戰老兵', desc: '累計完成 100 個回合', reward: 20, test: (s) => s.turns >= 100 },
    { id: 'tools_1000', name: '工具狂人', desc: '累計使用工具 1000 次', reward: 20, test: (s) => s.toolCalls >= 1000 },
    { id: 'edits_500', name: '鐵匠大師', desc: '累計修改檔案 500 次', reward: 20, test: (s) => s.edits >= 500 },
    { id: 'reads_500', name: '博覽群書', desc: '累計閱讀檔案 500 次', reward: 15, test: (s) => s.reads >= 500 },
    { id: 'helpers_5', name: '人多好辦事', desc: '同時有 5 位小幫手', reward: 15, test: (s) => s.maxHelpers >= 5 },
    { id: 'night_owl', name: '夜貓子', desc: '凌晨 0–5 點還在上工', reward: 10, test: (s) => s.nightTurns >= 1 },
    { id: 'early_bird', name: '早起的鳥兒', desc: '早上 5–7 點就開工', reward: 10, test: (s) => s.earlyTurns >= 1 },
    { id: 'goblins_10', name: '哥布林剋星', desc: '打倒 10 隻哥布林', reward: 15, test: (s) => s.goblins >= 10 },
    { id: 'focus_1', name: '專注新手', desc: '完成第一個番茄鐘', reward: 5, test: (s) => s.focus >= 1 },
    { id: 'focus_25', name: '心流大師', desc: '完成 25 個番茄鐘', reward: 25, test: (s) => s.focus >= 25 },
    { id: 'streak_7', name: '全勤獎', desc: '連續 7 天上工', reward: 25, test: (s) => s.streak >= 7 },
    { id: 'collector_10', name: '收藏家', desc: '收集 10 件物品', reward: 15, test: (s) => s.owned >= 10 },
    { id: 'collector_all', name: '圖鑑完成', desc: '收集所有物品', reward: 100, test: (s) => s.owned >= s.totalItems },
    { id: 'gacha_first', name: '第一抽', desc: '第一次招募', reward: 3, test: (s) => s.pulls >= 1 },
    { id: 'chest_10', name: '尋寶獵人', desc: '打開 10 個寶箱', reward: 15, test: (s) => s.chests >= 10 },
    { id: 'dragon', name: '見過龍的人', desc: '目睹巨龍飛過', reward: 10, test: (s) => s.dragons >= 1 },
    { id: 'hours_100', name: '百小時夥伴', desc: '一起度過 100 小時', reward: 30, test: (s) => s.activeMinutes >= 6000 },
  ];

  const PULL_COST = 10;
  const DUPLICATE_REFUND = 3;

  return { STATIONS, RARITY, ITEMS, ACHIEVEMENTS, PULL_COST, DUPLICATE_REFUND };
});
