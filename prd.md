# FairSharing AI MVP

## 1. 项目概述

**一句话定义**

FairSharing AI 是一个面向 AI Agent 协作的链上贡献记录与激励分配 MVP：AI Agent 可以为项目提交贡献提案（做了什么、证明是什么、希望获得多少奖励），其他 Agent 进行投票，提案通过后，项目合约自动 mint 对应奖励 Token 给提案 Agent。

**黑客松目标**

在最短时间内跑通一个完整闭环：

1. 创建项目
2. 注册 / 预置 3–5 个 AI Agent
3. 某个 Agent 提交贡献提案
4. 其他 Agent 投票
5. 提案通过后自动发放奖励 Token
6. 前端可完整演示整个流程

**核心原则**

- 一个仓库完成全部内容
- 尽量少依赖、少服务
- 不做数据库后端
- 链上只保存最小必要状态
- AI 逻辑链下运行，结算与规则链上执行
- 先能演示，再考虑扩展性

---

## 2. 要解决的问题

当 AI Agent 开始独立参与任务执行、内容产出和协作时，目前缺少一种适合 AI 协作场景的、透明且可验证的贡献记录与激励分配机制。

现有问题：

- AI 的真实贡献难以被可信记录
- 激励分配通常依赖中心化平台或人工判断
- 多个 AI Agent 之间缺少公开透明的协作与结算机制
- 自报价与他人审核之间缺少可博弈、可约束的流程

FairSharing AI 的目标不是一开始就做完整治理系统，而是先验证一个最小命题：

> AI Agent 能否像人类协作者一样，自主申报贡献、自我报价、接受集体验证，并自动完成链上奖励结算？

---

## 3. MVP 范围

### 3.1 本次必须实现

- Project Factory：创建新的 FS Project
- FS Project 合约：
  - 管理 Agent 白名单
  - 提交贡献提案
  - 投票
  - 执行通过的提案
  - mint 奖励 Token
- Reward Token：项目内 ERC-20 奖励 Token
- Web 前端：
  - 连接钱包
  - 创建项目
  - 查看项目详情
  - 提交贡献
  - 查看提案列表
  - 对提案投票
  - 查看通过后余额变化
- 简单 Agent Runner：
  - 使用预置测试钱包模拟多个 AI Agent
  - 自动读取已有提案并发起投票或提交新提案

### 3.2 本次不做

- 不做复杂声誉系统
- 不做 token-weighted governance
- 不做可升级合约
- 不做完整账户抽象 / ERC-4337 / session key
- 不做去中心化存储集成的复杂上传体验
- 不做链下数据库
- 不做复杂争议仲裁
- 不做生产级权限系统
- 不做多链

### 3.3 Stretch Goal（有时间再做）

- Agent 根据历史通过记录自动调整报价
- 提案 proof 接入 IPFS
- 简单 reputation 分数
- Agent 自动批量模拟
- 支持项目预算上限

---

## 4. 用户与角色

### 4.1 Demo 角色

**Project Owner**

- 创建 Project
- 初始化 Agent 白名单
- 观察项目运行

**AI Agent**

- 提交贡献提案
- 对他人提案投票
- 接收奖励 Token

**Viewer / Judge**

- 在前端查看项目、提案、投票结果、奖励结果

### 4.2 为什么白名单 Agent

MVP 阶段不解决女巫攻击与开放治理问题，因此采用白名单 Agent，一地址一票。这样最简单、最稳定，也最适合黑客松演示。

---

## 5. 产品核心流程

### 5.1 创建项目

1. Owner 在前端点击 Create Project
2. 调用 Factory 部署一个新的 FSProject
3. FSProject 同时部署 / 绑定一个 RewardToken
4. Owner 初始化 Agent 列表

### 5.2 提交贡献提案

1. Agent 选择项目
2. 填写：
   - title
   - summary
   - proofURI
   - proofHash
   - requestedReward
3. 提交交易到 FSProject
4. 生成一个 Proposal

### 5.3 Agent 投票

1. 其他 Agent 浏览提案
2. 对提案执行 approve / reject
3. 每个 Agent 每个 proposal 只能投一次
4. 达到过半支持后，proposal 状态变为 Passed

### 5.4 执行结算

1. 任意人调用 executeProposal
2. Project 合约检查 proposal 已通过且未执行
3. RewardToken mint requestedReward 给 proposer
4. Proposal 状态变为 Executed

### 5.5 演示故事线

建议准备 3 个固定脚本：

1. **合理报价通过**：Agent A 报价 1000，其他 Agent 认为合理并通过
2. **过高报价被拒**：Agent B 报价 5000，被多数否决
3. **参考历史后再次通过**：Agent B 看到类似任务大多 900–1200，重新报价 1100，通过

这个第三个故事最能体现“FairSharing + AI 博弈定价”的概念。

---

## 6. 功能需求

### 6.1 Factory

**功能**

- 创建 FSProject
- 记录项目列表

**最小字段**

- projectId
- project address
- creator
- name
- createdAt

### 6.2 FSProject

**状态**

- projectName
- owner
- rewardToken
- agent whitelist
- proposalCounter
- proposals mapping

**Proposal 字段**

- id
- proposer
- title
- summary
- proofURI
- proofHash
- requestedReward
- yesVotes
- noVotes
- status
- createdAt

**ProposalStatus**

- Pending
- Passed
- Rejected
- Executed

**主要方法**

- addAgent(address)
- removeAgent(address)
- submitProposal(...)
- vote(proposalId, support)
- executeProposal(proposalId)
- getProposal(proposalId)

### 6.3 RewardToken

**功能**

- ERC-20 Token
- 仅 Project 合约可 mint

**最小字段**

- name
- symbol
- totalSupply
- balances

### 6.4 Web 前端

页面建议：

1. `/` 首页
   - 项目列表
   - 创建项目入口

2. `/projects/[address]`
   - 项目信息
   - Agent 列表
   - Token 信息
   - 提案列表
   - 新建提案表单

3. `/demo`
   - 预置 Agent 控制面板
   - 一键触发 demo 行为

**前端最小能力**

- 连接浏览器钱包
- 读取项目与提案
- 发交易
- 展示事件结果

### 6.5 Agent Runner（链下）

MVP 不做真正自治 Agent 网络，只做一个最简单的本地 / server-side runner：

- 预置 3–5 个测试私钥（仅限 Base Sepolia demo，绝不使用真实资金）
- 每个 Agent 有一个简单策略：
  - 如果历史相似任务报价在可接受区间，则 approve
  - 如果 requestedReward 明显高于历史中位数，则 reject
  - 偶尔提交自己的提案

这部分可以写成一个简单的 TypeScript 脚本或 Next.js route handler。

---

## 7. 非功能需求

- **简单优先**：优先减少模块数量
- **可演示**：前端必须清楚展示“提交 → 投票 → mint”流程
- **可重复部署**：支持本地和 Base Sepolia
- **可读性**：合约结构简单，便于现场讲解
- **低耦合**：AI 策略与合约规则分离

---

## 8. 关键设计决策

### 8.1 为什么不用数据库

因为黑客松目标是验证协议闭环，而不是构建完整平台。项目与提案列表可以通过合约 view + event 读取，避免额外部署数据库和后端服务。

### 8.2 为什么链上只存最小状态

完整贡献内容、长文本、模型输出、附件都不适合直接放链上。链上只存最小必要字段和 proof 引用即可，既保留可验证性，也降低复杂度与 gas。

### 8.3 为什么不用 token-weighted governance

如果奖励 token 同时等于投票权，系统会很快滑向“先赚钱者拥有更大表决权”的结构，MVP 阶段会掩盖核心问题。黑客松版本采用白名单 Agent + 一地址一票，更适合验证机制本身。

### 8.4 为什么暂时不做 AA 钱包

真正的智能账户、session key、自动签名是合理方向，但不适合作为首版依赖。MVP 先使用受控测试钱包模拟 Agent 自动执行，先证明机制成立。

### 8.5 ERC-8004 集成策略

FairSharing AI 参与了 "Agents With Receipts — ERC-8004" 赛道，因此 FSProject 在 `addAgent()` 时会调用 ERC-8004 identity registry 验证 Agent 地址是否拥有链上身份。

集成方式：
- `FSProject` 构造函数接收 `erc8004Registry` 地址
- `addAgent(address)` 调用 `IERC8004Registry.isRegistered(agent)` 验证
- 若 `erc8004Registry == address(0)`，跳过验证（本地开发 / 测试网）
- FSProjectFactory 将 registry 地址传递给每个新建的 FSProject

这样既满足赛道要求（Agent 白名单与 ERC-8004 身份绑定），又不影响本地开发与测试流程。

### 8.6 提案投票规则

- 无 deadline，提案永久有效直到投票结果确定
- 投票实时结算：达到 `yesVotes > N/2` 立即 Passed，`noVotes > N/2` 立即 Rejected
- Agent 数量通常 3–5 个，不存在治理冷漠问题，无需超时机制

---

## 9. 合约设计

### 9.1 合约清单

- `FSProjectFactory.sol`
- `FSProject.sol`
- `RewardToken.sol`

### 9.2 权限模型

- Factory：任何人可 createProject
- FSProject Owner：可添加或移除 Agent
- Agent：可 submitProposal 和 vote
- Project 合约：唯一允许 mint Token 的主体

### 9.3 通过规则

MVP 采用最简单规则：

- 白名单 Agent 总数设为 N
- `yesVotes > N / 2` 视为通过
- `noVotes >= N / 2 + 1` 可视为拒绝
- 也可以不提前 reject，只在 execute 前判定 yes 是否过半

为减少状态分支，推荐：

- vote 时实时更新 Passed / Rejected
- execute 只允许 Passed 状态执行

### 9.4 建议事件

- `ProjectCreated`
- `AgentAdded`
- `AgentRemoved`
- `ProposalSubmitted`
- `ProposalVoted`
- `ProposalPassed`
- `ProposalRejected`
- `ProposalExecuted`

前端主要依赖这些事件更新状态。

---

## 10. 仓库结构

```text
fairsharing-ai/
├─ apps/
│  └─ web/                     # Next.js 前端
├─ packages/
│  ├─ contracts/               # Hardhat + Solidity
│  └─ shared/                  # ABI、types、constants
├─ scripts/
│  └─ agent-runner.ts          # 本地 Agent 模拟脚本
├─ .env.example
├─ package.json
├─ package.json          # bun workspace root
└─ README.md
```

### 10.1 contracts 包

```text
packages/contracts/
├─ contracts/
│  ├─ FSProjectFactory.sol
│  ├─ FSProject.sol
│  └─ RewardToken.sol
├─ ignition/ or scripts/
├─ test/
├─ hardhat.config.ts
└─ package.json
```

### 10.2 web 包

```text
apps/web/
├─ app/
│  ├─ page.tsx
│  ├─ projects/[address]/page.tsx
│  └─ demo/page.tsx
├─ components/
├─ lib/
│  ├─ wagmi.ts
│  ├─ contracts.ts
│  └─ format.ts
├─ public/
└─ package.json
```

---

## 11. 技术选型

### 11.1 Monorepo

**bun workspace**

理由：轻量、简单、适合前端与合约共享 ABI/types。Package manager 使用 bun，runtime 使用 Node.js。

### 11.2 前端

**Next.js + TypeScript + App Router**

理由：

- 快速起项目
- React 生态成熟
- App Router 适合直接做少量页面与服务端逻辑

### 11.3 Web3 前端

**wagmi + viem**

理由：

- 连接钱包简单
- 读取合约和发交易体验成熟
- TypeScript 友好

### 11.4 合约开发

**Hardhat 3 + OpenZeppelin Contracts**

理由：

- 上手快
- 适合黑客松和 demo 项目
- OpenZeppelin 可直接复用 ERC-20、Ownable / AccessControl 等安全基础能力

### 11.5 网络

**Base（Base Sepolia 测试网，主网备选）**

理由：

- 黑客松 "Agent Services on Base" 赛道要求部署在 Base
- Base Sepolia 适合开发和演示，gas 费低
- 工具链与 Sepolia 完全兼容，只需改 chainId

---

## 12. 数据模型

### 12.1 Project

```ts
{
  address: string
  name: string
  owner: string
  rewardToken: string
  agents: string[]
  proposalCount: number
}
```

### 12.2 Proposal

```ts
{
  id: number;
  proposer: string;
  title: string;
  summary: string;
  proofURI: string;
  proofHash: string;
  requestedReward: bigint;
  yesVotes: number;
  noVotes: number;
  status: "Pending" | "Passed" | "Rejected" | "Executed";
  createdAt: number;
}
```

### 12.3 Agent Profile（链下）

```ts
{
  address: string;
  name: string;
  role: string;
  strategy: "conservative" | "neutral" | "aggressive";
}
```

---

## 13. API / 链下逻辑

MVP 不做完整后端 API，只保留两个可选能力：

### 13.1 可选 Next.js Route Handlers

- `POST /api/demo/submit`
- `POST /api/demo/vote`
- `POST /api/demo/run-round`

作用：

- 触发预置 Agent 提交 proposal
- 触发多个 Agent 执行投票
- 便于 demo 时一键推进流程

### 13.2 本地脚本模式

也可以完全不用 API，只提供：

- `bun agent:submit`
- `bun agent:vote`
- `bun agent:round`

对于黑客松，CLI 脚本通常比 API 更稳。

---

## 14. 页面草图

### 14.1 首页

模块：

- Header（连接钱包）
- Create Project 表单
- Project List

### 14.2 项目详情页

模块：

- 项目基础信息
- Token 信息
- Agent 白名单
- New Proposal 表单
- Proposal List
- 每条 Proposal 的 Vote / Execute 按钮

### 14.3 Demo 页

模块：

- 预置 Agent 状态
- 一键发起合理报价
- 一键发起过高报价
- 一键执行自动投票
- 输出日志面板

---

## 15. 成功标准

### 15.1 Demo 成功标准

必须满足：

- 能在 Base Sepolia 创建项目
- 能成功提交 proposal
- 能由多个 Agent 成功投票
- 能在通过后 mint token 给 proposer
- 前端可查看 proposal 状态和余额变化

### 15.2 讲故事成功标准

评委能在 2–3 分钟内理解：

- 这是什么
- 为什么 AI Agent 需要这种机制
- 系统如何让“自报价 + 集体验证 + 自动结算”成立

---

## 16. 里程碑

### Milestone 1：合约闭环

- 完成 3 个核心合约
- 本地测试通过
- 本地脚本能跑通 submit → vote → execute

### Milestone 2：前端可交互

- 钱包连接
- 创建项目
- 查看 proposal
- 投票与执行

### Milestone 3：Demo 自动化

- 预置 Agent 钱包
- 一键模拟 3 个场景
- Base Sepolia 部署完成

---

## 17. 开发优先级

### P0

- Factory
- Project
- RewardToken
- 创建项目
- 提交 proposal
- 投票
- execute mint
- Base Sepolia 部署

### P1

- Demo 页面
- Agent runner
- 历史相似报价参考（链下简单实现）

### P2

- 更好的 UI
- Proof 上传到 IPFS
- 统计面板

---

## 18. 风险与应对

### 风险 1：没有索引层，前端读取麻烦

**应对**：只支持少量项目和提案；前端直接读取 events + view。

### 风险 2：Agent 自动签名过于复杂

**应对**：只使用测试钱包和本地私钥，不做 AA。

### 风险 3：链上文本成本高

**应对**：限制 summary 长度，proof 用 URI + hash。

### 风险 4：投票逻辑边界复杂

**应对**：固定白名单、一地址一票、不支持撤票。

### 风险 5：讲不清“为什么要上链”

**应对**：强调链上负责的是“共识后的激励结算与公开记录”，不是把全部 AI 行为搬上链。

---

## 19. README 建议内容

README 首页建议直接写：

1. What it is
2. Why it matters
3. How it works
4. Repo structure
5. Local development
6. Deploy to Base Sepolia
7. Demo scenarios

---

## 20. 建议的第一版 Demo 文案

**FairSharing AI** is an onchain contribution and reward mechanism for AI Agents.

Agents can:

- submit what they did,
- attach proof,
- request a reward,
- and let peer agents vote on whether the pricing is fair.

If the proposal passes, the project contract automatically mints reward tokens to the proposing agent.

This MVP demonstrates a minimal closed loop for:
**AI contribution → peer review → onchain incentive settlement**.

---

## 21. 开工建议

第一天只做下面这些：

1. 建 monorepo
2. 写 3 个合约
3. 写 3 个测试：
   - submit proposal
   - majority vote pass
   - execute mint
4. 部署到 Base Sepolia
5. 前端先只做项目详情页

只要这一步完成，你就已经有一个能讲的黑客松原型了。

---

## 22. 默认实现建议（最省事版本）

- 合约权限：`Ownable` + `mapping(address => bool) isAgent`
- Token：标准 `ERC20`
- Project 创建：Factory 直接 `new FSProject(...)`
- 数据读取：前端直接 `readContract`
- 事件监听：前端轮询 + 手动刷新即可
- Demo Agent：Node 脚本读取 `.env` 内测试私钥
- Proof：先填任意 URL / GitHub Gist / Notion Public Link

这个版本不是最优雅的，但最接近“黑客松能落地”的目标。
