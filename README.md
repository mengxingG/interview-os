# 🎯 InterviewOS


> **Your AI-Powered Career Command Center | 从碎片化的面试准备，进化为全周期的 AI 职业资产管理系统。**

## 把准备简历、专项训练、面试、JD 备面、模拟面试，串成一个持续进化的技术面试闭环


InterviewOS 是一个专为 AI 产品经理及广大硬核求职者打造的端到端（E2E）求职备战平台。它不仅是一个单纯的"面经生成工具"，更是一个将你的职业经历"原子化、资产化"的**活文档（Living Document）生态**。

通过深度整合大模型（Gemini/DeepSeek）的理解能力与 Notion 的结构化数据库，InterviewOS 将**岗前调研、底层故事打磨、高压环境模拟测试**无缝串联，让你的职业生涯从此不再"裸奔"。

### 📦 系统架构与模块说明 (Modules & Capabilities)

InterviewOS 采用“作战中枢 + 四阶段流水线”的架构设计，覆盖从底层资产沉淀到最终面谈复盘的全生命周期，最大化降低求职过程中的上下文切换与认知负荷。

| 模 块 大 类 | 子模块名称 | 核心功能 (Features) | 核心价值与帮助|
| :--- | :--- | :--- | :--- |
| **🕹️ 全局控制** | **作战中枢 (Cockpit)** | 聚合今日任务、面试日程、题库进度与历史记录的全局 Dashboard。 | **“反焦虑神器”**：一眼看透当前进度与薄弱环节，系统自动生成下一步行动建议，消除备战期的迷茫感。 |
| **🧱 阶段一：<br>资产沉淀** | **故事库 (Story Library) <br>& AI 优化 (Copilot)** | 支持 Notion 双向同步，内置严格事实锚定的 STAR 扩写引擎，支持一键生成并归档“90秒口述版”。 | **“重塑经历资产”**：将碎片化经历转化为结构化的高质量弹药。通过 AI 推演与防幻觉机制，确保故事既有业务张力又守住事实红线。 |
| **🎯 阶段二：<br>精准投递** | **岗位分析 & 简历优化** | 拆解目标 JD，提取核心能力要求，并根据 JD 动态高亮/重写简历匹配项。 | **“千人千面”**：提高简历初筛通过率，把“通用简历”快速转化为“定制化敲门砖”。 |
| **⚔️ 阶段三：<br>面试攻坚** | **知识训练 (Training)** | 采用费曼技巧与 AI 辅助阅读，针对底层技术（如 RAG、大模型架构）进行深度问答。 | **“扫除知识盲区”**：像给8岁小孩讲故事一样拆解复杂技术概念，建立扎实的底层认知。 |
| | **面试备战 (Strategy)** | 输入真实 JD 后，生成结构化的万字战略分析报告。 | **“知己知彼”**：提前预判面试官考察重点与业务团队痛点，实现降维打击。 |
| | **考前热身 (Warmup)** | 面试前 5-10 分钟的“终极护身符”。一键生成 60 秒高光回放、3x3 核心要点及失误恢复手册。 | **“消除临场空白”**：在最高压的环境下提供结构化抓手，避免现场卡壳，完美把控开场节奏。 |
| | **模拟面试 (Mock)** | 内置 Focus 倒计时与“皮卡丘”专注组件，结合 LLM 逻辑的模拟面试官进行全真对练。 | **“肌肉记忆养成”**：通过还原真实的压迫感与时间限制，提升临场反应速度与抗压能力。 |
| **🔄 阶段四：<br>复盘转化** | **面试复盘 & 薪资谈判** | 结构化沉淀面试实录，归因坏 Case 并提取面经；提供谈薪策略辅助。 | **“数据飞轮”**：让每一次面试都成为下一次成功的垫脚石，确保在最终转化环节实现利益最大化。 |

![InterviewOS 首页](images/homepage.png)

---

## ✨ 核心功能特性 (Key Features)

### 1. 📂 故事库 (Story Bank) - 锻造无懈可击的原子资产
摒弃传统的静态文档，使用 STAR 法则沉淀可复用的故事素材，并与 AI 深度结对编程：
* **✨ 创造者模式 (AI Copilot)：** 独立的可视化工作区，一键优化语病、补充量化结果、按目标 JD 重新聚焦，以及一键压缩为 **90秒口述备战版**。
* **🔥 防御者模式 (深度拷问作战室)：** * **强人设连环追问：** 动态切换考官视角（如：`Staff Engineer` 深挖 RAG/缓存机制等技术底座，`Data Science Lead` 质疑业务埋点因果性，`跨部门主管` 测试压力下的资源协调手腕）。
    * **高纯度防御闪卡：** 拷问结束后，AI 会自动滤除废话，提炼出核心交锋点，以结构化 Q&A（问题与防守策略）的形式保存。

![故事库 - AI 优化与深度拷问](images/story.png)

### 2. 🎯 精准备战 (Interview Prep) - 秒级产出万字战报
告别面试前海量搜集资料的焦虑，基于当前 JD 与你的简历底稿，一键生成战略地图：
* **JD 深度解码：** 提取岗位核心职责、隐含期望与你的核心差距分析。
* **🎤 千人千面自我介绍引擎：** 自动融合候选人的通用 Elevator Pitch 与当前岗位的痛点需求，输出带有极强业务压迫感的提词器：
    * **30秒快读版：** 核心高光与 JD 匹配度，适合极端限时破冰。
    * **1分钟标准版：** 逻辑闭环，包含核心指标体系。
    * **3分钟深度版：** 详尽的项目操盘细节与职业转型故事，应对高管深挖。
![精准备战](images/prep.png)
![面试备战 - 自我介绍引擎](images/interview1.png)

### 3. 🔗 深度架构闭环 (Notion as a Living Database)
完全告别数据孤岛与"流水账"记录，将 Notion 作为强大的 Headless CMS 接入：
* **全生命周期 CRUD：** 基于隐式 `page_id` 实现数据的精准双向绑定与更新，拒绝重复产生冗余数据。
* **多维结构化落库：** 引入大模型提炼机制，在点击同步的瞬间，按需打包"标准优化版 (Quote块)"、"90秒口述卡片 (Callout块)"及"拷问复盘 (Toggle折叠块)"，分门别类挂载至 Notion 的页面正文，形成完美的知识闪卡。

### 4. ⏱️ 个性化定制简历+项目介绍
* **根据JD，个性化生成符合JD要求+公司特性的简历。
* **个性化生成自我介绍逐字稿
![定制简历 - AI 优化与根据JD修改简历](images/resume.png)

### 4. 岗位分析、确定匹配度
![岗位分析](images/position.png)

## 🛠️ 技术栈 (Tech Stack)

InterviewOS 采用现代化的全栈架构体系，优化开发体验与渲染性能：

* **前端框架：** Next.js 14+ (App Router) + React 18 + TypeScript
* **UI 与交互：** Tailwind CSS + Shadcn/ui + Sonner (全局异步 Toast 状态管理)
* **AI 引擎：** Vercel AI SDK 
* **大语言模型：** Gemini 1.5 Pro / Flash、DeepSeek (负责结构化数据提取与流式对话)
* **数据持久化：** Notion API (Database & Block Management)
* **开发流范式：** Cursor + Vibe Coding

---

## 🚀 快速开始 (Quick Start)

### 1. 环境准备
确保你的系统中已安装 Node.js (>= 18.x) 与 npm/pnpm。

### 2. 获取代码
```bash
git clone https://github.com/YourUsername/InterviewOS.git
cd InterviewOS
```

### 3. 配置环境变量
复制根目录下的 `.env.example` 并重命名为 `.env.local`，填入你的专属密钥：

```env
# AI Models Configuration
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_deepseek_or_openai_key # 兼容 OpenAI 格式的接口

# Notion Integration
NOTION_API_KEY=secret_your_notion_integration_token
NOTION_STORIES_DB_ID=your_notion_database_id
```
> 注：Notion Integration 需要为对应的 Database 授予权限。

### 4. 安装依赖并启动
```bash
npm install
npm run dev
```
启动后，在浏览器中访问 http://localhost:3000 即可进入你的专属 AI 求职驾驶舱。

---

## 🖼️ 更多功能预览

![知识库](images/knowledge.png)

![复盘](images/post.png)

![考前热身](images/active.png)

![进程](images/progress.png)
---

## 🤝 贡献与反馈 (Contributing & Feedback)

InterviewOS 目前处于持续迭代中，脱胎于真实 AI PM 求职实战中的刚性痛点。如果你在使用过程中有任何灵感，或希望增加对其他招聘平台数据格式的快捷解析支持，欢迎提交 [Issue] 或 [Pull Request]。

## 📄 开源协议 (License)

本项目基于 MIT License 协议开源。

---

### 💡 写在后面的话
