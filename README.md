# 🎮 Indienstein - AI游戏创意生成器

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)

> 🚀 基于Web的AI游戏创意生成器，使用AI和随机词组合，点燃游戏开发的创意火花！✨

## 📋 项目简介

Indienstein是一个基于Web技术构建的游戏创意生成工具，通过智能的AI助手和多维度随机词汇组合系统，帮助游戏开发者、设计师和创意工作者突破创意瓶颈，生成独特有趣的游戏概念和创意方案。

### 🎯 核心功能

- **🎲 多维度词汇生成**: 从8个创意维度智能抽取和组合关键词
- **🤖 AI创意合成**: 使用大语言模型将随机词汇融合成完整的游戏创意
- **💬 多角色AI聊天**: 内置三种AI助手角色，提供不同风格的创意支持
- **⚡ 批量生成模式**: 一次性生成1-10个创意方案
- **💾 本地存储**: 聊天记录和设置自动保存到本地
- **📱 响应式设计**: 支持桌面和移动设备访问

### 🌟 特色亮点

- **纯Web技术**: 基于HTML5、CSS3、ES6+构建，无需安装任何插件
- **多AI提供商**: 支持通义千问、OpenAI等多种AI服务
- **流式对话**: 实时流式AI对话体验，就像真人聊天
- **现代UI设计**: 采用玻璃拟态设计风格，美观且易用
- **模块化架构**: 清晰的代码结构，易于扩展和维护
- **离线友好**: 除AI服务外，其他功能均可离线使用

## 🚀 快速开始

### 环境要求

- 现代Web浏览器（Chrome 80+、Firefox 75+、Safari 13+、Edge 80+）
- AI服务API密钥（通义千问或OpenAI）

### 安装使用

1. **克隆项目**
```bash
git clone https://github.com/JupiterTheWarlock/Indienstein-by-JtheWL.git
cd Indienstein-by-JtheWL
```

2. **直接运行**
   - 使用本地服务器打开项目（推荐）
   ```bash
   # 使用Python
   python -m http.server 8000
   
   # 或使用Node.js
   npx serve .
   
   # 或使用PHP
   php -S localhost:8000
   ```
   - 然后访问 `http://localhost:8000`

3. **配置AI服务**
   - 打开设置页面
   - 选择AI提供商（通义千问或OpenAI）
   - 输入API密钥
   - 选择AI模型

### 使用方法

1. **AI聊天**: 
   - 选择AI角色（EggCat猫娘、创意助手、技术顾问）
   - 开始与AI对话获取创意建议

2. **创意生成**:
   - 在创意生成器页面选择词汇维度
   - 设置生成数量（1-10个）
   - 点击"生成创意"等待AI处理
   - 查看和保存生成的创意方案

3. **设置管理**:
   - 配置不同的AI提供商
   - 管理API密钥
   - 导入/导出词库数据

## 🎨 主要特性

### 创意维度系统
- **🔧 机制 (Mechanisms)**: 游戏核心玩法机制
- **🎭 基调 (Tone)**: 游戏情感氛围和风格
- **👥 角色 (Characters)**: 游戏角色和NPC设定
- **🏞️ 场景 (Scenes)**: 游戏环境和背景设定
- **🎒 物品 (Items)**: 游戏道具和装备系统
- **🎯 目标 (Goals)**: 游戏目标和任务设计
- **⚠️ 限制 (Limitations)**: 游戏规则和约束条件
- **✨ 体验 (Experiences)**: 期望的游戏体验感受

### AI助手角色
- **🐱 EggCat**: 可爱的猫娘AI，提供轻松愉快的创意交流
- **💡 创意助手**: 专业的游戏设计顾问，深度分析创意可行性
- **🔧 技术顾问**: 技术导向的AI，关注实现方案和技术细节

## 📂 项目结构

```
Indienstein/
├── index.html              # 主页面入口
├── styles/                 # 样式文件
│   ├── main.css            # 主要样式和布局
│   └── components.css      # 组件样式
├── scripts/                # JavaScript模块
│   ├── main.js            # 应用入口和初始化
│   ├── ai-service.js      # AI服务管理
│   ├── word-generator.js  # 词汇生成系统
│   └── ui-manager.js      # UI交互管理
└── IndiensteinFromUnity/  # Unity参考项目（仅供参考）
```

## 🛠️ 技术栈

- **前端**: HTML5 + CSS3 + Vanilla JavaScript (ES6+)
- **AI服务**: 通义千问 API、OpenAI API
- **存储**: localStorage (本地存储)
- **架构**: 模块化设计，事件驱动
- **样式**: CSS Grid + Flexbox，玻璃拟态设计

## 🚀 开发路线图

### ✅ 已完成
- [x] 基础Web界面和响应式设计
- [x] AI聊天功能（流式/非流式）
- [x] 多维度词汇生成系统
- [x] 创意生成和批量处理
- [x] 本地存储和设置管理
- [x] 三种AI角色支持

### 🔄 进行中
- [ ] 性能优化和代码重构
- [ ] 更多AI提供商集成
- [ ] 词库扩展和管理工具

### 📋 计划中
- [ ] 用户账户系统
- [ ] 创意分享社区
- [ ] 插件系统支持
- [ ] 移动端PWA应用
- [ ] 多语言支持

## 🤝 贡献指南

欢迎提出建议和贡献代码！

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📝 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 👤 作者

**JtheWL (术士木星)**
- GitHub: [@JupiterTheWarlock](https://github.com/JupiterTheWarlock)

## 🙏 致谢

- 各大AI服务提供商的技术支持
- 开源社区的贡献和灵感
- 所有使用和反馈的用户们

---

⭐ 如果这个项目对您有帮助，请给它一个 star！让更多开发者发现这个有趣的工具～