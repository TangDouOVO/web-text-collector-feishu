# 飞书文档收藏助手 - 浏览器插件

一款可以将网页文本快速收藏到飞书文档的浏览器插件，支持Chrome、Edge等主流浏览器。 
[项目详情](https://forum.trae.cn/t/topic/9792?u=糖逗)

## 功能特性

- ✅ 选中文本自动显示收藏按钮
- ✅ 一键收藏到指定飞书文档
- ✅ 自动记录原文内容、来源链接和收藏时间
- ✅ 收藏成功显示可点击的文档链接
- ✅ 详细的错误提示和调试信息
- ✅ 加载动画提升用户体验

## 快速开始

### 1. 准备工作

#### 创建飞书企业自建应用

1. 访问 [飞书开放平台](https://open.feishu.cn)
2. 登录后进入「开发者后台」
3. 点击「创建应用」→ 选择「企业自建应用」
4. 填写应用名称和描述，完成创建

#### 获取 App ID 和 App Secret

1. 在应用详情页，进入「凭证与基础信息」
2. 复制 `App ID` 和 `App Secret`

#### 配置应用权限

1. 进入「权限管理」页面
2. 搜索并添加以下权限：
   - `docx:document` (文档读写)
   - `docx:document.content` (文档内容读写)
   - `wiki:space` (知识空间读写)
   - `wiki:node` (节点读写)
3. 点击「申请权限」

#### 创建飞书知识库文档

1. 在飞书中创建一个新的知识库文档或使用现有文档
2. 从文档URL中获取文档Token（node_token）
   - 示例URL: `https://my.feishu.cn/wiki/UvfowWBeQiyJjIkpR91c3QgQn?fromScene=spaceOverview`
   - 文档Token: `UvfowWBeQiyJjIkpR91c3QgQn`

### 2. 安装插件

#### 开发者模式安装

1. 下载或克隆本项目代码
2. 打开Chrome/Edge浏览器，访问 `chrome://extensions/`
3. 开启右上角的「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择本项目文件夹

### 3. 配置插件

1. 点击浏览器工具栏中的插件图标
2. 在配置页面填写：
   - **App ID**: 飞书应用的App ID
   - **App Secret**: 飞书应用的App Secret
   - **文档 Token**: 目标飞书知识库文档的node_token（从URL中获取）
3. 点击「保存配置」

## 使用方法

1. 在任意网页中，用鼠标选中要收藏的文本
2. 选中文本上方会出现「收藏」按钮
3. 点击「收藏」按钮
4. 等待收藏完成（会显示加载动画）
5. 收藏成功后会显示提示，包含文档链接

## 文件结构

```
/workspace/
├── manifest.json          # 插件配置文件
├── background.js          # 后台服务脚本
├── content.js             # 内容脚本
├── content.css            # 内容脚本样式
├── popup.html             # 弹出页面
├── popup.css              # 弹出页面样式
├── popup.js               # 弹出页面脚本
├── icons/                 # 插件图标
│   ├── icon16.svg
│   ├── icon48.svg
│   └── icon128.svg
├── generate-icons.js      # 图标生成脚本
└── README.md              # 说明文档
```

## 技术实现

### 核心功能模块

1. **内容脚本 ([content.js](file:///workspace/content.js))**
   - 监听文本选择事件
   - 显示/隐藏收藏按钮
   - 处理收藏按钮点击
   - 显示成功/失败消息

2. **后台脚本 ([background.js](file:///workspace/background.js))**
   - 管理飞书API访问凭证
   - 实现文档内容追加功能
   - 处理消息通信

3. **弹出页面 ([popup.html](file:///workspace/popup.html))**
   - 用户配置界面
   - 状态显示
   - 使用说明

### 飞书API集成

- 使用 Tenant Access Token 进行身份验证
- 调用 Docx API 追加文档内容
- Token 自动刷新机制

## 常见问题

### Q: 收藏失败怎么办？
A: 请检查：
1. App ID 和 App Secret 是否正确
2. 文档 Token 是否正确
3. 应用是否已申请所需权限
4. 错误提示中的详细信息

### Q: 如何更换目标文档？
A: 点击插件图标，在配置页面更新「文档 Token」并保存。

### Q: 支持哪些浏览器？
A: 支持 Chrome、Edge、Brave 等基于 Chromium 的浏览器。

## 安全说明

- App Secret 存储在浏览器本地 storage 中
- 不会向第三方服务器发送任何数据
- 仅访问用户指定的飞书文档

## 开发者说明

### 调试插件

1. 在 `chrome://extensions/` 页面点击「Service Worker」查看后台日志
2. 在网页上右键 →「检查」查看内容脚本日志
3. 右键点击插件图标 →「检查弹出内容」查看弹出页面日志

### 权限说明

插件需要以下权限：
- `storage`: 存储用户配置和访问令牌
- `identity`: OAuth授权（当前版本使用 Tenant Access Token）
- `activeTab`: 访问当前标签页
- `scripting`: 注入内容脚本

## 许可证

MIT License
