/* =========================================================
   games-registry.js — 游戏注册表
   ---------------------------------------------------------
   ★ 以后新增小游戏，只需要改这一个文件：
     1. 在 games/ 下新建一个文件夹，放入独立页面（自带 css / js）
     2. 在下面的数组里 push 一条配置
     3. 游戏中心页面会自动出现新卡片，无需改动其它代码

   字段说明：
     id          唯一标识，建议与文件夹同名
     name        游戏名（卡片标题）
     subtitle    一句话副标题
     description 卡片描述（2 行内最佳）
     path        游戏页面相对站点根目录的路径
     tags        标签数组，展示为小 chip
     meta        右上角角标，例如 "9 × 9"
     status      "ready" 可玩 / "soon" 开发中 / "beta" 测试中
     accent      主题色，用于卡片图标与悬停光效
     icon        图标 SVG（24×24，stroke 使用 currentColor）
     featured    是否为重点推荐（排在最前）
   ========================================================= */

window.GAME_REGISTRY = [
  {
    id: "sudoku",
    name: "数独",
    subtitle: "经典 9 × 9 · 四档难度",
    description:
      "四档难度的标准 9×9 数独，支持笔记模式、撤销、提示与自动校验。每局题目由程序随机生成，保证唯一解。",
    path: "games/sudoku/index.html",
    tags: ["益智", "逻辑", "单人"],
    meta: "9 × 9",
    status: "ready",
    accent: "#0052d9",
    featured: true,
    icon:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<rect x="3" y="3" width="18" height="18" rx="2.5"/>' +
      '<path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>' +
      "</svg>"
  }

  /* ---- 新增游戏示例（取消注释并修改即可） ----
  , {
    id: "2048",
    name: "2048",
    subtitle: "合并数字，冲击 2048",
    description: "方向键操作，相同数字合并翻倍。纯前端实现，支持触屏滑动。",
    path: "games/2048/index.html",
    tags: ["休闲", "数字"],
    meta: "4 × 4",
    status: "soon",
    accent: "#0f9b8e",
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M12 3v18M3 12h18"/></svg>'
  }
  */
];

/* 未上线的占位卡片（想加几个就加几个，只是视觉提示） */
window.GAME_PLACEHOLDERS = [
  { name: "更多游戏", note: "按模块接入中" },
  { name: "待定", note: "欢迎提议" }
];
