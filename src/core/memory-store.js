const PROFILE_FILE = "memory/profile.json";
const RELATIONSHIP_FILE = "memory/relationship.json";
const SUMMARY_INDEX_FILE = "memory/memory-summary.json";

function defaultProfile() {
  return {
    user: {
      name: "",
      preferences: [],
      notes: []
    },
    vela: {
      personaId: "vela-default"
    }
  };
}

function defaultRelationship() {
  return {
    stage: "warm",
    note: "熟悉，但仍然克制。",
    sharedMoments: []
  };
}

function defaultSummaryIndex() {
  return {
    updatedAt: null,
    recent: []
  };
}

export class MemoryStore {
  constructor(store, config) {
    this.store = store;
    this.config = config;
  }

  async initialize() {
    await this.store.ensureDir("memory", "sessions");
    await this.store.writeJson(
      PROFILE_FILE,
      await this.store.readJson(PROFILE_FILE, defaultProfile())
    );
    await this.store.writeJson(
      RELATIONSHIP_FILE,
      await this.store.readJson(RELATIONSHIP_FILE, defaultRelationship())
    );
    await this.store.writeJson(
      SUMMARY_INDEX_FILE,
      await this.store.readJson(SUMMARY_INDEX_FILE, defaultSummaryIndex())
    );
  }

  async loadMemorySnapshot() {
    const profile = await this.store.readJson(PROFILE_FILE, defaultProfile());
    const relationship = await this.store.readJson(
      RELATIONSHIP_FILE,
      defaultRelationship()
    );
    const summaryIndex = await this.store.readJson(
      SUMMARY_INDEX_FILE,
      defaultSummaryIndex()
    );

    return {
      profile,
      relationship,
      recentSummaries: summaryIndex.recent.slice(
        0,
        this.config.runtime.recentSummaryLimit
      )
    };
  }

  async appendTurnSummary(summary) {
    const day = summary.createdAt.slice(0, 10);
    const relativePath = `memory/sessions/${day}.jsonl`;
    await this.store.appendJsonLine(relativePath, summary);

    const summaryIndex = await this.store.readJson(
      SUMMARY_INDEX_FILE,
      defaultSummaryIndex()
    );
    const recent = [summary, ...(summaryIndex.recent || [])].slice(
      0,
      this.config.runtime.summaryIndexLimit
    );

    await this.store.writeJson(SUMMARY_INDEX_FILE, {
      updatedAt: summary.createdAt,
      recent
    });
  }
}
