# XingParty

独立的星派对游戏识别客户端。通用启动器 `DiceTrace-Client` 不再承载游戏识别逻辑；本项目只处理 Lucky Party。

## 架构

- `src/games/lucky-party.ts`：Lucky Party 窗口配置和识别入口。
- `src/games/raw-model-output-parser.ts`：Lucky Party 原始模型输出转换。
- `src/games/recognition-state-machine.ts`：Lucky Party 单局、回合和行动状态机。
- `src/main`：会话、窗口捕获、日志和本地数据等 XingParty 运行时。

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Requirements

- Node.js `22.22.3`
- pnpm

使用 nvm 安装并切换到项目指定的 Node.js 版本：

```bash
nvm install
nvm use
node --version
```

### Install

```bash
$ pnpm install
```

### Development

```bash
$ pnpm dev
```

如需使用模拟识别数据，在项目根目录的 `.env` 中设置：

```dotenv
MOCK_DATA=true
```

修改后重新启动应用。启用后点击“开始识别”会直接播放模拟数据，不会连接游戏窗口或执行截图逻辑。可复制 `.env.example` 作为初始配置；`.env` 属于本地配置，不会提交到 Git。

后端 API 默认为本机 DiceLogBackend，也可以在 `.env` 中配置统一的 API 基址。基址只需填写到 API 版本，具体接口路径由客户端拼接：

```dotenv
XINGPARTY_API_BASE_URL=http://localhost:8000/api/v1
```

修改接口地址后需要重新启动客户端。资源请求由 Electron 主进程发送，因此不会出现在渲染页面 DevTools 的 Network 面板中；请求过程和失败原因会记录在“运行日志”页面。

### Build

```bash
# For windows
$ pnpm build:win

# For macOS
$ pnpm build:mac

# For Linux
$ pnpm build:linux
```
