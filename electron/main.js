import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain } from "electron";
import { VelaCore } from "../src/core/vela-core.js";

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

ipcMain.handle("vela:send-message", async (_event, message) => {
  return core.handleUserMessage(message);
});

ipcMain.handle("vela:complete-onboarding", async (_event, payload) => {
  return core.completeOnboarding(payload);
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
