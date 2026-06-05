const cloudConfig = window.ROSE_BLOG_CONFIG || {};
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
let activeInterest = "全部";
let activeCategory = "日志";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const interestTypes = ["全部", "艺术", "音乐", "电影", "阅读", "展览", "生活灵感"];

const wishMenu = [
  { key: "big-ticket", text: "今天开大单", cost: 6 },
  { key: "new-client", text: "今天拓新有望", cost: 9 },
  { key: "no-redemption", text: "今天不赎回", cost: 12 },
  { key: "smooth-meeting", text: "客户会议顺利", cost: 15 },
  { key: "roadshow-glow", text: "产品路演发光", cost: 24 },
  { key: "aum-steady", text: "本周稳住规模", cost: 36 }
];

const elements = {
  sessionArea: $("#sessionArea"),
  authStatus: $("#authStatus"),
  authMessage: $("#authMessage"),
  loginForm: $("#loginForm"),
  registerForm: $("#registerForm"),
  profileCard: $("#profileCard"),
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
  lotteryTopicForm: $("#lotteryTopicForm"),
  lotteryTopicInput: $("#lotteryTopicInput"),
  lotteryTopicCard: $("#lotteryTopicCard"),
  lotteryEntryForm: $("#lotteryEntryForm"),
  lotteryEntryInput: $("#lotteryEntryInput"),
  lotteryResult: $("#lotteryResult"),
  lotteryEntries: $("#lotteryEntries"),
  eventLogForm: $("#eventLogForm"),
  eventTimeInput: $("#eventTimeInput"),
  medicineInput: $("#medicineInput"),
  eventNoteInput: $("#eventNoteInput"),
  eventLogList: $("#eventLogList"),
  hiveTotalText: $("#hiveTotalText"),
  soundToggle: $("#soundToggle"),
  todayText: $("#todayText"),
  syncStatus: $("#syncStatus"),
  archiveTitle: $("#archiveTitle"),
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
    ? `<img src="${avatar.image}" alt="" />`
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
    ? `<img src="${avatar.image}" alt="" />`
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

function renderLottery() {
  const topic = currentLotteryTopic();
  const entries = topic ? lotteryEntries.filter((entry) => entry.topic_id === topic.id) : [];
  const winner = winnerForTopic(topic, entries);
  const hasEntered = Boolean(profile && entries.some((entry) => entry.owner_id === profile.user_id));

  elements.lotteryTopicForm.hidden = profile?.role !== "owner";
  elements.lotteryEntryForm.hidden = !profile || !topic || hasEntered;

  if (!topic) {
    elements.lotteryTopicCard.innerHTML = `<p>今天还没有讨论话题。等站主发布后，朋友们就可以参与抽奖。</p>`;
    elements.lotteryResult.innerHTML = "";
    elements.lotteryEntries.innerHTML = "";
    return;
  }

  elements.lotteryTopicCard.innerHTML = `
    <span>${escapeHtml(topic.topic_date)}</span>
    <strong>${escapeHtml(topic.topic_text)}</strong>
    <small>参与后将自动开奖，奖品：站主邀请喝 Manner 一次。</small>
  `;

  if (!profile) {
    elements.lotteryResult.innerHTML = `<p>登录 ID 后可以参与今日抽奖。</p>`;
  } else if (winner) {
    const winnerProfile = profiles.get(winner.owner_id);
    elements.lotteryResult.innerHTML = `
      <strong>今日获奖 ID：${escapeHtml(winnerProfile?.handle || "朋友")}</strong>
      <span>奖品：站主邀请喝 Manner 一次</span>
    `;
  } else {
    elements.lotteryResult.innerHTML = `<p>还没有朋友参与，第一条留言会点亮今日抽奖。</p>`;
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

function currentLotteryTopic() {
  const week = lotteryWeekKey();
  return lotteryTopics.find((topic) => topic.topic_date === week) || null;
}

function renderLottery() {
  const topic = currentLotteryTopic();
  const entries = topic ? lotteryEntries.filter((entry) => entry.topic_id === topic.id) : [];
  const winner = isLotteryDrawn(topic) ? winnerForTopic(topic, entries) : null;
  const hasEntered = Boolean(profile && entries.some((entry) => entry.owner_id === profile.user_id));

  elements.lotteryTopicForm.hidden = profile?.role !== "owner";
  elements.lotteryEntryForm.hidden = !profile || !topic || hasEntered || isLotteryDrawn(topic);

  if (!topic) {
    elements.lotteryTopicCard.innerHTML = `<p>本周还没有讨论话题。站主发布后，朋友们就可以参与本周抽奖。</p>`;
    elements.lotteryResult.innerHTML = `<p>统一开奖时间：每周日 21:00。</p>`;
    elements.lotteryEntries.innerHTML = "";
    return;
  }

  elements.lotteryTopicCard.innerHTML = `
    <span>本周开奖：${escapeHtml(formatLotteryDrawTime(topic.topic_date))}</span>
    <strong>${escapeHtml(topic.topic_text)}</strong>
    <small>奖品：站主邀请喝 Manner 一次。每个 ID 本周可参与一次。</small>
  `;

  if (!profile) {
    elements.lotteryResult.innerHTML = `<p>登录 ID 后可以参与本周抽奖。开奖时间：${escapeHtml(formatLotteryDrawTime(topic.topic_date))}。</p>`;
  } else if (!isLotteryDrawn(topic)) {
    elements.lotteryResult.innerHTML = `<p>本周已有 ${entries.length} 位朋友参与。周日 21:00 自动公布获奖 ID。</p>`;
  } else if (winner) {
    const winnerProfile = profiles.get(winner.owner_id);
    elements.lotteryResult.innerHTML = `
      <strong>本周获奖 ID：${escapeHtml(winnerProfile?.handle || "朋友")}</strong>
      <span>奖品：站主邀请喝 Manner 一次</span>
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

function renderLottery() {
  const topic = currentLotteryTopic();
  const entries = topic ? lotteryEntries.filter((entry) => entry.topic_id === topic.id) : [];
  const drawn = isLotteryDrawn(topic);
  const winner = drawn ? winnerForTopic(topic, entries) : null;
  const hasEntered = Boolean(profile && entries.some((entry) => entry.owner_id === profile.user_id));

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
  elements.authStatus.textContent = profile ? `已登录：${profile.handle}` : "未登录";

  if (!profile) {
    const label = document.createElement("span");
    label.textContent = hasCloud ? "请登录" : "需要先配置云端";
    elements.sessionArea.append(label);
    elements.profileCard.hidden = true;
    renderWishPool();
    return;
  }

  const name = document.createElement("span");
  name.textContent = profile.handle;
  const logout = document.createElement("button");
  logout.type = "button";
  logout.textContent = "退出";
  logout.addEventListener("click", () => {
    clearSession();
    renderSession();
    renderFeed();
    renderChat();
    renderWishPool();
    renderLottery();
    setMessage("已退出。");
  });
  elements.sessionArea.append(name, logout);

  elements.profileCard.hidden = false;
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
  renderLottery();
}

function switchAuthTab(tab) {
  $$(".auth-tabs button").forEach((button) => button.classList.toggle("active", button.dataset.authTab === tab));
  elements.loginForm.hidden = tab !== "login";
  elements.registerForm.hidden = tab !== "register";
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

async function loadBlog() {
  if (!client) return;
  setSync("同步中");
  try {
    const [postResult, commentResult, profileResult, likeResult, chatResult, chatLikeResult, wishResult, lotteryTopicResult, lotteryEntryResult, eventLogResult] = await Promise.all([
      client.from("blog_posts").select("*").order("created_at", { ascending: false }),
      client.from("blog_comments").select("*").order("created_at", { ascending: true }),
      client.from("blog_accounts").select("id, handle, avatar, role"),
      client.from("blog_post_likes").select("*"),
      client.from("chat_messages").select("*").order("created_at", { ascending: false }).limit(80),
      client.from("chat_message_likes").select("*"),
      client.from("koi_wishes").select("*").order("created_at", { ascending: false }).limit(80),
      client.from("lottery_topics").select("*").order("topic_date", { ascending: false }).limit(30),
      client.from("lottery_entries").select("*").order("created_at", { ascending: true }).limit(200),
      client.from("health_event_logs").select("*").order("event_time", { ascending: false }).limit(80)
    ]);
    for (const result of [postResult, commentResult, profileResult, likeResult, chatResult, chatLikeResult]) {
      if (result.error) throw result.error;
    }

    posts = postResult.data || [];
    comments = commentResult.data || [];
    likes = likeResult.data || [];
    chatMessages = chatResult.data || [];
    chatLikes = chatLikeResult.data || [];
    koiWishes = wishResult.error ? [] : (wishResult.data || []);
    lotteryTopics = lotteryTopicResult.error ? [] : (lotteryTopicResult.data || []);
    lotteryEntries = lotteryEntryResult.error ? [] : (lotteryEntryResult.data || []);
    eventLogs = eventLogResult.error ? [] : (eventLogResult.data || []);
    profiles = new Map((profileResult.data || []).map((item) => [item.id, { ...item, user_id: item.id }]));
    setSync("云端已同步");
    renderFeed();
    renderChat();
    renderWishPool();
    renderLottery();
    renderEventLogs();
  } catch {
    setSync("需要运行新版 SQL");
    elements.feed.innerHTML = `<div class="empty">新增了栏目历史和临时讨论区。请把新版 supabase-setup.sql 复制到 Supabase 的 SQL Editor 再运行一次。</div>`;
    elements.chatList.innerHTML = `<div class="empty">讨论区等待云端初始化。</div>`;
  }
}

function setCategory(category, shouldScroll = false) {
  activeCategory = category;
  elements.categoryInput.value = category;
  if (category !== "兴趣") activeInterest = "全部";
  if (elements.interestTypeWrap) elements.interestTypeWrap.hidden = category !== "兴趣";
  elements.archiveTitle.textContent = `${category}历史文章`;
  $$("[data-category]").forEach((button) => {
    if (button.tagName === "BUTTON") button.classList.toggle("active", button.dataset.category === category);
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
  const visible = posts.filter((post) => (
    post.category === activeCategory
    && (activeCategory !== "兴趣" || activeInterest === "全部" || (post.interest_type || "生活灵感") === activeInterest)
  ));
  elements.feed.innerHTML = "";
  if (!visible.length) {
    elements.feed.innerHTML = `<div class="empty">${activeCategory} 里还没有历史文章。</div>`;
    return;
  }

  visible.forEach((post) => {
    const node = elements.postTemplate.content.firstElementChild.cloneNode(true);
    const author = profiles.get(post.owner_id);
    paintAvatar(node.querySelector(".user-avatar"), avatarFromProfile(author));
    node.querySelector("h3").textContent = post.title;
    node.querySelector(".post__meta p").textContent = `${author?.handle || "朋友"} / ${formatDate(post.created_at)}`;
    node.querySelector(".mood").textContent = post.category === "兴趣" ? (post.interest_type || "生活灵感") : post.category;
    node.querySelector(".post__body").textContent = post.body;

    const image = node.querySelector(".post__image");
    if (post.image_url) {
      image.src = post.image_url;
      image.hidden = false;
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
      deletePostButton.textContent = post.category === "相册" ? "删除照片" : "删除";
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

function renderChat() {
  elements.chatList.innerHTML = "";
  if (!chatMessages.length) {
    elements.chatList.innerHTML = `<div class="empty">临时讨论区还没有消息。</div>`;
    return;
  }

  chatMessages.forEach((message) => {
    const author = profiles.get(message.owner_id);
    const item = document.createElement("article");
    item.className = "chat-message";
    item.innerHTML = `
      <div class="chat-message__head">
        <strong>${escapeHtml(author?.handle || "朋友")}</strong>
        ${message.body ? moodBubble(message.body) : ""}
        <small>${formatDate(message.created_at)}</small>
      </div>
      ${message.body ? `<p>${escapeHtml(message.body)}</p>` : ""}
      ${message.image_url ? `<img src="${message.image_url}" alt="聊天贴图" />` : ""}
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

    if (canDeleteChat(message)) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "删除";
      deleteButton.addEventListener("click", () => deleteChatMessage(message.id));
      actions.append(deleteButton);
    }
    elements.chatList.append(item);
  });
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
    elements.chatList.innerHTML = `<div class="empty">临时讨论区还没有消息。</div>`;
    return;
  }
  topMessages.forEach((message) => elements.chatList.append(createChatNode(message)));
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
    ${message.image_url ? `<img src="${message.image_url}" alt="聊天贴图" />` : ""}
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

$$("[data-hive-area]").forEach((button) => {
  button.addEventListener("click", () => addHiveCount(button.dataset.hiveArea));
});

$$("[data-category]").forEach((button) => {
  button.addEventListener("click", () => setCategory(button.dataset.category, true));
});

elements.categoryInput.addEventListener("change", () => {
  if (elements.interestTypeWrap) elements.interestTypeWrap.hidden = elements.categoryInput.value !== "兴趣";
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
  if (!profile) {
    setMessage("请先登录，再写博客。", "error");
    return;
  }
  const category = elements.categoryInput.value;
  const interestType = category === "兴趣" ? elements.interestTypeInput.value : null;
  const photoFile = elements.imageInput.files?.[0] || null;
  const title = elements.titleInput.value.trim() || (category === "相册" && photoFile ? "相册照片" : "");
  const body = elements.bodyInput.value.trim() || (category === "相册" && photoFile ? "分享一张照片。" : "");
  if (!title || !body) {
    setSync("请先填写标题和正文");
    return;
  }
  setSync(photoFile ? "处理照片中" : "保存中");
  let imageUrl = null;
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
  const { error } = await client.rpc("create_blog_post", {
    session_token: sessionToken,
    category_input: category,
    title_input: title,
    body_input: body,
    image_input: imageUrl
  });
  if (error) {
    setSync(rpcErrorText(error, "保存失败"));
    return;
  }
  setSync("已保存");
  activeCategory = category;
  elements.postForm.reset();
  updateMediaClearButtons();
  await loadBlog();
  setCategory(activeCategory, true);
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
  const { error } = await client.rpc("create_chat_message", {
    session_token: sessionToken,
    body_input: body,
    image_input: imageUrl
  });
  if (error) {
    setSync(rpcErrorText(error, "讨论区发送失败"));
    return;
  }
  elements.chatForm.reset();
  setSync("已发送");
  await loadBlog();
});

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
      const names = { bowl: "疗愈颂钵", stream: "溪流摇铃", cosmos: "宇宙的声音" };
      const playingNames = { bowl: "颂钵播放中", stream: "溪流摇铃中", cosmos: "宇宙播放中" };
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
    await ensureAudio();
    clearSound();
    activeMode = mode;
    updateButtons();
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

renderAvatarPreview();
elements.bodyCount.textContent = `${elements.bodyInput.value.length} / ${elements.bodyInput.maxLength} 字`;
updateMediaClearButtons();
switchAuthTab("login");
setCategory("日志");
setupMimiDrag();
setupAmbientSounds();
refreshSession();
