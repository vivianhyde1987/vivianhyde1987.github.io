# Rose & Rainbow Blog

一个私人博客小站，支持 ID + 密码注册登录、栏目文章、相册上传、点赞、评论、回复和站主删除评论。

## 栏目

- 日志
- 小说
- 相册
- 心情

## 云端设置

网站使用 Supabase 保存账号、文章和评论。第一次上线前，请把 `supabase-setup.sql` 的内容复制到 Supabase 的 SQL Editor 运行一次，并在 Authentication 设置里关闭 Confirm email。

注册好你的站主账号后，再运行这句，把 `your-id` 改成你的永久 ID：

```sql
update public.profiles set role = 'owner' where handle = 'your-id';
```
