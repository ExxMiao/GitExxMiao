# 腾讯 AI 档案 · 静态小站

一个纯静态、零依赖、零构建的网站：

- **主页**：腾讯 AI 发展历程（时间轴 + 技术地图）
- **游戏中心**：模块化小游戏合集，目前上线 **经典 9×9 数独**，后续可持续接入新游戏

所有页面均为原生 HTML / CSS / JavaScript，无框架、无构建步骤，双击 `index.html` 即可在本地打开，也可以直接部署到 GitHub Pages。

## 目录结构

```
├── index.html                  主页（腾讯 AI 发展历程）
├── games.html                  游戏中心（由注册表自动渲染）
├── assets/
│   ├── css/
│   │   ├── base.css            全站设计变量 / 导航 / 页脚
│   │   ├── home.css            主页样式
│   │   └── games.css           游戏中心样式
│   └── js/
│       ├── site.js             全站通用交互
│       ├── games-registry.js   ★ 游戏注册表（加新游戏只改这里）
│       └── games-hub.js        游戏卡片渲染与筛选
└── games/
    └── sudoku/                 数独模块（完全独立）
        ├── index.html
        ├── sudoku.css
        └── sudoku.js           生成器 / 求解器 / 交互 / 存档
```

## 部署到 GitHub Pages

1. 在 GitHub 新建一个仓库（例如 `my-site`）。
2. 把本项目所有文件推送上去：

   ```bash
   git init
   git add .
   git commit -m "init: 主页 + 数独游戏中心"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/my-site.git
   git push -u origin main
   ```

3. 打开仓库 **Settings → Pages**，将 **Source** 设为 `Deploy from a branch`，分支选 `main`、目录选 `/ (root)`，保存。
4. 等待 1–2 分钟，访问 `https://<你的用户名>.github.io/my-site/` 即可。

> 若仓库名为 `<用户名>.github.io`，则直接访问 `https://<用户名>.github.io/`。

## 如何新增一个游戏（模块化设计）

游戏中心与具体游戏**完全解耦**，新增游戏只需三步，不改任何现有页面：

1. 在 `games/` 下新建文件夹（建议与游戏 id 同名），放入独立的
   `index.html` + 样式 + 脚本。引用 `../../assets/css/base.css` 即可继承全站导航与设计变量。

2. 打开 `assets/js/games-registry.js`，在 `window.GAME_REGISTRY` 数组里追加一条配置：

   ```js
   {
     id: "2048",
     name: "2048",
     subtitle: "合并数字，冲击 2048",
     description: "方向键操作，相同数字合并翻倍。",
     path: "games/2048/index.html",
     tags: ["休闲", "数字"],
     meta: "4 × 4",
     status: "ready",          // ready 可玩 / soon 开发中 / beta 测试中
     accent: "#0f9b8e",        // 卡片主题色
     icon: "<svg>…</svg>"
   }
   ```

3. 刷新 `games.html`，新游戏会自动出现在卡片列表中；`status: "soon"` 的游戏会以"开发中"样式展示但不可点击。

游戏中心同时会自动生成标签筛选（全部 / 各 tag），无需额外配置。

## 数独模块说明

- **题目生成**：随机回溯生成完整解，再逐格挖洞；每挖一格都用 MRV 回溯求解器验证**唯一解**，不唯一则填回。四档难度对应不同提示数（简单 40 / 中等 34 / 困难 29 / 专家 25）。
- **功能**：笔记模式、撤销（最多 300 步）、擦除、提示、自动校验错误、同行/列/宫重复标红、计时、暂停、数字键盘剩余计数、键盘操作（1–9 填数、方向键移动、N 笔记、H 提示、U 撤销、P 暂停）。
- **存档**：当前进度与各难度最佳成绩保存在 `localStorage`，刷新页面自动恢复。
- **移动端**：自适应布局，数字键盘加大便于触屏操作。

## 内容说明

主页内容为公开资料整理，仅供学习参考，与腾讯公司无关；2026 年的进展仍在快速变化，具体时间与数据请以官方发布为准。
