import path from "node:path";
import fs from "node:fs";
import https from "node:https";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, screen } from "electron";
import { VelaCore } from "../src/core/vela-core.js";

function fetchIpLocation() {
  return new Promise((resolve) => {
    const req = https.get(
      "https://ip-api.com/json/?fields=lat,lon,city,status",
      { timeout: 5000 },
      (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.status === "success" && Number.isFinite(json.lat)) {
              resolve({ lat: json.lat, lon: json.lon, city: json.city });
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const isSmokeTest = process.argv.includes("--smoke-test");
const windowStatePath = path.join(rootDir, ".vela-data", "window-state.json");
const electronDataDir = path.join(rootDir, ".vela-data", "electron");
const electronSessionDir = path.join(electronDataDir, "session");
const WINDOW_STATE_DEBOUNCE_MS = 500;

let mainWindow;
let core;
let smokeTimer;
let isFarewellClosing = false;
let windowStateSaveTimer = null;

fs.mkdirSync(electronSessionDir, { recursive: true });
app.setPath("userData", electronDataDir);
app.setPath("sessionData", electronSessionDir);

function toRoundedInteger(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.round(numericValue) : null;
}

function isBoundsWithinDisplay(bounds, display) {
  const workArea = display?.workArea;

  if (!workArea) {
    return false;
  }

  return (
    bounds.x >= workArea.x &&
    bounds.y >= workArea.y &&
    bounds.x + bounds.width <= workArea.x + workArea.width &&
    bounds.y + bounds.height <= workArea.y + workArea.height
  );
}

function buildDefaultWindowBounds(configWindow = {}) {
  const width = Math.max(320, toRoundedInteger(configWindow.width) ?? 1320);
  const height = Math.max(240, toRoundedInteger(configWindow.height) ?? 860);
  const minWidth = Math.max(320, toRoundedInteger(configWindow.minWidth) ?? width);
  const minHeight = Math.max(240, toRoundedInteger(configWindow.minHeight) ?? height);
  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay?.workArea || {
    x: 0,
    y: 0,
    width,
    height
  };
  const safeWidth = Math.min(Math.max(width, minWidth), workArea.width);
  const safeHeight = Math.min(Math.max(height, minHeight), workArea.height);

  return {
    x: workArea.x + Math.round((workArea.width - safeWidth) / 2),
    y: workArea.y + Math.round((workArea.height - safeHeight) / 2),
    width: safeWidth,
    height: safeHeight
  };
}

function normalizeWindowBounds(candidate, configWindow = {}) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const minWidth = Math.max(320, toRoundedInteger(configWindow.minWidth) ?? 1120);
  const minHeight = Math.max(240, toRoundedInteger(configWindow.minHeight) ?? 720);
  const width = toRoundedInteger(candidate.width);
  const height = toRoundedInteger(candidate.height);
  const x = toRoundedInteger(candidate.x);
  const y = toRoundedInteger(candidate.y);

  if (
    width === null ||
    height === null ||
    x === null ||
    y === null ||
    width < minWidth ||
    height < minHeight
  ) {
    return null;
  }

  const bounds = { x, y, width, height };
  const display = screen.getDisplayMatching(bounds);

  return isBoundsWithinDisplay(bounds, display) ? bounds : null;
}

function readWindowBounds(configWindow = {}) {
  try {
    const raw = fs.readFileSync(windowStatePath, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeWindowBounds(parsed, configWindow);
  } catch {
    return null;
  }
}

function captureWindowBounds(windowInstance = mainWindow) {
  if (!windowInstance || windowInstance.isDestroyed()) {
    return null;
  }

  const nextBounds = windowInstance.isFullScreen()
    ? windowInstance.getNormalBounds()
    : windowInstance.getBounds();

  return {
    x: Math.round(nextBounds.x),
    y: Math.round(nextBounds.y),
    width: Math.round(nextBounds.width),
    height: Math.round(nextBounds.height)
  };
}

function clearWindowStateSaveTimer() {
  if (windowStateSaveTimer) {
    clearTimeout(windowStateSaveTimer);
    windowStateSaveTimer = null;
  }
}

function persistWindowBounds(windowInstance = mainWindow) {
  if (isSmokeTest) {
    return;
  }

  const nextBounds = captureWindowBounds(windowInstance);

  if (!nextBounds) {
    return;
  }

  try {
    fs.mkdirSync(path.dirname(windowStatePath), { recursive: true });
    fs.writeFileSync(windowStatePath, JSON.stringify(nextBounds, null, 2), "utf8");
  } catch (error) {
    console.warn("[vela:main] failed to save window state", error?.message || error);
  }
}

function scheduleWindowBoundsSave(windowInstance = mainWindow) {
  if (isSmokeTest) {
    return;
  }

  clearWindowStateSaveTimer();
  windowStateSaveTimer = setTimeout(() => {
    windowStateSaveTimer = null;
    persistWindowBounds(windowInstance);
  }, WINDOW_STATE_DEBOUNCE_MS);
}

function getWindowState(windowInstance = mainWindow) {
  return {
    fullscreen: Boolean(windowInstance && !windowInstance.isDestroyed() && windowInstance.isFullScreen())
  };
}

function emitWindowState(windowInstance = mainWindow) {
  if (!windowInstance || windowInstance.isDestroyed()) {
    return;
  }

  windowInstance.webContents.send("vela:event", {
    type: "window-state",
    window: getWindowState(windowInstance)
  });
}

function setFullscreen(nextValue) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return getWindowState(null);
  }

  const shouldFullscreen = typeof nextValue === "boolean"
    ? nextValue
    : !mainWindow.isFullScreen();

  mainWindow.setFullScreen(shouldFullscreen);
  const nextState = getWindowState(mainWindow);
  emitWindowState(mainWindow);
  return nextState;
}

function bindWindowRuntimeEvents(windowInstance) {
  const pushWindowState = () => emitWindowState(windowInstance);
  const scheduleWindowStateSave = () => scheduleWindowBoundsSave(windowInstance);

  windowInstance.on("enter-full-screen", pushWindowState);
  windowInstance.on("leave-full-screen", pushWindowState);
  windowInstance.once("ready-to-show", pushWindowState);
  windowInstance.webContents.on("did-finish-load", pushWindowState);
  windowInstance.on("move", scheduleWindowStateSave);
  windowInstance.on("resize", scheduleWindowStateSave);
  windowInstance.on("close", (event) => {
    clearWindowStateSaveTimer();
    persistWindowBounds(windowInstance);

    if (isFarewellClosing || isSmokeTest || windowInstance.isDestroyed()) {
      return;
    }

    event.preventDefault();
    isFarewellClosing = true;

    try {
      windowInstance.webContents.send("vela:event", {
        type: "farewell"
      });
    } catch {
      windowInstance.destroy();
      return;
    }

    setTimeout(() => {
      if (!windowInstance.isDestroyed()) {
        windowInstance.destroy();
      }
    }, 500);
  });
  windowInstance.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") {
      return;
    }

    const key = String(input.key || "").toLowerCase();

    if (key === "f11" || (key === "f" && input.control)) {
      event.preventDefault();
      setFullscreen();
      return;
    }

    if (key === "escape" && windowInstance.isFullScreen()) {
      event.preventDefault();
      setFullscreen(false);
    }
  });
  windowInstance.on("closed", () => {
    clearWindowStateSaveTimer();

    if (mainWindow === windowInstance) {
      mainWindow = null;
    }
  });
}

async function createMainWindow() {
  isFarewellClosing = false;
  core = new VelaCore({ rootDir, userDataDir: app.getPath("userData") });
  await core.initialize();

  // IP-based location: runs async, does not block startup
  fetchIpLocation().then((loc) => {
    if (loc) {
      core.cacheBrowserLocation({ lat: loc.lat, lon: loc.lon }).catch(() => {});
    }
  });

  const config = core.getConfig();
  const { width, height, minWidth, minHeight } = config.app.window;
  const savedBounds = readWindowBounds(config.app.window);
  const initialBounds = savedBounds || buildDefaultWindowBounds(config.app.window);

  mainWindow = new BrowserWindow({
    x: initialBounds.x,
    y: initialBounds.y,
    width: initialBounds.width || width,
    height: initialBounds.height || height,
    minWidth,
    minHeight,
    show: !isSmokeTest,
    backgroundColor: "#f4ebe6",
    title: config.app.name,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  bindWindowRuntimeEvents(mainWindow);

  if (isSmokeTest) {
    smokeTimer = setTimeout(() => {
      console.error("smoke:timeout");
      app.exit(1);
    }, 10000);

    mainWindow.webContents.on(
      "did-fail-load",
      (_event, errorCode, errorDescription) => {
        console.error(`smoke:load-failed ${errorCode} ${errorDescription}`);
        app.exit(1);
      }
    );
  } else {
    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
    });
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(rootDir, "dist", "index.html"));
  }

  if (isSmokeTest) {
    clearTimeout(smokeTimer);
    console.log("smoke:window-ready");
    app.exit(0);
  }
}

ipcMain.handle("vela:bootstrap", async () => {
  return core.getBootstrapState();
});

ipcMain.handle("vela:read-binary-file", async (_event, filePath) => {
  const targetPath = String(filePath || "").trim();

  if (!targetPath) {
    throw new Error("binary file path is required");
  }

  return fs.promises.readFile(targetPath);
});

ipcMain.handle("vela:send-message", async (_event, message) => {
  const sendEvent = (payload) => {
    _event.sender.send("vela:event", payload);
  };

  return core.handleUserMessage(message, {
    onEvent: sendEvent
  });
});

ipcMain.handle("vela:switch-model", async (_event, modelId) => {
  return core.switchModel(modelId);
});

ipcMain.handle("vela:cache-location", async (_event, location) => {
  return core.cacheBrowserLocation(location);
});

ipcMain.handle("vela:proactive-open", async (_event) => {
  const sendEvent = (payload) => {
    _event.sender.send("vela:event", payload);
  };

  return core.maybeProactiveOpen({
    onEvent: sendEvent
  });
});

ipcMain.handle("vela:proactive-trigger", async (_event) => {
  const sendEvent = (payload) => {
    _event.sender.send("vela:event", payload);
  };

  return core.maybeProactiveTrigger({
    onEvent: sendEvent
  });
});

ipcMain.handle("vela:complete-onboarding", async (_event, payload) => {
  return core.completeOnboarding(payload);
});

ipcMain.handle("vela:complete-onboarding-v2", async (_event, payload) => {
  return core.completeOnboardingV2(payload);
});

ipcMain.handle("vela:update-settings", async (_event, payload) => {
  return core.updateSettings(payload);
});

ipcMain.handle("vela:set-voice-mode", async (_event, enabled) => {
  console.log("[vela:main] setVoiceMode request", {
    enabled: Boolean(enabled)
  });

  const sendEvent = (payload) => {
    _event.sender.send("vela:event", payload);
  };

  return core.setVoiceMode(enabled, {
    onEvent: sendEvent
  });
});

ipcMain.handle("vela:set-thinking-mode", async (_event, mode) => {
  return core.setThinkingMode(mode);
});

ipcMain.handle("vela:interrupt-output", async (_event) => {
  const sendEvent = (payload) => {
    _event.sender.send("vela:event", payload);
  };

  return core.interruptOutput({
    onEvent: sendEvent
  });
});

ipcMain.handle("vela:bridge-diary", async (_event) => {
  const note = await core.generateBridgeDiaryNote();
  return {
    bridgeDiaryNote: note || ""
  };
});

ipcMain.handle("vela:get-window-state", async () => {
  return getWindowState();
});

ipcMain.handle("vela:is-fullscreen", async () => {
  return Boolean(getWindowState().fullscreen);
});

ipcMain.handle("vela:toggle-fullscreen", async () => {
  return setFullscreen();
});

ipcMain.handle("vela:set-fullscreen", async (_event, nextValue) => {
  return setFullscreen(typeof nextValue === "boolean" ? nextValue : undefined);
});

app.whenReady().then(async () => {
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("before-quit", () => {
  clearWindowStateSaveTimer();
  persistWindowBounds(mainWindow);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
