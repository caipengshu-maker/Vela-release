import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { VelaCore } from "../src/core/vela-core.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Use an isolated temp directory for verify storage so test data
// never pollutes the production memory files in D:/Vela/data.
const verifyTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vela-verify-"));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUpdatedMemoryPeek(core, initialSummary, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  let snapshot = await core.getBootstrapState();

  while (
    Date.now() < deadline &&
    (!snapshot.memoryPeek?.summary || snapshot.memoryPeek.summary === initialSummary)
  ) {
    await sleep(200);
    snapshot = await core.getBootstrapState();
  }

  return snapshot;
}

async function run() {
  const core = new VelaCore({
    rootDir,
    userDataDir: rootDir,
    storageRootOverride: verifyTmpDir
  });

  await core.initialize();
  const before = await core.getBootstrapState();
  const initialSummary = before.memoryPeek?.summary || "";

  if (before.onboarding?.required) {
    await core.completeOnboarding({
      velaName: "Vela",
      userName: "测试用户",
      temperament: "gentle-cool",
      distance: "warm"
    });
  }

  const probe = `第${Date.now()}次验证：我最近总是睡得很晚，白天也有点飘。`;

  const afterChat = await core.handleUserMessage(probe);

  if (!afterChat.messages.length) {
    throw new Error("chat roundtrip did not produce messages");
  }

  const latestAssistant = afterChat.messages.at(-1);

  if (!latestAssistant?.llm?.providerMeta?.adapter) {
    throw new Error("assistant turn is missing normalized provider metadata");
  }

  if (latestAssistant.content !== latestAssistant.llm.text) {
    throw new Error("assistant message content diverged from normalized text");
  }

  if (!Array.isArray(latestAssistant.blocks) || latestAssistant.blocks.length === 0) {
    throw new Error("assistant turn is missing normalized content blocks");
  }

  const nextCore = new VelaCore({
    rootDir,
    userDataDir: rootDir,
    storageRootOverride: verifyTmpDir
  });
  await nextCore.initialize();
  const afterReload = await waitForUpdatedMemoryPeek(nextCore, initialSummary);

  if (!afterReload.memoryPeek?.summary) {
    throw new Error("recent summary was not loaded after reload");
  }

  if (afterReload.memoryPeek.summary === initialSummary && initialSummary) {
    throw new Error("recent summary did not update after chat");
  }

  if (!afterReload.onboarding?.completed) {
    throw new Error("onboarding should be completed during verify flow");
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
