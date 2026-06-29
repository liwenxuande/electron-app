# 授权控制系统 — 实施计划

## 涉及文件清单

### 新建文件

```
src/main/license/
├── machine-id.ts          # 硬件指纹采集
├── crypto.ts              # Ed25519 签名验证 + 公钥常量
├── license-store.ts       # 授权文件/试用记录的读写
├── license-validator.ts   # 验证入口：签名 + 机器码匹配 + 过期检查
├── license-window.ts      # 激活窗口 (BrowserWindow)
└── index.ts               # 统一导出 startupLicenseCheck()

src/renderer/src/views/
└── LicenseActivate.vue    # 激活页面 UI

src/renderer/
└── activate.html          # 激活窗口的 HTML 入口

dev-tool/
└── generate-license.ts    # 开发者授权码生成脚本 (独立，不入库)

src/preload/
└── license-preload.ts     # 激活窗口专用的 preload
```

### 修改文件

```
src/main/index.ts           # 启动时插入 license check 逻辑
src/preload/index.ts        # 新增 license 相关 IPC 桥接
src/preload/index.d.ts      # 新增 license API 类型声明
src/renderer/src/env.d.ts   # 同上
electron.vite.config.ts     # 新增 activate.html 的 renderer 构建入口
.gitignore                  # 排除 dev-tool/keypair.json
```

---

## 实施步骤

### 第 1 步：机器码采集模块 `machine-id.ts`

- 采集 4 个硬件维度：主板序列号、CPU ID、系统盘序列号、主网卡 MAC
- Windows 用 `child_process.execSync` 调 wmic 命令
- 每个维度独立 SHA256，取结果前 8 位作为指纹
- 整体机器码 = SHA256(4 个指纹用 `|` 拼接)，Base32 编码，每 4 位加 `-` 分隔
- 导出 `{ getMachineId(): string, getFingerprints(): string[] }`

### 第 2 步：密码学模块 `crypto.ts`

- 使用 Node.js 内置 `crypto` 模块，Ed25519 算法
- 公钥硬编码为常量（拆成 2-3 段拼接，简单混淆）
- 导出 `verifySignature(payload: string, signature: Buffer): boolean`
- 授权码格式：`Base64(payloadJSON) + "." + Base64(signature)`

### 第 3 步：授权存储模块 `license-store.ts`

- 授权文件：`app.getPath('userData')/license.dat`，存原始授权码字符串
- 试用记录双位置（写入时同时写，读取时任意一个命中即可）：
  - `app.getPath('userData')/trial.dat`
  - Windows 注册表 `HKCU\Software\<AppName>\Trial`（用 `reg query/add` 命令）
- 导出：`saveLicense()`, `loadLicense()`, `saveTrial()`, `loadTrial()`

### 第 4 步：验证模块 `license-validator.ts`

```
validateLicense(licenseCode):
  1. 解析 Base64，拆出 payload + signature
  2. 验证签名
  3. 提取 payload 中的 fingerprints（4 个），与当前机器比对，≥3/4 匹配即通过
  4. 检查过期时间（如果有）

checkTrial():
  → 返回 { status: 'active'|'expired'|'none', remainingDays?, machineCode }

startTrial(machineCode):
  → 写入双位置试用记录
```

### 第 5 步：激活窗口 `license-window.ts`

- 复用 splash window 的模式：独立 BrowserWindow（~500×400，frameless）
- 加载 `activate.html`，preload 桥接 license IPC
- 窗口无边框，居中显示

### 第 6 步：激活页面 `LicenseActivate.vue`

- 展示机器码（文本 + 复制按钮）
- 授权码输入框 + 激活按钮
- 试用状态显示（剩余天数 + "继续试用"按钮）
- 状态反馈：加载中 / 成功 / 失败提示
- 激活成功 → 通知 main process 关闭激活窗口，启动主窗口

### 第 7 步：IPC 通道设计

| IPC Channel | 方向 | 说明 |
|---|---|---|
| `license:getMachineId` | renderer→main | 获取当前机器码 |
| `license:activate` | renderer→main | 传入授权码，返回校验结果 |
| `license:getStatus` | renderer→main | 获取当前授权/试用状态 |
| `license:continueTrial` | renderer→main | 用户点击"继续试用"，关闭激活窗口 |

### 第 8 步：启动流程改造 `main/index.ts`

改造 `app.whenReady()` 中的启动序列：

```
app.whenReady()
  → initFileTransport()
  → initDb()
  → registerUserController()
  → licenseCheck = checkLicenseOrTrial()
  → if licenseCheck === 'valid':
      createSplashWindow() → createWindow()  // 原流程
  → else:
      createLicenseWindow()
      // 激活窗口关闭时触发回调，再次检查授权状态
      // 通过 → createSplashWindow() → createWindow()
      // 未通过 → app.quit()
```

### 第 9 步：构建配置修改

- `electron.vite.config.ts`：新增 `activate` 入口（参考现有 renderer 配置）
- `activate.html`：参考 `splash.html`，极简结构
- preload：新增 `license-preload.ts` 给激活窗口用

### 第 10 步：开发者工具 `dev-tool/generate-license.ts`

- 独立的 Node.js 脚本
- 从同目录 `keypair.json` 读取私钥（首次运行时自动生成并提示保存路径）
- CLI 参数：`--machine-code`（必填）、`--expiry`（可选，YYYY-MM-DD）、`--tier`（可选）
- 输出：单行授权码字符串
- 此目录加入 `.gitignore`

---

## 关键设计决策

1. **激活窗口 vs 页面内弹窗**：选独立 BrowserWindow，因为未授权时主窗口不应加载（避免用户通过 DevTools 绕过）
2. **公钥混淆**：拆分 2-3 段字符串拼接，简单防搜索替换
3. **试用防重装**：userData + 注册表双写即可
4. **零新增依赖**：完全基于 Node.js 内置 `crypto`、`child_process`、`fs` 模块

---

## 验证方式

1. 构建后首次启动 → 弹出激活窗口，显示机器码
2. 点击"继续试用" → 进入主界面
3. 修改系统时间到 15 天后 → 重新打开，试用过期
4. 用 dev-tool 生成授权码 → 粘贴激活 → 成功进入
5. 复制授权文件到另一台机器 → 应拒绝（机器码不匹配）
6. 卸载重装 → 试用剩余天数不变（不重置）
