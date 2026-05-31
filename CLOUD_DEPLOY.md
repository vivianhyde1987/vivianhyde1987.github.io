# 云端账号和留言区设置

## 1. 运行数据库脚本

打开 Supabase 项目，进入 SQL Editor，把 `supabase-setup.sql` 的全部内容复制进去，点击 Run。

它会创建三张表：

- `profiles`：朋友的永久 ID、头像和站主身份
- `blog_posts`：日志、小说、相册、心情栏目内容
- `blog_comments`：评论和评论下面的回复
- `blog_post_likes`：照片和文章的点赞记录

## 2. 关闭邮箱确认

在 Supabase 的 Authentication 设置里，确认 Email 登录已开启，同时把 Confirm email 关闭。

这样朋友注册时只需要填写 ID 和密码，不需要收邮件确认。请提醒朋友自己记好密码。

## 3. 设置站主账号

先在网页上注册你的账号。注册完成后，在 Supabase SQL Editor 再运行：

```sql
update public.profiles set role = 'owner' where handle = 'your-id';
```

把 `your-id` 改成你注册时填写的永久 ID。之后你就可以删除任何评论，也可以在评论下面回复朋友。

## 4. 配置网站公开钥匙

`config.js` 里需要保留 Supabase Project URL 和 publishable key。这个 key 是公开前端钥匙，不是 service role secret。
