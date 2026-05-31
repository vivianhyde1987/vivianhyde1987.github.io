const cloudConfig = window.ROSE_BLOG_CONFIG || {};
const hasCloud = Boolean(window.supabase && cloudConfig.supabaseUrl && cloudConfig.supabaseAnonKey);
const client = hasCloud ? window.supabase.createClient(cloudConfig.supabaseUrl, cloudConfig.supabaseAnonKey) : null;
const sessionKey = "rose-blog-session-token";

let sessionToken = localStorage.getItem(sessionKey) || "";
let profile = null;
let posts = [];
let comments = [];
let likes = [];
let profiles = new Map();
let activeCategory = "日志";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

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
  postForm: $("#postForm"),
  categoryInput: $("#categoryInput"),
  titleInput: $("#titleInput"),
  bodyInput: $("#bodyInput"),
  imageInput: $("#imageInput"),
  todayText: $("#todayText"),
  syncStatus: $("#syncStatus"),
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
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function normalizeHandle(handle) {
  return handle.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^\w\u4e00-\u9fa5-]/g, "").slice(0, 24);
}

function rpcErrorText(error, fallback) {
  return error?.message?.replace(/^.*ERROR:\s*/i, "") || fallback;
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

function compressPhoto(file) {
  if (!file) return Promise.resolve(null);
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
        const maxSide = 900;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
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
  node.innerHTML = `<span>${escapeHtml(avatar.mark || "R")}</span>`;
}

function renderAvatarPreview() {
  const avatar = {
    color: elements.avatarColorInput.value,
    shape: elements.avatarShapeInput.value,
    mark: elements.avatarMarkInput.value || "R"
  };
  elements.avatarPreview.style.setProperty("--avatar-color", avatar.color);
  elements.avatarPreview.dataset.shape = avatar.shape;
  elements.avatarPreview.innerHTML = `<span>${escapeHtml(avatar.mark)}</span>`;
}

function renderSession() {
  elements.sessionArea.replaceChildren();
  elements.authStatus.textContent = profile ? `已登录：${profile.handle}` : "未登录";

  if (!profile) {
    const label = document.createElement("span");
    label.textContent = hasCloud ? "请登录" : "需要先配置云端";
    elements.sessionArea.append(label);
    elements.profileCard.hidden = true;
    return;
  }

  const avatarNode = document.createElement("span");
  paintAvatar(avatarNode, avatarFromProfile(profile));
  const name = document.createElement("span");
  name.textContent = profile.handle;
  const logout = document.createElement("button");
  logout.type = "button";
  logout.textContent = "退出";
  logout.addEventListener("click", async () => {
    clearSession();
    renderSession();
    renderFeed();
    setMessage("已退出。");
  });
  elements.sessionArea.append(avatarNode, name, logout);

  elements.profileCard.hidden = false;
  elements.profileCard.innerHTML = `
    <strong>${escapeHtml(profile.handle)}</strong>
    <p>${profile.role === "owner" ? "站主账号" : "朋友账号"}</p>
  `;
  const avatar = avatarFromProfile(profile);
  elements.avatarColorInput.value = avatar.color || "#b62548";
  elements.avatarShapeInput.value = avatar.shape || "circle";
  elements.avatarMarkInput.value = avatar.mark || "R";
  renderAvatarPreview();
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
    const [{ data: postRows, error: postError }, { data: commentRows, error: commentError }, { data: profileRows, error: profileError }, { data: likeRows, error: likeError }] = await Promise.all([
      client.from("blog_posts").select("*").order("created_at", { ascending: false }),
      client.from("blog_comments").select("*").order("created_at", { ascending: true }),
      client.from("blog_accounts").select("id, handle, avatar, role"),
      client.from("blog_post_likes").select("*")
    ]);
    if (postError) throw postError;
    if (commentError) throw commentError;
    if (profileError) throw profileError;
    if (likeError) throw likeError;

    posts = postRows || [];
    comments = commentRows || [];
    likes = likeRows || [];
    profiles = new Map((profileRows || []).map((item) => [item.id, { ...item, user_id: item.id }]));
    setSync("云端已同步");
    renderFeed();
  } catch {
    setSync("需要运行新版 SQL");
    elements.feed.innerHTML = `<div class="empty">账号系统已更新。请先把新版 supabase-setup.sql 复制到 Supabase 的 SQL Editor 运行一次。</div>`;
  }
}

function setCategory(category) {
  activeCategory = category;
  elements.categoryInput.value = category;
  $$("[data-category]").forEach((button) => {
    if (button.tagName === "BUTTON") button.classList.toggle("active", button.dataset.category === category);
  });
  renderFeed();
}

function renderFeed() {
  const visible = posts.filter((post) => post.category === activeCategory);
  elements.feed.innerHTML = "";
  if (!visible.length) {
    elements.feed.innerHTML = `<div class="empty">${activeCategory} 里还没有内容。登录后写第一篇，它会保存在这里。</div>`;
    return;
  }

  visible.forEach((post) => {
    const node = elements.postTemplate.content.firstElementChild.cloneNode(true);
    const author = profiles.get(post.owner_id);
    paintAvatar(node.querySelector(".user-avatar"), avatarFromProfile(author));
    node.querySelector("h3").textContent = post.title;
    node.querySelector(".post__meta p").textContent = `${author?.handle || "朋友"} / ${formatDate(post.created_at)}`;
    node.querySelector(".mood").textContent = post.category;
    node.querySelector(".post__body").textContent = post.body;

    const image = node.querySelector(".post__image");
    if (post.image_url) {
      image.src = post.image_url;
      image.hidden = false;
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

$$(".auth-tabs button").forEach((button) => {
  button.addEventListener("click", () => switchAuthTab(button.dataset.authTab));
});

$$("[data-category]").forEach((button) => {
  button.addEventListener("click", () => setCategory(button.dataset.category));
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
    setMessage("ID 只能包含中文、英文、数字、下划线或短横线。", "error");
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

elements.avatarForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!profile) {
    setMessage("请先登录，再保存头像。", "error");
    return;
  }
  const avatar = {
    color: elements.avatarColorInput.value,
    shape: elements.avatarShapeInput.value,
    mark: elements.avatarMarkInput.value || "R"
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

elements.postForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!profile) {
    setMessage("请先登录，再写博客。", "error");
    return;
  }
  const category = elements.categoryInput.value;
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
  setSync("保存中");
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
  await loadBlog();
  setCategory(activeCategory);
});

elements.todayText.textContent = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long"
}).format(new Date());

renderAvatarPreview();
switchAuthTab("login");
setCategory("日志");
refreshSession();
