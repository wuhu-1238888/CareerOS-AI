# CareerOS-AI 项目规则

## 自动 Git 提交与推送

从现在开始,在本项目中,每当完成一个完整的功能点、任务或阶段后,默认自动执行 Git 同步流程,不需要用户再次提醒。

### 标准流程

1. 检查 `git status`
2. 检查本次修改内容
3. 确认没有明显的敏感信息,例如:API Key、Token、Password、`.env` 等私密配置
4. 运行必要的测试、lint 或 build
5. 将本次任务相关的修改加入 Git
6. 创建清晰的 commit,例如:
   - `feat: add xxx`
   - `fix: fix xxx`
   - `refactor: improve xxx`
   - `docs: update xxx`
7. 自动执行 `git push`
8. 汇报:本次完成的任务、commit message、commit hash、push 是否成功

### 默认行为

不要再询问:

- “是否需要 commit?”
- “是否需要 push?”
- “要不要同步 GitHub?”

只要本次任务已经完成、检查通过,并且不存在需要人工确认的问题,就自动执行 commit + push。

### 必须暂停并询问用户的情况

只有以下情况需要暂停:

1. 出现 Git 冲突
2. 远程存在新的提交,无法安全直接 push,需要先同步
3. Git 命令执行失败且无法安全自动解决
4. 发现可能包含敏感信息的文件
5. 需要执行危险操作,例如强制 push、reset、删除历史等

### 禁止操作(未经用户明确允许,不得执行)

- `git push --force`
- `git reset --hard`
- `git clean -fd`
- 删除远程分支
- 覆盖或删除已有 Git 历史

### 关于 git add

不要机械地执行 `git add .`。提交前先检查变更内容,只提交本次任务相关且确认安全的文件,避免把临时文件、敏感文件或其他未完成的修改提交进去。
