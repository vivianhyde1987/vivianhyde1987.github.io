const storageKey = "rose-rainbow-blog-v1";

const starterData = {
  currentUser: "rose1998",
  users: [
    { id: "rose1998", name: "rose1998", bio: "Endless Rain 派，喜欢深夜写长文。", following: ["hydeflower"], avatar: { color: "#b62548", shape: "circle", mark: "R" } },
    { id: "hydeflower", name: "hydeflower", bio: "L'Arc-en-Ciel 的彩虹光永远有效。", following: ["rose1998"], avatar: { color: "#0e8a94", shape: "soft", mark: "虹" } },
    { id: "blueblood", name: "blueblood", bio: "今天也在旧留言板等回复。", following: [], avatar: { color: "#6c4ea3", shape: "diamond", mark: "X" } }
  ],
  favoriteSongs: [
    { title: "ENDLESS RAIN", artist: "X JAPAN", link: "" },
    { title: "Rusty Nail", artist: "X JAPAN", link: "" },
    { title: "Flower", artist: "L'Arc-en-Ciel", link: "" },
    { title: "虹", artist: "L'Arc-en-Ciel", link: "" },
    { title: "Driver's High", artist: "L'Arc-en-Ciel", link: "" },
    { title: "软禁记忆", artist: "郑俊树", link: "" }
  ],
  posts: [
    {
      id: crypto.randomUUID(),
      authorId: "hydeflower",
      title: "今天的心情像 Flower 前奏",
      mood: "prism",
      body: "下午突然下雨，窗户上全是反光。听 L'Arc-en-Ciel 的时候，觉得以前那种博客互访真的很温柔：不用太大声，也能被看见。",
      tags: ["L'Arc-en-Ciel", "日记"],
      createdAt: Date.now() - 1000 * 60 * 60 * 3,
      comments: [
        { id: crypto.randomUUID(), authorId: "rose1998", body: "这句“不用太大声”太 yculblog 了。", createdAt: Date.now() - 1000 * 60 * 22 }
      ]
    },
    {
      id: crypto.randomUUID(),
      authorId: "rose1998",
      title: "Endless Rain 适合写给今天",
      mood: "rain",
      body: "想做一个小地方，每天贴一点心情，朋友可以来踩空间、评论、互相关注。不是算法推荐，就是慢慢等一条留言亮起来。",
      tags: ["X JAPAN", "日记"],
      createdAt: Date.now() - 1000 * 60 * 60 * 7,
      comments: [
        { id: crypto.randomUUID(), authorId: "blueblood", body: "踩一下，留下玫瑰。", createdAt: Date.now() - 1000 * 60 * 51 }
      ]
    }
  ]
};

let state = loadState();
let activeFilter = "all";

const elements = {
  sessionArea: document.querySelector("#sessionArea"),
  onlineBadge: document.querySelector("#onlineBadge"),
  authForm: document.querySelector("#authForm"),
  nameInput: document.querySelector("#nameInput"),
  bioInput: document.querySelector("#bioInput"),
  avatarForm: document.querySelector("#avatarForm"),
  avatarPreview: document.querySelector("#avatarPreview"),
  avatarColorInput: document.querySelector("#avatarColorInput"),
  avatarShapeInput: document.querySelector("#avatarShapeInput"),
  avatarMarkInput: document.querySelector("#avatarMarkInput"),
  peopleList: document.querySelector("#peopleList"),
  followCount: document.querySelector("#followCount"),
  dailySong: document.querySelector("#dailySong"),
  favoriteSongForm: document.querySelector("#favoriteSongForm"),
  songTitleInput: document.querySelector("#songTitleInput"),
  songArtistInput: document.querySelector("#songArtistInput"),
  songLinkInput: document.querySelector("#songLinkInput"),
  moodAudio: document.querySelector("#moodAudio"),
  trackNow: document.querySelector("#trackNow"),
  stopTrack: document.querySelector("#stopTrack"),
  todayText: document.querySelector("#todayText"),
  postForm: document.querySelector("#postForm"),
  titleInput: document.querySelector("#titleInput"),
  moodInput: document.querySelector("#moodInput"),
  bodyInput: document.querySelector("#bodyInput"),
  guestbookForm: document.querySelector("#guestbookForm"),
  guestbookInput: document.querySelector("#guestbookInput"),
  guestbookList: document.querySelector("#guestbookList"),
  guestbookStatus: document.querySelector("#guestbookStatus"),
  moodQuizForm: document.querySelector("#moodQuizForm"),
  moodWeatherInput: document.querySelector("#moodWeatherInput"),
  moodWishInput: document.querySelector("#moodWishInput"),
  moodResult: document.querySelector("#moodResult"),
  feed: document.querySelector("#feed"),
  postTemplate: document.querySelector("#postTemplate"),
  resetDemo: document.querySelector("#resetDemo")
};

const moodLabels = {
  rose: "玫瑰色",
  rain: "雨夜",
  prism: "彩虹",
  static: "旧电视雪花"
};

const trackPresets = {
  rain: {
    label: "雨夜钢琴氛围",
    file: "assets/audio/rain.wav"
  },
  flower: {
    label: "彩虹吉他氛围",
    file: "assets/audio/flower.wav"
  },
  nail: {
    label: "深夜鼓点氛围",
    file: "assets/audio/nail.wav"
  },
  nutMorning: {
    label: "坚果壳手摇铃：晨光轻摇",
    file: "assets/audio/nut-shell-morning.wav"
  },
  nutRain: {
    label: "坚果壳手摇铃：雨窗沙沙",
    file: "assets/audio/nut-shell-rain.wav"
  },
  nutSleep: {
    label: "坚果壳手摇铃：睡前慢摇",
    file: "assets/audio/nut-shell-sleep.wav"
  }
};

let activeTrackButton;
let guestbookTimer;
let currentMoodStamp = loadMoodStamp();

const cloudConfig = window.ROSE_BLOG_CONFIG || {};
const hasCloudGuestbook = Boolean(cloudConfig.supabaseUrl && cloudConfig.supabaseAnonKey);

const moodStampMap = {
  rain_quiet: { face: "雨", label: "雨夜安静", color: "#496c8f" },
  rain_spark: { face: "雫", label: "雨里微光", color: "#0e8a94" },
  rain_hug: { face: "抱", label: "需要拥抱", color: "#8c5b7a" },
  rain_noise: { face: "鼓", label: "雨中鼓点", color: "#42444f" },
  prism_quiet: { face: "虹", label: "彩虹轻声", color: "#0e8a94" },
  prism_spark: { face: "光", label: "闪闪发亮", color: "#d4a72c" },
  prism_hug: { face: "花", label: "柔软开花", color: "#b62548" },
  prism_noise: { face: "跳", label: "想要跳起", color: "#6c4ea3" },
  moon_quiet: { face: "月", label: "月光独处", color: "#59618f" },
  moon_spark: { face: "星", label: "夜里有星", color: "#6c4ea3" },
  moon_hug: { face: "眠", label: "想被安放", color: "#8c5b7a" },
  moon_noise: { face: "弦", label: "深夜弦音", color: "#251d20" },
  fire_quiet: { face: "烛", label: "小小火光", color: "#b66b25" },
  fire_spark: { face: "燃", label: "舞台燃起", color: "#b62548" },
  fire_hug: { face: "暖", label: "热烈温柔", color: "#d46f2c" },
  fire_noise: { face: "轰", label: "鼓点上头", color: "#251d20" }
};

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(starterData);

  try {
    return normalizeState(JSON.parse(saved));
  } catch {
    return structuredClone(starterData);
  }
}

function normalizeState(data) {
  const savedSongs = data.favoriteSongs || [];
  const starterSongs = structuredClone(starterData.favoriteSongs);
  const favoriteSongs = [...savedSongs];
  const users = (data.users || structuredClone(starterData.users)).map((user) => ({
    ...user,
    avatar: user.avatar || defaultAvatar(user.name)
  }));

  starterSongs.forEach((starterSong) => {
    const exists = favoriteSongs.some((song) => song.title === starterSong.title && song.artist === starterSong.artist);
    if (!exists) favoriteSongs.push(starterSong);
  });

  return {
    ...structuredClone(starterData),
    ...data,
    users,
    posts: data.posts || structuredClone(starterData.posts),
    favoriteSongs
  };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function loadMoodStamp() {
  try {
    return JSON.parse(localStorage.getItem(`${storageKey}-mood`));
  } catch {
    return null;
  }
}

function saveMoodStamp(mood) {
  currentMoodStamp = mood;
  localStorage.setItem(`${storageKey}-mood`, JSON.stringify(mood));
}

function currentUser() {
  return state.users.find((user) => user.id === state.currentUser) || null;
}

function userName(id) {
  return state.users.find((user) => user.id === id)?.name || "旧友";
}

function defaultAvatar(name = "旧友") {
  return {
    color: "#b62548",
    shape: "circle",
    mark: name.trim().slice(0, 1).toUpperCase() || "R"
  };
}

function createAvatar(user, size = "normal") {
  const avatar = document.createElement("span");
  const avatarData = user?.avatar || defaultAvatar(user?.name);
  avatar.className = `user-avatar user-avatar--${avatarData.shape || "circle"}`;
  avatar.style.setProperty("--avatar-color", avatarData.color || "#b62548");
  avatar.title = `${user?.name || "旧友"} 的头像`;
  const mark = document.createElement("span");
  mark.textContent = avatarData.mark || defaultAvatar(user?.name).mark;
  avatar.append(mark);
  if (size === "small") avatar.style.width = "42px";
  return avatar;
}

function renderAvatarPreview() {
  const avatar = {
    color: elements.avatarColorInput.value,
    shape: elements.avatarShapeInput.value,
    mark: elements.avatarMarkInput.value
  };
  elements.avatarPreview.style.setProperty("--avatar-color", avatar.color);
  elements.avatarPreview.dataset.shape = avatar.shape;
  elements.avatarPreview.innerHTML = `<span>${avatar.mark}</span>`;
}

function renderMoodResult() {
  if (!currentMoodStamp) {
    elements.moodResult.innerHTML = `<span class="mood-stamp">先测一下今天进门时的心情。</span>`;
    return;
  }

  elements.moodResult.innerHTML = "";
  elements.moodResult.append(createMoodStamp(currentMoodStamp));
}

function createMoodStamp(mood) {
  const stamp = document.createElement("span");
  stamp.className = "mood-stamp";
  stamp.style.setProperty("--mood-color", mood.color || "#b62548");
  const face = document.createElement("span");
  face.className = "mood-stamp__face";
  face.textContent = mood.face || "心";
  const label = document.createElement("span");
  label.textContent = mood.label || "今日心情";
  stamp.append(face, label);
  return stamp;
}

function slugifyName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^\w\u4e00-\u9fa5-]/g, "").slice(0, 22);
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(timestamp);
}

function render() {
  const user = currentUser();
  elements.todayText.textContent = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(new Date());

  elements.onlineBadge.textContent = user ? `在线：${user.name}` : "未登录";
  elements.sessionArea.replaceChildren();
  if (user) {
    elements.sessionArea.append(createAvatar(user, "small"));
  }
  const sessionLabel = document.createElement("span");
  sessionLabel.textContent = user ? user.name : "未登录";
  elements.sessionArea.append(sessionLabel);

  if (user) {
    elements.avatarColorInput.value = user.avatar?.color || "#b62548";
    elements.avatarShapeInput.value = user.avatar?.shape || "circle";
    elements.avatarMarkInput.value = user.avatar?.mark || "R";
  }
  renderAvatarPreview();

  if (user) {
    const logoutButton = document.createElement("button");
    logoutButton.id = "logoutButton";
    logoutButton.type = "button";
    logoutButton.textContent = "切换 ID";
    logoutButton.addEventListener("click", () => {
      state.currentUser = "";
      saveState();
      render();
    });
    elements.sessionArea.append(logoutButton);
  }

  renderPeople();
  renderDailySong();
  renderMoodResult();
  renderFeed();
}

function renderDailySong() {
  const songs = state.favoriteSongs || [];
  if (!songs.length) {
    elements.dailySong.innerHTML = "<p>还没有收藏歌。先加几首，你的小站每天会挑一首。</p>";
    return;
  }

  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
  const seed = [...todayKey].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const song = songs[seed % songs.length];
  const searchLink = `https://y.qq.com/n/ryqq/search?w=${encodeURIComponent(`${song.artist} ${song.title}`)}`;

  elements.dailySong.innerHTML = "";
  const intro = document.createElement("p");
  intro.textContent = "今天的小站推荐";
  const title = document.createElement("strong");
  title.textContent = `${song.title} / ${song.artist}`;
  const link = document.createElement("a");
  link.href = song.link || searchLink;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = song.link ? "打开收藏链接" : "去 QQ 音乐搜索";

  elements.dailySong.append(intro, title, link);
}

async function loadGuestbook() {
  try {
    const messages = hasCloudGuestbook ? await loadCloudGuestbook() : await loadLocalGuestbook();
    renderGuestbook(messages);
    elements.guestbookStatus.textContent = hasCloudGuestbook ? "云端已同步" : "本机已同步";
  } catch {
    elements.guestbookStatus.textContent = "离线";
    elements.guestbookList.innerHTML = `<p class="comment">公共留言区暂时连不上，稍后刷新试试。</p>`;
  }
}

async function loadLocalGuestbook() {
  const response = await fetch("/api/messages", { cache: "no-store" });
  if (!response.ok) throw new Error("bad response");
  return response.json();
}

async function loadCloudGuestbook() {
  const response = await fetch(`${cloudConfig.supabaseUrl}/rest/v1/guestbook_messages?select=*&order=created_at.desc&limit=120`, {
    headers: {
      apikey: cloudConfig.supabaseAnonKey,
      Authorization: `Bearer ${cloudConfig.supabaseAnonKey}`
    },
    cache: "no-store"
  });
  if (!response.ok) throw new Error("bad cloud response");
  const rows = await response.json();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    body: row.body,
    avatar: row.avatar,
    mood: row.mood,
    createdAt: new Date(row.created_at).getTime()
  }));
}

async function postGuestbookMessage(message) {
  if (hasCloudGuestbook) {
    const response = await fetch(`${cloudConfig.supabaseUrl}/rest/v1/guestbook_messages`, {
      method: "POST",
      headers: {
        apikey: cloudConfig.supabaseAnonKey,
        Authorization: `Bearer ${cloudConfig.supabaseAnonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        name: message.name,
        body: message.body,
        avatar: message.avatar,
        mood: message.mood
      })
    });
    if (!response.ok) throw new Error("bad cloud post");
    return;
  }

  const response = await fetch("/api/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message)
  });
  if (!response.ok) throw new Error("bad local post");
}

function renderGuestbook(messages) {
  elements.guestbookList.innerHTML = "";
  if (!messages.length) {
    elements.guestbookList.innerHTML = `<p class="comment">还没有公开留言。做第一个来踩空间的人。</p>`;
    return;
  }

  messages.forEach((message) => {
    const item = document.createElement("article");
    item.className = "guestbook-message";
    const avatar = document.createElement("span");
    avatar.className = `user-avatar user-avatar--${message.avatar?.shape || "circle"}`;
    avatar.style.setProperty("--avatar-color", message.avatar?.color || "#b62548");
    const mark = document.createElement("span");
    mark.textContent = message.avatar?.mark || message.name?.slice(0, 1) || "R";
    avatar.append(mark);

    const copy = document.createElement("div");
    const author = document.createElement("strong");
    const time = document.createElement("small");
    const body = document.createElement("p");
    author.textContent = message.name || "旧友";
    time.textContent = ` / ${formatDate(message.createdAt)}`;
    body.textContent = message.body;
    copy.append(author, time);
    if (message.mood) copy.append(createMoodStamp(message.mood));
    copy.append(body);
    item.append(avatar, copy);
    elements.guestbookList.append(item);
  });
}

function renderPeople() {
  const user = currentUser();
  const following = user?.following || [];
  elements.followCount.textContent = following.length;
  elements.peopleList.innerHTML = "";

  state.users
    .filter((person) => person.id !== user?.id)
    .forEach((person) => {
      const card = document.createElement("div");
      card.className = "people-card";
      const isFollowing = following.includes(person.id);
      const avatar = createAvatar(person, "small");
      const profile = document.createElement("div");
      const name = document.createElement("strong");
      const bio = document.createElement("p");
      const followButton = document.createElement("button");

      name.textContent = person.name;
      bio.textContent = person.bio || "还没有签名。";
      followButton.type = "button";
      followButton.textContent = isFollowing ? "已关注" : "关注";
      profile.append(name, bio);
      card.append(avatar, profile, followButton);

      followButton.addEventListener("click", () => {
        if (!requireLogin()) return;
        const me = currentUser();
        me.following = me.following || [];
        me.following = isFollowing
          ? me.following.filter((id) => id !== person.id)
          : [...me.following, person.id];
        saveState();
        render();
      });

      elements.peopleList.append(card);
    });
}

function renderFeed() {
  const user = currentUser();
  const following = user?.following || [];
  const posts = state.posts
    .filter((post) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "following") return following.includes(post.authorId) || post.authorId === user?.id;
      return post.tags.includes(activeFilter);
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  elements.feed.innerHTML = "";

  if (!posts.length) {
    elements.feed.innerHTML = `<div class="empty">这里暂时没有文章。换个筛选，或者自己写第一篇。</div>`;
    return;
  }

  posts.forEach((post) => {
    const node = elements.postTemplate.content.firstElementChild.cloneNode(true);
    const author = state.users.find((item) => item.id === post.authorId);
    const metaText = node.querySelector(".post__meta > div");
    metaText.className = "post-author";
    const authorCopy = document.createElement("div");
    authorCopy.append(...metaText.childNodes);
    metaText.append(createAvatar(author, "small"), authorCopy);
    node.dataset.id = post.id;
    node.querySelector("h3").textContent = post.title;
    node.querySelector(".post__meta p").textContent = `${userName(post.authorId)} / ${formatDate(post.createdAt)}`;
    node.querySelector(".mood").textContent = moodLabels[post.mood] || "心情";
    node.querySelector(".post__body").textContent = post.body;

    const tagArea = node.querySelector(".post__tags");
    post.tags.forEach((tag) => {
      const tagNode = document.createElement("span");
      tagNode.className = "tag";
      tagNode.textContent = tag;
      tagArea.append(tagNode);
    });

    const comments = node.querySelector(".comments");
    comments.innerHTML = post.comments.length ? "" : `<p class="comment">还没有评论，做第一个敲门的人。</p>`;
    post.comments.forEach((comment) => {
      const commentNode = document.createElement("p");
      commentNode.className = "comment";
      commentNode.innerHTML = `<strong>${userName(comment.authorId)}</strong> ${escapeHtml(comment.body)}<br><small>${formatDate(comment.createdAt)}</small>`;
      comments.append(commentNode);
    });

    node.querySelector(".comment-form").addEventListener("submit", (event) => {
      event.preventDefault();
      if (!requireLogin()) return;
      const input = event.currentTarget.querySelector("input");
      post.comments.push({
        id: crypto.randomUUID(),
        authorId: currentUser().id,
        body: input.value.trim(),
        createdAt: Date.now()
      });
      input.value = "";
      saveState();
      renderFeed();
    });

    elements.feed.append(node);
  });
}

function requireLogin() {
  if (currentUser()) return true;
  elements.nameInput.focus();
  return false;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[char];
  });
}

elements.authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = elements.nameInput.value.trim();
  if (!name) return;

  const id = slugifyName(name) || `user-${Date.now()}`;
  const existing = state.users.find((user) => user.id === id);
  if (existing) {
    state.currentUser = existing.id;
    existing.bio = elements.bioInput.value.trim() || existing.bio;
  } else {
    state.users.push({
      id,
      name,
      bio: elements.bioInput.value.trim() || "新来的朋友，还在调签名。",
      following: [],
      avatar: {
        color: elements.avatarColorInput.value,
        shape: elements.avatarShapeInput.value,
        mark: elements.avatarMarkInput.value
      }
    });
    state.currentUser = id;
  }

  elements.authForm.reset();
  saveState();
  render();
});

elements.postForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!requireLogin()) return;

  const tags = [...document.querySelectorAll(".tags input:checked")].map((input) => input.value);
  state.posts.unshift({
    id: crypto.randomUUID(),
    authorId: currentUser().id,
    title: elements.titleInput.value.trim(),
    mood: elements.moodInput.value,
    body: elements.bodyInput.value.trim(),
    tags: tags.length ? tags : ["日记"],
    createdAt: Date.now(),
    comments: []
  });

  elements.postForm.reset();
  document.querySelector('.tags input[value="X JAPAN"]').checked = true;
  document.querySelector('.tags input[value="L\'Arc-en-Ciel"]').checked = true;
  saveState();
  render();
});

elements.guestbookForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireLogin()) return;

  const user = currentUser();
  const body = elements.guestbookInput.value.trim();
  if (!body) return;

  elements.guestbookStatus.textContent = "发送中";
  try {
    await postGuestbookMessage({
      name: user.name,
      body,
      avatar: user.avatar || defaultAvatar(user.name),
      mood: currentMoodStamp
    });
    elements.guestbookInput.value = "";
    await loadGuestbook();
  } catch {
    elements.guestbookStatus.textContent = "发送失败";
  }
});

elements.moodQuizForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const key = `${elements.moodWeatherInput.value}_${elements.moodWishInput.value}`;
  const mood = moodStampMap[key] || { face: "心", label: "今日心情", color: "#b62548" };
  saveMoodStamp(mood);
  renderMoodResult();
});

elements.favoriteSongForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.favoriteSongs = state.favoriteSongs || [];
  state.favoriteSongs.push({
    title: elements.songTitleInput.value.trim(),
    artist: elements.songArtistInput.value.trim(),
    link: elements.songLinkInput.value.trim()
  });
  elements.favoriteSongForm.reset();
  saveState();
  renderDailySong();
});

[elements.avatarColorInput, elements.avatarShapeInput, elements.avatarMarkInput].forEach((control) => {
  control.addEventListener("input", renderAvatarPreview);
});

elements.avatarForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!requireLogin()) return;
  const user = currentUser();
  user.avatar = {
    color: elements.avatarColorInput.value,
    shape: elements.avatarShapeInput.value,
    mark: elements.avatarMarkInput.value
  };
  saveState();
  render();
});

document.querySelectorAll(".tabs button").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".tabs button").forEach((item) => item.classList.toggle("active", item === button));
    renderFeed();
  });
});

document.querySelectorAll(".mixtape button[data-track]").forEach((button) => {
  button.addEventListener("click", () => {
    playMoodTrack(button.dataset.track, button);
  });
});

elements.stopTrack.addEventListener("click", stopMoodTrack);

elements.resetDemo.addEventListener("click", () => {
  state = structuredClone(starterData);
  saveState();
  render();
});

render();
loadGuestbook();
guestbookTimer = setInterval(loadGuestbook, 12000);

function playMoodTrack(trackId, button) {
  const preset = trackPresets[trackId];
  if (!preset) return;

  stopMoodTrack();
  elements.moodAudio.src = preset.file;
  elements.moodAudio.loop = true;
  elements.moodAudio.volume = 0.8;
  elements.moodAudio.play().catch(() => {
    elements.trackNow.textContent = "手机如果没出声，请点上面的播放控制条。";
  });
  activeTrackButton = button;
  activeTrackButton.classList.add("is-playing");
  elements.trackNow.textContent = `正在播放：${preset.label}`;
}

function stopMoodTrack() {
  if (elements.moodAudio) {
    elements.moodAudio.pause();
    elements.moodAudio.currentTime = 0;
  }

  if (activeTrackButton) {
    activeTrackButton.classList.remove("is-playing");
    activeTrackButton = null;
  }

  if (elements.trackNow) {
    elements.trackNow.textContent = "点一段氛围音乐，给今天定个颜色。";
  }
}
