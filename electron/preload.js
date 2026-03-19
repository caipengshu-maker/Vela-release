import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("vela", {
  bootstrap: () => ipcRenderer.invoke("vela:bootstrap"),
  sendMessage: (message) => ipcRenderer.invoke("vela:send-message", message)
});
