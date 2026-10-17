// Everything collectable, plus achievements and activity stations.
// Loaded by the main process (require) and by renderers (<script>, exposes window.Catalog).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Catalog = factory();
})(typeof self !== 'undefined' ? self : this, () => {
  // What a character can be doing. Strip mode picks a pose + prop; room mode walks to a matching furniture station.
  const STATIONS = {
    code: { name: '寫程式', icon: '💻', pose: 'type', prop: 'laptop' },
    terminal: { name: '下指令', icon: '⚡', pose: 'command', prop: 'console' },
    read: { name: '閱讀', icon: '📖', pose: 'read', prop: 'book' },
    web: { name: '上網', icon: '🌐', pose: 'read', prop: 'book' },
    write: { name: '寫作', icon: '📜', pose: 'type', prop: 'laptop' },
    art: { name: '畫畫', icon: '🎨', pose: 'paint', prop: 'easel' },
    game: { name: '玩遊戲', icon: '🎮', pose: 'game', prop: null },
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
    legend: { name: '傳說', color: '#ffc83d', weight: 3 },
  };

  const ITEMS = [
    // Characters
    { id: 'skin:office', type: 'skin', rarity: 'starter', name: '上班族', desc: '準時打卡，偶爾摸魚' },
    { id: 'skin:scientist', type: 'skin', rarity: 'starter', name: '研究員', desc: '把 bug 變成 feature' },
    { id: 'skin:cat', type: 'skin', rarity: 'starter', name: '貓貓', desc: '會踩鍵盤' },
    { id: 'skin:robot', type: 'skin', rarity: 'starter', name: '機器人', desc: '嗶嗶，任務完成' },
    { id: 'skin:droid', type: 'skin', rarity: 'starter', name: '暴走機器人', desc: 'AI 的預設造型，不要惹它' },
    { id: 'skin:ninja', type: 'skin', rarity: 'epic', name: '忍者', desc: '悄悄地 commit' },
    { id: 'skin:chef', type: 'skin', rarity: 'epic', name: '廚師', desc: '義大利麵程式碼專家' },
    { id: 'skin:astronaut', type: 'skin', rarity: 'epic', name: '太空人', desc: '在雲端工作' },
    { id: 'skin:commander', type: 'skin', rarity: 'legend', name: '冷酷吉米', desc: '白盔白身、紅披風，話不多' },
    // Accessories
    { id: 'acc:partyhat', type: 'accessory', rarity: 'common', name: '派對帽' },
    { id: 'acc:flower', type: 'accessory', rarity: 'common', name: '小花' },
    { id: 'acc:glasses', type: 'accessory', rarity: 'common', name: '眼鏡' },
    { id: 'acc:bow', type: 'accessory', rarity: 'common', name: '蝴蝶結' },
    { id: 'acc:headphones', type: 'accessory', rarity: 'rare', name: '耳機' },
    { id: 'acc:sunglasses', type: 'accessory', rarity: 'rare', name: '墨鏡' },
    { id: 'acc:halo', type: 'accessory', rarity: 'rare', name: '光環' },
    { id: 'acc:vr', type: 'accessory', rarity: 'epic', name: 'VR 眼鏡' },
    // Floors
    { id: 'floor:cyber', type: 'floor', rarity: 'starter', name: '金屬網格' },
    { id: 'floor:neon', type: 'floor', rarity: 'common', name: '霓虹地磚' },
    { id: 'floor:wood', type: 'floor', rarity: 'starter', name: '木地板' },
    { id: 'floor:tile', type: 'floor', rarity: 'starter', name: '磁磚' },
    { id: 'floor:carpet', type: 'floor', rarity: 'common', name: '地毯' },
    { id: 'floor:stone', type: 'floor', rarity: 'common', name: '石磚' },
    { id: 'floor:marble', type: 'floor', rarity: 'rare', name: '大理石' },
    { id: 'floor:terra', type: 'floor', rarity: 'starter', name: '紅陶磚' },
    { id: 'floor:plank', type: 'floor', rarity: 'starter', name: '木棧板' },
    { id: 'floor:sand', type: 'floor', rarity: 'starter', name: '沙灘' },
    { id: 'floor:magic', type: 'floor', rarity: 'rare', name: '星星地毯' },
    { id: 'floor:grass', type: 'floor', rarity: 'rare', name: '草地' },
    // Walls
    { id: 'wall:plum', type: 'wall', rarity: 'starter', name: '酒紅牆' },
    { id: 'wall:cyber', type: 'wall', rarity: 'starter', name: '霓虹金屬牆' },
    { id: 'wall:cream', type: 'wall', rarity: 'starter', name: '米色牆' },
    { id: 'wall:brick', type: 'wall', rarity: 'common', name: '紅磚牆' },
    { id: 'wall:navy', type: 'wall', rarity: 'common', name: '深藍牆' },
    { id: 'wall:mint', type: 'wall', rarity: 'rare', name: '薄荷牆' },
    { id: 'wall:wood', type: 'wall', rarity: 'starter', name: '木板牆' },
    { id: 'wall:bamboo', type: 'wall', rarity: 'starter', name: '竹牆' },
    { id: 'wall:log', type: 'wall', rarity: 'starter', name: '圓木牆' },
    { id: 'wall:stone', type: 'wall', rarity: 'common', name: '石牆' },
    { id: 'wall:glass', type: 'wall', rarity: 'rare', name: '玻璃溫室' },
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
    { id: 'obj:bed', type: 'furniture', rarity: 'starter', name: '床' },
    { id: 'obj:boxes', type: 'furniture', rarity: 'starter', name: '紙箱' },
    { id: 'obj:shelf', type: 'furniture', rarity: 'starter', name: '壁架' },
    { id: 'obj:window', type: 'furniture', rarity: 'starter', name: '窗戶' },
    { id: 'obj:fridge', type: 'furniture', rarity: 'starter', name: '發光冰櫃' },
    { id: 'obj:shopdoor', type: 'furniture', rarity: 'starter', name: '店門' },
    { id: 'obj:sign', type: 'furniture', rarity: 'starter', name: '招牌' },
    { id: 'obj:bin', type: 'furniture', rarity: 'starter', name: '垃圾桶' },
    { id: 'obj:streetlamp', type: 'furniture', rarity: 'starter', name: '路燈' },
    { id: 'obj:aircon', type: 'furniture', rarity: 'starter', name: '冷氣室外機' },
    { id: 'obj:telescope', type: 'furniture', rarity: 'common', name: '望遠鏡' },
    { id: 'obj:tree', type: 'plant', rarity: 'starter', name: '樹' },
    { id: 'obj:bush', type: 'plant', rarity: 'starter', name: '灌木' },
    { id: 'obj:lilypad', type: 'furniture', rarity: 'starter', name: '荷葉' },
    { id: 'obj:boat', type: 'furniture', rarity: 'common', name: '小船' },
    { id: 'obj:planter', type: 'furniture', rarity: 'starter', name: '花台' },
    { id: 'obj:cauldron', type: 'furniture', rarity: 'rare', name: '魔藥鍋' },
    { id: 'obj:potions', type: 'furniture', rarity: 'common', name: '藥水架' },
    { id: 'obj:crate', type: 'furniture', rarity: 'starter', name: '木箱' },
    { id: 'obj:barrel', type: 'furniture', rarity: 'starter', name: '木桶' },
    { id: 'obj:chair', type: 'furniture', rarity: 'starter', name: '椅子' },
    { id: 'obj:stool', type: 'furniture', rarity: 'starter', name: '吧台椅' },
    { id: 'obj:books', type: 'furniture', rarity: 'starter', name: '書堆' },
    { id: 'obj:signboard', type: 'furniture', rarity: 'common', name: '立牌' },
    { id: 'obj:watertank', type: 'furniture', rarity: 'common', name: '水塔' },
    { id: 'obj:antenna', type: 'furniture', rarity: 'common', name: '天線' },
    { id: 'obj:walllamp', type: 'furniture', rarity: 'starter', name: '壁燈' },
    { id: 'obj:palm', type: 'plant', rarity: 'starter', name: '椰子樹' },
    { id: 'obj:umbrella', type: 'furniture', rarity: 'starter', name: '海灘陽傘' },
    { id: 'obj:lounger', type: 'furniture', rarity: 'starter', name: '躺椅' },
    { id: 'obj:surfboard', type: 'furniture', rarity: 'common', name: '衝浪板' },
    { id: 'obj:tiki', type: 'furniture', rarity: 'starter', name: '火把' },
    { id: 'obj:campfire', type: 'furniture', rarity: 'starter', name: '營火' },
    { id: 'obj:logpile', type: 'furniture', rarity: 'starter', name: '柴堆' },
    { id: 'obj:mushroom', type: 'plant', rarity: 'starter', name: '蘑菇' },
    { id: 'obj:lantern', type: 'furniture', rarity: 'starter', name: '提燈' },
    { id: 'obj:waterfall', type: 'furniture', rarity: 'common', name: '瀑布' },
    { id: 'obj:hangplant', type: 'furniture', rarity: 'starter', name: '吊盆' },
    { id: 'obj:meter', type: 'furniture', rarity: 'starter', name: '電錶箱' },
    { id: 'obj:ivy', type: 'furniture', rarity: 'common', name: '爬藤' },
    { id: 'obj:windowbox', type: 'furniture', rarity: 'common', name: '窗台花箱' },
    { id: 'obj:banner', type: 'furniture', rarity: 'common', name: '掛旗' },
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
    { id: 'obj:tv', type: 'furniture', rarity: 'rare', name: '電視遊樂器' },
    { id: 'obj:aquarium', type: 'furniture', rarity: 'rare', name: '水族箱' },
    { id: 'obj:trophy', type: 'furniture', rarity: 'rare', name: '獎盃櫃' },
    { id: 'obj:fireplace', type: 'furniture', rarity: 'epic', name: '壁爐' },
    // Home comforts
    { id: 'obj:armchair', type: 'furniture', rarity: 'starter', name: '單人沙發' },
    { id: 'obj:nightstand', type: 'furniture', rarity: 'starter', name: '床頭櫃' },
    { id: 'obj:waterdispenser', type: 'furniture', rarity: 'starter', name: '飲水機' },
    { id: 'obj:beanbag', type: 'furniture', rarity: 'common', name: '懶骨頭' },
    { id: 'obj:fan', type: 'furniture', rarity: 'common', name: '電風扇' },
    { id: 'obj:candles', type: 'furniture', rarity: 'common', name: '蠟燭' },
    { id: 'obj:plush', type: 'furniture', rarity: 'common', name: '熊熊玩偶' },
    { id: 'obj:kitchen', type: 'furniture', rarity: 'common', name: '流理台', desc: '居民會來泡茶' },
    { id: 'obj:lavalamp', type: 'furniture', rarity: 'rare', name: '熔岩燈' },
    // More for the walls
    { id: 'obj:calendar', type: 'furniture', rarity: 'starter', name: '月曆' },
    { id: 'obj:corkboard', type: 'furniture', rarity: 'starter', name: '軟木公告板' },
    { id: 'obj:painting', type: 'furniture', rarity: 'common', name: '風景畫' },
    { id: 'obj:photowall', type: 'furniture', rarity: 'common', name: '照片牆' },
    { id: 'obj:dartboard', type: 'furniture', rarity: 'common', name: '飛鏢靶' },
    { id: 'obj:stringlights', type: 'furniture', rarity: 'rare', name: '串燈', desc: '晚上會一閃一閃' },
    // Garden and yard
    { id: 'obj:bench', type: 'furniture', rarity: 'starter', name: '公園長椅' },
    { id: 'obj:mailbox', type: 'furniture', rarity: 'starter', name: '信箱' },
    { id: 'obj:fence', type: 'furniture', rarity: 'starter', name: '白色柵欄' },
    { id: 'obj:gnome', type: 'furniture', rarity: 'common', name: '花園小矮人' },
    { id: 'obj:birdhouse', type: 'furniture', rarity: 'common', name: '鳥屋', desc: '偶爾會有小鳥來' },
    { id: 'obj:well', type: 'furniture', rarity: 'rare', name: '水井' },
    { id: 'obj:swing', type: 'furniture', rarity: 'rare', name: '鞦韆' },
    { id: 'obj:snowman', type: 'furniture', rarity: 'rare', name: '雪人' },
    { id: 'obj:fountain', type: 'furniture', rarity: 'epic', name: '噴水池' },
    { id: 'obj:hedge', type: 'plant', rarity: 'starter', name: '樹籬' },
    { id: 'obj:flowerbed', type: 'plant', rarity: 'common', name: '花圃' },
    { id: 'obj:sunflower', type: 'plant', rarity: 'common', name: '向日葵' },
    { id: 'obj:cactus', type: 'plant', rarity: 'common', name: '仙人掌' },
    { id: 'obj:pumpkin', type: 'plant', rarity: 'rare', name: '南瓜', desc: '天黑會變成南瓜燈' },
    { id: 'obj:wardrobe', type: 'furniture', rarity: 'common', name: '衣櫃' },
    { id: 'obj:dresser', type: 'furniture', rarity: 'common', name: '五斗櫃' },
    { id: 'obj:guitar', type: 'furniture', rarity: 'common', name: '吉他', desc: '居民會來彈兩下' },
    { id: 'obj:turntable', type: 'furniture', rarity: 'rare', name: '黑膠唱機', desc: '聽音樂的好地方' },
    { id: 'obj:writingdesk', type: 'furniture', rarity: 'rare', name: '打字機書桌', desc: 'AI 寫文件、居民寫日記都來這裡' },
    { id: 'obj:kotatsu', type: 'furniture', rarity: 'rare', name: '暖桌', desc: '大家圍著聊天，還有橘子' },
    { id: 'obj:neon', type: 'furniture', rarity: 'epic', name: '霓虹燈' },
    // Plants: trees and greenery to plant on the lawn
    { id: 'obj:pine', type: 'plant', rarity: 'starter', name: '松樹' },
    { id: 'obj:rock', type: 'plant', rarity: 'starter', name: '岩石' },
    { id: 'obj:birch', type: 'plant', rarity: 'common', name: '白樺' },
    { id: 'obj:bamboo', type: 'plant', rarity: 'common', name: '竹子' },
    { id: 'obj:jungle', type: 'plant', rarity: 'common', name: '熱帶灌木' },
    { id: 'obj:maple', type: 'plant', rarity: 'rare', name: '楓樹' },
    { id: 'obj:sakura', type: 'plant', rarity: 'rare', name: '櫻花樹' },
    // Building blocks and stairs
    { id: 'block:brick', type: 'block', rarity: 'starter', name: '磚地基' },
    { id: 'block:grass', type: 'block', rarity: 'starter', name: '草地方塊' },
    { id: 'block:room', type: 'block', rarity: 'starter', name: '室內地板' },
    { id: 'block:stairs', type: 'block', rarity: 'starter', name: '樓梯' },
    { id: 'block:deck', type: 'block', rarity: 'common', name: '木平台' },
    { id: 'block:loft', type: 'block', rarity: 'common', name: '閣樓' },
    { id: 'block:water', type: 'block', rarity: 'common', name: '水池' },
    { id: 'block:glass', type: 'block', rarity: 'rare', name: '玻璃屋' },
    { id: 'block:spiral', type: 'block', rarity: 'rare', name: '旋轉樓梯' },
    // Land: the size of the plot
    { id: 'land:8', type: 'land', rarity: 'starter', name: '8×8 空地' },
    { id: 'land:10', type: 'land', rarity: 'rare', name: '10×10 空地', desc: '大一點的地，現成的藍圖也蓋得下了' },
    { id: 'land:12', type: 'land', rarity: 'epic', name: '12×12 空地', desc: '最大的一塊地' },
  ];

  // What building costs, in coins: blocks and stairs by the piece, furniture and plants by
  // rarity. Taking something away gives half back.
  const BUILD_PRICE = { starter: 3, common: 5, rare: 8, epic: 12, legend: 20 };
  const BLOCK_PRICE = { starter: 2, common: 3, rare: 4 };
  function priceOf(id) {
    if (id === 'block:spiral') return 8;
    const item = ITEMS.find((i) => i.id === id);
    if (!item) return id.startsWith('block:') ? 2 : 3;
    if (item.type === 'block') return BLOCK_PRICE[item.rarity] || 2;
    return BUILD_PRICE[item.rarity] || 3;
  }

  // What an achievement counts and how far it has to get; `goal` may name another count (all the items).
  const reach = (count, goal) => ({ count, goal, test: (s) => s[count] >= (typeof goal === 'string' ? s[goal] : goal) });
  const ACHIEVEMENTS = [
    { id: 'first_turn', name: '第一個任務', desc: 'AI 夥伴做完第一件事', reward: 5, ...reach('turns', 1) },
    { id: 'turns_100', name: '做完一百件', desc: 'AI 一共做完 100 件事', reward: 20, ...reach('turns', 100) },
    { id: 'tools_1000', name: '工具狂人', desc: 'AI 一共動手 1000 次', reward: 20, ...reach('toolCalls', 1000) },
    { id: 'edits_500', name: '改檔職人', desc: '一共改了 500 次檔案', reward: 20, ...reach('edits', 500) },
    { id: 'reads_500', name: '博覽群書', desc: '一共看了 500 次檔案', reward: 15, ...reach('reads', 500) },
    { id: 'helpers_5', name: '人多好辦事', desc: '同時有 5 位小幫手', reward: 15, ...reach('maxHelpers', 5) },
    { id: 'night_owl', name: '夜貓子', desc: '凌晨 0–5 點還在上工', reward: 10, ...reach('nightTurns', 1) },
    { id: 'early_bird', name: '早起的鳥兒', desc: '早上 5–7 點就開工', reward: 10, ...reach('earlyTurns', 1) },
    { id: 'bugs_10', name: '除蟲專家', desc: '抓到 10 隻 bug', reward: 15, ...reach('bugs', 10) },
    { id: 'focus_1', name: '專注新手', desc: '完成第一個番茄鐘', reward: 5, ...reach('focus', 1) },
    { id: 'focus_25', name: '心流大師', desc: '完成 25 個番茄鐘', reward: 25, ...reach('focus', 25) },
    { id: 'streak_7', name: '全勤獎', desc: '連續 7 天上工', reward: 25, ...reach('streak', 7) },
    { id: 'collector_10', name: '收藏家', desc: '收集 10 件物品', reward: 15, ...reach('owned', 10) },
    { id: 'collector_all', name: '圖鑑完成', desc: '收集所有物品', reward: 100, ...reach('owned', 'totalItems') },
    { id: 'gacha_first', name: '第一抽', desc: '第一次招募', reward: 3, ...reach('pulls', 1) },
    { id: 'chest_10', name: '拆箱達人', desc: '打開 10 個包裹', reward: 15, ...reach('chests', 10) },
    { id: 'ufo', name: '第三類接觸', desc: '目睹 UFO 飛過', reward: 10, ...reach('ufos', 1) },
    { id: 'hours_100', name: '百小時夥伴', desc: '一起待了 100 小時', reward: 30, ...reach('activeMinutes', 6000) },
    { id: 'flow_1', name: '進入心流', desc: '同一件事專注 25 分鐘', reward: 5, ...reach('flowSessions', 1) },
    { id: 'flow_50', name: '專注職人', desc: '專心滿 25 分鐘，累積 50 次', reward: 25, ...reach('flowSessions', 50) },
    { id: 'checkin_7', name: '天天報到', desc: '連續簽到 7 天', reward: 15, ...reach('checkInBest', 7) },
  ];

  const PULL_COST = 10;
  const DUPLICATE_REFUND = 3;

  return { STATIONS, RARITY, ITEMS, ACHIEVEMENTS, PULL_COST, DUPLICATE_REFUND, priceOf };
});
