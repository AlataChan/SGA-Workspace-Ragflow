# UI 隐藏项记录

为满足用户反馈（“先不显示，之后可能再加回”），项目里对以下 UI 做了**默认隐藏**处理。后续如需恢复，只需将对应开关改回 `true` 即可。

## 1) Workspace 左下角 Agent 简介卡片

- 现状：默认隐藏
- 位置：`components/workspace/main-workspace-layout.tsx`
- 开关：`SHOW_AGENT_INTRO_CARD`
- 恢复方式：将 `SHOW_AGENT_INTRO_CARD = false` 改为 `true`

## 2) 右侧边栏底部 3 个功能按钮

按钮包括：`语音通话` / `视频会议` / `交互历史`

- 现状：默认隐藏
- 位置：`components/workspace/main-workspace-layout.tsx`
- 开关：`SHOW_AGENT_ACTION_BUTTONS`
- 恢复方式：将 `SHOW_AGENT_ACTION_BUTTONS = false` 改为 `true`

