# Rose & Rainbow Blog

一个私人博客小站，支持 ID + 密码注册登录、栏目文章、相册上传、点赞、评论、回复和站主删除评论。

## 栏目

- 日志
- 小说
- 相册
- 心情

## 云端设置

网站使用 Supabase 保存账号、文章和评论。账号系统是博客自己的 ID + 密码，不再使用邮箱验证。

每次 `supabase-setup.sql` 更新后，请把它复制到 Supabase 的 SQL Editor 运行一次。

注册好你的站主账号后，再运行这句，把 `your-id` 改成你的永久 ID：

```sql
update public.profiles set role = 'owner' where handle = 'your-id';
```
