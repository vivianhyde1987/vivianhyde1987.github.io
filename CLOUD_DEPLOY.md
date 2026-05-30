# 永久在线版设置

这个博客已经支持两种留言区：

- `config.js` 没填 Supabase 时：使用本机 `/api/messages`
- `config.js` 填了 Supabase 时：使用云端公共留言区

## 1. 创建 Supabase 留言库

1. 打开 Supabase，新建一个 Project。
2. 进入 SQL Editor。
3. 粘贴并运行 `supabase-setup.sql`。
4. 在 Project Settings / API 里找到：
   - Project URL
   - anon public key

## 2. 填写云端配置

编辑 `config.js`：

```js
window.ROSE_BLOG_CONFIG = {
  supabaseUrl: "你的 Project URL",
  supabaseAnonKey: "你的 anon public key"
};
```

`anon public key` 可以放在前端；真正保护留言库的是 `supabase-setup.sql` 里的 RLS 策略。

## 3. 发布永久网址

把整个文件夹发布到 Netlify、Vercel 或 GitHub Pages。

需要一起发布的文件包括：

- `index.html`
- `styles.css`
- `app.js`
- `config.js`
- `assets/`

不需要发布：

- `data/`
- `tunnel-output.txt`
- `serveo-output.txt`
- `preview-screenshot.png`

## 4. 上线后的效果

永久网址上的“公共留言区”会读写 Supabase。
你在家、单位、手机和朋友手机上打开同一个网址，都能看到同一批留言。
