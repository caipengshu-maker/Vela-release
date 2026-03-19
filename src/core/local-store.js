import fs from "node:fs/promises";
import path from "node:path";

export class LocalStore {
  constructor(rootDir) {
    this.rootDir = rootDir;
  }

  resolve(...segments) {
    return path.join(this.rootDir, ...segments);
  }

  async ensureDir(...segments) {
    await fs.mkdir(this.resolve(...segments), { recursive: true });
  }

  async readJson(relativePath, fallbackValue) {
    try {
      const raw = await fs.readFile(this.resolve(relativePath), "utf8");
      return JSON.parse(raw);
    } catch (error) {
      if (error.code === "ENOENT") {
        return structuredClone(fallbackValue);
      }

      throw error;
    }
  }

  async writeJson(relativePath, value) {
    const fullPath = this.resolve(relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }

  async appendJsonLine(relativePath, value) {
    const fullPath = this.resolve(relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.appendFile(fullPath, `${JSON.stringify(value)}\n`, "utf8");
  }
}
