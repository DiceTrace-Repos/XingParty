# XingParty

独立的星派对游戏识别适配器。通用启动器 `DiceTrace-Client` 不再承载游戏识别逻辑；每个游戏在 `src/games/<game>/adapter.ts` 中实现自己的窗口参数与识别算法。

## 架构

- `src/games/types.ts`：游戏适配器契约。
- `src/games/registry.ts`：适配器注册表，目录中的每个游戏都必须显式注册。
- `src/games/lucky-party/adapter.ts`：星派对适配器（当前保留窗口捕获配置，识别算法可独立迭代）。
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

### Build

```bash
# For windows
$ pnpm build:win

# For macOS
$ pnpm build:mac

# For Linux
$ pnpm build:linux
```
