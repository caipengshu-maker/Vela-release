const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vela", {
  ipcRenderer: {
    invoke: (channel, payload) => ipcRenderer.invoke(channel, payload)
  },
  bootstrap: () => ipcRenderer.invoke("vela:bootstrap"),
  readBinaryFile: (filePath) =>
    ipcRenderer.invoke("vela:read-binary-file", filePath),
  sendMessage: (message) => ipcRenderer.invoke("vela:send-message", message),
  switchModel: (modelId) => ipcRenderer.invoke("vela:switch-model", modelId),
  cacheLocation: (location) => ipcRenderer.invoke("vela:cache-location", location),
  proactiveOpen: () => ipcRenderer.invoke("vela:proactive-open"),
  proactiveTrigger: () => ipcRenderer.invoke("vela:proactive-trigger"),
  completeOnboarding: (payload) =>
    ipcRenderer.invoke("vela:complete-onboarding", payload),
  setVoiceMode: (enabled) => ipcRenderer.invoke("vela:set-voice-mode", enabled),
  setThinkingMode: (mode) => ipcRenderer.invoke("vela:set-thinking-mode", mode),
  interruptOutput: () => ipcRenderer.invoke("vela:interrupt-output"),
  loadBridgeDiary: () => ipcRenderer.invoke("vela:bridge-diary"),
  getWindowState: () => ipcRenderer.invoke("vela:get-window-state"),
  setFullscreen: (enabled) => ipcRenderer.invoke("vela:set-fullscreen", enabled),
  onEvent: (listener) => {
    const wrappedListener = (_event, payload) => {
      listener(payload);
    };

    ipcRenderer.on("vela:event", wrappedListener);

    return () => {
      ipcRenderer.removeListener("vela:event", wrappedListener);
    };
  }
});
