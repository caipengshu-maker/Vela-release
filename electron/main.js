import path from "node:path";
import fs from "node:fs";
import https from "node:https";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain } from "electron";
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
const electronDataDir = path.join(rootDir, ".vela-data", "electron");
const electronSessionDir = path.join(electronDataDir, "session");

let mainWindow;
let core;
let smokeTimer;

fs.mkdirSync(electronSessionDir, { recursive: true });
app.setPath("userData", electronDataDir);
app.setPath("sessionData", electronSessionDir);

async function createMainWindow() {
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

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth,
    minHeight,
    show: !isSmokeTest,
    backgroundColor: "#f4ebe6",
    title: config.app.name,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

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

app.whenReady().then(async () => {
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
