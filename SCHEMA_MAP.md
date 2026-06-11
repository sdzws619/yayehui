# 雅业会 — 代码与数据库字段映射表

> **维护说明**：每次修改 Supabase 表结构或代码中涉及数据库字段时，必须同步更新此表。
> **规则**：写任何涉及数据库字段的代码前，先查此表，不允许凭记忆写字段名。

---

## registered_users 表

| 数据库字段名 | 数据类型 | 代码中引用位置 | 代码中的字段名 | 备注 |
|:-----------|:--------|:--------------|:--------------|:-----|
| id | bigint (PK) | admin_db.js / yayehui.html | `id` | 自增主键 |
| user_name | text | yayehui.html 注册/登录/重置 | `userData.user_name` / `u.user_name` | 用户名，唯一 |
| phone | text | yayehui.html 注册/登录/重置 | `userData.phone` / `u.phone` | 手机号，唯一 |
| password_hash | text | yayehui.html 注册/登录/重置 | `userData.password_hash` / `u.password_hash` / `updates.password_hash` | ⚠️ **不是 password** |
| property_address | text | yayehui.html 注册 | `userData.property_address` | 关联房产地址 |
| is_verified | boolean | admin_db.js | `is_verified` | 是否已审核 |
| created_at | timestamptz | yayehui.html 注册 | `userData.created_at` | 注册时间，自动生成 |

---

## property_addresses 表

| 数据库字段名 | 数据类型 | 代码中引用位置 | 代码中的字段名 | 备注 |
|:-----------|:--------|:--------------|:--------------|:-----|
| id | bigint (PK) | admin_db.js | `id` | 自增主键 |
| address | text | admin_db.js markRegistered/markUnregistered | `address` | 完整地址，如"2座2楼201" |
| building | text | — | `building` | 座号 |
| floor | text | — | `floor` | 楼层 |
| unit | text | — | `unit` | 房号 |
| imported_at | timestamptz | — | `imported_at` | 导入时间 |
| is_registered | boolean | admin_db.js / yayehui.html | `is_registered` | 是否已注册 |

---

## announcements 表

| 数据库字段名 | 代码中字段名 | 备注 |
|:-----------|:--------------|:-----|
| id | `id` | PK |
| title | `title` | 公告标题 |
| content | `content` | 公告内容 |
| created_at | `created_at` | 发布时间 |

---

## polls 表

| 数据库字段名 | 代码中字段名 | 备注 |
|:-----------|:--------------|:-----|
| id | `id` | PK |
| title | `title` | 投票标题 |
| description | `description` | 投票描述 |
| is_active | `is_active` | 是否激活 |
| created_at | `created_at` | 创建时间 |

---

## poll_options 表

| 数据库字段名 | 代码中字段名 | 备注 |
|:-----------|:--------------|:-----|
| id | `id` | PK |
| poll_id | `poll_id` | 关联 polls.id |
| option_text | `option_text` | 选项文字 |
| vote_count | `vote_count` | 票数（可选） |

---

## 全局变量清单（防 BUG-06）

> 以下变量由 `admin_db.js` 声明，其他文件 **不得重复声明**。

| 变量名 | 声明位置 | 声明方式 | 说明 |
|:-------|:---------|:----------|:-----|
| `SUPABASE_URL` | admin_db.js 第4行 | `const` | Supabase 项目 URL |
| `SUPABASE_KEY` | admin_db.js 第5行 | `const` | Supabase 匿名 Key |
| `supabaseClient` | admin_db.js 第7行 | `const` | Supabase 客户端实例 |
| `db` | admin_db.js 第60行 | `const` | 所有表的 CRUD 封装对象 |
| `USE_SUPABASE` | admin_db.js 第210行 | `var` | Supabase 模式开关 |

> **重要**：`yayehui.html` 和 `admin.html` 通过 `<script src="admin_db.js">` 加载上述变量，**不得在內联脚本中重复声明**。

---

## 部署前检查清单（防 BUG-05）

每次部署前，必须逐项确认：

```
□ 1. admin_db.js 和 yayehui.html 中所有 JS 引用已加版本号参数（如 ?v=20260611b）
□ 2. HTML <head> 中包含 no-cache meta 标签（Cache-Control / Pragma / Expires）
□ 3. admin_db.js 第210行 var USE_SUPABASE = true; 未被改为 const
□ 4. 所有涉及 registered_users 表的代码中，密码字段使用 password_hash（不是 password）
□ 5. 部署后等 2 分钟（GitHub Pages CDN 刷新），用无痕窗口验证
□ 6. 通知用户执行 Ctrl+Shift+R 强制刷新
```

---

## 修改记录

| 日期 | 修改内容 | 修改人 |
|------|----------|--------|
| 2026-06-11 | 初始创建，覆盖 V16.7 全部表结构 | AI |
