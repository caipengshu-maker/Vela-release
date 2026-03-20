import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("vela", {
  bootstrap: () => ipcRenderer.invoke("vela:bootstrap"),
  sendMessage: (message) => ipcRenderer.invoke("vela:send-message", message),
  completeOnboarding: (payload) =>
    ipcRenderer.invoke("vela:complete-onboarding", payload),
  setVoiceMode: (enabled) => ipcRenderer.invoke("vela:set-voice-mode", enabled),
  setThinkingMode: (mode) => ipcRenderer.invoke("vela:set-thinking-mode", mode),
  interruptOutput: () => ipcRenderer.invoke("vela:interrupt-output"),
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
