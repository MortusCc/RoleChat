# RoleChat — 通用 AI 角色扮演轻问答网页

通用型 AI 角色扮演对话平台。支持用户设定世界观与角色进入沉浸式对话，内嵌 15 个自行设计的功能图标，调用 DeepSeek API 实现智能回复。

## 技术栈

- **前端**：HTML / CSS / JavaScript（原生，无框架）
- **API**：DeepSeek Chat Completion API（流式输出 SSE）
- **代理**：Vercel Serverless Functions
- **部署**：Vercel / Netlify

## 项目结构

```
RoleChat/
├── index.html          # 入口页面（SPA 多页面路由）
├── css/
│   └── style.css       # 全局样式 + 移动端适配
├── js/
│   ├── app.js          # 页面路由、UI 交互、状态管理
│   └── api.js          # API 调用封装、SSE 流式解析
├── assets/
│   └── icons/          # 12-15 个功能图标 (SVG / PNG)
├── .gitignore
└── README.md
```

## 页面结构

| 页面 | 路由 | 说明 |
| --- | --- | --- |
| 对话列表 | `#chat-list` | 历史对话卡片、新建/搜索/删除/收藏 |
| 对话界面 | `#chat-room` | 消息气泡、发送、重新生成、复制、点赞 |
| 角色管理 | `#role-manage` | 角色卡管理、编辑/删除/分享 |
| 角色创建 | `#role-create` | 世界观、AI 设定、用户身份 |
| 我的 | `#profile` | 个人设置与数据 |

底部导航：对话 / 角色 / 发现 / 我的

## 图标清单 (15 个)

对话、角色、发现、我的、新建对话、搜索、删除、收藏、发送、重新生成、复制、点赞/踩、角色切换、世界观设定、保存

## 快速开始

1. 在 Vercel 配置环境变量 `DEEPSEEK_API_KEY`
2. 部署 `api/chat.js` 为 Serverless Function
3. 静态文件部署至 Vercel / Netlify
4. 访问公开 URL

## 实验相关

本项目为 UI 设计实验（一）功能图标设计与制作的课程作业载体。
详见 `ui设计实验（一）指导书辅修.md` 和 `项目开发文档.md`。
