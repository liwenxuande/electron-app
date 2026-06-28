import { app, ipcMain, BrowserWindow, shell } from "electron";
import path from "path";
import dayjs from "dayjs";
import winston from "winston";
import fs from "fs";
import Database from "better-sqlite3";
import PQueue from "p-queue";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    // 控制台输出（立即可用）
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] [${level}] ${message}`;
        })
      )
    })
  ]
});
function initFileTransport() {
  const logsDir = path.join(app.getPath("userData"), "logs");
  fs.mkdirSync(logsDir, { recursive: true });
  logger.add(
    new winston.transports.File({
      filename: path.join(logsDir, "app.log"),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    })
  );
}
class UserService {
  repository;
  dbManager;
  constructor(repository, dbManager) {
    this.repository = repository;
    this.dbManager = dbManager;
  }
  /**
   * 参数校验
   * @returns 校验通过返回 null，失败返回错误消息字符串
   */
  validateUserInput(data) {
    const { name, phone, address } = data;
    if (!name || name.trim() === "") {
      return "姓名不能为空";
    }
    if (name.length > 50) {
      return "姓名长度不能超过50个字符";
    }
    if (!phone || phone.trim() === "") {
      return "手机号不能为空";
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return "手机号格式不正确（11位，1开头）";
    }
    if (!address || address.trim() === "") {
      return "地址不能为空";
    }
    if (address.length > 200) {
      return "地址长度不能超过200个字符";
    }
    return null;
  }
  /** 成功的返回 */
  success(data, msg = "操作成功") {
    return { code: 0, data, msg };
  }
  /** 失败的返回 */
  fail(msg) {
    return { code: -1, data: null, msg };
  }
  /**
   * 新增用户（事务包裹）
   */
  async createUser(input) {
    const validateError = this.validateUserInput(input);
    if (validateError) {
      return this.fail(validateError);
    }
    try {
      const createTime = dayjs().format("YYYY-MM-DD HH:mm:ss");
      await this.dbManager.transaction(() => {
        this.repository.insert(input.name.trim(), input.phone.trim(), input.address.trim(), createTime);
      });
      logger.info(`新增用户成功: ${input.name}`);
      return this.success(null, "新增成功");
    } catch (error) {
      logger.error(`新增用户失败: ${error.message}`);
      return this.fail(`新增失败: ${error.message}`);
    }
  }
  /**
   * 编辑用户（事务包裹）
   */
  async updateUser(id, input) {
    const validateError = this.validateUserInput(input);
    if (validateError) {
      return this.fail(validateError);
    }
    try {
      const existing = this.repository.selectById(id);
      if (!existing) {
        return this.fail("该用户不存在");
      }
      await this.dbManager.transaction(() => {
        this.repository.update(id, input.name.trim(), input.phone.trim(), input.address.trim());
      });
      logger.info(`编辑用户成功: id=${id}`);
      return this.success(null, "编辑成功");
    } catch (error) {
      logger.error(`编辑用户失败: ${error.message}`);
      return this.fail(`编辑失败: ${error.message}`);
    }
  }
  /**
   * 删除用户（单条语句，不需事务）
   */
  async deleteUser(id) {
    try {
      const existing = this.repository.selectById(id);
      if (!existing) {
        return this.fail("该用户不存在");
      }
      await this.dbManager.run("DELETE FROM user WHERE id = ?", [id]);
      logger.info(`删除用户成功: id=${id}`);
      return this.success(null, "删除成功");
    } catch (error) {
      logger.error(`删除用户失败: ${error.message}`);
      return this.fail(`删除失败: ${error.message}`);
    }
  }
  /**
   * 分页查询用户列表（含模糊搜索）
   */
  getUserList(params) {
    try {
      const searchName = params.searchName || "";
      const page = params.page || 1;
      const pageSize = params.pageSize || 10;
      const result = this.repository.selectList(searchName, page, pageSize);
      return this.success(result, "查询成功");
    } catch (error) {
      logger.error(`查询用户列表失败: ${error.message}`);
      return this.fail(`查询失败: ${error.message}`);
    }
  }
  /**
   * 根据ID查询单条用户
   */
  getUserById(id) {
    try {
      const user = this.repository.selectById(id);
      if (!user) {
        return this.fail("用户不存在");
      }
      return this.success(user, "查询成功");
    } catch (error) {
      logger.error(`查询用户详情失败: ${error.message}`);
      return this.fail(`查询失败: ${error.message}`);
    }
  }
}
class UserRepository {
  dbManager;
  constructor(dbManager) {
    this.dbManager = dbManager;
  }
  /**
   * 新增用户
   * @returns 插入结果（含 lastInsertRowid）
   */
  insert(name, phone, address, createTime) {
    return this.dbManager.getDb().prepare(`
      INSERT INTO user (name, phone, address, create_time)
      VALUES (?, ?, ?, ?)
    `).run(name, phone, address, createTime);
  }
  /** 根据ID查询单条用户 */
  selectById(id) {
    return this.dbManager.get(
      "SELECT * FROM user WHERE id = ?",
      [id]
    );
  }
  /**
   * 分页查询 + 模糊搜索姓名
   * @param searchName 搜索关键字（空字符串表示不筛选）
   * @param page       当前页码（从1开始）
   * @param pageSize   每页条数
   */
  selectList(searchName, page, pageSize) {
    const offset = (page - 1) * pageSize;
    const likePattern = `%${searchName}%`;
    const totalRow = this.dbManager.get(
      `SELECT COUNT(*) as count FROM user WHERE name LIKE ?`,
      [likePattern]
    );
    const total = totalRow ? totalRow.count : 0;
    const list = this.dbManager.all(
      `SELECT * FROM user WHERE name LIKE ? ORDER BY id DESC LIMIT ? OFFSET ?`,
      [likePattern, pageSize, offset]
    );
    return { list, total };
  }
  /**
   * 更新用户
   * @returns 更新结果
   */
  update(id, name, phone, address) {
    return this.dbManager.getDb().prepare(`
      UPDATE user SET name = ?, phone = ?, address = ? WHERE id = ?
    `).run(name, phone, address, id);
  }
  /** 根据ID删除用户 */
  deleteById(id) {
    return this.dbManager.getDb().prepare("DELETE FROM user WHERE id = ?").run(id);
  }
}
class DbManager {
  /** 单例实例 */
  static instance = null;
  /** SQLite数据库连接 */
  db = null;
  /** 串行写队列（concurrency=1），避免 database is locked */
  writeQueue;
  constructor() {
    this.writeQueue = new PQueue({ concurrency: 1 });
  }
  /** 获取全局唯一单例 */
  static getInstance() {
    if (!DbManager.instance) {
      DbManager.instance = new DbManager();
    }
    return DbManager.instance;
  }
  /**
   * 初始化数据库：创建连接、开启WAL、建表
   * @param dbPath 数据库文件路径（通常为 userData/data.db）
   */
  init(dbPath) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        phone       TEXT    NOT NULL,
        address     TEXT    NOT NULL,
        create_time TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      )
    `);
    logger.info("数据库初始化完成，WAL模式已开启");
  }
  /** 获取数据库实例（内部使用，确保已初始化） */
  getDb() {
    if (!this.db) {
      throw new Error("数据库尚未初始化，请先调用 init()");
    }
    return this.db;
  }
  /**
   * 写入操作（INSERT/UPDATE/DELETE）—— 进入串行写队列
   * @param sql     SQL语句，使用 ? 占位符
   * @param params  参数数组
   * @returns       执行结果 { changes, lastInsertRowid }
   */
  async run(sql, params = []) {
    return this.writeQueue.add(() => {
      logger.info(`[SQL] ${sql} | params: ${JSON.stringify(params)}`);
      return this.getDb().prepare(sql).run(...params);
    });
  }
  /**
   * 查询单行数据（只读操作，不走队列）
   * @param sql     SQL语句，使用 ? 占位符
   * @param params  参数数组
   * @returns       查询结果或 undefined
   */
  get(sql, params = []) {
    logger.info(`[SQL] ${sql} | params: ${JSON.stringify(params)}`);
    return this.getDb().prepare(sql).get(...params);
  }
  /**
   * 查询多行数据（只读操作，不走队列）
   * @param sql     SQL语句，使用 ? 占位符
   * @param params  参数数组
   * @returns       查询结果数组
   */
  all(sql, params = []) {
    logger.info(`[SQL] ${sql} | params: ${JSON.stringify(params)}`);
    return this.getDb().prepare(sql).all(...params);
  }
  /**
   * 事务包装（走串行写队列，保证原子性）
   * @param fn 在事务中执行的函数，接收 db 实例
   * @returns  函数返回值
   */
  async transaction(fn) {
    return this.writeQueue.add(() => {
      const db = this.getDb();
      const txn = db.transaction(() => {
        return fn(db);
      });
      return txn();
    });
  }
}
function registerUserController() {
  const dbManager = DbManager.getInstance();
  const repository = new UserRepository(dbManager);
  const service = new UserService(repository, dbManager);
  ipcMain.handle("user:list", async (_event, params) => {
    try {
      logger.info(`[IPC] user:list 收到请求: ${JSON.stringify(params)}`);
      return service.getUserList(params);
    } catch (error) {
      logger.error(`[IPC] user:list 异常: ${error.message}`);
      return { code: -1, data: null, msg: `系统异常: ${error.message}` };
    }
  });
  ipcMain.handle("user:getById", async (_event, id) => {
    try {
      logger.info(`[IPC] user:getById 收到请求: id=${id}`);
      return service.getUserById(id);
    } catch (error) {
      logger.error(`[IPC] user:getById 异常: ${error.message}`);
      return { code: -1, data: null, msg: `系统异常: ${error.message}` };
    }
  });
  ipcMain.handle("user:create", async (_event, data) => {
    try {
      logger.info(`[IPC] user:create 收到请求: ${JSON.stringify(data)}`);
      return await service.createUser(data);
    } catch (error) {
      logger.error(`[IPC] user:create 异常: ${error.message}`);
      return { code: -1, data: null, msg: `系统异常: ${error.message}` };
    }
  });
  ipcMain.handle("user:update", async (_event, id, data) => {
    try {
      logger.info(`[IPC] user:update 收到请求: id=${id}, data=${JSON.stringify(data)}`);
      return await service.updateUser(id, data);
    } catch (error) {
      logger.error(`[IPC] user:update 异常: ${error.message}`);
      return { code: -1, data: null, msg: `系统异常: ${error.message}` };
    }
  });
  ipcMain.handle("user:delete", async (_event, id) => {
    try {
      logger.info(`[IPC] user:delete 收到请求: id=${id}`);
      return await service.deleteUser(id);
    } catch (error) {
      logger.error(`[IPC] user:delete 异常: ${error.message}`);
      return { code: -1, data: null, msg: `系统异常: ${error.message}` };
    }
  });
  logger.info("User IPC控制器注册完成");
}
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
let mainWindow = null;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 800,
    minHeight: 500,
    title: "人员管理系统",
    webPreferences: {
      // 预加载脚本：在渲染进程中安全暴露API
      preload: path.join(__dirname, "../preload/index.js"),
      // 安全隔离：禁止渲染进程直接访问 Node API
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  mainWindow.on("page-title-updated", (event) => {
    event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });
  if (process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  logger.info("主窗口创建完成");
}
app.whenReady().then(() => {
  initFileTransport();
  const dbPath = path.join(app.getPath("userData"), "data.db");
  DbManager.getInstance().init(dbPath);
  registerUserController();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  logger.info("应用启动完成");
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("before-quit", () => {
  logger.info("应用即将退出");
});
