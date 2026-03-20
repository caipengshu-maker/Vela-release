function wait(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function estimateDuration(text) {
  const normalizedLength = String(text || "").trim().length;
  return Math.max(220, Math.min(1300, normalizedLength * 38));
}

class PlaceholderTtsSession {
  constructor({ onEvent }) {
    this.onEvent = onEvent;
    this.closed = false;
    this.started = false;
    this.pendingWork = Promise.resolve();
  }

  emit(event) {
    if (!this.closed || event.type === "done" || event.type === "error") {
      this.onEvent?.(event);
    }
  }

  async start() {
    if (this.started || this.closed) {
      return;
    }

    this.started = true;
    this.emit({
      type: "status",
      status: "placeholder"
    });
  }

  async pushText(text, meta = {}) {
    if (this.closed || !String(text || "").trim()) {
      return;
    }

    await this.start();

    const task = this.pendingWork.then(async () => {
      this.emit({
        type: "status",
        status: "queued"
      });
      this.emit({
        type: "segment-started",
        text,
        segmentId: meta.segmentId || null
      });
      this.emit({
        type: "status",
        status: "speaking"
      });
      await wait(estimateDuration(text));
      this.emit({
        type: "segment-complete",
        text,
        segmentId: meta.segmentId || null,
        isFinal: true
      });
      this.emit({
        type: "status",
        status: "ready"
      });
    });

    this.pendingWork = task.catch(() => {});
    await task;
  }

  async finish() {
    if (this.closed) {
      return;
    }

    await this.pendingWork;
    this.emit({
      type: "done"
    });
    this.closed = true;
  }

  async cancel() {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.emit({
      type: "done",
      cancelled: true
    });
  }
}

export const placeholderTtsProvider = {
  id: "placeholder",
  label: "Placeholder TTS",
  defaultApiKeyEnv: "",
  requiresApiKey: false,
  capabilities: {
    streamAudio: false,
    acceptsTextDeltas: true
  },
  createSession({ onEvent }) {
    return new PlaceholderTtsSession({ onEvent });
  }
};
