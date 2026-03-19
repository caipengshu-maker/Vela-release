import path from "node:path";
import { fileURLToPath } from "node:url";
import { VelaCore } from "../src/core/vela-core.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

async function run() {
  const core = new VelaCore({
    rootDir,
    userDataDir: rootDir
  });

  await core.initialize();
  const before = await core.getBootstrapState();
  const initialSummary = before.memoryPeek?.summary || "";
  const probe = `第${Date.now()}次验证：我最近总是睡得很晚，白天也有点飘。`;

  const afterChat = await core.handleUserMessage(probe);

  if (!afterChat.messages.length) {
    throw new Error("chat roundtrip did not produce messages");
  }

  const nextCore = new VelaCore({
    rootDir,
    userDataDir: rootDir
  });
  await nextCore.initialize();
  const afterReload = await nextCore.getBootstrapState();

  if (!afterReload.memoryPeek?.summary) {
    throw new Error("recent summary was not loaded after reload");
  }

  if (afterReload.memoryPeek.summary === initialSummary && initialSummary) {
    throw new Error("recent summary did not update after chat");
  }

  if (!afterReload.welcomeNote.includes("上次我们停在")) {
    throw new Error("welcome note did not include recent summary continuity");
  }

  console.log("verify:core ok");
  console.log(`latest-summary: ${afterReload.memoryPeek.summary}`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
