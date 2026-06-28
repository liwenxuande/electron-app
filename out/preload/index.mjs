import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("userAPI", {
  /** 分页查询用户列表（含模糊搜索） */
  getUserList: (params) => {
    return ipcRenderer.invoke("user:list", params);
  },
  /** 根据ID查询单条用户 */
  getUserById: (id) => {
    return ipcRenderer.invoke("user:getById", id);
  },
  /** 新增用户 */
  createUser: (data) => {
    return ipcRenderer.invoke("user:create", data);
  },
  /** 编辑用户（传入ID和新数据） */
  updateUser: (id, data) => {
    return ipcRenderer.invoke("user:update", id, data);
  },
  /** 删除用户 */
  deleteUser: (id) => {
    return ipcRenderer.invoke("user:delete", id);
  }
});
