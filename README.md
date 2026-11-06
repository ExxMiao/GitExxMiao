# 星野浮记 · 个人博客 + 游戏中心

一个纯静态、零依赖、零构建的网站：

- **主页**：二次元风格的个人博客（最新文章 / 分类 / 关于我），博客文章为占位示例内容，替换成自己的文章即可
- **游戏中心**：模块化小游戏合集，目前上线 **经典 9×9 数独** 与 **扫雷**，后续可持续接入新游戏

所有页面均为原生 HTML / CSS / JavaScript，无框架、无构建步骤，双击 `index.html` 即可在本地打开，也可以直接部署到 GitHub Pages。

## 目录结构

```
├── index.html                  主页（二次元风格个人博客）
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
    ├── sudoku/                 数独模块（完全独立）
    │   ├── index.html
    │   ├── sudoku.css
    │   └── sudoku.js           生成器 / 求解器 / 交互 / 存档
    └── minesweeper/            扫雷模块（完全独立）
        ├── index.html
        ├── minesweeper.css
        └── minesweeper.js      布雷 / 翻开扩散 / 交互 / 存档
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

## 扫雷模块说明

- **难度**：初级 9×9·10 雷 / 中级 16×16·40 雷 / 高级 30×16·99 雷（高级在小屏上可横向滚动）。
- **首点必安全**：地雷在第一次点击之后才布置，且保证点击位置及其周围一圈无雷。
- **功能**：右键 / 长按 / 旗子模式三种插旗方式、数字快开（旗数够了点数字一次翻开周围）、失败后亮出全部地雷并标出错旗、胜利自动插旗、计时、暂停、键盘操作（方向键移动、Enter 翻开、F 插旗）。
- **存档**：当前进度与各难度最佳成绩保存在 `localStorage`。

## 内容说明

主页的博客文章、数据与头像均为占位示例内容，可直接在 `index.html` 中替换为自己的文章；游戏模块代码为原创，可自由使用。
