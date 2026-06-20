const cloudConfig = window.ROSE_BLOG_CONFIG || {};
const retiredModulesEnabled = false;
const hasCloud = Boolean(window.supabase && cloudConfig.supabaseUrl && cloudConfig.supabaseAnonKey);
const client = hasCloud ? window.supabase.createClient(cloudConfig.supabaseUrl, cloudConfig.supabaseAnonKey) : null;
const sessionKey = "rose-blog-session-token";

let sessionToken = localStorage.getItem(sessionKey) || "";
let profile = null;
let posts = [];
let comments = [];
let likes = [];
let chatMessages = [];
let chatLikes = [];
let profiles = new Map();
let pendingAvatarImage = null;
let koiWishes = [];
let lotteryTopics = [];
let lotteryEntries = [];
let eventLogs = [];
let podcasts = [];
let podcastComments = [];
let podcastLikes = [];
let pendingPodcastRecording = null;
let podcastMusicMode = "off";
let cabinArtworks = [];
let cabinRecordings = [];
let mimiCareLogs = [];
let activeCabinArtFilter = "oil";
let archiveOpen = false;
let medicineHistoryOpen = false;
let activeInterest = "全部";
let activeCategory = "文章";
let activeMysteryCategory = "健康";
let feedVisibleCount = 8;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const CabinAudioManager = (() => {
  const activeSources = new Map();
  const activeVoices = new Set();
  let context = null;

  const getContext = () => {
    context ||= new (window.AudioContext || window.webkitAudioContext)();
    if (context.state === "suspended") context.resume().catch((error) => console.warn("[CabinAudio] 无法恢复声音上下文。", error));
    return context;
  };
  const stopController = (controller) => {
    if (!controller) return;
    try {
      if (typeof controller === "function") controller();
      else if (controller instanceof HTMLMediaElement) {
        controller.pause();
        controller.currentTime = 0;
      } else if (typeof controller.stop === "function") controller.stop();
    } catch (error) {
      console.warn("[CabinAudio] 停止声音时出现问题。", error);
    }
  };
  const stop = (name) => {
    stopController(activeSources.get(name));
    activeSources.delete(name);
  };
  const play = (name, audioOrFunction) => {
    stop(name);
    try {
      const controller = typeof audioOrFunction === "function" ? audioOrFunction(getContext()) : audioOrFunction;
      if (controller instanceof HTMLMediaElement) {
        controller.currentTime = 0;
        controller.play().catch((error) => console.warn(`[CabinAudio:${name}] 播放失败。`, error));
      }
      if (controller) activeSources.set(name, controller);
      return controller;
    } catch (error) {
      console.warn(`[CabinAudio:${name}]`, error);
      return null;
    }
  };
  const registerActiveOscillator = (node) => {
    if (!node) return node;
    activeVoices.add(node);
    node.addEventListener?.("ended", () => activeVoices.delete(node), { once: true });
    return node;
  };
  const registerVoice = (voice) => {
    if (!voice) return voice;
    activeVoices.add(voice);
    return voice;
  };
  const releaseVoice = (voice) => activeVoices.delete(voice);
  const stopAllVoices = () => {
    [...activeVoices].forEach((voice) => stopController(voice));
    activeVoices.clear();
  };
  const stopAll = () => {
    [...activeSources.keys()].forEach(stop);
    stopAllVoices();
  };
  const stopRoomSounds = () => stopAll();

  const getActiveVoiceCount = () => activeVoices.size;
  const getActiveSourceNames = () => [...activeSources.keys()];
  return { play, stop, stopAll, stopRoomSounds, registerActiveOscillator, registerVoice, releaseVoice, stopAllVoices, getActiveVoiceCount, getActiveSourceNames, getContext };
})();

window.CabinAudioManager = CabinAudioManager;

function playCabinFireAmbience() {
  if (document.hidden) return null;
  return CabinAudioManager.play("cabin-fire-ambience", (audioContext) => {
    const nodes = [];
    const timers = [];
    const masterGain = audioContext.createGain();
    const warmthFilter = audioContext.createBiquadFilter();
    const emberGain = audioContext.createGain();
    const emberOsc = audioContext.createOscillator();

    masterGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.055, audioContext.currentTime + 0.8);
    warmthFilter.type = "lowpass";
    warmthFilter.frequency.value = 1200;
    warmthFilter.Q.value = 0.45;

    emberOsc.type = "triangle";
    emberOsc.frequency.value = 58;
    emberGain.gain.value = 0.0045;
    emberOsc.connect(emberGain).connect(masterGain);
    emberOsc.start();
    nodes.push(emberOsc);

    const makeNoisePop = (volume = 0.018, duration = 0.08, high = false) => {
      const frameCount = Math.max(1, Math.floor(audioContext.sampleRate * duration));
      const buffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frameCount; i += 1) {
        const tail = Math.pow(1 - i / frameCount, high ? 3.5 : 2.2);
        data[i] = (Math.random() * 2 - 1) * tail;
      }
      const source = audioContext.createBufferSource();
      const filter = audioContext.createBiquadFilter();
      const gain = audioContext.createGain();
      filter.type = high ? "bandpass" : "lowpass";
      filter.frequency.value = high ? 2200 + Math.random() * 1400 : 420 + Math.random() * 520;
      filter.Q.value = high ? 1.4 : 0.55;
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(volume, audioContext.currentTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
      source.buffer = buffer;
      source.connect(filter).connect(gain).connect(masterGain);
      source.start();
      source.stop(audioContext.currentTime + duration + 0.03);
      nodes.push(source);
      source.addEventListener?.("ended", () => {
        const index = nodes.indexOf(source);
        if (index >= 0) nodes.splice(index, 1);
      }, { once: true });
    };

    const createSoftBed = () => {
      const duration = 2.4;
      const frameCount = Math.floor(audioContext.sampleRate * duration);
      const buffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frameCount; i += 1) {
        data[i] = (Math.random() * 2 - 1) * 0.22;
      }
      const source = audioContext.createBufferSource();
      const gain = audioContext.createGain();
      source.buffer = buffer;
      source.loop = true;
      gain.gain.value = 0.012;
      source.connect(warmthFilter).connect(gain).connect(masterGain);
      source.start();
      nodes.push(source);
    };

    createSoftBed();
    masterGain.connect(audioContext.destination);

    timers.push(window.setInterval(() => {
      if (document.hidden) return;
      makeNoisePop(0.012 + Math.random() * 0.018, 0.055 + Math.random() * 0.08, Math.random() > 0.58);
      if (Math.random() > 0.78) {
        window.setTimeout(() => makeNoisePop(0.009, 0.045, true), 70 + Math.random() * 90);
      }
    }, 360 + Math.random() * 220));

    return {
      stop: () => {
        timers.forEach((timer) => window.clearInterval(timer));
        const now = audioContext.currentTime;
        try {
          masterGain.gain.cancelScheduledValues(now);
          masterGain.gain.setTargetAtTime(0.0001, now, 0.16);
        } catch (error) {
          console.warn("[CabinFire] fade", error);
        }
        window.setTimeout(() => {
          nodes.forEach((node) => {
            try { node.stop?.(); } catch {}
            try { node.disconnect?.(); } catch {}
          });
          try { masterGain.disconnect(); } catch {}
        }, 420);
      }
    };
  });
}

const fallbackBlogMaterials = {
  roomMap: {
    studio: { painting: "cabin-painting-night.jpg", prop: "cabin-lamp-cutout.png", plant: "cabin-flowers-cutout.png", accent: "#9b6a3f" },
    water: { painting: "cabin-painting-water.jpg", prop: "cabin-desk-lamp.jpg", plant: "cabin-flowers-cutout.png", accent: "#6f8f86" },
    flowers: { painting: "cabin-painting-flowers.jpg", plantMain: "cabin-flowers-cutout.png", plantDetail: "cabin-flowers.jpg", accent: "#8b9a68" },
    hearth: { scene: "cabin-hearth.jpg", lamp: "cabin-wood-lamp.jpg", accent: "#b06f3a" },
    child: { painting: "cabin-art-night.jpg", toy: "cabin-flowers-cutout.png", prop: "cabin-desk-lamp.jpg", accent: "#b99764" },
    pet: { mainCat: "mimi-sit-transparent.png", watchToy: "mimi-play.jpg", playing: "mimi-play.jpg", peeking: "mimi-alert.jpg", relaxed: "mimi-lean.jpg", accent: "#a77b55" },
    shared: { pendant: "cabin-pendant-cutout.png" }
  },
  gallerySeeds: [
    { title: "旧画室", category: "oil", src: "cabin-painting-night.jpg" },
    { title: "旧水边", category: "oil", src: "cabin-painting-water.jpg" },
    { title: "旧花房", category: "oil", src: "cabin-painting-flowers.jpg" }
  ],
  articleIllustrations: [],
  legacyFallbacks: {},
  audio: { mimiPurr: "assets/blog-materials/audio/mimi-purr-soft-source.mp3" }
};

const BLOG_MATERIALS = window.ROSE_BLOG_MATERIALS || fallbackBlogMaterials;
const getBlogMaterials = () => BLOG_MATERIALS;
const homepageImageMaterials = {
  hero: "cabin-hearth.jpg",
  cards: [
    "cabin-art-flowers.jpg",
    "cabin-art-night.jpg",
    "cabin-art-water.jpg",
    "cabin-painting-flowers.jpg",
    "cabin-painting-night.jpg",
    "cabin-painting-water.jpg"
  ],
  pet: "assets/blog-materials/original/source-01-0589d5f1a87d.jpg"
};

function preferCompleteHomepageImage(src, index = 0) {
  if (!src) return homepageImageMaterials.cards[index % homepageImageMaterials.cards.length];
  if (src.includes("assets/blog-materials/vector/")) {
    return homepageImageMaterials.cards[index % homepageImageMaterials.cards.length] || src;
  }
  return src;
}

function getBlogMaterialPath(path) {
  if (!path) return "";
  if (/^(https?:|data:|blob:|file:)/.test(path)) return path;
  return path.replace(/^\/+/, "");
}

function setImageSafe(img, src, alt = "", fallbackSrc = "") {
  if (!img || !src) return false;
  const safeSrc = getBlogMaterialPath(src);
  const safeFallback = getBlogMaterialPath(fallbackSrc);
  const withVersion = (path) => {
    if (!path || /^(https?:|data:|blob:)/.test(path)) return path;
    return `${path}${path.includes("?") ? "&" : "?"}v=vector-final-1`;
  };
  img.loading = "lazy";
  img.decoding = "async";
  img.hidden = false;
  if (alt) img.alt = alt;
  img.removeAttribute("data-image-error");
  img.onerror = () => {
    console.warn("[BlogMaterials] image failed:", safeSrc);
    img.dataset.imageError = "true";
    if (safeFallback && img.dataset.fallbackApplied !== "true") {
      img.dataset.fallbackApplied = "true";
      img.src = withVersion(safeFallback);
    }
  };
  img.removeAttribute("data-fallback-applied");
  img.src = withVersion(safeSrc);
  return true;
}

console.table(
  Object.entries(BLOG_MATERIALS.roomMap || {}).map(([room, data]) => ({
    room,
    painting: data.painting || "",
    scene: data.scene || "",
    mainCat: data.mainCat || "",
    prop: data.prop || "",
    plant: data.plant || data.plantMain || "",
    lamp: data.lamp || ""
  }))
);

const interestTypes = ["全部", "艺术", "音乐", "电影", "阅读", "展览", "生活灵感"];

const wishMenu = [
  { key: "big-ticket", text: "今天开大单", cost: 6 },
  { key: "new-client", text: "今天拓新有望", cost: 9 },
  { key: "no-redemption", text: "今天不赎回", cost: 12 },
  { key: "smooth-meeting", text: "客户会议顺利", cost: 15 },
  { key: "roadshow-glow", text: "产品路演发光", cost: 24 },
  { key: "aum-steady", text: "本周稳住规模", cost: 36 }
];

const mysteryBoxes = {
  "健康": [
    "人体的嗅觉和记忆联系很深，所以某一种气味常常能瞬间把人带回很多年前。",
    "晒太阳不只是为了维生素 D，规律接触自然光也会帮助身体校准睡眠节律。",
    "喝温水本身不神奇，但慢一点喝水会给身体一个“现在可以放松”的信号。",
    "皮肤屏障也有自己的节律，睡眠不足时，皮肤更容易觉得干、痒、敏感。",
    "深长呼气会轻轻拉动副交感神经，很多人会因此感觉身体慢慢降速。",
    "人在安静坐下后仍需要一点时间才感觉放松，因为身体的紧张通常比念头退得更慢。",
    "规律吃饭会给身体提供时间线索，因此饮食节奏也会间接影响睡眠和精神状态。",
    "轻微活动能帮助静脉把血液送回心脏，久坐时偶尔抬脚或走动会更舒服。",
    "皮肤的温度感受器会把冷暖信息传给大脑，所以温暖的触感常与安心感联系在一起。",
    "打哈欠不一定只是困，它也可能出现在大脑切换状态、调节警觉度的时候。"
  ],
  "心理": [
    "人脑会更容易记住未完成的事，所以睡前把待办写下来，反而可能让脑子安静。",
    "把情绪命名出来，比如“我现在有点紧张”，常常会让情绪强度下降一点。",
    "安全感不总是来自答案，有时来自一个稳定重复的小仪式。",
    "怀旧不一定是逃避，它也可能是在帮人重新确认：自己曾经被爱过、被陪伴过。",
    "人在疲惫时更容易把普通问题看成巨大问题，所以很多答案适合睡醒后再决定。",
    "比起笼统地说“我很糟”，描述具体感受更容易找到可以处理的那一小部分。",
    "熟悉的音乐能降低环境的不确定感，因此有些歌会像一个随身携带的房间。",
    "人们往往高估别人对自己小失误的关注，这种现象被称为聚光灯效应。",
    "完成一个很小的动作也会增强掌控感，所以低落时整理桌面的一角可能真的有用。",
    "心理恢复并不总是向上直线，有时状态反复只是身体仍在学习新的安全感。"
  ],
  "世界": [
    "冰岛没有蚊子，和当地气候、水体冻结方式以及蚊子生命周期很难衔接有关。",
    "威尼斯的很多建筑靠木桩支撑，木头在缺氧的水下反而不容易腐烂。",
    "日本有些车站会播放不同旋律，帮助乘客用声音辨认站点和方向。",
    "撒哈拉沙漠的尘埃会漂洋过海，给亚马孙雨林带去一部分矿物养分。",
    "世界上有些图书馆会收藏气味、种子和声音，不只收藏纸质书。",
    "南极洲其实是世界上最大的沙漠，因为判断沙漠的关键是降水少，而不是炎热。",
    "有些古老森林里的树会通过地下真菌网络交换养分和化学信号。",
    "地球上的大部分火山活动发生在海底，只是人类很少能直接看到。",
    "芬兰部分地区冬天会设置专门的积雪储存区，让积雪在夏季也能用于降温。",
    "海水看起来是蓝色，不只是反射天空，也因为水会吸收更多偏红波段的光。"
  ],
  "政治": [
    "很多国家的议会座位设计会影响辩论气氛：面对面更像交锋，半圆形更像协商。",
    "“影子内阁”是一种反对党制度设计，用来对应监督现任政府各部门。",
    "有些国家的选票故意设计得非常朴素，是为了减少视觉暗示对投票选择的影响。",
    "政治仪式里的服装、旗帜、座位顺序，常常在无声表达权力关系。",
    "地方自治的核心并不只是“离中央远”，而是让一部分公共事务更贴近日常生活。",
    "一些议会用抽签决定发言顺序，是为了减少资历和派系对程序的影响。",
    "现代预算公开制度的意义之一，是让公众能看见政策承诺最终流向了哪些具体支出。",
    "公民投票与普通选举不同，它通常让选民直接回答某一个具体公共议题。",
    "两院制议会常让两组代表以不同方式产生，用来增加决策中的复核与平衡。",
    "许多公共政策会设置试点期，是为了在全面实施前观察真实世界里的副作用。"
  ],
  "文学": [
    "很多小说里真正推动故事的不是事件，而是人物心里不愿说出口的那句话。",
    "日本私小说传统强调自我暴露，读起来常像作者把内心剖开给人看。",
    "哥特文学里的古堡、暗廊、雾气，常常不是背景，而是人物心理的外化。",
    "短篇小说很像一扇半开的门，厉害之处常在于它没有把所有房间都照亮。",
    "很多作家会反复书写同一个主题，不是重复，而是在不同年纪重新回答同一个问题。",
    "书信体小说会故意让读者只看到人物愿意写下的部分，因此沉默也构成情节。",
    "诗歌里的换行不仅控制节奏，也能让同一个词在句尾获得额外重量。",
    "不可靠叙述者并不一定说谎，也可能只是无法理解自己正在经历的事情。",
    "文学中的留白会邀请读者参与补全，所以没有写出的部分有时比结局更长久。",
    "同一个故事被不同人物讲述时，事实未必改变，但读者对真相的感觉会改变。"
  ]
};

const elements = {
  sessionArea: $("#sessionArea"),
  authStatus: $("#authStatus"),
  authMessage: $("#authMessage"),
  loginForm: $("#loginForm"),
  registerForm: $("#registerForm"),
  profileCard: $("#profileCard"),
  accountShare: $(".account-share"),
  avatarForm: $("#avatarForm"),
  avatarPreview: $("#avatarPreview"),
  avatarColorInput: $("#avatarColorInput"),
  avatarShapeInput: $("#avatarShapeInput"),
  avatarMarkInput: $("#avatarMarkInput"),
  avatarImageInput: $("#avatarImageInput"),
  postForm: $("#postForm"),
  categoryInput: $("#categoryInput"),
  interestTypeWrap: $("#interestTypeWrap"),
  interestTypeInput: $("#interestTypeInput"),
  titleInput: $("#titleInput"),
  bodyInput: $("#bodyInput"),
  bodyCount: $("#bodyCount"),
  imageInput: $("#imageInput"),
  videoInput: $("#videoInput"),
  imageSizeHint: $("#imageSizeHint"),
  videoSizeHint: $("#videoSizeHint"),
  clearImageInput: $("#clearImageInput"),
  clearVideoInput: $("#clearVideoInput"),
  chatForm: $("#chatForm"),
  chatBodyInput: $("#chatBodyInput"),
  chatImageInput: $("#chatImageInput"),
  chatList: $("#chatList"),
  koiCoinText: $("#koiCoinText"),
  wishOptions: $("#wishOptions"),
  wishHistory: $("#wishHistory"),
  mysteryBoxTabs: $("#mysteryBoxTabs"),
  mysteryBoxCard: $("#mysteryBoxCard"),
  lotteryTopicForm: $("#lotteryTopicForm"),
  lotteryTopicInput: $("#lotteryTopicInput"),
  lotteryTopicCard: $("#lotteryTopicCard"),
  lotteryEntryForm: $("#lotteryEntryForm"),
  lotteryEntryInput: $("#lotteryEntryInput"),
  lotteryResult: $("#lotteryResult"),
  lotteryEntries: $("#lotteryEntries"),
  lotteryHistory: $("#lotteryHistory"),
  eventLogForm: $("#eventLogForm"),
  eventTimeInput: $("#eventTimeInput"),
  medicineInput: $("#medicineInput"),
  eventNoteInput: $("#eventNoteInput"),
  medicineHistoryToggle: $("#medicineHistoryToggle"),
  copyMedicineSummary: $("#copyMedicineSummary"),
  eventLogList: $("#eventLogList"),
  hiveTotalText: $("#hiveTotalText"),
  hiveMonthSummary: $("#hiveMonthSummary"),
  hiveMonthGrid: $("#hiveMonthGrid"),
  sleepNowText: $("#sleepNowText"),
  sleepAffirmation: $("#sleepAffirmation"),
  sleepStartButton: $("#sleepStartButton"),
  sleepRecordText: $("#sleepRecordText"),
  sleepQuizForm: $("#sleepQuizForm"),
  sleepSummary: $("#sleepSummary"),
  podcastForm: $("#podcastForm"),
  podcastDateInput: $("#podcastDateInput"),
  podcastIssueInput: $("#podcastIssueInput"),
  podcastTopicInput: $("#podcastTopicInput"),
  podcastAudioInput: $("#podcastAudioInput"),
  podcastMusicInput: $("#podcastMusicInput"),
  podcastMusicPreset: $("#podcastMusicPreset"),
  podcastMusicOptions: $("#podcastMusicOptions"),
  podcastAudioHint: $("#podcastAudioHint"),
  podcastMusicHint: $("#podcastMusicHint"),
  podcastRecordStart: $("#podcastRecordStart"),
  podcastRecordStop: $("#podcastRecordStop"),
  podcastRecordTime: $("#podcastRecordTime"),
  podcastRecordPreview: $("#podcastRecordPreview"),
  podcastList: $("#podcastList"),
  cabinArtworkForm: $("#cabinArtworkForm"),
  cabinArtworkCategory: $("#cabinArtworkCategory"),
  cabinArtworkTitle: $("#cabinArtworkTitle"),
  cabinArtworkImage: $("#cabinArtworkImage"),
  cabinGalleryGrid: $("#cabinGalleryGrid"),
  copyInviteButton: $("#copyInviteButton"),
  posterButton: $("#posterButton"),
  sharePoster: $("#sharePoster"),
  soundToggle: $("#soundToggle"),
  todayText: $("#todayText"),
  syncStatus: $("#syncStatus"),
  archiveTitle: $("#archiveTitle"),
  archiveToggle: $("#archiveToggle"),
  interestFilters: $("#interestFilters"),
  feed: $("#feed"),
  postTemplate: $("#postTemplate")
};

function setMessage(text, tone = "") {
  elements.authMessage.textContent = text;
  elements.authMessage.dataset.tone = tone;
}

function setSync(text) {
  elements.syncStatus.textContent = text;
}

function escapeHtml(value = "") {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function shanghaiNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
}

function dateKeyFromLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function lotteryWeekKey() {
  const now = shanghaiNow();
  const daysUntilSunday = (7 - now.getDay()) % 7;
  const drawDate = new Date(now);
  drawDate.setDate(now.getDate() + daysUntilSunday);
  return dateKeyFromLocal(drawDate);
}

function lotteryDrawTime(topicDate) {
  return new Date(`${topicDate}T21:00:00+08:00`);
}

function isLotteryDrawn(topic) {
  return Boolean(topic && Date.now() >= lotteryDrawTime(topic.topic_date).getTime());
}

function formatLotteryDrawTime(topicDate) {
  return `${topicDate} 周日 21:00`;
}

function stableHash(text = "") {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function normalizeHandle(handle) {
  return handle.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 24);
}

function rpcErrorText(error, fallback) {
  return error?.message?.replace(/^.*ERROR:\s*/i, "") || fallback;
}

function formatFileSize(bytes = 0) {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

function saveSession(result) {
  sessionToken = result.token;
  localStorage.setItem(sessionKey, sessionToken);
  profile = {
    user_id: result.account.id,
    id: result.account.id,
    handle: result.account.handle,
    avatar: result.account.avatar,
    role: result.account.role
  };
}

function clearSession() {
  sessionToken = "";
  profile = null;
  localStorage.removeItem(sessionKey);
}

function compressPhoto(file, options = {}) {
  if (!file) return Promise.resolve(null);
  const maxSide = options.maxSide || 900;
  const quality = options.quality || 0.72;
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("not image"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("photo read failed"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("photo load failed"));
      image.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadPostVideo(file) {
  if (!file) return null;
  const maxBytes = 50 * 1024 * 1024;
  if (!file.type.startsWith("video/")) {
    throw new Error("not video");
  }
  if (file.size > maxBytes) {
    throw new Error("video too large");
  }
  const extension = (file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
  const path = `${profile.user_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const { error } = await client.storage.from("blog-videos").upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type || "video/mp4",
    upsert: false
  });
  if (error) throw error;
  const { data } = client.storage.from("blog-videos").getPublicUrl(path);
  return data.publicUrl;
}

function defaultAvatar(mark = "R") {
  return { color: "#b62548", shape: "circle", mark: mark.slice(0, 2).toUpperCase() || "R" };
}

function avatarFromProfile(item) {
  return item?.avatar || defaultAvatar(item?.handle || item?.display_name || "R");
}

function paintAvatar(node, avatar) {
  node.className = `user-avatar user-avatar--${avatar.shape || "circle"}`;
  node.style.setProperty("--avatar-color", avatar.color || "#b62548");
  node.innerHTML = avatar.image
    ? `<img src="${avatar.image}" alt="" loading="lazy" decoding="async" />`
    : `<span>${escapeHtml(avatar.mark || "R")}</span>`;
}

function renderAvatarPreview() {
  const currentAvatar = avatarFromProfile(profile);
  const avatar = {
    color: elements.avatarColorInput.value,
    shape: elements.avatarShapeInput.value,
    mark: elements.avatarMarkInput.value || "R",
    image: pendingAvatarImage || currentAvatar.image || ""
  };
  elements.avatarPreview.style.setProperty("--avatar-color", avatar.color);
  elements.avatarPreview.dataset.shape = avatar.shape;
  elements.avatarPreview.innerHTML = avatar.image
    ? `<img src="${avatar.image}" alt="" loading="lazy" decoding="async" />`
    : `<span>${escapeHtml(avatar.mark)}</span>`;
}

function koiStatsFor(userId) {
  if (!userId) return { likes: 0, comments: 0, earned: 0, spent: 0, balance: 0 };
  const likeCoins = likes.filter((item) => item.owner_id === userId).length;
  const commentCoins = comments.filter((item) => item.owner_id === userId).length * 3;
  const spent = koiWishes
    .filter((wish) => wish.owner_id === userId)
    .reduce((total, wish) => total + Number(wish.cost || 0), 0);
  const earned = likeCoins + commentCoins;
  return { likes: likeCoins, comments: commentCoins, earned, spent, balance: Math.max(0, earned - spent) };
}

function renderWishPool() {
  if (!elements.koiCoinText || !elements.wishOptions || !elements.wishHistory) return;
  const stats = koiStatsFor(profile?.user_id);
  elements.koiCoinText.textContent = profile ? `锦鲤币 ${stats.balance}` : "登录后积累";
  elements.wishOptions.innerHTML = "";
  wishMenu.forEach((wish) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wish-option";
    button.disabled = !profile || stats.balance < wish.cost;
    button.innerHTML = `<strong>${escapeHtml(wish.text)}</strong><span>${wish.cost} 枚</span>`;
    button.addEventListener("click", () => makeKoiWish(wish));
    elements.wishOptions.append(button);
  });

  const recent = koiWishes
    .filter((wish) => !profile || wish.owner_id === profile.user_id)
    .slice(0, 6);
  if (!recent.length) {
    elements.wishHistory.innerHTML = `<p>还没有投愿望。先去评论或给文章点赞，攒一点锦鲤币。</p>`;
    return;
  }
  elements.wishHistory.innerHTML = recent.map((wish) => {
    const author = profiles.get(wish.owner_id);
    return `
      <article>
        <span>${escapeHtml(author?.handle || "朋友")}</span>
        <strong>${escapeHtml(wish.wish_text || wish.text || "投了一个愿望")}</strong>
        <small>-${Number(wish.cost || 0)} 枚 · ${formatDate(wish.created_at)}</small>
      </article>
    `;
  }).join("");
}

async function uploadPodcastAudio(file, kind = "episode") {
  if (!file) return null;
  const maxBytes = 100 * 1024 * 1024;
  if (!file.type.startsWith("audio/")) throw new Error("not audio");
  if (file.size > maxBytes) throw new Error("audio too large");
  const extension = (file.name.split(".").pop() || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp3";
  const path = `${profile.user_id}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const { error } = await client.storage.from("blog-audio").upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type || "audio/mpeg",
    upsert: false
  });
  if (error) throw error;
  return client.storage.from("blog-audio").getPublicUrl(path).data.publicUrl;
}

function dailyMysteryFor(category) {
  const facts = mysteryBoxes[category] || [];
  if (!facts.length) return "";
  const pairedFacts = facts.flatMap((fact, index) => (
    facts.slice(index + 1).map((second) => `${fact} 还有一个相关的小发现：${second}`)
  ));
  const list = [...facts, ...pairedFacts];
  const storageKey = "rose-blog-mystery-history-v1";
  let history = {};
  try {
    history = JSON.parse(localStorage.getItem(storageKey) || "{}") || {};
  } catch {
    history = {};
  }
  const categoryHistory = history[category] || {};
  const date = todayKey();
  if (categoryHistory[date] && list.includes(categoryHistory[date])) return categoryHistory[date];
  const seen = new Set(Object.values(categoryHistory));
  const available = list.filter((fact) => !seen.has(fact));
  const pool = available.length ? available : list;
  const fact = pool[stableHash(`${date}:${category}`) % pool.length];
  history[category] = { ...categoryHistory, [date]: fact };
  try {
    localStorage.setItem(storageKey, JSON.stringify(history));
  } catch {
    // The daily fact still works when private browsing blocks storage.
  }
  return fact;
}

function renderMysteryBox() {
  if (!elements.mysteryBoxTabs || !elements.mysteryBoxCard) return;
  elements.mysteryBoxTabs.innerHTML = "";
  Object.keys(mysteryBoxes).forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = category;
    button.classList.toggle("active", category === activeMysteryCategory);
    button.addEventListener("click", () => {
      activeMysteryCategory = category;
      renderMysteryBox();
    });
    elements.mysteryBoxTabs.append(button);
  });
  elements.mysteryBoxCard.innerHTML = `
    <small>${todayKey()} / ${escapeHtml(activeMysteryCategory)}</small>
    <p>${escapeHtml(dailyMysteryFor(activeMysteryCategory))}</p>
  `;
}

async function makeKoiWish(wish) {
  if (!profile) {
    setMessage("请先登录，再去许愿池投愿望。", "error");
    return;
  }
  const stats = koiStatsFor(profile.user_id);
  if (stats.balance < wish.cost) {
    setMessage("锦鲤币还不够，再评论或点赞攒一点。", "error");
    return;
  }
  const { error } = await client.rpc("create_koi_wish", {
    session_token: sessionToken,
    wish_key_input: wish.key,
    wish_text_input: wish.text,
    cost_input: wish.cost
  });
  if (error) {
    setMessage(rpcErrorText(error, "许愿失败，请确认新版 SQL 已运行。"), "error");
    return;
  }
  setMessage(`愿望已投入许愿池：${wish.text}`, "ok");
  await loadBlog();
}

function currentLotteryTopic() {
  const today = todayKey();
  return lotteryTopics.find((topic) => topic.topic_date === today) || null;
}

function winnerForTopic(topic, entries) {
  if (!topic || !entries.length) return null;
  const uniqueEntries = [...new Map(entries.map((entry) => [entry.owner_id, entry])).values()]
    .sort((a, b) => String(a.owner_id).localeCompare(String(b.owner_id)));
  if (!uniqueEntries.length) return null;
  const index = stableHash(`${topic.topic_date}:${topic.topic_text}`) % uniqueEntries.length;
  return uniqueEntries[index];
}

const lotteryBlessings = [
  "本周所行皆有回声，认真种下的事，会在合适的时候开花。",
  "愿你这一周判断清醒、行动轻盈，好消息沿着来路慢慢靠近。",
  "本周的好运不必喧哗，它会藏在一次顺利沟通和一个意外机会里。",
  "愿你手里的事情稳稳落地，想见的人有回应，想做的事有进展。",
  "这一周请相信自己的节奏，慢一点也没有关系，方向正确就会抵达。",
  "愿本周的你被善意照亮，也有余力把温柔留给身边的人。",
  "本周宜向前一步：新的连接、新的答案，正在比想象中更近的地方。",
  "愿你本周少一些内耗，多一些笃定；每一次选择都更靠近心里的光。",
  "这一周会有一件小事替你证明，耐心并没有被辜负。",
  "愿你本周遇事有解、忙中有闲，所有努力都落在值得的地方。",
  "本周的风向正在变好，保持敏锐，也记得给自己留一点松弛。",
  "愿这一周的你既有赢得结果的锋芒，也有安放自己的柔软。"
];

function blessingForTopic(topic, winner) {
  const key = `${topic?.topic_date || ""}:${topic?.topic_text || ""}:${winner?.owner_id || ""}`;
  return lotteryBlessings[stableHash(key) % lotteryBlessings.length];
}

function renderLotteryHistory() {
  if (!elements.lotteryHistory) return;
  const drawnTopics = lotteryTopics
    .filter((topic) => isLotteryDrawn(topic))
    .sort((a, b) => String(b.topic_date).localeCompare(String(a.topic_date)))
    .slice(0, 12);
  if (!drawnTopics.length) {
    elements.lotteryHistory.innerHTML = "";
    return;
  }
  elements.lotteryHistory.innerHTML = `
    <div class="lottery-history__head">
      <strong>往期开奖</strong>
      <small>中奖名单会一直保留</small>
    </div>
    ${drawnTopics.map((topic) => {
      const entries = lotteryEntries.filter((entry) => entry.topic_id === topic.id);
      const winner = winnerForTopic(topic, entries);
      const winnerProfile = winner ? profiles.get(winner.owner_id) : null;
      return `
        <article class="lottery-history__item">
          <div>
            <time>${escapeHtml(topic.topic_date)}</time>
            <span>${escapeHtml(topic.topic_text || "本周话题")}</span>
          </div>
          ${winner ? `
            <strong>中奖 ID：${escapeHtml(winnerProfile?.handle || "朋友")}</strong>
            <p>${escapeHtml(blessingForTopic(topic, winner))}</p>
          ` : `<p>本期无人参与，未产生中奖者。</p>`}
        </article>
      `;
    }).join("")}
  `;
}



function currentLotteryTopic() {
  const week = lotteryWeekKey();
  return lotteryTopics.find((topic) => topic.topic_date === week) || null;
}



function renderLottery() {
  const topic = currentLotteryTopic();
  const entries = topic ? lotteryEntries.filter((entry) => entry.topic_id === topic.id) : [];
  const drawn = isLotteryDrawn(topic);
  const winner = drawn ? winnerForTopic(topic, entries) : null;
  const hasEntered = Boolean(profile && entries.some((entry) => entry.owner_id === profile.user_id));
  renderLotteryHistory();

  elements.lotteryTopicForm.hidden = profile?.role !== "owner";
  elements.lotteryEntryForm.hidden = !profile || !topic || hasEntered || drawn;

  if (!topic) {
    elements.lotteryTopicCard.innerHTML = `
      <p>本周还没有讨论话题。站主发布本周话题后，朋友们才能参与抽奖。</p>
    `;
    elements.lotteryResult.innerHTML = `<p>统一开奖时间：每周日 21:00。</p>`;
    elements.lotteryEntries.innerHTML = "";
    return;
  }

  elements.lotteryTopicCard.innerHTML = `
    <span>本周开奖：${escapeHtml(formatLotteryDrawTime(topic.topic_date))}</span>
    <strong>${escapeHtml(topic.topic_text)}</strong>
    <small>每个 ID 本周可参与一次，奖品：站主邀请喝 Manner 一次。</small>
  `;

  if (!profile) {
    elements.lotteryResult.innerHTML = `<p>登录 ID 后可以参与本周抽奖。</p>`;
  } else if (hasEntered && !drawn) {
    elements.lotteryResult.innerHTML = `<p>你已经参与本周抽奖。周日 21:00 自动公布获奖 ID。</p>`;
  } else if (!drawn) {
    elements.lotteryResult.innerHTML = `<p>本周已有 ${entries.length} 位朋友参与。周日 21:00 自动公布获奖 ID。</p>`;
  } else if (winner) {
    const winnerProfile = profiles.get(winner.owner_id);
    elements.lotteryResult.innerHTML = `
      <strong>本周获奖 ID：${escapeHtml(winnerProfile?.handle || "朋友")}</strong>
      <span>奖品：站主邀请喝 Manner 一次</span>
      <p class="lottery-blessing">${escapeHtml(blessingForTopic(topic, winner))}</p>
    `;
  } else {
    elements.lotteryResult.innerHTML = `<p>本周还没有朋友参与，所以这周暂不开奖。</p>`;
  }

  elements.lotteryEntries.innerHTML = entries.length ? entries.map((entry) => {
    const author = profiles.get(entry.owner_id);
    return `
      <article>
        <strong>${escapeHtml(author?.handle || "朋友")}</strong>
        <p>${escapeHtml(entry.body)}</p>
        <small>${formatDate(entry.created_at)}</small>
      </article>
    `;
  }).join("") : `<p>暂无参与留言。</p>`;
}

function moodFromText(text = "") {
  const value = text.toLowerCase();
  const moodRules = [
    { label: "开心", face: ":-)", tone: "happy", words: ["开心", "高兴", "快乐", "喜欢", "哈哈", "好耶", "棒", "爱", "幸福"] },
    { label: "想念", face: "<3", tone: "miss", words: ["想你", "想念", "怀念", "记得", "以前", "回忆", "思念"] },
    { label: "疲惫", face: "-_-", tone: "tired", words: ["累", "困", "疲惫", "加班", "忙", "撑不住", "睡"] },
    { label: "难过", face: ":'(", tone: "sad", words: ["难过", "伤心", "哭", "失落", "痛", "烦", "崩溃", "委屈"] },
    { label: "闪亮", face: "*", tone: "bright", words: ["期待", "希望", "加油", "明天", "漂亮", "浪漫", "惊喜"] }
  ];
  const found = moodRules.find((rule) => rule.words.some((word) => value.includes(word)));
  return found || { label: "安静", face: "...", tone: "calm" };
}

function moodBubble(text) {
  const mood = moodFromText(text);
  return `<span class="mood-bubble mood-bubble--${mood.tone}" title="根据留言自动判断">${mood.face} ${mood.label}</span>`;
}

function renderSession() {
  elements.sessionArea.replaceChildren();
  window.updateCabinOwnerControls?.();
  elements.authStatus.textContent = profile ? `已登录：${profile.handle}` : "未登录";

  if (!profile) {
    const accountButton = document.createElement("button");
    accountButton.type = "button";
    accountButton.className = "quick-account-button";
    accountButton.textContent = hasCloud ? "登录" : "云端未连接";
    accountButton.addEventListener("click", openAccountBookmark);
    elements.sessionArea.append(accountButton);
    elements.profileCard.hidden = true;
    elements.avatarForm.hidden = true;
    if (elements.accountShare) elements.accountShare.hidden = true;
    renderWishPool();
    return;
  }

  const name = document.createElement("button");
  name.type = "button";
  name.className = "quick-account-button";
  name.textContent = profile.handle;
  name.addEventListener("click", openAccountBookmark);
  const logout = document.createElement("button");
  logout.type = "button";
  logout.textContent = "退出";
  logout.addEventListener("click", () => {
    clearSession();
    renderSession();
    renderFeed();
    renderChat();
    renderWishPool();
    if (retiredModulesEnabled) renderLottery();
    setMessage("已退出。");
  });
  elements.sessionArea.append(name, logout);

  elements.profileCard.hidden = false;
  elements.avatarForm.hidden = false;
  if (elements.accountShare) elements.accountShare.hidden = false;
  elements.profileCard.innerHTML = `
    <strong>${escapeHtml(profile.handle)}</strong>
    <p>${profile.role === "owner" ? "站主账号" : "朋友账号"}</p>
  `;
  const avatar = avatarFromProfile(profile);
  pendingAvatarImage = null;
  elements.avatarColorInput.value = avatar.color || "#b62548";
  elements.avatarShapeInput.value = avatar.shape || "circle";
  elements.avatarMarkInput.value = avatar.mark || "R";
  elements.avatarImageInput.value = "";
  renderAvatarPreview();
  renderWishPool();
  if (retiredModulesEnabled) renderLottery();
}

function switchAuthTab(tab) {
  $$(".auth-tabs button").forEach((button) => button.classList.toggle("active", button.dataset.authTab === tab));
  elements.loginForm.hidden = tab !== "login";
  elements.registerForm.hidden = tab !== "register";
}

function openAccountBookmark() {
  const accountTab = document.querySelector('[data-bookmark-target=".auth-panel"]');
  if (accountTab) accountTab.click();
}

function updateArchiveVisibility() {
  if (!elements.feed || !elements.archiveToggle) return;
  elements.feed.classList.toggle("is-collapsed", !archiveOpen);
  elements.archiveToggle.textContent = archiveOpen ? "收起旧文" : "查看旧日志";
}

function bindArchiveToggle() {
  if (!elements.archiveToggle) return;
  elements.archiveToggle.addEventListener("click", () => {
    archiveOpen = !archiveOpen;
    updateArchiveVisibility();
  });
}

function openArticleArchive() {
  const mainLayout = document.getElementById("mainLayout");
  const articlesSection = document.getElementById("articlesSection");
  if (mainLayout) mainLayout.hidden = false;
  if (articlesSection) articlesSection.hidden = false;
  archiveOpen = true;
  updateArchiveVisibility();
  renderFeed();
  requestAnimationFrame(() => {
    (elements.archiveTitle || articlesSection)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

async function refreshSession() {
  if (!hasCloud) {
    setMessage("云端账号还没连接。请确认 config.js 已填 Supabase 地址和公开钥匙。", "error");
    renderSession();
    return;
  }
  if (sessionToken) {
    const { data, error } = await client.rpc("get_blog_session", { session_token: sessionToken });
    if (error) {
      clearSession();
    } else {
      profile = { user_id: data.id, id: data.id, handle: data.handle, avatar: data.avatar, role: data.role };
    }
  }
  renderSession();
  await loadBlog();
}

async function safeQuery(label, queryPromise, fallback = []) {
  try {
    const result = await queryPromise;
    if (result.error) {
      console.warn(`[${label}]`, result.error);
      return fallback;
    }
    return result.data || fallback;
  } catch (error) {
    console.warn(`[${label}]`, error);
    return fallback;
  }
}

let extendedBlogLoaded = false;
let extendedBlogLoading = null;
let blogCoreLoading = null;

async function loadBlog(options = {}) {
  if (!client) return;
  if (blogCoreLoading) return blogCoreLoading;
  const forceExtended = Boolean(options.forceExtended);
  blogCoreLoading = (async () => {
    setSync("???");
    const [postResult, commentResult, profileResult, likeResult, chatResult, chatLikeResult] = await Promise.all([
      client.from("blog_posts").select("*").order("created_at", { ascending: false }).limit(80),
      client.from("blog_comments").select("*").order("created_at", { ascending: true }).limit(500),
      client.from("blog_accounts").select("id, handle, avatar, role"),
      client.from("blog_post_likes").select("*"),
      client.from("chat_messages").select("*").order("created_at", { ascending: false }).limit(80),
      client.from("chat_message_likes").select("*")
    ]);
    for (const result of [postResult, commentResult, profileResult, likeResult, chatResult, chatLikeResult]) {
      if (result.error) throw result.error;
    }

    posts = postResult.data || [];
    comments = commentResult.data || [];
    likes = likeResult.data || [];
    chatMessages = chatResult.data || [];
    chatLikes = chatLikeResult.data || [];
    profiles = new Map((profileResult.data || []).map((item) => [item.id, { ...item, user_id: item.id }]));
    setSync("?????");
    renderFeed();
    renderChat();
    renderWishPool();
    if (forceExtended) {
      await loadExtendedBlogData({ force: true });
    } else {
      // Extended modules load when their bookmark/section is opened.
    }
  })().catch((error) => {
    console.error("[loadBlog:core]", error);
    setSync("?????? SQL");
    elements.feed.innerHTML = `<div class="empty">?????????????????? supabase-setup.sql ??? Supabase ? SQL Editor ??????</div>`;
    elements.chatList.innerHTML = `<div class="empty">???????????</div>`;
  }).finally(() => {
    blogCoreLoading = null;
  });
  return blogCoreLoading;
}

async function loadExtendedBlogData({ force = false } = {}) {
  if (!client) return;
  if (extendedBlogLoaded && !force) return;
  if (extendedBlogLoading) return extendedBlogLoading;
  extendedBlogLoading = (async () => {
    const [wishData, podcastData, podcastCommentData, podcastLikeData, cabinArtworkData, mimiCareData, cabinRecordingData] = await Promise.all([
      safeQuery("koi_wishes", client.from("koi_wishes").select("*").order("created_at", { ascending: false }).limit(80)),
      safeQuery("blog_podcasts", client.from("blog_podcasts").select("*").order("publish_date", { ascending: false }).order("issue_no", { ascending: false }).limit(40)),
      safeQuery("podcast_comments", client.from("podcast_comments").select("*").order("created_at", { ascending: true }).limit(240)),
      safeQuery("podcast_likes", client.from("podcast_likes").select("*")),
      safeQuery("cabin_artworks", client.from("cabin_artworks").select("*").order("created_at", { ascending: false }).limit(80)),
      safeQuery("mimi_care_logs", client.from("mimi_care_logs").select("*").order("created_at", { ascending: false }).limit(40)),
      safeQuery("cabin_music_recordings", client.from("cabin_music_recordings").select("*").order("created_at", { ascending: false }).limit(30))
    ]);
    koiWishes = wishData;
    lotteryTopics = [];
    lotteryEntries = [];
    eventLogs = [];
    podcasts = podcastData;
    podcastComments = podcastCommentData;
    podcastLikes = podcastLikeData;
    cabinArtworks = cabinArtworkData;
    mimiCareLogs = mimiCareData;
    cabinRecordings = cabinRecordingData;
    extendedBlogLoaded = true;
    renderWishPool();
    renderPodcasts();
    renderCabinGallery();
    renderMimiCareLogs();
    renderCabinRecordings();
  })().catch((error) => {
    console.warn("[loadBlog:extended]", error);
  }).finally(() => {
    extendedBlogLoading = null;
  });
  return extendedBlogLoading;
}

function scheduleExtendedBlogLoad() {
  if (extendedBlogLoaded || extendedBlogLoading) return;
  const run = () => loadExtendedBlogData().catch((error) => console.warn("[loadBlog:extended]", error));
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 2500 });
  } else {
    window.setTimeout(run, 900);
  }
}

function setCategory(category, shouldScroll = false) {
  activeCategory = "文章";
  elements.categoryInput.value = "文章";
  activeInterest = "全部";
  if (elements.interestTypeWrap) elements.interestTypeWrap.hidden = true;
  elements.archiveTitle.innerHTML = `
    <div class="archive-title__copy">
      <span>旧日志和文章</span>
      <small id="syncStatus">${escapeHtml(elements.syncStatus?.textContent || "准备同步")}</small>
    </div>
    <button id="archiveToggle" type="button">${archiveOpen ? "收起旧文" : "查看旧日志"}</button>
  `;
  elements.syncStatus = $("#syncStatus");
  elements.archiveToggle = $("#archiveToggle");
  archiveOpen = false;
  updateArchiveVisibility();
  bindArchiveToggle();
  $$("[data-category]").forEach((button) => {
    if (button.tagName === "BUTTON") button.classList.toggle("active", button.dataset.category === "文章");
  });
  renderInterestFilters();
  renderFeed();
  if (shouldScroll) {
    elements.archiveTitle.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderInterestFilters() {
  if (!elements.interestFilters) return;
  elements.interestFilters.hidden = activeCategory !== "兴趣";
  if (activeCategory !== "兴趣") {
    elements.interestFilters.innerHTML = "";
    return;
  }
  elements.interestFilters.innerHTML = interestTypes.map((type) => (
    `<button type="button" class="${type === activeInterest ? "active" : ""}" data-interest-filter="${escapeHtml(type)}">${escapeHtml(type)}</button>`
  )).join("");
  elements.interestFilters.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      activeInterest = button.dataset.interestFilter || "全部";
      renderInterestFilters();
      renderFeed();
    });
  });
}

function renderFeed() {
  const articleCategories = new Set(["文章", "日志", "小说"]);
  const visible = posts.filter((post) => articleCategories.has(post.category));
  const displayPosts = visible.slice(0, feedVisibleCount);
  elements.feed.innerHTML = "";
  if (!visible.length) {
    elements.feed.innerHTML = `<div class="empty">还没有历史文章。</div>`;
    return;
  }

  displayPosts.forEach((post) => {
    const node = elements.postTemplate.content.firstElementChild.cloneNode(true);
    const author = profiles.get(post.owner_id);
    paintAvatar(node.querySelector(".user-avatar"), avatarFromProfile(author));
    node.querySelector("h3").textContent = post.title;
    node.querySelector(".post__meta p").textContent = `${author?.handle || "朋友"} / ${formatDate(post.created_at)}`;
    node.querySelector(".mood").textContent = "文章";
    node.querySelector(".post__body").textContent = post.body;

    const image = node.querySelector(".post__image");
    const articleIllustrations = homepageImageMaterials.cards;
    const illustrationSeed = String(post.id || post.title || "article")
      .split("")
      .reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const articleIllustration = articleIllustrations.length
      ? articleIllustrations[illustrationSeed % articleIllustrations.length]
      : "";
    const postImageSource = post.image_url || articleIllustration;
    if (postImageSource) {
      setImageSafe(image, postImageSource, post.title || "文章插图");
      image.closest(".post__image-frame").hidden = false;
    }
    const video = node.querySelector(".post__video");
    if (post.video_url) {
      video.src = post.video_url;
      video.hidden = false;
    }

    const commentsArea = node.querySelector(".comments");
    const postActions = document.createElement("div");
    postActions.className = "post-actions";

    const likeButton = document.createElement("button");
    likeButton.type = "button";
    likeButton.className = "like-button";
    likeButton.textContent = `${isLiked(post.id) ? "已赞" : "点赞"} ${likeCount(post.id)}`;
    likeButton.disabled = !profile;
    likeButton.classList.toggle("is-liked", isLiked(post.id));
    likeButton.addEventListener("click", () => toggleLike(post.id));
    postActions.append(likeButton);

    if (canDeletePost(post)) {
      const deletePostButton = document.createElement("button");
      deletePostButton.type = "button";
      deletePostButton.className = "danger-button";
      deletePostButton.textContent = "删除";
      deletePostButton.addEventListener("click", () => deletePost(post.id));
      postActions.append(deletePostButton);
    }

    commentsArea.before(postActions);
    renderComments(node.querySelector(".comments"), post.id);
    const form = node.querySelector(".comment-form");
    form.hidden = !profile;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = form.querySelector("input");
      await addComment(post.id, null, input.value.trim());
      input.value = "";
    });
    elements.feed.append(node);
  });
  if (visible.length > displayPosts.length) {
    const more = document.createElement("button");
    more.type = "button";
    more.className = "load-more-button";
    more.textContent = `查看更多 ${Math.min(8, visible.length - displayPosts.length)} 篇`;
    more.addEventListener("click", () => {
      feedVisibleCount += 8;
      renderFeed();
    });
    elements.feed.append(more);
  }
}

function likeCount(postId) {
  return likes.filter((item) => item.post_id === postId).length;
}

function isLiked(postId) {
  return Boolean(profile && likes.some((item) => item.post_id === postId && item.owner_id === profile.user_id));
}

function canDeletePost(post) {
  return Boolean(profile && (profile.role === "owner" || post.owner_id === profile.user_id));
}

async function toggleLike(postId) {
  if (!profile) {
    setMessage("请先登录，再点赞。", "error");
    return;
  }
  const { error } = await client.rpc("toggle_blog_like", { session_token: sessionToken, post_uuid: postId });
  if (error) {
    setSync(rpcErrorText(error, "点赞失败"));
    return;
  }
  await loadBlog();
}

async function deletePost(id) {
  const { error } = await client.rpc("delete_blog_post", { session_token: sessionToken, post_uuid: id });
  if (error) {
    setSync(rpcErrorText(error, "删除失败"));
    return;
  }
  await loadBlog();
}

function renderComments(container, postId) {
  const list = comments.filter((item) => item.post_id === postId && !item.parent_id);
  container.innerHTML = list.length ? "" : `<p class="comment">还没有评论。</p>`;
  list.forEach((comment) => container.append(createCommentNode(comment)));
}

function createCommentNode(comment, isReply = false) {
  const author = profiles.get(comment.owner_id);
  const node = document.createElement("article");
  node.className = isReply ? "comment reply" : "comment";
  const canDelete = profile && (profile.role === "owner" || comment.owner_id === profile.user_id);
  node.innerHTML = `
    <div class="comment__head">
      <strong>${escapeHtml(author?.handle || "朋友")}</strong>
      ${moodBubble(comment.body)}
      <small>${formatDate(comment.created_at)}</small>
    </div>
    <p>${escapeHtml(comment.body)}</p>
    <div class="comment__actions"></div>
  `;

  const actions = node.querySelector(".comment__actions");
  if (profile) {
    const replyButton = document.createElement("button");
    replyButton.type = "button";
    replyButton.textContent = "回复";
    replyButton.addEventListener("click", () => showReplyForm(node, comment));
    actions.append(replyButton);
  }
  if (canDelete) {
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "删除";
    deleteButton.addEventListener("click", () => deleteComment(comment.id));
    actions.append(deleteButton);
  }

  comments.filter((item) => item.parent_id === comment.id).forEach((reply) => node.append(createCommentNode(reply, true)));
  return node;
}

function showReplyForm(node, comment) {
  const old = node.querySelector(".reply-form");
  if (old) old.remove();
  const form = document.createElement("form");
  form.className = "reply-form";
  form.innerHTML = `
    <input maxlength="500" placeholder="回复 ${escapeHtml(profiles.get(comment.owner_id)?.handle || "朋友")}" required />
    <button type="submit">发送</button>
  `;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await addComment(comment.post_id, comment.id, form.querySelector("input").value.trim());
  });
  node.append(form);
}

async function addComment(postId, parentId, body) {
  if (!profile || !body) return;
  const { error } = await client.rpc("create_blog_comment", {
    session_token: sessionToken,
    post_uuid: postId,
    parent_uuid: parentId,
    body_input: body
  });
  if (error) {
    setSync(rpcErrorText(error, "评论发送失败"));
    return;
  }
  await loadBlog();
}

async function deleteComment(id) {
  const { error } = await client.rpc("delete_blog_comment", { session_token: sessionToken, comment_uuid: id });
  if (error) {
    setSync(rpcErrorText(error, "删除失败"));
    return;
  }
  await loadBlog();
}

function chatLikeCount(messageId) {
  return chatLikes.filter((item) => item.message_id === messageId).length;
}

function isChatLiked(messageId) {
  return Boolean(profile && chatLikes.some((item) => item.message_id === messageId && item.owner_id === profile.user_id));
}

function canDeleteChat(message) {
  return Boolean(profile && (profile.role === "owner" || message.owner_id === profile.user_id));
}



async function toggleChatLike(messageId) {
  if (!profile) {
    setMessage("请先登录，再点赞。", "error");
    return;
  }
  const { error } = await client.rpc("toggle_chat_like", { session_token: sessionToken, message_uuid: messageId });
  if (error) {
    setSync(rpcErrorText(error, "讨论区点赞失败"));
    return;
  }
  await loadBlog();
}

async function deleteChatMessage(messageId) {
  const { error } = await client.rpc("delete_chat_message", { session_token: sessionToken, message_uuid: messageId });
  if (error) {
    setSync(rpcErrorText(error, "删除讨论消息失败"));
    return;
  }
  await loadBlog();
}

function renderChat() {
  elements.chatList.innerHTML = "";
  const topMessages = chatMessages.filter((message) => !message.parent_id);
  if (!topMessages.length) {
    elements.chatList.innerHTML = `<div class="empty">\u4e34\u65f6\u8ba8\u8bba\u533a\u8fd8\u6ca1\u6709\u6d88\u606f\u3002</div>`;
    return;
  }
  const expanded = elements.chatList.dataset.expanded === "true";
  const visibleCount = expanded ? topMessages.length : 30;
  topMessages.slice(0, visibleCount).forEach((message) => elements.chatList.append(createChatNode(message)));
  if (!expanded && topMessages.length > visibleCount) {
    const more = document.createElement("button");
    more.type = "button";
    more.className = "chat-load-more";
    more.textContent = `\u67e5\u770b\u66f4\u591a\u7559\u8a00\uff08\u8fd8\u6709 ${topMessages.length - visibleCount} \u6761\uff09`;
    more.addEventListener("click", () => {
      elements.chatList.dataset.expanded = "true";
      renderChat();
    });
    elements.chatList.append(more);
  }
}

function formatPodcastTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function bindPodcastPlayer(card, podcast) {
  const voice = new Audio(podcast.audio_url);
  const music = podcast.music_url ? new Audio(podcast.music_url) : null;
  const playButton = card.querySelector(".podcast-play");
  const progress = card.querySelector(".podcast-progress");
  const timeText = card.querySelector(".podcast-time");
  const speed = card.querySelector(".podcast-speed");
  const volume = card.querySelector(".podcast-volume");
  const musicToggle = card.querySelector(".podcast-music-toggle");
  let musicEnabled = Boolean(music);
  voice.preload = "metadata";
  if (music) {
    music.preload = "auto";
    music.loop = true;
  }

  const syncTime = () => {
    const duration = Number.isFinite(voice.duration) ? voice.duration : 0;
    progress.max = duration || 1;
    if (!progress.matches(":active")) progress.value = voice.currentTime || 0;
    timeText.textContent = `${formatPodcastTime(voice.currentTime)} / ${formatPodcastTime(duration)}`;
  };

  const pause = () => {
    voice.pause();
    music?.pause();
    playButton.textContent = "▶";
    playButton.classList.remove("is-playing");
    playButton.setAttribute("aria-label", "播放");
  };

  playButton.addEventListener("click", async () => {
    if (!voice.paused) {
      pause();
      return;
    }
    document.querySelectorAll(".podcast-play.is-playing").forEach((button) => button.click());
    if (music && musicEnabled) {
      music.currentTime = voice.currentTime % Math.max(music.duration || voice.duration || 1, 1);
      music.playbackRate = voice.playbackRate;
      music.volume = Number(volume.value) * 0.24;
      await music.play().catch(() => {});
    }
    await voice.play();
    playButton.textContent = "❚❚";
    playButton.classList.add("is-playing");
    playButton.setAttribute("aria-label", "暂停");
  });

  card.querySelector(".podcast-back").addEventListener("click", () => {
    voice.currentTime = Math.max(0, voice.currentTime - 15);
    if (music) music.currentTime = voice.currentTime % Math.max(music.duration || 1, 1);
  });
  card.querySelector(".podcast-forward").addEventListener("click", () => {
    voice.currentTime = Math.min(voice.duration || Infinity, voice.currentTime + 15);
    if (music) music.currentTime = voice.currentTime % Math.max(music.duration || 1, 1);
  });
  progress.addEventListener("input", () => {
    voice.currentTime = Number(progress.value);
    if (music) music.currentTime = voice.currentTime % Math.max(music.duration || 1, 1);
    syncTime();
  });
  speed.addEventListener("change", () => {
    voice.playbackRate = Number(speed.value);
    if (music) music.playbackRate = voice.playbackRate;
  });
  volume.addEventListener("input", () => {
    voice.volume = Number(volume.value);
    if (music) music.volume = Number(volume.value) * 0.24;
  });
  musicToggle?.addEventListener("click", async () => {
    musicEnabled = !musicEnabled;
    musicToggle.textContent = musicEnabled ? "关闭背景乐" : "开启背景乐";
    musicToggle.classList.toggle("active", musicEnabled);
    if (!musicEnabled) {
      music.pause();
    } else if (!voice.paused) {
      music.currentTime = voice.currentTime % Math.max(music.duration || voice.duration || 1, 1);
      music.playbackRate = voice.playbackRate;
      music.volume = Number(volume.value) * 0.24;
      await music.play().catch(() => {});
    }
  });
  voice.addEventListener("loadedmetadata", syncTime);
  voice.addEventListener("timeupdate", syncTime);
  voice.addEventListener("ended", () => {
    playButton.classList.remove("is-playing");
    pause();
    voice.currentTime = 0;
    syncTime();
  });
  syncTime();
}

function podcastLikeCount(podcastId) {
  return podcastLikes.filter((like) => like.podcast_id === podcastId).length;
}

function isPodcastLiked(podcastId) {
  return Boolean(profile && podcastLikes.some((like) => like.podcast_id === podcastId && like.owner_id === profile.user_id));
}

async function togglePodcastLike(podcastId) {
  if (!profile) return setMessage("请先登录，再点赞播客。", "error");
  const { error } = await client.rpc("toggle_podcast_like", { session_token: sessionToken, podcast_uuid: podcastId });
  if (error) return setMessage(rpcErrorText(error, "点赞失败"), "error");
  await loadBlog();
}

function createPodcastCommentNode(comment, podcastId, isReply = false) {
  const author = profiles.get(comment.owner_id);
  const node = document.createElement("article");
  node.className = isReply ? "podcast-comment podcast-comment--reply" : "podcast-comment";
  node.innerHTML = `
    <div class="podcast-comment__head"><strong>${escapeHtml(author?.handle || "朋友")}</strong><small>${formatDate(comment.created_at)}</small></div>
    <p>${escapeHtml(comment.body)}</p>
    <div class="podcast-comment__actions"></div>
  `;
  const actions = node.querySelector(".podcast-comment__actions");
  if (profile) {
    const reply = document.createElement("button");
    reply.type = "button";
    reply.textContent = "回复";
    reply.addEventListener("click", () => {
      node.querySelector(".podcast-reply-form")?.remove();
      const form = document.createElement("form");
      form.className = "podcast-reply-form";
      form.innerHTML = `<input maxlength="500" placeholder="回复 ${escapeHtml(author?.handle || "朋友")}" required /><button type="submit">发送</button>`;
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const body = form.querySelector("input").value.trim();
        if (!body) return;
        const { error } = await client.rpc("create_podcast_comment", { session_token: sessionToken, podcast_uuid: podcastId, parent_uuid: comment.id, body_input: body });
        if (error) return setMessage(rpcErrorText(error, "回复失败"), "error");
        await loadBlog();
      });
      node.append(form);
    });
    actions.append(reply);
  }
  if (profile && (profile.role === "owner" || profile.user_id === comment.owner_id)) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "删除";
    remove.addEventListener("click", async () => {
      const { error } = await client.rpc("delete_podcast_comment", { session_token: sessionToken, comment_uuid: comment.id });
      if (error) return setMessage(rpcErrorText(error, "删除失败"), "error");
      await loadBlog();
    });
    actions.append(remove);
  }
  podcastComments.filter((item) => item.parent_id === comment.id).forEach((reply) => node.append(createPodcastCommentNode(reply, podcastId, true)));
  return node;
}

async function sharePodcast(podcast) {
  const shareData = { title: `NO.${String(podcast.issue_no).padStart(3, "0")}期 ${podcast.topic}`, text: `来听这一期播客：${podcast.topic}`, url: window.location.href };
  if (navigator.share) {
    try { await navigator.share(shareData); } catch {}
    return;
  }
  await navigator.clipboard.writeText(`${shareData.title}\n${shareData.url}`);
  setMessage("播客链接已复制，可以发给朋友。", "ok");
}

function renderPodcasts() {
  if (!elements.podcastList) return;
  elements.podcastForm.hidden = profile?.role !== "owner";
  if (!podcasts.length) {
    elements.podcastList.innerHTML = `<div class="empty">还没有发布播客。</div>`;
    return;
  }
  elements.podcastList.innerHTML = "";
  podcasts.forEach((podcast) => {
    const card = document.createElement("article");
    card.className = "podcast-card";
    card.innerHTML = `
      <div class="podcast-card__head">
        <div>
          <time>${escapeHtml(podcast.publish_date || "")}</time>
          <h3>${escapeHtml(podcast.topic)}</h3>
        </div>
        <strong>NO.${String(podcast.issue_no).padStart(3, "0")}期</strong>
      </div>
      <div class="podcast-player">
        <div class="podcast-controls">
          <button class="podcast-back" type="button" aria-label="后退15秒">↶15</button>
          <button class="podcast-play" type="button" aria-label="播放">▶</button>
          <button class="podcast-forward" type="button" aria-label="快进15秒">15↷</button>
          <select class="podcast-speed" aria-label="播放倍速">
            <option value="0.75">0.75×</option>
            <option value="1" selected>1×</option>
            <option value="1.25">1.25×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
          </select>
        </div>
        <input class="podcast-progress" type="range" min="0" max="1" value="0" step="0.1" aria-label="播放进度" />
        <div class="podcast-player__foot">
          <span class="podcast-time">00:00 / 00:00</span>
          <label class="podcast-volume-wrap">音量 <input class="podcast-volume" type="range" min="0" max="1" value="0.8" step="0.05" aria-label="音量" /></label>
          ${podcast.music_url ? `<button class="podcast-music-toggle active" type="button">关闭背景乐</button>` : ""}
        </div>
      </div>
      <div class="podcast-social">
        <button class="podcast-like ${isPodcastLiked(podcast.id) ? "is-liked" : ""}" type="button">${isPodcastLiked(podcast.id) ? "已赞" : "点赞"} ${podcastLikeCount(podcast.id)}</button>
        <button class="podcast-share" type="button">转发</button>
        <span>${podcastComments.filter((item) => item.podcast_id === podcast.id).length} 条留言</span>
      </div>
      <div class="podcast-comments"></div>
      <form class="podcast-comment-form">
        <input maxlength="500" placeholder="听完后说点什么" ${profile ? "" : "disabled"} required />
        <button type="submit" ${profile ? "" : "disabled"}>留言</button>
      </form>
      ${profile?.role === "owner" ? `<button class="podcast-delete" type="button">删除本期</button>` : ""}
    `;
    bindPodcastPlayer(card, podcast);
    card.querySelector(".podcast-like").addEventListener("click", () => togglePodcastLike(podcast.id));
    card.querySelector(".podcast-share").addEventListener("click", () => sharePodcast(podcast));
    const commentsNode = card.querySelector(".podcast-comments");
    podcastComments.filter((item) => item.podcast_id === podcast.id && !item.parent_id).forEach((comment) => commentsNode.append(createPodcastCommentNode(comment, podcast.id)));
    card.querySelector(".podcast-comment-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!profile) return setMessage("请先登录，再留言。", "error");
      const input = event.currentTarget.querySelector("input");
      const body = input.value.trim();
      if (!body) return;
      const { error } = await client.rpc("create_podcast_comment", { session_token: sessionToken, podcast_uuid: podcast.id, parent_uuid: null, body_input: body });
      if (error) return setMessage(rpcErrorText(error, "留言失败"), "error");
      await loadBlog();
    });
    card.querySelector(".podcast-delete")?.addEventListener("click", async () => {
      if (!window.confirm(`确定删除 NO.${String(podcast.issue_no).padStart(3, "0")} 期吗？`)) return;
      const { error } = await client.rpc("delete_blog_podcast", { session_token: sessionToken, podcast_uuid: podcast.id });
      if (error) return setMessage(rpcErrorText(error, "删除失败"), "error");
      await loadBlog();
    });
    elements.podcastList.append(card);
  });
}

function createChatNode(message, isReply = false) {
  const author = profiles.get(message.owner_id);
  const item = document.createElement("article");
  item.className = isReply ? "chat-message chat-message--reply" : "chat-message";
  item.innerHTML = `
    <div class="chat-message__head">
      <strong>${escapeHtml(author?.handle || "朋友")}</strong>
      ${message.body ? moodBubble(message.body) : ""}
      <small>${formatDate(message.created_at)}</small>
    </div>
    ${message.body ? `<p>${escapeHtml(message.body)}</p>` : ""}
    ${message.image_url ? `<img src="${message.image_url}" alt="聊天贴图" loading="lazy" decoding="async" />` : ""}
    <div class="chat-message__actions"></div>
  `;
  const actions = item.querySelector(".chat-message__actions");
  const likeButton = document.createElement("button");
  likeButton.type = "button";
  likeButton.className = isChatLiked(message.id) ? "is-liked" : "";
  likeButton.textContent = `${isChatLiked(message.id) ? "已赞" : "点赞"} ${chatLikeCount(message.id)}`;
  likeButton.disabled = !profile;
  likeButton.addEventListener("click", () => toggleChatLike(message.id));
  actions.append(likeButton);

  if (profile) {
    const replyButton = document.createElement("button");
    replyButton.type = "button";
    replyButton.textContent = "回复";
    replyButton.addEventListener("click", () => showChatReplyForm(item, message));
    actions.append(replyButton);
  }

  if (canDeleteChat(message)) {
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "删除";
    deleteButton.addEventListener("click", () => deleteChatMessage(message.id));
    actions.append(deleteButton);
  }

  chatMessages
    .filter((reply) => reply.parent_id === message.id)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .forEach((reply) => item.append(createChatNode(reply, true)));
  return item;
}

function showChatReplyForm(node, message) {
  const old = node.querySelector(".chat-reply-form");
  if (old) old.remove();
  const form = document.createElement("form");
  form.className = "chat-reply-form";
  form.innerHTML = `
    <input maxlength="800" placeholder="回复 ${escapeHtml(profiles.get(message.owner_id)?.handle || "朋友")}" required />
    <button type="submit">发送</button>
  `;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await addChatMessage(form.querySelector("input").value.trim(), null, message.id);
  });
  node.append(form);
}

async function addChatMessage(body, imageUrl = null, parentId = null) {
  if (!profile) {
    setMessage("请先登录，再进入讨论区。", "error");
    return false;
  }
  if (!body && !imageUrl) {
    setSync("讨论区消息不能为空");
    return false;
  }
  const { error } = await client.rpc("create_chat_message", {
    session_token: sessionToken,
    body_input: body,
    image_input: imageUrl,
    parent_uuid: parentId
  });
  if (error) {
    setSync(rpcErrorText(error, "讨论区发送失败，请确认新版 SQL 已运行"));
    return false;
  }
  setSync(parentId ? "回复已发送" : "已发送");
  await loadBlog();
  return true;
}

function renderEventLogs() {
  if (!elements.eventLogList) return;
  renderHiveCounter();
  if (!eventLogs.length) {
    elements.eventLogList.innerHTML = `<div class="empty">还没有事件记录。</div>`;
    return;
  }
  elements.eventLogList.innerHTML = "";
  eventLogs.forEach((record) => {
    const author = profiles.get(record.owner_id);
    const item = document.createElement("article");
    item.className = "event-log-item";
    const medicine = record.medicine_name ? escapeHtml(record.medicine_name) : "未填写药名";
    item.innerHTML = `
      <div class="event-log-item__head">
        <strong>${medicine}</strong>
        <small>${formatDate(record.event_time || record.created_at)}</small>
      </div>
      <p>${escapeHtml(record.note || "无备注")}</p>
      <small>记录人：${escapeHtml(author?.handle || "站主")}</small>
      <div class="event-log-item__actions"></div>
    `;
    const actions = item.querySelector(".event-log-item__actions");
    if (profile && (profile.role === "owner" || record.owner_id === profile.user_id)) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "删除";
      button.addEventListener("click", () => deleteEventLog(record.id));
      actions.append(button);
    }
    elements.eventLogList.append(item);
  });
}

async function deleteEventLog(recordId) {
  const { error } = await client.rpc("delete_health_event_log", {
    session_token: sessionToken,
    record_uuid: recordId
  });
  if (error) {
    setSync(rpcErrorText(error, "删除记录失败"));
    return;
  }
  await loadBlog();
}

function medicineRecords() {
  return eventLogs
    .filter((record) => String(record.medicine_name || "").trim())
    .sort((a, b) => new Date(b.event_time || b.created_at) - new Date(a.event_time || a.created_at));
}

function renderMedicineHistory() {
  if (!elements.eventLogList) return;
  const records = medicineRecords();
  if (elements.medicineHistoryToggle) {
    elements.medicineHistoryToggle.textContent = medicineHistoryOpen ? "收起服药记录" : "查看服药记录";
  }
  elements.eventLogList.innerHTML = "";
  elements.eventLogList.hidden = !medicineHistoryOpen;
  if (!medicineHistoryOpen) return;
  if (!records.length) {
    elements.eventLogList.innerHTML = `<div class="empty">还没有服药记录。保存药品种类后，会自动出现在这里。</div>`;
    return;
  }
  records.forEach((record) => {
    const author = profiles.get(record.owner_id);
    const item = document.createElement("article");
    item.className = "event-log-item medicine-record";
    item.innerHTML = `
      <div class="event-log-item__head">
        <strong>${escapeHtml(record.medicine_name)}</strong>
        <small>${formatDate(record.event_time || record.created_at)}</small>
      </div>
      <p>${escapeHtml(record.note || "没有备注")}</p>
      <small>记录人：${escapeHtml(author?.handle || "站主")}</small>
      <div class="event-log-item__actions"></div>
    `;
    const actions = item.querySelector(".event-log-item__actions");
    if (profile && (profile.role === "owner" || record.owner_id === profile.user_id)) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "删除";
      button.addEventListener("click", () => deleteEventLog(record.id));
      actions.append(button);
    }
    elements.eventLogList.append(item);
  });
}

function medicineSummaryText() {
  const { monthPrefix, areaTotals } = hiveCountsForMonth();
  const [year, month] = monthPrefix.split("-").map(Number);
  const monthRecords = medicineRecords()
    .filter((record) => localDateKeyInShanghai(record.event_time || record.created_at).startsWith(monthPrefix))
    .sort((a, b) => new Date(a.event_time || a.created_at) - new Date(b.event_time || b.created_at));
  const hiveText = hiveAreas.map((area) => `${area}${areaTotals[area] || 0}次`).join("，");
  const medicineText = monthRecords.length
    ? monthRecords.map((record) => {
        const time = new Intl.DateTimeFormat("zh-CN", {
          timeZone: "Asia/Shanghai",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        }).format(new Date(record.event_time || record.created_at));
        const note = record.note ? `；备注：${record.note}` : "";
        return `${time} ${record.medicine_name}${note}`;
      }).join("\n")
    : "本月暂无服药记录。";
  return [
    `荨麻疹复诊摘要（${year}年${month}月）`,
    `本月风团计数：${hiveText}`,
    "服药记录：",
    medicineText
  ].join("\n");
}

async function copyMedicineSummary() {
  const text = medicineSummaryText();
  try {
    await navigator.clipboard.writeText(text);
    setSync("复诊摘要已复制，可以直接粘贴给医生或备忘录");
  } catch {
    medicineHistoryOpen = true;
    renderMedicineHistory();
    setSync("复制失败，已展开服药记录，请手动复制");
  }
}

function renderEventLogs() {
  renderHiveCounter();
  renderSleepPanel();
  renderMedicineHistory();
}

function hiveAreaFromNote(note = "") {
  const match = note.match(/^\[风团计数\]\s*(手|脖子|四肢)/);
  return match ? match[1] : "";
}

function isTodayInShanghai(value) {
  if (!value) return false;
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
  return key === todayKey();
}

function hiveCountsToday() {
  return eventLogs.reduce((counts, record) => {
    if (!isTodayInShanghai(record.event_time || record.created_at)) return counts;
    const area = hiveAreaFromNote(record.note || "");
    if (area) counts[area] = (counts[area] || 0) + 1;
    return counts;
  }, { 手: 0, 脖子: 0, 四肢: 0 });
}

function renderHiveCounter() {
  const counts = hiveCountsToday();
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (elements.hiveTotalText) {
    elements.hiveTotalText.textContent = `今日合计 ${total} 次`;
  }
  $$("[data-hive-area]").forEach((button) => {
    const area = button.dataset.hiveArea;
    const number = button.querySelector("span");
    if (number) number.textContent = counts[area] || 0;
  });
}

async function addHiveCount(area) {
  if (!profile) {
    setMessage("请先登录，再记录风团次数。", "error");
    return;
  }
  const { error } = await client.rpc("create_health_event_log", {
    session_token: sessionToken,
    event_time_input: new Date().toISOString(),
    medicine_input: "",
    note_input: `[风团计数] ${area}`
  });
  if (error) {
    setSync(rpcErrorText(error, "风团计数保存失败，请确认新版 SQL 已运行"));
    return;
  }
  setSync(`${area} 风团 +1`);
  await loadBlog();
}

$$(".auth-tabs button").forEach((button) => {
  button.addEventListener("click", () => switchAuthTab(button.dataset.authTab));
});

const hiveAreas = ["脖子", "四肢", "躯干", "头", "脸"];

function hiveAreaFromNote(note = "") {
  const match = note.match(/^\[风团计数\]\s*(脖子|四肢|躯干|头|脸)/);
  return match ? match[1] : "";
}

function localDatePartsInShanghai(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function localDateKeyInShanghai(value) {
  const parts = localDatePartsInShanghai(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function hiveCountsForMonth() {
  const now = shanghaiNow();
  const monthPrefix = dateKeyFromLocal(now).slice(0, 7);
  const days = {};
  const areaTotals = Object.fromEntries(hiveAreas.map((area) => [area, 0]));
  eventLogs.forEach((record) => {
    const area = hiveAreaFromNote(record.note || "");
    if (!area) return;
    const key = localDateKeyInShanghai(record.event_time || record.created_at);
    if (!key.startsWith(monthPrefix)) return;
    if (!days[key]) days[key] = Object.fromEntries(hiveAreas.map((name) => [name, 0]));
    days[key][area] += 1;
    areaTotals[area] += 1;
  });
  return { monthPrefix, days, areaTotals };
}

function hiveCountsToday() {
  const today = todayKey();
  const counts = hiveCountsForMonth().days[today] || {};
  return Object.fromEntries(hiveAreas.map((area) => [area, counts[area] || 0]));
}

function renderHiveCounter() {
  const counts = hiveCountsToday();
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (elements.hiveTotalText) {
    elements.hiveTotalText.textContent = `今日合计 ${total} 次`;
  }
  $$("[data-hive-area]").forEach((button) => {
    const area = button.dataset.hiveArea;
    const number = button.querySelector("span");
    if (number) number.textContent = counts[area] || 0;
  });
  renderHiveMonthSummary();
  renderSleepPanel();
}

function renderHiveMonthSummary() {
  if (!elements.hiveMonthGrid || !elements.hiveMonthSummary) return;
  const { monthPrefix, days, areaTotals } = hiveCountsForMonth();
  const [year, month] = monthPrefix.split("-").map(Number);
  const dayCount = new Date(year, month, 0).getDate();
  const monthTotal = Object.values(areaTotals).reduce((sum, value) => sum + value, 0);
  const activeDays = Object.values(days).filter((counts) => Object.values(counts).some(Boolean)).length;
  const areaText = hiveAreas.map((area) => `${area}${areaTotals[area] || 0}`).join(" / ");
  elements.hiveMonthSummary.textContent = monthTotal
    ? `${month}月共 ${monthTotal} 次，${activeDays} 天有记录｜${areaText}`
    : `${month}月暂无风团记录`;
  const weekdayOffset = new Date(year, month - 1, 1).getDay();
  const cells = Array.from({ length: weekdayOffset }, () => `<span class="hive-month__blank"></span>`);
  for (let day = 1; day <= dayCount; day += 1) {
    const key = `${monthPrefix}-${String(day).padStart(2, "0")}`;
    const counts = days[key] || {};
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const detail = hiveAreas
      .filter((area) => counts[area])
      .map((area) => `${area}${counts[area]}`)
      .join(" ");
    cells.push(`
      <span class="hive-month__day ${total ? "has-hives" : ""}" title="${escapeHtml(detail || "无记录")}">
        <b>${day}</b>
        <em>${total || ""}</em>
      </span>
    `);
  }
  elements.hiveMonthGrid.innerHTML = cells.join("");
}

async function addHiveCount(area) {
  if (!profile) {
    setMessage("请先登录，再记录风团次数。", "error");
    return;
  }
  const { error } = await client.rpc("create_health_event_log", {
    session_token: sessionToken,
    event_time_input: new Date().toISOString(),
    medicine_input: "",
    note_input: `[风团计数] ${area}`
  });
  if (error) {
    setSync(rpcErrorText(error, "风团计数保存失败，请确认新版 SQL 已运行"));
    return;
  }
  setSync(`${area} 风团 +1`);
  await loadBlog();
}

const sleepAffirmations = [
  "今天已经走到这里，就已经很好。夜晚会替你把紧绷慢慢松开。",
  "你不需要在睡前解决所有事，身体可以先回到安静里。",
  "把今天交还给今天，把明天留给明天，此刻只需要呼吸。",
  "你允许自己休息，也是在认真照顾正在努力的自己。",
  "今晚的任务很简单：躺下，变轻，慢慢回到自己的节奏。",
  "没有完成的事先放在门外，梦会替你把心擦亮一点。",
  "你可以温柔地收尾，今天到这里就够了。"
];

function sleepNotePrefix(prefix) {
  return `[${prefix}]`;
}

function sleepRecordToday(prefix) {
  return eventLogs.find((record) => (
    isTodayInShanghai(record.event_time || record.created_at)
    && String(record.note || "").startsWith(sleepNotePrefix(prefix))
  ));
}

function renderSleepPanel() {
  if (!elements.sleepNowText) return;
  const now = shanghaiNow();
  elements.sleepNowText.textContent = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(now);
  const index = stableHash(todayKey()) % sleepAffirmations.length;
  elements.sleepAffirmation.textContent = sleepAffirmations[index];

  const sleepRecord = sleepRecordToday("睡眠记录");
  if (sleepRecord) {
    elements.sleepRecordText.textContent = `今晚准备睡觉时间：${formatDate(sleepRecord.event_time || sleepRecord.created_at)}`;
    elements.sleepStartButton.textContent = "已记录今晚睡觉";
    elements.sleepStartButton.disabled = true;
  } else {
    elements.sleepRecordText.textContent = profile ? "点击后记录今晚准备睡觉的时间。" : "登录后可以记录睡眠。";
    elements.sleepStartButton.textContent = "准备睡觉";
    elements.sleepStartButton.disabled = !profile;
  }

  const summaryRecord = sleepRecordToday("睡前收尾");
  elements.sleepSummary.innerHTML = summaryRecord
    ? `<p>${escapeHtml(String(summaryRecord.note || "").replace(/^\[睡前收尾\]\s*/, ""))}</p>`
    : `<p>回答 5 个小问题，生成今天的睡前收尾句。</p>`;
}

function sleepClosingLine(score, need) {
  if (need === "hope") {
    return score >= 6
      ? "今天的你没有被琐碎吞掉，还保留着一点明亮；请带着这点光睡去。"
      : "就算今天不轻松，明天也仍然有可以重新开始的一小块地方。";
  }
  if (need === "release") {
    return score >= 6
      ? "今天可以收好了，不必再反复检查；你已经做了能做的部分。"
      : "把压力先放在床边，今晚不审判自己，只允许身体慢慢松开。";
  }
  return score >= 6
    ? "今天的你是稳的，柔软的，也值得被好好安放。"
    : "辛苦的一天到这里结束，今晚你只需要被温柔接住。";
}

async function saveSleepNote(prefix, note) {
  const { error } = await client.rpc("create_health_event_log", {
    session_token: sessionToken,
    event_time_input: new Date().toISOString(),
    medicine_input: "",
    note_input: `${sleepNotePrefix(prefix)} ${note}`
  });
  if (error) {
    setSync(rpcErrorText(error, "睡眠记录保存失败，请确认新版 SQL 已运行"));
    return false;
  }
  await loadBlog();
  return true;
}

if (retiredModulesEnabled) {
$$("[data-hive-area]").forEach((button) => {
  button.addEventListener("click", () => addHiveCount(button.dataset.hiveArea));
});

if (elements.sleepStartButton) {
  elements.sleepStartButton.addEventListener("click", async () => {
    if (!profile) {
      setMessage("请先登录，再记录睡眠。", "error");
      return;
    }
    const ok = await saveSleepNote("睡眠记录", "准备睡觉");
    if (ok) setSync("今晚睡眠时间已记录");
  });
}

if (elements.sleepQuizForm) {
  elements.sleepQuizForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!profile) {
      setMessage("请先登录，再生成睡前收尾。", "error");
      return;
    }
    const form = new FormData(elements.sleepQuizForm);
    const score = ["body", "mood", "done", "mind"].reduce((sum, key) => sum + Number(form.get(key) || 0), 0);
    const need = String(form.get("need") || "soft");
    const ok = await saveSleepNote("睡前收尾", sleepClosingLine(score, need));
    if (ok) setSync("今晚收尾已生成");
  });
}
}

function siteUrl() {
  return "https://www.vivianhyde1987.com/";
}

function currentInviteText() {
  return `\u6765 The rough and smooth \u5750\u4e00\u4f1a\u513f\u3002\u8fd9\u91cc\u53ef\u4ee5\u6ce8\u518c ID\u3001\u7559\u8a00\u3001\u804a\u5929\uff0c\u4e5f\u53ef\u4ee5\u770b\u6587\u7ae0\u3001\u64ad\u5ba2\u548c\u5c0f\u6728\u5c4b\u3002\n${siteUrl()}`;
}

async function copyInviteText() {
  const text = currentInviteText();
  try {
    await navigator.clipboard.writeText(text);
    setSync("邀请语已复制");
  } catch {
    setSync("复制失败，可以手动复制网址");
  }
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const paragraphs = String(text).split("\n");
  let cursorY = y;
  paragraphs.forEach((paragraph) => {
    let line = "";
    Array.from(paragraph).forEach((char) => {
      const next = line + char;
      if (ctx.measureText(next).width > maxWidth && line) {
        ctx.fillText(line, x, cursorY);
        line = char;
        cursorY += lineHeight;
      } else {
        line = next;
      }
    });
    if (line) {
      ctx.fillText(line, x, cursorY);
      cursorY += lineHeight;
    }
    cursorY += lineHeight * 0.35;
  });
  return cursorY;
}

function generateSharePoster() {
  if (!elements.sharePoster) return;
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 1280;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 900, 1280);
  gradient.addColorStop(0, "#160b12");
  gradient.addColorStop(0.46, "#2a111d");
  gradient.addColorStop(1, "#0b0a0d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 900, 1280);

  ctx.fillStyle = "rgba(182, 37, 72, 0.32)";
  ctx.beginPath();
  ctx.arc(170, 190, 190, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(212, 167, 44, 0.18)";
  ctx.beginPath();
  ctx.arc(760, 1060, 220, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 250, 245, 0.08)";
  for (let i = 0; i < 42; i += 1) {
    ctx.beginPath();
    ctx.arc((i * 97) % 900, (i * 173) % 1280, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(255, 240, 220, 0.28)";
  ctx.lineWidth = 2;
  ctx.strokeRect(56, 56, 788, 1168);

  ctx.fillStyle = "rgba(255, 245, 232, 0.92)";
  ctx.font = "700 48px Microsoft YaHei, sans-serif";
  ctx.fillText("来博客坐一会", 96, 170);
  ctx.font = "400 25px Microsoft YaHei, sans-serif";
  ctx.fillStyle = "rgba(255, 245, 232, 0.68)";
  ctx.fillText("留言、文章、每周话题抽奖", 98, 220);

  ctx.font = "700 34px Microsoft YaHei, sans-serif";
  ctx.fillStyle = "rgba(255, 217, 223, 0.95)";
  const topic = currentLotteryTopic();
  const mainText = topic?.topic_text || "今晚也可以留下你的一句话。";
  let y = wrapCanvasText(ctx, mainText, 98, 390, 704, 52);

  ctx.font = "400 27px Microsoft YaHei, sans-serif";
  ctx.fillStyle = "rgba(255, 245, 232, 0.74)";
  y = wrapCanvasText(ctx, "这里是一间私人博客。注册 ID 后，可以留言、互动，也可以参与每周日 21:00 的抽奖。", 98, y + 52, 704, 42);

  ctx.fillStyle = "rgba(255, 245, 232, 0.12)";
  ctx.fillRect(98, 980, 704, 118);
  ctx.fillStyle = "rgba(255, 245, 232, 0.86)";
  ctx.font = "700 31px Microsoft YaHei, sans-serif";
  ctx.fillText("www.vivianhyde1987.com", 132, 1048);
  ctx.font = "400 22px Microsoft YaHei, sans-serif";
  ctx.fillStyle = "rgba(255, 245, 232, 0.58)";
  ctx.fillText("长按保存海报，发给想邀请来的朋友", 132, 1088);

  const dataUrl = canvas.toDataURL("image/png");
  elements.sharePoster.hidden = false;
  elements.sharePoster.innerHTML = `
    <img src="${dataUrl}" alt="博客分享海报" loading="lazy" decoding="async" />
    <a href="${dataUrl}" download="vivian-blog-poster.png">下载海报</a>
  `;
  setSync("分享海报已生成");
}

if (elements.copyInviteButton) {
  elements.copyInviteButton.addEventListener("click", copyInviteText);
}

if (elements.posterButton) {
  elements.posterButton.addEventListener("click", generateSharePoster);
}

$$("[data-category]").forEach((button) => {
  button.addEventListener("click", () => setCategory(button.dataset.category, true));
});

elements.categoryInput.addEventListener("change", () => {
  if (elements.interestTypeWrap) elements.interestTypeWrap.hidden = true;
});

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!client) return;
  const handle = normalizeHandle($("#loginHandle").value);
  const password = $("#loginPassword").value;
  if (!handle) {
    setMessage("请先输入 ID。", "error");
    return;
  }
  setMessage("登录中");
  const { data, error } = await client.rpc("login_blog_account", { handle_input: handle, password_input: password });
  if (error) {
    setMessage(rpcErrorText(error, "登录失败，请检查 ID 和密码。"), "error");
    return;
  }
  saveSession(data);
  elements.loginForm.reset();
  renderSession();
  await loadBlog();
  setMessage("已登录。", "ok");
});

elements.registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!client) return;
  const handle = normalizeHandle($("#registerHandle").value);
  const password = $("#registerPassword").value;
  if (!handle) {
    setMessage("ID 不能为空。", "error");
    return;
  }
  setMessage("注册中");
  const { data, error } = await client.rpc("register_blog_account", { handle_input: handle, password_input: password });
  if (error) {
    setMessage(rpcErrorText(error, "注册失败，请换一个 ID 再试。"), "error");
    return;
  }
  saveSession(data);
  elements.registerForm.reset();
  renderSession();
  await loadBlog();
  setMessage("注册成功，已经登录。", "ok");
});

if (retiredModulesEnabled && elements.lotteryTopicForm && elements.lotteryEntryForm) {
elements.lotteryTopicForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!profile || profile.role !== "owner") {
    setMessage("只有站主可以发布今日话题。", "error");
    return;
  }
  const topic = elements.lotteryTopicInput.value.trim();
  if (!topic) {
    setMessage("请先写今日讨论话题。", "error");
    return;
  }
  const { error } = await client.rpc("create_lottery_topic", {
    session_token: sessionToken,
    topic_date_input: lotteryWeekKey(),
    topic_text_input: topic
  });
  if (error) {
    setMessage(rpcErrorText(error, "今日话题发布失败，请确认新版 SQL 已运行。"), "error");
    return;
  }
  elements.lotteryTopicForm.reset();
  setMessage("今日讨论话题已发布。", "ok");
  await loadBlog();
});

elements.lotteryEntryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!profile) {
    setMessage("请先登录，再参与抽奖。", "error");
    return;
  }
  const topic = currentLotteryTopic();
  const body = elements.lotteryEntryInput.value.trim();
  if (!topic || !body) return;
  const { error } = await client.rpc("enter_lottery", {
    session_token: sessionToken,
    topic_uuid: topic.id,
    body_input: body
  });
  if (error) {
    setMessage(rpcErrorText(error, "参与抽奖失败，请确认新版 SQL 已运行。"), "error");
    return;
  }
  elements.lotteryEntryForm.reset();
  setMessage("已参与今日抽奖。", "ok");
  await loadBlog();
});

}

elements.avatarForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!profile) {
    setMessage("请先登录，再保存头像。", "error");
    return;
  }
  const avatar = {
    color: elements.avatarColorInput.value,
    shape: elements.avatarShapeInput.value,
    mark: elements.avatarMarkInput.value || "R",
    image: pendingAvatarImage || avatarFromProfile(profile).image || ""
  };
  const { data, error } = await client.rpc("update_blog_avatar", { session_token: sessionToken, avatar_input: avatar });
  if (error) {
    setMessage(rpcErrorText(error, "头像保存失败。"), "error");
    return;
  }
  profile = { user_id: data.id, id: data.id, handle: data.handle, avatar: data.avatar, role: data.role };
  profiles.set(profile.user_id, profile);
  setMessage("头像已保存。", "ok");
  renderSession();
  renderFeed();
});

[elements.avatarColorInput, elements.avatarShapeInput, elements.avatarMarkInput].forEach((input) => {
  input.addEventListener("input", renderAvatarPreview);
});

function updateMediaClearButtons() {
  const imageFile = elements.imageInput.files?.[0] || null;
  const videoFile = elements.videoInput.files?.[0] || null;
  elements.clearImageInput.hidden = !imageFile;
  elements.clearVideoInput.hidden = !videoFile;
  elements.imageSizeHint.textContent = imageFile ? `已选择：${formatFileSize(imageFile.size)}` : "未选择照片";
  elements.videoSizeHint.textContent = videoFile ? `已选择：${formatFileSize(videoFile.size)}${videoFile.size > 50 * 1024 * 1024 ? "，超过建议大小" : ""}` : "未选择视频";
  elements.videoSizeHint.dataset.tone = videoFile && videoFile.size > 50 * 1024 * 1024 ? "warn" : "";
}

elements.imageInput.addEventListener("change", updateMediaClearButtons);
elements.videoInput.addEventListener("change", updateMediaClearButtons);
elements.bodyInput.addEventListener("input", () => {
  elements.bodyCount.textContent = `${elements.bodyInput.value.length} / ${elements.bodyInput.maxLength} 字`;
});
elements.clearImageInput.addEventListener("click", () => {
  elements.imageInput.value = "";
  updateMediaClearButtons();
});
elements.clearVideoInput.addEventListener("click", () => {
  elements.videoInput.value = "";
  updateMediaClearButtons();
});

function updatePodcastFileHints() {
  const audioFile = elements.podcastAudioInput?.files?.[0] || null;
  const musicFile = elements.podcastMusicInput?.files?.[0] || null;
  if (elements.podcastAudioHint) elements.podcastAudioHint.textContent = pendingPodcastRecording
    ? `录音已完成：${formatFileSize(pendingPodcastRecording.size)}`
    : audioFile ? `已选择：${formatFileSize(audioFile.size)}` : "未选择音频";
  if (elements.podcastMusicHint) {
    if (podcastMusicMode === "off") {
      elements.podcastMusicHint.textContent = "背景乐已关闭";
    } else if (elements.podcastMusicPreset?.value === "upload") {
      elements.podcastMusicHint.textContent = musicFile ? `已选择：${formatFileSize(musicFile.size)}` : "请选择自己的背景音乐";
    } else {
      elements.podcastMusicHint.textContent = `已选择：${elements.podcastMusicPreset?.selectedOptions?.[0]?.textContent || "站内背景乐"}`;
    }
  }
}

elements.podcastAudioInput?.addEventListener("change", () => {
  pendingPodcastRecording = null;
  elements.podcastRecordPreview.hidden = true;
  elements.podcastRecordPreview.removeAttribute("src");
  updatePodcastFileHints();
});
elements.podcastMusicInput?.addEventListener("change", updatePodcastFileHints);
document.querySelectorAll("[data-podcast-music-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    podcastMusicMode = button.dataset.podcastMusicMode;
    document.querySelectorAll("[data-podcast-music-mode]").forEach((item) => item.classList.toggle("active", item === button));
    elements.podcastMusicOptions.hidden = podcastMusicMode === "off";
    updatePodcastFileHints();
  });
});
elements.podcastMusicPreset?.addEventListener("change", () => {
  const uploadMode = elements.podcastMusicPreset.value === "upload";
  elements.podcastMusicInput.hidden = !uploadMode;
  if (!uploadMode) elements.podcastMusicInput.value = "";
  updatePodcastFileHints();
});

if (elements.podcastRecordStart && elements.podcastRecordStop) {
  let recorder = null;
  let recordingStream = null;
  let chunks = [];
  let recordTimer = null;
  let recordStartedAt = 0;

  elements.podcastRecordStart.addEventListener("click", async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      return setMessage("当前浏览器不支持直接录音，请使用上传录音。", "error");
    }
    try {
      recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type)) || "";
      recorder = preferredType ? new MediaRecorder(recordingStream, { mimeType: preferredType }) : new MediaRecorder(recordingStream);
      chunks = [];
      recorder.addEventListener("dataavailable", (event) => { if (event.data.size) chunks.push(event.data); });
      recorder.addEventListener("stop", () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const extension = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
        pendingPodcastRecording = new File(chunks, `podcast-recording-${Date.now()}.${extension}`, { type: mimeType });
        elements.podcastAudioInput.value = "";
        elements.podcastRecordPreview.src = URL.createObjectURL(pendingPodcastRecording);
        elements.podcastRecordPreview.hidden = false;
        recordingStream?.getTracks().forEach((track) => track.stop());
        window.clearInterval(recordTimer);
        elements.podcastRecordStart.disabled = false;
        elements.podcastRecordStop.disabled = true;
        updatePodcastFileHints();
      });
      recorder.start(500);
      recordStartedAt = Date.now();
      elements.podcastRecordTime.textContent = "00:00";
      recordTimer = window.setInterval(() => {
        elements.podcastRecordTime.textContent = formatPodcastTime((Date.now() - recordStartedAt) / 1000);
      }, 500);
      elements.podcastRecordStart.disabled = true;
      elements.podcastRecordStop.disabled = false;
      elements.podcastRecordStop.classList.add("is-recording");
      setMessage("正在录制，完成后点“完成录制”。", "ok");
    } catch {
      setMessage("没有获得麦克风权限，请允许访问麦克风后再试。", "error");
    }
  });

  elements.podcastRecordStop.addEventListener("click", () => {
    if (recorder?.state === "recording") recorder.stop();
    elements.podcastRecordStop.classList.remove("is-recording");
  });
}

elements.podcastForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (profile?.role !== "owner") return setMessage("只有站主可以发布播客。", "error");
  const audioFile = pendingPodcastRecording || elements.podcastAudioInput.files?.[0] || null;
  const musicFile = elements.podcastMusicInput.files?.[0] || null;
  if (!audioFile) return setMessage("请先选择节目录音。", "error");
  setSync("上传播客中");
  try {
    const audioUrl = await uploadPodcastAudio(audioFile, "episode");
    let musicUrl = null;
    if (podcastMusicMode === "on") {
      if (elements.podcastMusicPreset.value === "upload") {
        if (!musicFile) throw new Error("music required");
        musicUrl = await uploadPodcastAudio(musicFile, "music");
      } else {
        musicUrl = new URL(elements.podcastMusicPreset.value, window.location.href).href;
      }
    }
    const { error } = await client.rpc("create_blog_podcast", {
      session_token: sessionToken,
      publish_date_input: elements.podcastDateInput.value,
      issue_no_input: Number(elements.podcastIssueInput.value),
      topic_input: elements.podcastTopicInput.value.trim(),
      audio_url_input: audioUrl,
      music_url_input: musicUrl
    });
    if (error) throw error;
    elements.podcastForm.reset();
    pendingPodcastRecording = null;
    elements.podcastRecordPreview.hidden = true;
    elements.podcastRecordPreview.removeAttribute("src");
    elements.podcastRecordTime.textContent = "00:00";
    podcastMusicMode = "off";
    document.querySelectorAll("[data-podcast-music-mode]").forEach((button) => button.classList.toggle("active", button.dataset.podcastMusicMode === "off"));
    elements.podcastMusicOptions.hidden = true;
    elements.podcastMusicInput.hidden = true;
    elements.podcastDateInput.value = new Date().toISOString().slice(0, 10);
    updatePodcastFileHints();
    setSync("播客已发布");
    await loadBlog();
  } catch (error) {
    const message = error.message === "audio too large"
      ? "音频太大，请换 100MB 以内的文件"
      : error.message === "music required" ? "请选择背景音乐文件" : "播客发布失败，请先运行新版 SQL";
    setSync(message);
    setMessage(message, "error");
  }
});

elements.avatarImageInput.addEventListener("change", async () => {
  const file = elements.avatarImageInput.files?.[0] || null;
  if (!file) {
    pendingAvatarImage = null;
    renderAvatarPreview();
    return;
  }
  try {
    pendingAvatarImage = await compressPhoto(file, { maxSide: 260, quality: 0.78 });
    renderAvatarPreview();
    setMessage("头像照片已选好，点保存头像后生效。", "ok");
  } catch {
    pendingAvatarImage = null;
    elements.avatarImageInput.value = "";
    setMessage("头像照片读取失败，请换一张普通 JPG 或 PNG。", "error");
  }
});

elements.postForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!profile) {
    setMessage("请先登录，再写博客。", "error");
    return;
  }
  const category = elements.categoryInput.value;
  const interestType = category === "兴趣" ? elements.interestTypeInput.value : null;
  const photoFile = elements.imageInput.files?.[0] || null;
  const videoFile = elements.videoInput.files?.[0] || null;
  const title = elements.titleInput.value.trim() || (videoFile ? "视频记录" : photoFile ? "相册照片" : "");
  const body = elements.bodyInput.value.trim() || (videoFile ? "分享一段视频。" : photoFile ? "分享一张照片。" : "");
  if (!title || !body) {
    setSync("请先填写标题和正文");
    return;
  }

  setSync(videoFile ? "上传视频中" : photoFile ? "处理照片中" : "保存中");
  let imageUrl = null;
  let videoUrl = null;
  try {
    imageUrl = await compressPhoto(photoFile);
  } catch {
    setSync("照片处理失败，请换一张普通 JPG 或 PNG");
    return;
  }
  if (imageUrl && imageUrl.length > 850000) {
    setSync("照片还是太大，请换一张较小的照片");
    return;
  }
  try {
    videoUrl = await uploadPostVideo(videoFile);
  } catch (error) {
    setSync(error.message === "video too large" ? "视频太大，请换 50MB 以内的短视频" : "视频上传失败，请确认新版 SQL 已运行");
    return;
  }

  const { error } = await client.rpc("create_blog_post", {
    session_token: sessionToken,
    category_input: category,
    title_input: title,
    body_input: body,
    image_input: imageUrl,
    video_input: videoUrl,
    interest_type_input: interestType
  });
  if (error) {
    setSync(rpcErrorText(error, "保存失败，请确认新版 SQL 已运行"));
    return;
  }
  setSync("已保存");
  activeCategory = category;
  elements.postForm.reset();
  updateMediaClearButtons();
  await loadBlog();
  setCategory(activeCategory, true);
}, { capture: true });

elements.chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!profile) {
    setMessage("请先登录，再进入讨论区。", "error");
    return;
  }
  const body = elements.chatBodyInput.value.trim();
  const file = elements.chatImageInput.files?.[0] || null;
  if (!body && !file) {
    setSync("讨论区消息不能为空");
    return;
  }
  setSync(file ? "处理贴图中" : "发送中");
  let imageUrl = null;
  try {
    imageUrl = await compressPhoto(file, { maxSide: 720, quality: 0.7 });
  } catch {
    setSync("贴图处理失败，请换一张普通 JPG 或 PNG");
    return;
  }
  if (imageUrl && imageUrl.length > 650000) {
    setSync("贴图太大，请换一张较小的图片");
    return;
  }
  const ok = await addChatMessage(body, imageUrl, null);
  if (ok) elements.chatForm.reset();
}, { capture: true });

if (elements.eventLogForm) {
  elements.eventLogForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!profile) {
      setMessage("请先登录，再保存事件记录。", "error");
      return;
    }
    const eventTime = elements.eventTimeInput.value
      ? new Date(elements.eventTimeInput.value).toISOString()
      : new Date().toISOString();
    const medicine = elements.medicineInput.value.trim();
    const note = elements.eventNoteInput.value.trim();
    if (!medicine && !note) {
      setSync("请填写药品种类或备注");
      return;
    }
    const { error } = await client.rpc("create_health_event_log", {
      session_token: sessionToken,
      event_time_input: eventTime,
      medicine_input: medicine,
      note_input: note
    });
    if (error) {
      setSync(rpcErrorText(error, "事件记录保存失败，请确认新版 SQL 已运行"));
      return;
    }
    elements.eventLogForm.reset();
    setSync("事件记录已保存");
    await loadBlog();
  });
}

if (elements.medicineHistoryToggle) {
  elements.medicineHistoryToggle.addEventListener("click", () => {
    medicineHistoryOpen = !medicineHistoryOpen;
    renderMedicineHistory();
  });
}

if (elements.copyMedicineSummary) {
  elements.copyMedicineSummary.addEventListener("click", copyMedicineSummary);
}

elements.todayText.textContent = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long"
}).format(new Date());

function setupMimiDrag() {
  const mimi = document.querySelector(".mimi-companion");
  const handle = document.querySelector(".mimi-companion__photo");
  if (!mimi || !handle) return;

  const storageKey = "mimi-companion-position";
  const edgeGap = 8;
  let isDragging = false;
  let didMove = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const placeMimi = (left, top) => {
    const rect = mimi.getBoundingClientRect();
    const maxLeft = Math.max(edgeGap, window.innerWidth - rect.width - edgeGap);
    const maxTop = Math.max(edgeGap, window.innerHeight - rect.height - edgeGap);
    mimi.style.left = `${clamp(left, edgeGap, maxLeft)}px`;
    mimi.style.top = `${clamp(top, edgeGap, maxTop)}px`;
    mimi.style.right = "auto";
    mimi.style.bottom = "auto";
  };

  const savePosition = () => {
    const rect = mimi.getBoundingClientRect();
    localStorage.setItem(storageKey, JSON.stringify({ left: rect.left, top: rect.top }));
  };

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
      placeMimi(saved.left, saved.top);
    }
  } catch {
    localStorage.removeItem(storageKey);
  }

  handle.addEventListener("pointerdown", (event) => {
    const rect = mimi.getBoundingClientRect();
    isDragging = true;
    didMove = false;
    startX = event.clientX;
    startY = event.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    mimi.classList.add("is-dragging");
    handle.setPointerCapture?.(event.pointerId);
  });

  handle.addEventListener("pointermove", (event) => {
    if (!isDragging) return;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) didMove = true;
    placeMimi(startLeft + deltaX, startTop + deltaY);
  });

  const stopDrag = (event) => {
    if (!isDragging) return;
    isDragging = false;
    mimi.classList.remove("is-dragging");
    savePosition();
    if (didMove) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  handle.addEventListener("pointerup", stopDrag);
  handle.addEventListener("pointercancel", stopDrag);
  handle.addEventListener("click", (event) => {
    if (!didMove) return;
    event.preventDefault();
    event.stopPropagation();
    didMove = false;
  });
  window.addEventListener("resize", () => {
    const rect = mimi.getBoundingClientRect();
    placeMimi(rect.left, rect.top);
    savePosition();
  });
}

function setupHealingSound() {
  const button = elements.soundToggle;
  if (!button) return;
  let audioContext = null;
  let masterGain = null;
  let timer = null;
  let enabled = false;

  const frequencies = [136.1, 174, 221.2, 256, 341.3];

  const ensureAudio = () => {
    if (audioContext) return;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.075;
    masterGain.connect(audioContext.destination);
  };

  const playBowl = () => {
    if (!audioContext || !masterGain || !enabled) return;
    const now = audioContext.currentTime;
    const frequency = frequencies[Math.floor(Math.random() * frequencies.length)];
    [1, 2.01, 3.02].forEach((multiple, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.value = frequency * multiple;
      oscillator.detune.value = (Math.random() - 0.5) * 8;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.18 : 0.045, now + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 8.5 + index * 1.2);
      oscillator.connect(gain).connect(masterGain);
      oscillator.start(now);
      oscillator.stop(now + 11);
    });
  };

  const updateButton = () => {
    button.textContent = enabled ? "颂钵播放中" : "疗愈颂钵";
    button.classList.toggle("is-playing", enabled);
  };

  const start = async () => {
    ensureAudio();
    if (audioContext.state === "suspended") await audioContext.resume();
    if (enabled) return;
    enabled = true;
    updateButton();
    playBowl();
    timer = window.setInterval(playBowl, 5200);
  };

  const stop = () => {
    enabled = false;
    if (timer) window.clearInterval(timer);
    timer = null;
    updateButton();
  };

  button.addEventListener("click", async () => {
    if (enabled) {
      stop();
    } else {
      await start();
    }
  });

  const autoStart = (event) => {
    if (event?.target === button) return;
    start().catch(() => updateButton());
  };
  window.addEventListener("pointerdown", autoStart, { once: true });
  window.addEventListener("keydown", autoStart, { once: true });
  updateButton();
}

function setupAmbientSounds() {
  const buttons = [...document.querySelectorAll("[data-sound-mode]")];
  if (!buttons.length) return;
  let audioContext = null;
  let masterGain = null;
  let activeMode = "";
  let timers = [];
  let nodes = [];
  let rainAudio = null;
  let lastTouchAt = 0;

  const clearSound = () => {
    timers.forEach((timer) => window.clearInterval(timer));
    timers = [];
    nodes.forEach((node) => {
      try {
        node.stop?.();
      } catch {}
      node.disconnect?.();
    });
    nodes = [];
    if (rainAudio) {
      rainAudio.pause();
      rainAudio.currentTime = 0;
      rainAudio = null;
    }
  };

  const ensureAudio = async () => {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioContext.createGain();
      masterGain.gain.value = 0.085;
      masterGain.connect(audioContext.destination);
    }
    if (audioContext.state === "suspended") await audioContext.resume();
  };

  const updateButtons = () => {
    buttons.forEach((button) => {
      const playing = activeMode === button.dataset.soundMode;
      const label = button.querySelector(".sound-toggle__label");
      button.classList.toggle("is-playing", playing);
      if (!label) return;
      const names = { bowl: "疗愈颂钵", stream: "溪流摇铃", cosmos: "宇宙的声音", rain: "雨声" };
      const playingNames = { bowl: "颂钵播放中", stream: "溪流摇铃中", cosmos: "宇宙播放中", rain: "雨声播放中" };
      label.textContent = playing ? playingNames[button.dataset.soundMode] : names[button.dataset.soundMode];
    });
  };

  const playBowl = () => {
    if (!audioContext || !masterGain || activeMode !== "bowl") return;
    const now = audioContext.currentTime;
    const frequency = [136.1, 174, 221.2, 256, 341.3][Math.floor(Math.random() * 5)];
    [1, 2.01, 3.02].forEach((multiple, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.value = frequency * multiple;
      oscillator.detune.value = (Math.random() - 0.5) * 8;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.18 : 0.045, now + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 8.5 + index * 1.2);
      oscillator.connect(gain).connect(masterGain);
      oscillator.start(now);
      oscillator.stop(now + 11);
      nodes.push(oscillator, gain);
    });
  };

  const startStream = () => {
    const bufferSize = 2 * audioContext.sampleRate;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = (Math.random() * 2 - 1) * 0.26;
    }
    const noise = audioContext.createBufferSource();
    const lowPass = audioContext.createBiquadFilter();
    const highPass = audioContext.createBiquadFilter();
    noise.buffer = buffer;
    noise.loop = true;
    lowPass.type = "lowpass";
    lowPass.frequency.value = 950;
    highPass.type = "highpass";
    highPass.frequency.value = 180;
    noise.connect(lowPass).connect(highPass).connect(masterGain);
    noise.start();
    nodes.push(noise, lowPass, highPass);

    const shake = () => {
      if (!audioContext || !masterGain || activeMode !== "stream") return;
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = 680 + Math.random() * 420;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.045, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      oscillator.connect(gain).connect(masterGain);
      oscillator.start(now);
      oscillator.stop(now + 0.25);
      nodes.push(oscillator, gain);
    };
    timers.push(window.setInterval(shake, 900 + Math.random() * 700));
    shake();
  };

  const startCosmos = () => {
    const droneGain = audioContext.createGain();
    droneGain.gain.value = 0.36;
    droneGain.connect(masterGain);
    [55, 82.41, 110].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.value = index === 0 ? 0.16 : 0.06;
      oscillator.connect(gain).connect(droneGain);
      oscillator.start();
      nodes.push(oscillator, gain);
    });
    nodes.push(droneGain);

    const sparkle = () => {
      if (!audioContext || !masterGain || activeMode !== "cosmos") return;
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      oscillator.type = "sine";
      oscillator.frequency.value = 520 + Math.random() * 920;
      filter.type = "bandpass";
      filter.frequency.value = oscillator.frequency.value;
      filter.Q.value = 8;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.035, now + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
      oscillator.connect(filter).connect(gain).connect(masterGain);
      oscillator.start(now);
      oscillator.stop(now + 3);
      nodes.push(oscillator, filter, gain);
    };

    sparkle();
    timers.push(window.setInterval(sparkle, 1800));
  };

  const startMode = async (mode) => {
    clearSound();
    activeMode = mode;
    updateButtons();
    if (mode === "rain") {
      rainAudio = new Audio("assets/audio/rain.wav");
      rainAudio.loop = true;
      rainAudio.volume = 0.58;
      await rainAudio.play();
      return;
    }
    await ensureAudio();
    if (mode === "stream") {
      startStream();
    } else if (mode === "cosmos") {
      startCosmos();
    } else {
      playBowl();
      timers.push(window.setInterval(playBowl, 5200));
    }
  };

  const stop = () => {
    activeMode = "";
    clearSound();
    updateButtons();
  };

  buttons.forEach((button) => {
    const activate = async (event) => {
      event.preventDefault();
      if (event.type === "touchend") lastTouchAt = Date.now();
      if (event.type === "click" && Date.now() - lastTouchAt < 700) return;
      const mode = button.dataset.soundMode;
      if (activeMode === mode) {
        stop();
      } else {
        try {
          await startMode(mode);
        } catch {
          updateButtons();
        }
      }
    };
    button.addEventListener("click", activate);
    button.addEventListener("touchend", activate, { passive: false });
  });

  updateButtons();
}

function setupPanelToggles() {
  const panels = [
    ".welcome-panel",
    ".wish-pool",
    ".lottery-panel",
    ".event-log",
    ".sleep-panel",
    ".composer",
    ".chat"
  ];
  panels.forEach((selector) => {
    const panel = document.querySelector(selector);
    const head = panel?.querySelector(".panel__head");
    if (!panel || !head || head.querySelector(".panel-toggle")) return;
    panel.classList.add("collapsible-panel", "is-collapsed");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "panel-toggle";
    button.textContent = "展开";
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", () => {
      const collapsed = panel.classList.toggle("is-collapsed");
      button.textContent = collapsed ? "展开" : "收起";
      button.setAttribute("aria-expanded", String(!collapsed));
    });
    head.append(button);
  });
}

function setupMimiPet() {
  const pet = document.querySelector(".mimi-pet");
  if (!pet) return;
  const catButton = pet.querySelector(".mimi-pet__cat");
  const catImage = catButton.querySelector("img");
  const panel = pet.querySelector(".mimi-pet__panel");
  const petRoom = document.querySelector("#cabinPetRoom");
  const bubble = pet.querySelector(".mimi-pet__bubble");
  const message = pet.querySelector(".mimi-pet__message");
  const storageKey = "mimi-pet-care-v1";
  const positionStorageKey = "mimi-cabin-room-positions-v1";
  const petAssets = getBlogMaterials().roomMap.pet;
  const idleSource = petAssets.mainCat || "mimi-sit-transparent.png";
  const getMimiAsset = (action = "idle") => {
    const assets = getBlogMaterials().roomMap.pet || {};
    const main = assets.mainCat || assets.idle || "mimi-sit-transparent.png";
    const map = {
      idle: assets.idle || main,
      pet: assets.purr || assets.relaxed || main,
      purr: assets.purr || assets.relaxed || main,
      treat: assets.relaxed || assets.purr || main,
      food: assets.peeking || main,
      wand: assets.playing || assets.watchToy || main,
      play: assets.playing || assets.watchToy || main,
      walk: assets.walkingSide || assets.walking || main,
      walking: assets.walkingSide || assets.walking || main,
      peek: assets.peeking || main,
      hold: assets.hold || assets.relaxed || main,
      doctor: main
    };
    return map[action] || main;
  };
  window.getMimiAsset = getMimiAsset;
  const poses = [getMimiAsset("idle"), getMimiAsset("peek")];
  const walkFrames = (petAssets.walkFrames && petAssets.walkFrames.length
    ? petAssets.walkFrames
    : [getMimiAsset("walk"), petAssets.peeking, petAssets.watchToy, petAssets.playing]
  ).filter(Boolean);
  const stateImages = [
    getMimiAsset("idle"),
    getMimiAsset("purr"),
    getMimiAsset("play"),
    getMimiAsset("peek"),
    getMimiAsset("hold"),
    ...walkFrames
  ].filter(Boolean);
  stateImages.forEach((src) => {
    const preloadImage = new Image();
    preloadImage.loading = "lazy";
    preloadImage.decoding = "async";
    preloadImage.src = getBlogMaterialPath(src);
  });
  const now = Date.now();
  let state = { hunger: 78, mood: 82, health: 88, litter: 86, lastUpdate: now, lastDoctor: 0, pose: 0 };
  try { state = { ...state, ...JSON.parse(localStorage.getItem(storageKey) || "{}") }; } catch {}
  const elapsedHours = Math.max(0, (now - Number(state.lastUpdate || now)) / 3600000);
  state.hunger = Math.max(24, state.hunger - elapsedHours * 1.4);
  state.mood = Math.max(35, state.mood - elapsedHours * 0.45);
  state.litter = Math.max(18, state.litter - elapsedHours * 0.9);
  state.lastUpdate = now;
  let moveTimer = null;
  let walkFrameTimer = null;
  let groomingTimer = null;
  let groomingEndTimer = null;
  let lastX = 0;
  let currentMimiRoom = "studio";
  let currentMimiContainer = document.querySelector(".cabin-room__scene") || petRoom || document.body;
  let didDragMimi = false;
  let purrBufferPromise = null;
  const purrAudioPath = getBlogMaterials().audio?.mimiPurr || "mimi-purr.mp3";
  const realPurr = new Audio(purrAudioPath);
  realPurr.preload = "metadata";
  realPurr.volume = 0.16;
  realPurr.hidden = true;
  realPurr.dataset.mimiPurr = "true";
  document.body.append(realPurr);

  const save = () => localStorage.setItem(storageKey, JSON.stringify(state));
  const stopGrooming = () => {
    window.clearTimeout(groomingTimer);
    window.clearTimeout(groomingEndTimer);
    pet.classList.remove("is-grooming");
  };
  const scheduleGrooming = () => {
    window.clearTimeout(groomingTimer);
    if (document.hidden || pet.dataset.pose !== "sit" || pet.classList.contains("is-walking") || pet.classList.contains("is-playing") || pet.classList.contains("is-held")) return;
    groomingTimer = window.setTimeout(() => {
      if (document.hidden || pet.dataset.pose !== "sit" || !panel.hidden || pet.classList.contains("is-dragging") || pet.classList.contains("is-walking") || pet.classList.contains("is-playing") || pet.classList.contains("is-held")) {
        scheduleGrooming();
        return;
      }
      pet.classList.add("is-grooming");
      groomingEndTimer = window.setTimeout(() => {
        pet.classList.remove("is-grooming");
        scheduleGrooming();
      }, 3000 + Math.random() * 2000);
    }, 20000 + Math.random() * 25000);
  };
  const readMimiPositions = () => {
    try { return JSON.parse(localStorage.getItem(positionStorageKey) || "{}"); } catch { return {}; }
  };
  const saveMimiPosition = (roomId, x, y) => {
    const positions = readMimiPositions();
    positions[roomId] = { x, y };
    localStorage.setItem(positionStorageKey, JSON.stringify(positions));
  };
  const clampMimiPosition = (x, y, container = currentMimiContainer) => {
    const width = Math.max(80, pet.offsetWidth || 120);
    const height = Math.max(90, pet.offsetHeight || 130);
    const safeInset = 14;
    const maxX = Math.max(safeInset, (container?.clientWidth || 360) - width - safeInset);
    const maxY = Math.max(safeInset, (container?.clientHeight || 360) - height - safeInset);
    return {
      x: Math.max(safeInset, Math.min(maxX, Number(x) || safeInset)),
      y: Math.max(safeInset, Math.min(maxY, Number(y) || safeInset))
    };
  };
  const setMimiPosition = (x, y, persist = true) => {
    const point = clampMimiPosition(x, y);
    pet.style.setProperty("--mimi-x", `${point.x}px`);
    pet.style.setProperty("--mimi-y", `${point.y}px`);
    if (persist) saveMimiPosition(currentMimiRoom, point.x, point.y);
  };
  const applyMimiRoomPosition = () => {
    const saved = readMimiPositions()[currentMimiRoom];
    const fallback = currentMimiRoom === "pet" ? { x: 46, y: 82 } : { x: 28, y: Math.max(120, (currentMimiContainer?.clientHeight || 360) - 180) };
    setMimiPosition(saved?.x ?? fallback.x, saved?.y ?? fallback.y, Boolean(saved));
  };
  const render = () => {
    ["hunger", "mood", "health", "litter"].forEach((key) => {
      const bar = pet.querySelector(`[data-mimi-stat="${key}"]`);
      if (bar) bar.style.setProperty("--mimi-value", `${Math.max(0, Math.min(100, state[key]))}%`);
    });
    save();
  };
  const speak = (text, duration = 2600) => {
    bubble.textContent = text;
    bubble.classList.add("is-visible");
    message.textContent = text;
    window.clearTimeout(speak.timer);
    speak.timer = window.setTimeout(() => bubble.classList.remove("is-visible"), duration);
  };
  const positionMimiPanel = () => {
    if (panel.hidden) return;
    const catRect = catButton.getBoundingClientRect();
    const panelWidth = Math.min(330, Math.max(260, window.innerWidth - 84));
    const panelHeight = Math.min(520, Math.floor(window.innerHeight * 0.72));
    const gap = 14;
    let left = catRect.right + gap;
    if (left + panelWidth > window.innerWidth - 14) left = catRect.left - panelWidth - gap;
    left = Math.max(12, Math.min(left, window.innerWidth - panelWidth - 12));
    let top = catRect.top - 12;
    if (window.innerWidth <= 680) top = 12;
    top = Math.max(12, Math.min(top, window.innerHeight - panelHeight - 12));
    panel.style.width = `${panelWidth}px`;
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  };
  const openMimiPanel = () => {
    panel.hidden = false;
    requestAnimationFrame(positionMimiPanel);
  };
  const sound = (type) => {
    try {
      const audioContext = CabinAudioManager.getContext();
      const nowTime = audioContext.currentTime;
      if (type === "step") {
        [0, 0.16, 0.33, 0.5].forEach((delay) => {
          const oscillator = audioContext.createOscillator();
          const gain = audioContext.createGain();
          oscillator.type = "triangle";
          oscillator.frequency.value = 72 + Math.random() * 22;
          gain.gain.setValueAtTime(0.035, nowTime + delay);
          gain.gain.exponentialRampToValueAtTime(0.0001, nowTime + delay + 0.08);
          oscillator.connect(gain).connect(audioContext.destination);
          oscillator.start(nowTime + delay);
          oscillator.stop(nowTime + delay + 0.09);
          CabinAudioManager.registerActiveOscillator(oscillator);
        });
      } else if (type === "purrFallback") {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = "sawtooth";
        oscillator.frequency.value = 27;
        gain.gain.setValueAtTime(0.018, nowTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, nowTime + 1.5);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start(nowTime);
        oscillator.stop(nowTime + 1.6);
        CabinAudioManager.registerActiveOscillator(oscillator);
      } else if (type === "meow") {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(530, nowTime);
        oscillator.frequency.exponentialRampToValueAtTime(310, nowTime + 0.38);
        gain.gain.setValueAtTime(0.035, nowTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, nowTime + 0.42);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start(nowTime);
        oscillator.stop(nowTime + 0.45);
        CabinAudioManager.registerActiveOscillator(oscillator);
      }
    } catch (error) {
      console.warn(`[CabinAudio:Mimi:${type}]`, error);
    }
  };
  const playRealPurr = async () => {
    CabinAudioManager.stop("mimi-purr");
    try {
      const context = CabinAudioManager.getContext();
      purrBufferPromise ||= fetch(purrAudioPath)
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.arrayBuffer();
        })
        .then((buffer) => context.decodeAudioData(buffer));
      const audioBuffer = await purrBufferPromise;
      const duration = Math.min(2.8, Math.max(2.2, audioBuffer.duration - 0.2));
      CabinAudioManager.play("mimi-purr", (audioContext) => {
        const source = audioContext.createBufferSource();
        const highpass = audioContext.createBiquadFilter();
        const lowpass = audioContext.createBiquadFilter();
        const gain = audioContext.createGain();
        source.buffer = audioBuffer;
        highpass.type = "highpass";
        highpass.frequency.value = 58;
        highpass.Q.value = 0.7;
        lowpass.type = "lowpass";
        lowpass.frequency.value = 1650;
        lowpass.Q.value = 0.55;
        const start = audioContext.currentTime;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.105, start + 0.1);
        gain.gain.setValueAtTime(0.105, start + duration - 0.42);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        source.connect(highpass).connect(lowpass).connect(gain).connect(audioContext.destination);
        source.start(start, Math.min(0.2, Math.max(0, audioBuffer.duration - duration)), duration);
        source.stop(start + duration + 0.03);
        return { stop: () => { try { source.stop(); } catch {} } };
      });
      window.setTimeout(() => CabinAudioManager.stop("mimi-purr"), duration * 1000 + 80);
    } catch (error) {
      console.warn("[CabinAudio:MimiPurr] 未能处理真实呼噜声，已使用短播放保护。", error);
      realPurr.volume = 0.16;
      CabinAudioManager.play("mimi-purr", realPurr);
      window.setTimeout(() => CabinAudioManager.stop("mimi-purr"), 2800);
    }
  };
  const setPetVisual = (src, className = "is-idle-breathing", duration = 0) => {
    pet.classList.remove("is-idle-breathing", "is-purring", "is-playing", "is-stretching", "is-turning", "is-grooming");
    if (src) setImageSafe(catImage, src, "棕虎斑猫眯眯", fallbackBlogMaterials.roomMap.pet.mainCat);
    if (className) pet.classList.add(className);
    if (duration) window.setTimeout(() => setPetVisual(idleSource), duration);
  };
  const move = () => {
    if (!pet.classList.contains("is-in-pet-room") || !currentMimiContainer || !panel.hidden || pet.classList.contains("is-held") || pet.classList.contains("is-dragging")) return;
    stopGrooming();
    const safeWidth = Math.max(70, currentMimiContainer.clientWidth - 150);
    const safeHeight = Math.max(120, currentMimiContainer.clientHeight - 155);
    const restingSpots = currentMimiRoom === "pet"
      ? [
        { x: safeWidth * 0.04, y: safeHeight * 0.2 },
        { x: safeWidth * 0.66, y: safeHeight * 0.78 },
        { x: safeWidth * 0.38, y: safeHeight * 0.64 },
        { x: safeWidth * 0.94, y: safeHeight * 0.16 }
      ]
      : [
        { x: safeWidth * 0.06, y: safeHeight * 0.74 },
        { x: safeWidth * 0.7, y: safeHeight * 0.76 },
        { x: safeWidth * 0.86, y: safeHeight * 0.48 }
      ];
    const spot = restingSpots[Math.floor(Math.random() * restingSpots.length)];
    const x = 18 + spot.x;
    const y = 36 + spot.y;
    pet.style.setProperty("--mimi-face", x > lastX ? "-1" : "1");
    lastX = x;
    pet.dataset.pose = "walk";
    pet.classList.remove("is-idle-breathing", "is-stretching", "is-turning");
    let walkFrame = 0;
    setImageSafe(catImage, walkFrames[walkFrame], "正在房间里散步的眯眯", fallbackBlogMaterials.roomMap.pet.mainCat);
    window.clearInterval(walkFrameTimer);
    walkFrameTimer = window.setInterval(() => {
      walkFrame = (walkFrame + 1) % walkFrames.length;
      setImageSafe(catImage, walkFrames[walkFrame], "正在房间里散步的眯眯", fallbackBlogMaterials.roomMap.pet.mainCat);
    }, 300);
    setMimiPosition(x, y);
    pet.classList.add("is-walking");
    CabinAudioManager.stop("mimi-steps");
    CabinAudioManager.play("mimi-steps", () => {
      sound("step");
      return () => {};
    });
    window.setTimeout(() => {
      window.clearInterval(walkFrameTimer);
      pet.classList.remove("is-walking");
      state.pose = 0;
      pet.dataset.pose = "sit";
      setImageSafe(catImage, poses[0], "坐下休息的眯眯", fallbackBlogMaterials.roomMap.pet.mainCat);
      const restingClass = Math.random() < 0.38 ? "is-stretching" : Math.random() < 0.35 ? "is-turning" : "is-idle-breathing";
      setPetVisual(idleSource, restingClass, restingClass === "is-idle-breathing" ? 0 : 1500);
      save();
      scheduleGrooming();
      if (Math.random() < 0.08) sound("meow");
    }, 5400);
  };
  const scheduleMove = (delay = 16000 + Math.random() * 14000) => {
    window.clearTimeout(moveTimer);
    moveTimer = window.setTimeout(() => { move(); scheduleMove(); }, delay);
  };
  catButton.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || panel && !panel.hidden) return;
    if (!pet.classList.contains("is-in-pet-room") || !currentMimiContainer) return;
    event.preventDefault();
    event.stopPropagation();
    stopGrooming();
    window.clearTimeout(moveTimer);
    window.clearInterval(walkFrameTimer);
    pet.classList.add("is-dragging");
    pet.classList.remove("is-walking");
    catButton.setPointerCapture?.(event.pointerId);
    const containerRect = currentMimiContainer.getBoundingClientRect();
    const petRect = pet.getBoundingClientRect();
    const offsetX = event.clientX - petRect.left;
    const offsetY = event.clientY - petRect.top;
    const moveDrag = (moveEvent) => {
      didDragMimi = true;
      const x = moveEvent.clientX - containerRect.left - offsetX;
      const y = moveEvent.clientY - containerRect.top - offsetY;
      setMimiPosition(x, y, false);
    };
    const finishDrag = () => {
      pet.classList.remove("is-dragging");
      catButton.removeEventListener("pointermove", moveDrag);
      catButton.removeEventListener("pointerup", finishDrag);
      catButton.removeEventListener("pointercancel", finishDrag);
      const rect = pet.getBoundingClientRect();
      setMimiPosition(rect.left - containerRect.left, rect.top - containerRect.top, true);
      scheduleMove(18000);
    };
    catButton.addEventListener("pointermove", moveDrag);
    catButton.addEventListener("pointerup", finishDrag, { once: true });
    catButton.addEventListener("pointercancel", finishDrag, { once: true });
  });

  catButton.addEventListener("click", () => {
    if (didDragMimi) {
      didDragMimi = false;
      return;
    }
    const idle = pet.dataset.pose === "sit" && panel.hidden && !pet.classList.contains("is-walking") && !pet.classList.contains("is-playing") && !pet.classList.contains("is-held");
    if (idle) {
      stopGrooming();
      playRealPurr();
      setPetVisual(getMimiAsset("purr"), "is-purring", 3000);
      speak("她轻轻呼噜了几秒。", 2400);
      openMimiPanel();
      return;
    }
    panel.hidden = !panel.hidden;
    if (!panel.hidden) {
      speak("你找到眯眯了。她正安静地看着你。", 2200);
      positionMimiPanel();
    }
  });
  pet.querySelector(".mimi-pet__close").addEventListener("click", () => { panel.hidden = true; });
  pet.querySelectorAll("[data-mimi-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.mimiAction;
      stopGrooming();
      const reactions = {
        food: () => { state.hunger = Math.min(100, state.hunger + 25); state.health = Math.min(100, state.health + 2); setPetVisual(getMimiAsset("food"), "is-turning", 1700); speak("眯眯认真地吃了几口猫粮。"); },
        treat: () => { state.hunger = Math.min(100, state.hunger + 12); state.mood = Math.min(100, state.mood + 18); setPetVisual(getMimiAsset("treat"), "is-idle-breathing", 1900); speak("猫条很好吃。她舔了舔鼻子。"); },
        wand: () => { state.mood = Math.min(100, state.mood + 22); setPetVisual(getMimiAsset("play"), "is-playing", 2100); speak("她盯紧逗猫棒，轻轻扑了过去。"); },
        pet: () => { state.mood = Math.min(100, state.mood + 12); playRealPurr(); setPetVisual(getMimiAsset("purr"), "is-purring", 3000); speak("她眯起眼睛，轻轻呼噜了几秒。", 2600); },
        hold: () => { state.mood = Math.min(100, state.mood + 8); pet.classList.toggle("is-held"); setPetVisual(pet.classList.contains("is-held") ? getMimiAsset("hold") : getMimiAsset("idle")); speak(pet.classList.contains("is-held") ? "你把眯眯抱起来了。她安静地靠着你。" : "你轻轻把她放回地上。"); },
        litter: () => { state.litter = 100; speak("猫砂盆干净了。眯眯过来检查了一遍。"); },
        doctor: () => { state.health = 100; state.lastDoctor = Date.now(); speak("完成了一次温柔的健康检查，一切都被好好记挂着。"); }
      };
      reactions[action]?.();
      if (["treat", "wand"].includes(action) && Math.random() < 0.15) sound("meow");
      render();
      await saveMimiCareLog(action);
    });
  });
  petRoom?.querySelector(".pet-room__wand")?.addEventListener("click", () => {
    pet.querySelector('[data-mimi-action="wand"]')?.click();
  });
  pet.addEventListener("mimi-enter-room", (event) => {
    stopGrooming();
    currentMimiRoom = event.detail?.roomId || currentMimiRoom || "studio";
    currentMimiContainer = event.detail?.container || currentMimiContainer || petRoom || document.body;
    pet.dataset.pose = "sit";
    setPetVisual(idleSource);
    applyMimiRoomPosition();
    positionMimiPanel();
    window.setTimeout(move, 1800);
    scheduleGrooming();
  });
  pet.addEventListener("mimi-leave-room", () => {
    stopGrooming();
    CabinAudioManager.stop("mimi-purr");
    CabinAudioManager.stop("mimi-meow");
    CabinAudioManager.stop("mimi-steps");
    window.clearInterval(walkFrameTimer);
    pet.classList.remove("is-walking", "is-playing", "is-purring", "is-stretching", "is-turning", "is-held", "is-grooming");
    catImage.src = idleSource;
  });
  pet.dataset.pose = "sit";
  setPetVisual(idleSource);
  render();
  scheduleMove(6000);
  scheduleGrooming();
  document.body.append(panel);
  const defaultCabinHost = document.querySelector(".cabin-experience .cabin-room__scene");
  if (defaultCabinHost) {
    currentMimiContainer = defaultCabinHost;
    defaultCabinHost.append(pet);
    pet.classList.add("is-in-pet-room");
    pet.dispatchEvent(new CustomEvent("mimi-enter-room", { detail: { roomId: "studio", container: defaultCabinHost } }));
  }
  window.addEventListener("resize", () => {
    if (pet.classList.contains("is-in-pet-room")) applyMimiRoomPosition();
    positionMimiPanel();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopGrooming();
      return;
    }
    scheduleGrooming();
  });
}

const mimiCareLabels = {
  food: "喂了猫粮",
  treat: "喂了猫条",
  wand: "陪眯眯玩逗猫棒",
  pet: "摸了摸眯眯",
  hold: "抱了抱眯眯",
  litter: "铲了猫砂",
  doctor: "带眯眯做了健康检查"
};

function renderMimiCareLogs() {
  const list = document.querySelector("#mimiCareList");
  const count = document.querySelector("#mimiCareCount");
  if (!list || !count) return;
  count.textContent = `${mimiCareLogs.length}条`;
  if (!mimiCareLogs.length) {
    list.innerHTML = "<p>还没有人留下照顾记录。</p>";
    return;
  }
  list.innerHTML = mimiCareLogs.map((record) => `
    <article>
      <span>${escapeHtml(record.caretaker_name || "访客")}</span>
      <strong>${escapeHtml(mimiCareLabels[record.action] || "陪伴了眯眯")}</strong>
      <time>${formatDate(record.created_at)}</time>
    </article>
  `).join("");
}

async function saveMimiCareLog(action) {
  if (!mimiCareLabels[action]) return;
  const localRecord = {
    id: `local-${Date.now()}`,
    action,
    caretaker_name: profile?.handle || "访客",
    created_at: new Date().toISOString()
  };
  mimiCareLogs = [localRecord, ...mimiCareLogs].slice(0, 60);
  renderMimiCareLogs();
  if (!client) return;
  const { error } = await client.rpc("create_mimi_care_log", {
    session_token: sessionToken || null,
    action_input: action
  });
  if (!error) await loadBlog();
}

function setupBookmarkPanels() {
  const panels = [
    { selector: ".auth-panel", label: "账号" },
    { selector: ".avatar-panel", label: "头像" },
    { selector: ".welcome-panel", label: "小站" },
    { selector: ".wish-pool", label: "许愿" },
    { selector: ".lottery-panel", label: "抽奖" },
    { selector: ".composer", label: "写文" },
    { selector: ".chat", label: "讨论" }
  ];
  const rail = document.createElement("nav");
  rail.className = "bookmark-rail";
  rail.setAttribute("aria-label", "功能书签");
  document.body.append(rail);

  const closeAll = () => {
    document.querySelectorAll(".bookmark-panel.is-bookmark-open").forEach((panel) => {
      panel.classList.remove("is-bookmark-open");
    });
    rail.querySelectorAll("button").forEach((button) => button.classList.remove("active"));
  };

  panels.forEach(({ selector, label }) => {
    const panel = document.querySelector(selector);
    const head = panel?.querySelector(".panel__head");
    if (!panel || !head) return;
    document.body.append(panel);
    panel.classList.remove("collapsible-panel", "is-collapsed");
    panel.classList.add("bookmark-panel");

    const close = document.createElement("button");
    close.type = "button";
    close.className = "panel-close";
    close.textContent = "关闭";
    close.addEventListener("click", closeAll);
    head.append(close);

    const tab = document.createElement("button");
    tab.type = "button";
    tab.textContent = label;
    tab.dataset.bookmarkTarget = selector;
    tab.addEventListener("click", () => {
      const isOpen = panel.classList.contains("is-bookmark-open");
      closeAll();
      if (!isOpen) {
        panel.classList.add("is-bookmark-open");
        tab.classList.add("active");
      }
    });
    rail.append(tab);
  });
}

function setupBlogBookmarks() {
  const panels = [
    { selector: ".auth-panel", label: "\u8d26\u53f7" },
    { selector: "#soundStrip", label: "\u58f0\u97f3", special: "sound" },
    { selector: "#articlesSection", label: "\u6587\u7ae0", special: "articles" },
    { selector: ".podcast-panel", label: "\u64ad\u5ba2" },
    { selector: ".cabin-panel", label: "\u6728\u5c4b" },
    { selector: ".composer", label: "\u5199\u6587" },
    { selector: ".chat", label: "\u8ba8\u8bba" }
  ];
  const rail = document.createElement("nav");
  rail.className = "bookmark-rail";
  rail.setAttribute("aria-label", "\u529f\u80fd\u4e66\u7b7e");
  document.body.append(rail);

  const closeAll = () => {
    document.querySelectorAll(".bookmark-panel.is-bookmark-open").forEach((panel) => panel.classList.remove("is-bookmark-open"));
    const soundStrip = document.querySelector("#soundStrip");
    if (soundStrip) soundStrip.hidden = true;
    rail.querySelectorAll("button").forEach((button) => button.classList.remove("active"));
    document.body.classList.remove("has-bookmark-open");
  };

  panels.forEach(({ selector, label, special }) => {
    const panel = document.querySelector(selector);
    if (special === "sound") {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.textContent = label;
      tab.dataset.bookmarkTarget = selector;
      tab.addEventListener("click", () => {
        const isOpen = panel && !panel.hidden;
        closeAll();
        if (!isOpen && panel) {
          initAmbientOnce();
          panel.hidden = false;
          tab.classList.add("active");
          panel.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
      rail.append(tab);
      return;
    }
    if (special === "articles") {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.textContent = label;
      tab.dataset.bookmarkTarget = selector;
      tab.addEventListener("click", () => {
        closeAll();
        tab.classList.add("active");
        openArticleArchive();
      });
      rail.append(tab);
      return;
    }
    const head = panel?.querySelector(".panel__head");
    if (!panel || !head) return;
    document.body.append(panel);
    panel.classList.add("bookmark-panel");
    panel.classList.remove("is-bookmark-open");
    if (!head.querySelector(".panel-close")) {
      const close = document.createElement("button");
      close.type = "button";
      close.className = "panel-close";
      close.textContent = "\u5173\u95ed";
      close.addEventListener("click", closeAll);
      head.append(close);
    }
    const tab = document.createElement("button");
    tab.type = "button";
    tab.textContent = label;
    tab.dataset.bookmarkTarget = selector;
    tab.addEventListener("click", () => {
      const isOpen = panel.classList.contains("is-bookmark-open");
      closeAll();
      if (!isOpen) {
        panel.classList.add("is-bookmark-open");
        tab.classList.add("active");
        document.body.classList.add("has-bookmark-open");
      }
    });
    rail.append(tab);
  });
}

function playNutShellShaker() {
  CabinAudioManager.stop("nut-shell-shaker");
  CabinAudioManager.play("nut-shell-shaker", (audioContext) => {
    const now = audioContext.currentTime;
    const output = audioContext.createGain();
    output.gain.setValueAtTime(0.0001, now);
    output.gain.linearRampToValueAtTime(0.06, now + 0.04);
    output.gain.exponentialRampToValueAtTime(0.0001, now + 2);
    output.connect(audioContext.destination);
    const oscillators = [];
    for (let i = 0; i < 18; i += 1) {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = i % 2 ? "triangle" : "square";
      osc.frequency.value = 650 + Math.random() * 1800;
      const start = now + i * 0.085;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.018, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
      osc.connect(gain).connect(output);
      osc.start(start);
      osc.stop(start + 0.1);
      oscillators.push(osc);
    }
    return { stop: () => oscillators.forEach((osc) => { try { osc.stop(); } catch {} }) };
  });
}

function setupCabinExperience() {
  const experience = document.querySelector(".cabin-experience");
  if (!experience) return;
  const image = $("#cabinRoomImage");
  const detailImage = $("#cabinRoomDetail");
  const plantImage = $("#cabinRoomPlant");
  const accentImage = $("#cabinRoomAccent");
  const pendantImage = $("#cabinPendant");
  const musicStudio = $("#cabinMusicStudio");
  const petRoom = $("#cabinPetRoom");
  const gallery = document.querySelector(".cabin-gallery");
  const title = $("#cabinRoomTitle");
  const note = $("#cabinRoomNote");
  const number = $("#cabinRoomNumber");
  const lightButton = $("#cabinLightToggle");
  const treasureClue = $("#cabinTreasureClue");
  const treasureDialog = $("#cabinTreasureDialog");
  const treasureMessage = $("#cabinTreasureMessage");
  const cabinRoom = experience.querySelector(".cabin-room");
  const scene = experience.querySelector(".cabin-room__scene");
  const candleFlame = document.createElement("span");
  candleFlame.className = "cabin-candle-flame";
  candleFlame.setAttribute("aria-hidden", "true");
  candleFlame.hidden = true;
  scene.append(candleFlame);
  const materialMap = getBlogMaterials().roomMap || fallbackBlogMaterials.roomMap;
  const cabinAssetPositionKey = "cabin-asset-positions-v2-bar";
  const cabinAssetLayers = [
    ["painting", image],
    ["prop", detailImage],
    ["plant", plantImage],
    ["accent", accentImage],
    ["pendant", pendantImage]
  ];
  const cabinAssetControls = new Map();
  let cabinRestoreButton = null;
  const rooms = {
    studio: { number: "ROOM 01", title: "夜色画室", note: "灯亮以后，街巷里的星星才慢慢出现。", image: materialMap.studio.painting, alt: "夜色街巷装框画", aspect: "portrait", detail: materialMap.studio.prop, detailAlt: "桌上的暖光台灯", prop: "lamp", pendant: false, assets: materialMap.studio, layout: { theme: "studio", paintingSize: "25%", paintingHeight: "49%", paintingX: "7%", paintingY: "8%", propSize: "13%", propX: "83%", propY: "26%", plantSize: "0%", plantX: "0%", plantY: "0%", accentSize: "58%", accentX: "31%", accentY: "0%", pendantSize: "28%", moodColor: "#9b6a3f", floorTone: "#2d190f" } },
    water: { number: "ROOM 02", title: "水边房间", note: "胡桃木墙上，水面把光留在了睡莲之间。", image: materialMap.water.painting, alt: "睡莲水面装框画", aspect: "landscape", detail: materialMap.water.prop, detailAlt: "绿色墙钟", prop: "clock", pendant: true, assets: materialMap.water, layout: { theme: "water", paintingSize: "51%", paintingHeight: "52%", paintingX: "7%", paintingY: "10%", propSize: "12%", propX: "78%", propY: "52%", plantSize: "19%", plantX: "59%", plantY: "12%", pendantSize: "18%", moodColor: "#6f8f86", floorTone: "#20221d" } },
    flowers: { number: "ROOM 03", title: "花与书房", note: "花、旧书和绿色墙面，在夜里有自己的呼吸。", image: materialMap.flowers.painting, alt: "花与书静物装框画", aspect: "landscape", detail: materialMap.flowers.plantDetail, detailAlt: "桌上的淡粉菊花瓶", prop: "flowers", pendant: true, assets: materialMap.flowers, layout: { theme: "flowers", paintingSize: "46%", paintingHeight: "51%", paintingX: "6%", paintingY: "9%", propSize: "16%", propX: "78%", propY: "10%", plantSize: "19%", plantX: "58%", plantY: "10%", pendantSize: "17%", moodColor: "#8b9a68", floorTone: "#272016" } },
    hearth: { number: "ROOM 04", title: "炉边角落", note: "灯和薄雾守着这个角落，像一间一直有人等候的小屋。", image: materialMap.hearth.scene, alt: "暖色灯光与加湿器角落", aspect: "landscape", detail: materialMap.hearth.lamp, detailAlt: "桌上的暖光灯", prop: "lamp", pendant: false, assets: materialMap.hearth, layout: { theme: "hearth", paintingSize: "56%", paintingHeight: "62%", paintingX: "5%", paintingY: "7%", propSize: "15%", propX: "76%", propY: "10%", plantSize: "0%", plantX: "0%", plantY: "0%", accentSize: "15%", accentX: "58%", accentY: "10%", pendantSize: "0%", moodColor: "#b06f3a", floorTone: "#32190d" } },
    child: { number: "ROOM 05", title: "儿童画室", note: "胡桃木矮柜和柔软地毯，等着新的颜色住进来。", image: materialMap.child.painting, alt: "儿童房里的竹影装框画", aspect: "portrait", detail: materialMap.child.prop, detailAlt: "绿色墙钟", prop: "clock", pendant: true, assets: materialMap.child, layout: { theme: "child", paintingSize: "30%", paintingHeight: "66%", paintingX: "8%", paintingY: "7%", propSize: "9%", propX: "87%", propY: "17%", plantSize: "13%", plantX: "72%", plantY: "12%", accentSize: "29%", accentX: "42%", accentY: "10%", pendantSize: "16%", moodColor: "#b99764", floorTone: "#312116" } }
  };
  let lightOn = false;
  const dayKey = new Date().toISOString().slice(0, 10);
  const roomKeys = Object.keys(rooms);
  const dailyNumber = [...dayKey].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const treasureRoom = roomKeys[dailyNumber % roomKeys.length];
  const treasureMessages = [
    "今天会有一件小事，悄悄站到你这一边。",
    "愿你不急着证明自己，也仍然被世界温柔看见。",
    "今天留下的一点耐心，会在不远处变成好运。",
    "你正在走的路，也许安静，但并没有白走。",
    "愿今天的你既有边界，也有柔软。",
    "某个迟来的答案，正在靠近你。",
    "把心放慢一点，属于你的光不会错过你。"
  ];
  const todayMessage = treasureMessages[dailyNumber % treasureMessages.length];

  const playFootsteps = () => {
    CabinAudioManager.play("cabin-footsteps", (footstepContext) => {
      const sources = [];
      try {
      [0, 0.18, 0.38].forEach((delay, index) => {
        const now = footstepContext.currentTime + delay;
        const buffer = footstepContext.createBuffer(1, Math.floor(footstepContext.sampleRate * 0.12), footstepContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
        const source = footstepContext.createBufferSource();
        const filter = footstepContext.createBiquadFilter();
        const gain = footstepContext.createGain();
        source.buffer = buffer;
        filter.type = "lowpass";
        filter.frequency.value = 190 + index * 25;
        gain.gain.value = 0.09;
        source.connect(filter).connect(gain).connect(footstepContext.destination);
        source.start(now);
        source.stop(now + 0.13);
        sources.push(source);
        CabinAudioManager.registerActiveOscillator(source);
      });
      } catch (error) {
        console.warn("[CabinAudio:Footsteps]", error);
      }
      return { stop: () => sources.forEach((source) => { try { source.stop(); } catch {} }) };
    });
  };
  const ensureCabinFireAmbience = () => {
    if (document.hidden) return;
    if (!CabinAudioManager.getActiveSourceNames().includes("cabin-fire-ambience")) {
      playCabinFireAmbience();
    }
  };

  const applyRoomLayout = (room) => {
    const layout = room.layout || {};
    experience.dataset.cabinTheme = layout.theme || "studio";
    const variables = {
      "--painting-w": layout.paintingSize,
      "--painting-h": layout.paintingHeight,
      "--painting-x": layout.paintingX,
      "--painting-y": layout.paintingY,
      "--prop-w": layout.propSize,
      "--prop-x": layout.propX,
      "--prop-y": layout.propY,
      "--plant-w": layout.plantSize,
      "--plant-x": layout.plantX,
      "--plant-y": layout.plantY,
      "--accent-w": layout.accentSize || "0%",
      "--accent-x": layout.accentX || "0%",
      "--accent-y": layout.accentY || "0%",
      "--pendant-w": layout.pendantSize,
      "--room-accent": layout.moodColor,
      "--room-floor": layout.floorTone
    };
    Object.entries(variables).forEach(([key, value]) => { if (value) scene.style.setProperty(key, value); });
  };
  const readCabinAssetPositions = () => {
    try { return JSON.parse(localStorage.getItem(cabinAssetPositionKey) || "{}"); } catch { return {}; }
  };
  const writeCabinAssetPosition = (roomId, layer, position) => {
    const positions = readCabinAssetPositions();
    const current = positions[roomId]?.[layer] || {};
    positions[roomId] = { ...(positions[roomId] || {}), [layer]: { ...current, ...position } };
    localStorage.setItem(cabinAssetPositionKey, JSON.stringify(positions));
  };
  const canEditCabinAssets = () => profile?.role === "owner";
  const hasHiddenCabinAssets = (roomId) => Object.values(readCabinAssetPositions()[roomId] || {}).some((asset) => asset?.hidden);
  const clearHiddenCabinAssets = (roomId) => {
    const positions = readCabinAssetPositions();
    if (!positions[roomId]) return;
    Object.keys(positions[roomId]).forEach((layer) => { positions[roomId][layer].hidden = false; });
    localStorage.setItem(cabinAssetPositionKey, JSON.stringify(positions));
  };
  const positionCabinAssetControls = () => {
    const roomId = experience.dataset.cabinRoom || "studio";
    const sceneRect = scene.getBoundingClientRect();
    cabinAssetLayers.forEach(([layer, element]) => {
      const controls = cabinAssetControls.get(layer);
      if (!controls) return;
      const visible = canEditCabinAssets() && !element.hidden && !experience.classList.contains("is-music-room") && !experience.classList.contains("is-pet-room");
      controls.hidden = !visible;
      if (!visible) return;
      const rect = element.getBoundingClientRect();
      controls.style.left = `${Math.max(8, rect.right - sceneRect.left - 56)}px`;
      controls.style.top = `${Math.max(8, rect.top - sceneRect.top + 8)}px`;
      controls.dataset.cabinRoomLayer = `${roomId}:${layer}`;
    });
    if (candleFlame) {
      const showFlame = roomId === "hearth" && accentImage && !accentImage.hidden && !experience.classList.contains("is-music-room") && !experience.classList.contains("is-pet-room");
      candleFlame.hidden = !showFlame;
      if (showFlame) {
        const rect = accentImage.getBoundingClientRect();
        candleFlame.style.left = `${rect.left - sceneRect.left + rect.width * 0.48}px`;
        candleFlame.style.top = `${rect.top - sceneRect.top + rect.height * 0.2}px`;
        candleFlame.style.setProperty("--flame-size", `${Math.max(12, Math.min(26, rect.width * 0.11))}px`);
      }
    }
    if (cabinRestoreButton) {
      const hasCustomLayout = Boolean(readCabinAssetPositions()[roomId]);
      cabinRestoreButton.hidden = !(canEditCabinAssets() && hasCustomLayout && !experience.classList.contains("is-music-room") && !experience.classList.contains("is-pet-room"));
    }
  };
  const resetCabinRoomLayout = (roomId) => {
    const positions = readCabinAssetPositions();
    delete positions[roomId];
    localStorage.setItem(cabinAssetPositionKey, JSON.stringify(positions));
  };
  const applyCabinAssetPosition = (roomId, layer, element) => {
    const position = readCabinAssetPositions()[roomId]?.[layer];
    element.dataset.cabinLayer = layer;
    element.dataset.cabinRoomLayer = `${roomId}:${layer}`;
    element.classList.toggle("is-cabin-flipped", Boolean(position?.flipped));
    element.style.setProperty("--cabin-asset-scale", Number.isFinite(position?.scale) ? String(position.scale) : "1");
    const isNewStudioCabinet = roomId === "studio" && layer === "accent" && (element.currentSrc || element.src || "").includes("walnut-work-cabinet-tidy");
    if (position?.hidden && !isNewStudioCabinet) {
      element.hidden = true;
      return;
    }
    if (!position) {
      element.style.removeProperty("top");
      element.style.removeProperty("left");
      element.style.removeProperty("right");
      element.style.removeProperty("bottom");
      return;
    }
    if (Number.isFinite(position.left) && Number.isFinite(position.top)) {
      element.style.left = `${position.left}%`;
      element.style.top = `${position.top}%`;
      element.style.right = "auto";
      element.style.bottom = "auto";
    }
  };
  const createCabinAssetControls = () => {
    cabinAssetLayers.forEach(([layer, element]) => {
      const controls = document.createElement("div");
      controls.className = "cabin-asset-control";
      controls.hidden = true;
      controls.innerHTML = `
        <button type="button" class="cabin-asset-control__trigger" data-cabin-control="menu" title="调整" aria-label="调整">···</button>
        <span class="cabin-asset-control__actions">
          <button type="button" class="cabin-asset-control__button" data-cabin-control="smaller" title="缩小" aria-label="缩小">−</button>
          <button type="button" class="cabin-asset-control__button" data-cabin-control="larger" title="放大" aria-label="放大">＋</button>
          <button type="button" class="cabin-asset-control__button" data-cabin-control="flip" title="转变方向" aria-label="转变方向">↔</button>
          <button type="button" class="cabin-asset-control__button" data-cabin-control="hide" title="隐藏这个物件" aria-label="隐藏这个物件">×</button>
        </span>
      `;
      controls.addEventListener("pointerdown", (event) => event.stopPropagation());
      controls.addEventListener("click", (event) => {
        const button = event.target.closest("[data-cabin-control]");
        if (!button || !canEditCabinAssets()) return;
        if (button.dataset.cabinControl === "menu") {
          controls.classList.toggle("is-open");
          return;
        }
        const roomId = experience.dataset.cabinRoom || "studio";
        const current = readCabinAssetPositions()[roomId]?.[layer] || {};
        if (button.dataset.cabinControl === "flip") {
          writeCabinAssetPosition(roomId, layer, { flipped: !current.flipped });
          applyCabinAssetPosition(roomId, layer, element);
          positionCabinAssetControls();
          return;
        }
        if (button.dataset.cabinControl === "smaller" || button.dataset.cabinControl === "larger") {
          const currentScale = Number.isFinite(current.scale) ? current.scale : 1;
          const step = button.dataset.cabinControl === "larger" ? 0.1 : -0.1;
          const nextScale = Math.max(0.45, Math.min(1.85, Number((currentScale + step).toFixed(2))));
          writeCabinAssetPosition(roomId, layer, { scale: nextScale });
          applyCabinAssetPosition(roomId, layer, element);
          positionCabinAssetControls();
          return;
        }
        writeCabinAssetPosition(roomId, layer, { hidden: true });
        applyCabinRoomAssets(roomId, rooms[roomId]);
      });
      element.addEventListener("pointerenter", () => controls.classList.add("is-near"));
      element.addEventListener("pointerleave", () => window.setTimeout(() => controls.classList.remove("is-near"), 180));
      controls.addEventListener("pointerleave", () => controls.classList.remove("is-open", "is-near"));
      scene.append(controls);
      cabinAssetControls.set(layer, controls);
    });
    cabinRestoreButton = document.createElement("button");
    cabinRestoreButton.type = "button";
    cabinRestoreButton.className = "cabin-asset-restore";
    cabinRestoreButton.textContent = "重置布局";
    cabinRestoreButton.hidden = true;
    cabinRestoreButton.addEventListener("click", () => {
      const roomId = experience.dataset.cabinRoom || "studio";
      resetCabinRoomLayout(roomId);
      applyCabinRoomAssets(roomId, rooms[roomId]);
    });
    scene.append(cabinRestoreButton);
    window.addEventListener("resize", positionCabinAssetControls);
    window.updateCabinOwnerControls = positionCabinAssetControls;
  };
  const makeCabinAssetDraggable = (element, layer) => {
    if (!element) return;
    element.classList.add("is-cabin-draggable");
    element.title = "可以拖动调整位置";
    element.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const roomId = experience.dataset.cabinRoom || "studio";
      if (!canEditCabinAssets()) return;
      if (element.hidden || experience.classList.contains("is-music-room") || experience.classList.contains("is-pet-room")) return;
      event.preventDefault();
      element.setPointerCapture?.(event.pointerId);
      element.classList.add("is-dragging");
      const sceneRect = scene.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const offsetX = event.clientX - elementRect.left;
      const offsetY = event.clientY - elementRect.top;
      const move = (moveEvent) => {
        const maxLeft = Math.max(0, sceneRect.width - elementRect.width);
        const maxTop = Math.max(0, sceneRect.height - elementRect.height);
        const leftPx = Math.max(0, Math.min(maxLeft, moveEvent.clientX - sceneRect.left - offsetX));
        const topPx = Math.max(0, Math.min(maxTop, moveEvent.clientY - sceneRect.top - offsetY));
        const left = Number(((leftPx / sceneRect.width) * 100).toFixed(2));
        const top = Number(((topPx / sceneRect.height) * 100).toFixed(2));
        element.style.left = `${left}%`;
        element.style.top = `${top}%`;
        element.style.right = "auto";
        element.style.bottom = "auto";
        element.dataset.dragLeft = String(left);
        element.dataset.dragTop = String(top);
        positionCabinAssetControls();
      };
      const finish = () => {
        element.classList.remove("is-dragging");
        element.removeEventListener("pointermove", move);
        element.removeEventListener("pointerup", finish);
        element.removeEventListener("pointercancel", finish);
        if (element.dataset.dragLeft && element.dataset.dragTop) {
          writeCabinAssetPosition(roomId, layer, {
            left: Number(element.dataset.dragLeft),
            top: Number(element.dataset.dragTop)
          });
        }
        positionCabinAssetControls();
      };
      element.addEventListener("pointermove", move);
      element.addEventListener("pointerup", finish, { once: true });
      element.addEventListener("pointercancel", finish, { once: true });
    });
  };
  const applyCabinRoomAssets = (roomId, room = rooms[roomId]) => {
    const assets = BLOG_MATERIALS.roomMap?.[roomId] || room?.assets;
    const fallbackAssets = fallbackBlogMaterials.roomMap[roomId] || {};
    if (!assets || !room) {
      console.warn("[BlogMaterials] 没有找到房间素材:", roomId);
      return;
    }
    const mainSource = assets.painting || assets.scene || assets.background || assets.mainCat || "";
    const detailSource = assets.prop || assets.plant || assets.plantMain || assets.lamp || assets.plantDetail || assets.toy || "";
    const plantSource = assets.plant || assets.plantMain || assets.toy || "";
    const accentSource = assets.accentImage || (assets.painting && assets.scene ? assets.scene : assets.toy && detailSource !== assets.toy ? assets.toy : "");
    const fallbackMain = fallbackAssets.painting || fallbackAssets.scene || fallbackAssets.mainCat || "";
    const fallbackDetail = fallbackAssets.prop || fallbackAssets.plant || fallbackAssets.plantMain || fallbackAssets.lamp || fallbackAssets.toy || "";
    if (mainSource) setImageSafe(image, mainSource, assets.title || room.alt, fallbackMain);
    detailImage.hidden = !detailSource;
    plantImage.hidden = !plantSource;
    accentImage.hidden = !accentSource;
    pendantImage.hidden = !room.pendant;
    if (detailSource) setImageSafe(detailImage, detailSource, `${assets.title || room.title} detail`, fallbackDetail);
    if (plantSource) setImageSafe(plantImage, plantSource, `${assets.title || room.title} plant`, fallbackAssets.plant || fallbackAssets.plantMain || "");
    if (accentSource) setImageSafe(accentImage, accentSource, `${assets.title || room.title} scene`, fallbackAssets.toy || "");
    if (room.pendant && BLOG_MATERIALS.roomMap?.shared?.pendant) {
      setImageSafe(pendantImage, BLOG_MATERIALS.roomMap.shared.pendant, "胡桃木暖光吊灯", fallbackBlogMaterials.roomMap.shared.pendant);
    }
    image.alt = room.alt;
    image.dataset.aspect = room.aspect;
    detailImage.alt = room.detailAlt;
    detailImage.dataset.prop = room.prop;
    applyRoomLayout(room);
    cabinAssetLayers.forEach(([layer, element]) => applyCabinAssetPosition(roomId, layer, element));
    requestAnimationFrame(positionCabinAssetControls);
  };
  createCabinAssetControls();
  cabinAssetLayers.forEach(([layer, element]) => {
    makeCabinAssetDraggable(element, layer);
    element.addEventListener("load", () => requestAnimationFrame(positionCabinAssetControls));
  });

  const setLight = (value) => {
    lightOn = value;
    experience.classList.toggle("is-lit", lightOn);
    lightButton.setAttribute("aria-pressed", String(lightOn));
    lightButton.querySelector("strong").textContent = lightOn ? "关灯" : "开灯";
    treasureClue.hidden = !(lightOn && experience.dataset.cabinRoom === treasureRoom);
  };

  const startRoomTransition = () => {
    if (cabinRoom) {
      cabinRoom.classList.add("is-transitioning");
      cabinRoom.classList.remove("is-loaded");
    }
    if (scene) scene.classList.add("is-loading");
  };
  const finishRoomTransition = () => {
    if (cabinRoom) {
      cabinRoom.classList.remove("is-transitioning");
      cabinRoom.classList.add("is-loaded");
    }
    if (scene) scene.classList.remove("is-loading");
  };

  document.querySelectorAll("[data-room]").forEach((button) => {
    button.addEventListener("click", () => {
      const room = rooms[button.dataset.room];
      const isMusicRoom = button.dataset.room === "music";
      const isPetRoom = button.dataset.room === "pet";
      if (!room && !isMusicRoom && !isPetRoom) return;
      CabinAudioManager.stopRoomSounds();
      CabinAudioManager.stop("nut-shell-shaker");
      playFootsteps();
      ensureCabinFireAmbience();
      experience.classList.add("is-walking");
      window.setTimeout(() => experience.classList.remove("is-walking"), 650);
      experience.dataset.cabinRoom = button.dataset.room;
      document.dispatchEvent(new CustomEvent("cabin-room-change", { detail: { roomId: button.dataset.room } }));
      document.querySelectorAll("[data-room]").forEach((item) => item.classList.toggle("active", item === button));
      experience.classList.toggle("is-music-room", isMusicRoom);
      experience.classList.toggle("is-pet-room", isPetRoom);
      musicStudio.hidden = !isMusicRoom;
      petRoom.hidden = !isPetRoom;
      gallery.hidden = isMusicRoom || isPetRoom;
      positionCabinAssetControls();
      const mimi = document.querySelector(".mimi-pet");
      const mimiPanel = document.querySelector(".mimi-pet__panel");
      if (mimi) {
        const mimiHost = isPetRoom ? petRoom : isMusicRoom ? musicStudio : scene;
        mimiHost.append(mimi);
        mimi.classList.add("is-in-pet-room");
        mimi.dispatchEvent(new CustomEvent("mimi-enter-room", {
          detail: { roomId: button.dataset.room, container: mimiHost }
        }));
        if (!isPetRoom && mimiPanel) mimiPanel.hidden = true;
      }
      if (isMusicRoom || isPetRoom) {
        setLight(false);
        return;
      }
      number.textContent = room.number;
      title.textContent = room.title;
      note.textContent = room.note;
      setLight(false);
      startRoomTransition();
      applyCabinRoomAssets(button.dataset.room, room);
      let loadCount = 0;
      const onAssetLoad = () => { loadCount++; if (loadCount >= 2) finishRoomTransition(); };
      image.addEventListener("load", onAssetLoad, { once: true });
      if (room.pendant && pendantImage) pendantImage.addEventListener("load", onAssetLoad, { once: true });
      if (image.complete) onAssetLoad();
      if (!room.pendant || (pendantImage && pendantImage.complete)) { if (loadCount < 2 && room.pendant && pendantImage && pendantImage.complete) onAssetLoad(); }
      window.setTimeout(finishRoomTransition, 1500); // 兜底超时
    });
  });
  experience.addEventListener("pointerdown", ensureCabinFireAmbience, { passive: true });
  lightButton.addEventListener("click", () => setLight(!lightOn));
  treasureClue.addEventListener("click", () => {
    treasureMessage.textContent = todayMessage;
    treasureDialog.showModal();
    localStorage.setItem("cabin-treasure-found", dayKey);
  });
  treasureDialog.querySelector(".cabin-treasure-dialog__close").addEventListener("click", () => treasureDialog.close());

  // 键盘导航
  experience.setAttribute("tabindex", "0");
  experience.setAttribute("aria-label", "小木屋 — 使用左右箭头切换房间，回车或 L 键开关灯");
  experience.addEventListener("keydown", (event) => {
    if (event.target !== experience && event.target.closest("input, textarea, [contenteditable]")) return;
    const currentRoom = experience.dataset.cabinRoom || "studio";
    const isSpecial = currentRoom === "music" || currentRoom === "pet";
    if (isSpecial && event.key === "ArrowLeft") {
      event.preventDefault();
      const prevRoom = roomKeys[roomKeys.length - 2]; // 儿童房
      const btn = document.querySelector(`[data-room="${prevRoom}"]`);
      if (btn) btn.click();
      return;
    }
    if (isSpecial) return;
    const currentIndex = roomKeys.indexOf(currentRoom);
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      if (currentIndex > 0) {
        event.preventDefault();
        const btn = document.querySelector(`[data-room="${roomKeys[currentIndex - 1]}"]`);
        if (btn) btn.click();
      }
    }
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      if (currentIndex < roomKeys.length - 1) {
        event.preventDefault();
        const btn = document.querySelector(`[data-room="${roomKeys[currentIndex + 1]}"]`);
        if (btn) btn.click();
      }
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      lightButton.click();
    }
    if (event.key === "l" || event.key === "L") {
      event.preventDefault();
      lightButton.click();
    }
  });

  scene?.addEventListener("click", (event) => {
    const target = event.target;
    const source = target?.currentSrc || target?.src || "";
    if (target?.id === "cabinRoomAccent" || source.includes("rattle-nut-shell-handmade")) {
      playNutShellShaker();
    }
  });
  applyCabinRoomAssets("studio", rooms.studio);
}

function renderCabinRecordings() {
  const list = $("#cabinRecordingList");
  if (!list) return;
  if (!cabinRecordings.length) {
    list.innerHTML = '<p class="cabin-recordings__empty">还没有作品留在这里。</p>';
    return;
  }
  list.innerHTML = cabinRecordings.map((recording) => {
    const author = profiles.get(recording.owner_id);
    return `<article><div><strong>${escapeHtml(recording.title)}</strong><small>${escapeHtml(author?.handle || recording.performer_name || "访客")} · ${formatDate(recording.created_at)}</small></div><audio controls preload="none" src="${recording.audio_url}"></audio></article>`;
  }).join("");
}

function setupCabinMusicRoom() {
  const studio = $("#cabinMusicStudio");
  if (!studio) return;
  const startButton = $("#cabinRecordStart");
  const stopButton = $("#cabinRecordStop");
  const saveButton = $("#cabinRecordSave");
  const timeLabel = $("#cabinRecordTime");
  const preview = $("#cabinRecordPreview");
  const titleInput = $("#cabinRecordingTitle");
  let context = null;
  let master = null;
  let recordDestination = null;
  let recorder = null;
  let chunks = [];
  let pendingRecording = null;
  let startedAt = 0;
  let timer = null;
  const heldKeyboardVoices = new Map();
  const guitarArt = document.querySelector("#musicRoomGuitarArt");
  if (guitarArt) {
    console.warn("[CabinMusic] 未找到吉他矢量素材，保留可弹奏吉他按钮。");
  }
  const perch = document.querySelector("#mimiPianoPerch");
  let pianoPlayCount = 0;
  const maybeShowMimiOnPiano = () => {
    if (!perch) return;
    pianoPlayCount += 1;
    if (pianoPlayCount < 3 && Math.random() > 0.18) return;
    perch.classList.add("is-visible");
    window.setTimeout(() => perch.classList.remove("is-visible"), 4200);
    pianoPlayCount = 0;
  };
  const pitchGameElements = {
    root: $("#perfectPitchGame"),
    difficulty: $("#pitchDifficulty"),
    start: $("#pitchStart"),
    replay: $("#pitchReplay"),
    round: $("#pitchRound"),
    score: $("#pitchScore"),
    streak: $("#pitchStreak"),
    feedback: $("#pitchFeedback")
  };
  const pianoNoteNames = new Map([
    [261.63, "C"],
    [277.18, "C#"],
    [293.66, "D"],
    [311.13, "D#"],
    [329.63, "E"],
    [349.23, "F"],
    [369.99, "F#"],
    [392, "G"],
    [415.3, "G#"],
    [440, "A"],
    [466.16, "A#"],
    [493.88, "B"],
    [523.25, "C5"]
  ]);
  const perfectPitchState = {
    active: false,
    awaitingAnswer: false,
    acceptingAnswer: false,
    round: 0,
    total: 10,
    score: 0,
    streak: 0,
    currentNote: null,
    notes: []
  };
  window.perfectPitchState = perfectPitchState;


  const ensureAudio = async () => {
    if (!context) {
      context = new (window.AudioContext || window.webkitAudioContext)();
      master = context.createGain();
      master.gain.value = 0.72;
      recordDestination = context.createMediaStreamDestination();
      master.connect(context.destination);
      master.connect(recordDestination);
    }
    if (context.state === "suspended") await context.resume();
  };
  const animateButton = (button) => {
    button.classList.remove("is-playing");
    void button.offsetWidth;
    button.classList.add("is-playing");
    window.setTimeout(() => button.classList.remove("is-playing"), 500);
  };
  const registerVoice = (nodes, stopAt, releaseDuration = 0.18) => {
    let stopped = false;
    const voice = {
      release: () => {
        if (stopped || !context) return;
        const now = context.currentTime;
        nodes.gain.gain.cancelScheduledValues(now);
        nodes.gain.gain.setValueAtTime(Math.max(0.0001, nodes.gain.gain.value), now);
        nodes.gain.gain.exponentialRampToValueAtTime(0.0001, now + releaseDuration);
        nodes.oscillators?.forEach((oscillator) => { try { oscillator.stop(now + releaseDuration + 0.04); } catch {} });
        if (nodes.source) { try { nodes.source.stop(now + releaseDuration + 0.04); } catch {} }
      },
      stop: () => {
        if (stopped) return;
        stopped = true;
        nodes.oscillators?.forEach((oscillator) => { try { oscillator.stop(); } catch {} });
        if (nodes.source) { try { nodes.source.stop(); } catch {} }
        CabinAudioManager.releaseVoice(voice);
      }
    };
    CabinAudioManager.registerVoice(voice);
    window.setTimeout(() => {
      stopped = true;
      CabinAudioManager.releaseVoice(voice);
    }, stopAt * 1000 + 180);
    return voice;
  };
  const playPiano = async (frequency, button) => {
    await ensureAudio();
    const now = context.currentTime;
    const oscillators = [];
    const voiceGain = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 4200;
    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.linearRampToValueAtTime(0.19, now + 0.018);
    voiceGain.gain.exponentialRampToValueAtTime(0.045, now + 1.5);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + 4.8);
    filter.connect(voiceGain).connect(master);
    [1, 2, 3.01].forEach((multiple, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index === 0 ? "triangle" : "sine";
      oscillator.frequency.value = frequency * multiple;
      gain.gain.value = index === 0 ? 0.84 : 0.14 / index;
      oscillator.connect(gain).connect(filter);
      oscillator.start(now);
      oscillator.stop(now + 4.9);
      oscillators.push(oscillator);
    });
    animateButton(button);
    return registerVoice({ oscillators, gain: voiceGain }, 4.9, 0.8);
  };
  const getPianoNotes = () => [...studio.querySelectorAll("[data-note]")]
    .map((button) => ({ frequency: Number(button.dataset.note), button, name: pianoNoteNames.get(Number(button.dataset.note)) || button.textContent.trim() }))
    .filter((note) => Number.isFinite(note.frequency));
  const pickPitchNotes = () => {
    const notes = getPianoNotes();
    const difficulty = pitchGameElements.difficulty?.value || "normal";
    const allowed = difficulty === "easy"
      ? ["C", "D", "E", "F", "G"]
      : difficulty === "normal"
        ? ["C", "D", "E", "F", "G", "A", "B"]
        : null;
    return allowed ? notes.filter((note) => allowed.includes(note.name)) : notes;
  };
  const setPitchFeedback = (text, tone = "") => {
    if (!pitchGameElements.feedback || !pitchGameElements.root) return;
    pitchGameElements.feedback.textContent = text;
    pitchGameElements.root.classList.remove("is-correct", "is-wrong", "is-finished");
    if (tone) {
      pitchGameElements.root.classList.add(`is-${tone}`);
      window.setTimeout(() => pitchGameElements.root?.classList.remove(`is-${tone}`), 780);
    }
  };
  const renderPerfectPitch = () => {
    if (!pitchGameElements.root) return;
    pitchGameElements.round.textContent = `${perfectPitchState.round}/${perfectPitchState.total}`;
    pitchGameElements.score.textContent = `得分 ${perfectPitchState.score}`;
    pitchGameElements.streak.textContent = `连对 ${perfectPitchState.streak}`;
    pitchGameElements.replay.disabled = !perfectPitchState.active || !perfectPitchState.currentNote;
    pitchGameElements.start.textContent = perfectPitchState.active ? "重新开始" : "开始挑战";
  };
  const playPitchPrompt = async () => {
    if (!perfectPitchState.currentNote) return;
    perfectPitchState.acceptingAnswer = false;
    const voice = await playPiano(perfectPitchState.currentNote.frequency, perfectPitchState.currentNote.button);
    window.setTimeout(() => voice?.release?.(), 980);
    window.setTimeout(() => { perfectPitchState.acceptingAnswer = true; }, 1050);
  };
  const nextPitchRound = async () => {
    if (perfectPitchState.round >= perfectPitchState.total) {
      perfectPitchState.active = false;
      perfectPitchState.awaitingAnswer = false;
      perfectPitchState.acceptingAnswer = false;
      const score = perfectPitchState.score;
      const verdict = score >= 9 ? "像在夜里摸到一束准光。" : score >= 6 ? "耳朵已经很稳了，再玩一局会更准。" : "先慢慢听 C、D、E、F、G，感觉会醒过来。";
      pitchGameElements.root?.classList.add("is-finished");
      setPitchFeedback(`挑战结束：${score}/${perfectPitchState.total}。${verdict}`);
      renderPerfectPitch();
      return;
    }
    perfectPitchState.round += 1;
    perfectPitchState.currentNote = perfectPitchState.notes[Math.floor(Math.random() * perfectPitchState.notes.length)];
    perfectPitchState.awaitingAnswer = true;
    setPitchFeedback("听音中……请等声音结束后在钢琴键上回答。");
    renderPerfectPitch();
    await playPitchPrompt();
  };
  const startPerfectPitch = async () => {
    perfectPitchState.notes = pickPitchNotes();
    if (!perfectPitchState.notes.length) return setPitchFeedback("没有可用的钢琴音。", "wrong");
    Object.assign(perfectPitchState, { active: true, awaitingAnswer: false, acceptingAnswer: false, round: 0, score: 0, streak: 0, currentNote: null });
    renderPerfectPitch();
    await nextPitchRound();
  };
  const answerPerfectPitch = async (frequency) => {
    if (!perfectPitchState.active || !perfectPitchState.awaitingAnswer || !perfectPitchState.acceptingAnswer) return;
    perfectPitchState.awaitingAnswer = false;
    perfectPitchState.acceptingAnswer = false;
    const picked = getPianoNotes().find((note) => Math.abs(note.frequency - frequency) < 0.1);
    const correct = Math.abs(frequency - perfectPitchState.currentNote.frequency) < 0.1;
    if (correct) {
      perfectPitchState.score += 1;
      perfectPitchState.streak += 1;
      setPitchFeedback(`答对了，是 ${perfectPitchState.currentNote.name}。`, "correct");
      if (perfectPitchState.streak >= 3 && perch?.classList.contains("is-visible")) {
        perch.textContent = "眯眯好像听懂了。";
        window.setTimeout(() => { perch.textContent = "眯眯坐在琴盖上听了一会儿。"; }, 2600);
      }
    } else {
      perfectPitchState.streak = 0;
      setPitchFeedback(`差一点。你选了 ${picked?.name || "这个音"}，正确答案是 ${perfectPitchState.currentNote.name}。`, "wrong");
    }
    renderPerfectPitch();
    window.setTimeout(nextPitchRound, 1050);
  };
  const playBowl = async (frequency, button) => {
    await ensureAudio();
    const now = context.currentTime;
    const oscillators = [];
    const voiceGain = context.createGain();
    const filter = context.createBiquadFilter();
    const tremolo = context.createOscillator();
    const tremoloGain = context.createGain();
    filter.type = "lowpass";
    filter.frequency.value = 5200;
    filter.Q.value = 0.8;
    tremolo.type = "sine";
    tremolo.frequency.value = 0.46;
    tremoloGain.gain.value = 0.018;
    tremolo.connect(tremoloGain).connect(voiceGain.gain);
    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.linearRampToValueAtTime(0.13, now + 0.28);
    voiceGain.gain.exponentialRampToValueAtTime(0.052, now + 5.4);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + 14.5);
    filter.connect(voiceGain).connect(master);
    [1, 1.502, 2.01, 2.71, 4.16, 5.43].forEach((multiple, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency * multiple + (index % 2 ? 1.7 : -0.9);
      gain.gain.value = index === 0 ? 0.72 : 0.22 / index;
      oscillator.connect(gain).connect(filter);
      oscillator.start(now + index * 0.018);
      oscillator.stop(now + 14.7);
      oscillators.push(oscillator);
    });
    tremolo.start(now);
    tremolo.stop(now + 14.7);
    oscillators.push(tremolo);
    animateButton(button);
    return registerVoice({ oscillators, gain: voiceGain }, 14.7, 2.2);
  };
  const playGuitarString = (frequency, destination, startOffset = 0, level = 0.18, decay = 4.2) => {
    const length = Math.max(2, Math.round(context.sampleRate / frequency));
    const buffer = context.createBuffer(1, context.sampleRate * decay, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / length, 0.22);
    for (let index = length; index < data.length - 1; index += 1) {
      data[index] = 0.996 * 0.5 * (data[index - length] + data[index - length + 1]);
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    const now = context.currentTime + startOffset;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(4200, now);
    filter.frequency.exponentialRampToValueAtTime(1250, now + decay - 0.45);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(level, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(destination);
    source.start(now);
    source.stop(now + decay + 0.04);
    return source;
  };
  const playGuitar = async (frequency, button) => {
    await ensureAudio();
    const now = context.currentTime;
    const sources = [];
    const chordGain = context.createGain();
    chordGain.gain.setValueAtTime(0.0001, now);
    chordGain.gain.linearRampToValueAtTime(1, now + 0.018);
    chordGain.gain.exponentialRampToValueAtTime(0.0001, now + 5.4);
    chordGain.connect(master);
    const chordIntervals = [1, 1.2599, 1.4983, 2];
    chordIntervals.forEach((multiple, index) => {
      sources.push(playGuitarString(frequency * multiple, chordGain, index * 0.045, index === 0 ? 0.18 : 0.105, 4.8 - index * 0.35));
    });
    sources.push(playGuitarString(frequency * 0.5, chordGain, 0.018, 0.08, 5.2));
    animateButton(button);
    return registerVoice({ oscillators: sources, gain: chordGain }, 5.4, 0.9);
  };

  const bindInstrumentButtons = (selector, playVoice, dataKey) => {
    studio.querySelectorAll(selector).forEach((button) => {
      let pointerVoice = null;
      button.addEventListener("pointerdown", async (event) => {
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        const frequency = Number(button.dataset[dataKey]);
        pointerVoice = await playVoice(frequency, button);
        if (dataKey === "note") {
          maybeShowMimiOnPiano();
          answerPerfectPitch(frequency);
        }
      });
      const release = () => { pointerVoice?.release?.(); pointerVoice = null; };
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("lostpointercapture", release);
    });
  };
  bindInstrumentButtons("[data-note]", playPiano, "note");
  bindInstrumentButtons("[data-bowl]", playBowl, "bowl");
  bindInstrumentButtons("[data-string]", playGuitar, "string");
  pitchGameElements.start?.addEventListener("click", startPerfectPitch);
  pitchGameElements.replay?.addEventListener("click", playPitchPrompt);
  pitchGameElements.difficulty?.addEventListener("change", () => {
    if (!perfectPitchState.active) return;
    startPerfectPitch();
  });
  renderPerfectPitch();

  const keyboardMap = { a: 261.63, w: 277.18, s: 293.66, e: 311.13, d: 329.63, f: 349.23, t: 369.99, g: 392, y: 415.3, h: 440, u: 466.16, j: 493.88, k: 523.25 };
  const isTypingTarget = (target) => target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable);
  window.addEventListener("keydown", async (event) => {
    const key = event.key.toLowerCase();
    if (isTypingTarget(event.target) || event.repeat || !keyboardMap[key] || document.querySelector('.cabin-experience')?.dataset.cabinRoom !== "music") return;
    event.preventDefault();
    const matchingButton = [...studio.querySelectorAll("[data-note]")].find((button) => Math.abs(Number(button.dataset.note) - keyboardMap[key]) < 0.1);
    heldKeyboardVoices.set(key, await playPiano(keyboardMap[key], matchingButton));
    answerPerfectPitch(keyboardMap[key]);
    maybeShowMimiOnPiano();
  });
  window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    heldKeyboardVoices.get(key)?.release?.();
    heldKeyboardVoices.delete(key);
  });
  document.addEventListener("cabin-room-change", (event) => {
    if (event.detail?.roomId === "music") return;
    perfectPitchState.awaitingAnswer = false;
    perfectPitchState.acceptingAnswer = false;
    CabinAudioManager.stopAllVoices?.();
  });

  startButton.addEventListener("click", async () => {
    await ensureAudio();
    if (!window.MediaRecorder) return setMessage("当前浏览器可以演奏，但不支持房间录音。", "error");
    const preferredType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type)) || "";
    recorder = preferredType ? new MediaRecorder(recordDestination.stream, { mimeType: preferredType }) : new MediaRecorder(recordDestination.stream);
    chunks = [];
    recorder.addEventListener("dataavailable", (event) => { if (event.data.size) chunks.push(event.data); });
    recorder.addEventListener("stop", () => {
      const mimeType = recorder.mimeType || "audio/webm";
      const extension = mimeType.includes("mp4") ? "m4a" : "webm";
      pendingRecording = new File(chunks, `cabin-music-${Date.now()}.${extension}`, { type: mimeType });
      preview.src = URL.createObjectURL(pendingRecording);
      preview.hidden = false;
      saveButton.disabled = false;
      startButton.disabled = false;
      stopButton.disabled = true;
      stopButton.classList.remove("is-recording");
      window.clearInterval(timer);
    });
    recorder.start(300);
    startedAt = Date.now();
    timeLabel.textContent = "00:00";
    timer = window.setInterval(() => { timeLabel.textContent = formatPodcastTime((Date.now() - startedAt) / 1000); }, 500);
    startButton.disabled = true;
    stopButton.disabled = false;
    stopButton.classList.add("is-recording");
  });
  stopButton.addEventListener("click", () => { if (recorder?.state === "recording") recorder.stop(); });
  saveButton.addEventListener("click", async () => {
    if (!profile) return setMessage("请先登录 ID，再把作品留在乐器房。", "error");
    if (!pendingRecording) return;
    const title = titleInput.value.trim() || `即兴片段 ${new Date().toLocaleDateString("zh-CN")}`;
    setSync("正在保存乐器房作品");
    try {
      const audioUrl = await uploadPodcastAudio(pendingRecording, "cabin-music");
      const { error } = await client.rpc("create_cabin_music_recording", { session_token: sessionToken, title_input: title, audio_url_input: audioUrl });
      if (error) throw error;
      pendingRecording = null;
      preview.hidden = true;
      preview.removeAttribute("src");
      saveButton.disabled = true;
      titleInput.value = "";
      timeLabel.textContent = "00:00";
      await loadBlog();
      setSync("作品已经留在乐器房");
    } catch {
      setSync("保存失败，请先运行乐器房新版 SQL");
    }
  });
  renderCabinRecordings();
}

const defaultCabinArtworks = getBlogMaterials().gallerySeeds.map((item, index) => ({
  id: `material-seed-${index}`,
  category: item.category,
  title: item.title,
  image_url: preferCompleteHomepageImage(item.src, index)
}));

function renderCabinGallery() {
  if (!elements.cabinGalleryGrid) return;
  elements.cabinArtworkForm.hidden = profile?.role !== "owner";
  document.querySelectorAll("[data-art-filter]").forEach((button) => button.classList.toggle("active", button.dataset.artFilter === activeCabinArtFilter));
  const sourceItems = [...defaultCabinArtworks, ...cabinArtworks];
  const items = sourceItems.filter((item) => item.category === activeCabinArtFilter);
  if (!items.length) {
    const waiting = activeCabinArtFilter === "child" ? "儿童房的画框已经挂好，等第一幅作品住进来。" : "这个展厅正在等待新的作品。";
    elements.cabinGalleryGrid.innerHTML = `<div class="cabin-gallery__empty"><span></span><p>${waiting}</p></div>`;
    return;
  }
  elements.cabinGalleryGrid.innerHTML = "";
  items.forEach((item) => {
    const figure = document.createElement("figure");
    figure.className = `cabin-artwork cabin-artwork--${item.category} home-visual-card`;
    figure.innerHTML = `<button type="button"><img src="${item.image_url}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async" /></button><figcaption>${escapeHtml(item.title)}</figcaption>`;
    figure.querySelector("button").addEventListener("click", () => {
      const dialog = document.createElement("dialog");
      dialog.className = "cabin-art-dialog";
      dialog.innerHTML = `<button type="button" aria-label="关闭">×</button><img src="${item.image_url}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async" /><p>${escapeHtml(item.title)}</p>`;
      document.body.append(dialog);
      dialog.querySelector("button").addEventListener("click", () => dialog.close());
      dialog.addEventListener("close", () => dialog.remove());
      dialog.showModal();
    });
    elements.cabinGalleryGrid.append(figure);
  });
}

document.querySelectorAll("[data-art-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    activeCabinArtFilter = button.dataset.artFilter;
    renderCabinGallery();
  });
});

elements.cabinArtworkForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (profile?.role !== "owner") return;
  const file = elements.cabinArtworkImage.files?.[0];
  if (!file) return;
  setSync("添加画作中");
  try {
    const imageUrl = await compressPhoto(file, { maxSide: 1400, quality: 0.82 });
    if (imageUrl.length > 1200000) throw new Error("image too large");
    const { error } = await client.rpc("create_cabin_artwork", {
      session_token: sessionToken,
      category_input: elements.cabinArtworkCategory.value,
      title_input: elements.cabinArtworkTitle.value.trim(),
      image_input: imageUrl
    });
    if (error) throw error;
    activeCabinArtFilter = elements.cabinArtworkCategory.value;
    elements.cabinArtworkForm.reset();
    await loadBlog();
    setSync("画作已加入木屋");
  } catch {
    setSync("画作添加失败，请运行新版 SQL 或换一张较小的图片");
  }
});

const deferredModules = {
  ambient: false,
  cabin: false,
  cabinMusic: false,
  mimi: false,
  extended: false
};

function initExtendedDataOnce() {
  if (deferredModules.extended) return;
  deferredModules.extended = true;
  loadExtendedBlogData().catch((error) => console.warn("[Deferred:extended]", error));
}

function initCabinOnce() {
  if (deferredModules.cabin) return;
  deferredModules.cabin = true;
  setupCabinExperience();
  renderCabinGallery();
}

function initMimiOnce() {
  if (deferredModules.mimi) return;
  deferredModules.mimi = true;
  initCabinOnce();
  setupMimiPet();
}

function initCabinMusicOnce() {
  if (deferredModules.cabinMusic) return;
  deferredModules.cabinMusic = true;
  initCabinOnce();
  setupCabinMusicRoom();
}

function initAmbientOnce() {
  if (deferredModules.ambient) return;
  deferredModules.ambient = true;
  setupAmbientSounds();
}

function setupDeferredModules() {
  const observe = (selector, init) => {
    const target = document.querySelector(selector);
    if (!target) return;
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      init();
      initExtendedDataOnce();
    }, { rootMargin: "260px 0px" });
    observer.observe(target);
  };
  observe(".podcast-panel", initExtendedDataOnce);
  document.querySelectorAll('[data-bookmark-target=".cabin-panel"]').forEach((button) => {
    button.addEventListener("click", () => { initCabinOnce(); initMimiOnce(); initCabinMusicOnce(); initExtendedDataOnce(); });
  });
  document.querySelectorAll('[data-bookmark-target=".podcast-panel"], [data-bookmark-target=".wish-pool"]').forEach((button) => {
    button.addEventListener("click", initExtendedDataOnce);
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) return;
    CabinAudioManager.stopRoomSounds();
    CabinAudioManager.stopAllVoices?.();
  });
}

renderAvatarPreview();
elements.bodyCount.textContent = `${elements.bodyInput.value.length} / ${elements.bodyInput.maxLength} 字`;
updateMediaClearButtons();
updatePodcastFileHints();
if (elements.podcastDateInput) elements.podcastDateInput.value = new Date().toISOString().slice(0, 10);
switchAuthTab("login");
setCategory("文章");
// Hidden homepage modules are kept in code but no longer shown.
setupBlogBookmarks();
setupDeferredModules();
refreshSession();
