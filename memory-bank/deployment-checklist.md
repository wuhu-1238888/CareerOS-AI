# 生产部署清单(任务 5.3,2026-08-23)

> 5.3 代码已交付并合入 master(commit 6f96b35):Vercel Blob 存储 provider、prompt 打包追踪、隐私政策/用户协议、FunnelEvent 埋点。**部署动作本身按用户决定暂缓**,本文档为部署时的完整操作清单。
> 已确认决策:生产 LLM = **DeepSeek**;生产数据库尚未创建(见「二、托管 Postgres 创建指导」)。

## 一、Vercel 环境变量清单(生产全部必填)

| 变量 | 值 | 生成方式 |
| --- | --- | --- |
| `DATABASE_URL` | 托管 Postgres 连接串(Neon/Supabase/Vercel Postgres) | 见第二节 |
| `NEXTAUTH_SECRET`(即 AUTH_SECRET) | 32+ 随机串 | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://<你的域名>` | 部署后填实际域名 |
| `LLM_PROVIDER` | `deepseek` | 已确认决策 |
| `DEEPSEEK_API_KEY` | DeepSeek 平台 API Key | https://platform.deepseek.com |
| `FILE_STORAGE_PROVIDER` | `vercel-blob` | 生产必须(Serverless 无持久磁盘) |
| `FILE_ENCRYPTION_KEY` | 32 字节 base64 或 64 位 hex | `openssl rand -hex 32`(本地测试过的值**不要**复用于生产) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob Store 的读写 Token | Vercel 控制台 → Storage → Create Blob Store |

安全:所有 Key 只进 Vercel 项目环境变量面板,绝不写入代码/仓库;`.env.example` 已含全部变量名(值留空)。

## 二、托管 Postgres 创建指导(Neon 免费档)

1. 打开 https://neon.tech 注册(可用 GitHub 登录)→ Create Project;
2. 区域选离用户近的(如亚太可用区),PostgreSQL 版本保持默认(16);
3. 创建后进入 **Connect** 页,复制 **Pooled connection string**(带 `-pooler` 的,适合 Serverless),形如 `postgresql://user:pass@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/careeros?sslmode=require`;
4. 把连接串填入 Vercel 的 `DATABASE_URL`(Neon 有 Vercel 集成可自动注入,亦可手动复制);
5. 首次部署后执行迁移:`npx prisma migrate deploy`(生产只允许 migrate deploy,禁止 migrate dev)。可经 Vercel 的 postbuild(`"build": "prisma generate && next build"`)自动生成 client;迁移本身推荐在部署后由本地一次性执行或经 CI 执行。

## 三、Vercel 部署步骤

1. https://vercel.com 导入 GitHub 仓库 `wuhu-1238888/CareerOS-AI`;
2. Framework Preset 选 Next.js;环境变量按第一节填写(部署前先建好 Blob Store 拿 Token);
3. Deploy → 部署完成后在 Settings → Domains 绑定自定义域名并回填 `NEXTAUTH_URL`;
4. 执行迁移:`npx prisma migrate deploy`(本地指向生产 DATABASE_URL)或临时拉取环境后运行;
5. 构建验证:构建日志应无错误;`/privacy`、`/terms`、`/`(首页)可访问,`/` 登录后重定向 `/dashboard`。

## 四、生产验收清单(5.3 验证标准)

- [ ] 生产走完整闭环:注册 → 画像 → 路线图 → 简历上传/解析/优化/导出 PDF,全程无裸错误;
- [ ] 简历上传/下载/删除在生产存储(Blob)正常 —— 上传后 Vercel Blob Store 可见对象(内容为密文);
- [ ] `AgentRun` 表在生产数据库可见运行记录;
- [ ] `FunnelEvent` 表可见 `resume-export` 事件(复制最终文本 / 下载 PDF 各记一条);
- [ ] 非 AI 接口响应 < 500ms(抽查);
- [ ] 画像生成 < 15s、简历优化 < 30s(DeepSeek 真实 Key 下复测);
- [ ] `/privacy` 与 `/terms` 公开可访问,且声明「服务部署于海外区域,数据在海外部署区域处理」。

## 五、已知前提与注意

- 数据库迁移 `20260822154212_add_funnel_event` 与 `20260822151017_add_task_completed_at` 必须在生产库执行(迁移文件已提交);
- 本地 `storage/` 目录(开发文件)不要打包到生产 —— Vercel 自动忽略非输出文件;
- Blob 存储走 `FILE_STORAGE_PROVIDER=vercel-blob` 分支,文件仍先经 AES-256 加密再上传(EncryptedStorage 装饰器,4.1 抽象不变);
- Prompt 打包已配置并验证(构建产物 `.nft.json` 6/6 prompt 在列),无需额外操作。
