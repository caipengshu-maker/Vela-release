function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function createWebSpeechProvider() {
  let recognition = null;
  let listening = false;
  let finished = false;

  function cleanup() {
    recognition = null;
    listening = false;
    finished = false;
  }

  function stop() {
    if (!recognition) {
      cleanup();
      return;
    }

    const currentRecognition = recognition;
    recognition = null;
    listening = false;
    finished = true;

    currentRecognition.onresult = null;
    currentRecognition.onerror = null;
    currentRecognition.onend = null;

    try {
      currentRecognition.abort();
    } catch {
      // Ignore abort errors when the browser has already ended the session.
    }
  }

  function start(onResult, onError) {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();

    if (!SpeechRecognitionCtor) {
      const error = new Error("webspeech-unavailable");
      error.code = "webspeech-unavailable";
      onError?.(error);
      return false;
    }

    if (listening) {
      return false;
    }

    try {
      recognition = new SpeechRecognitionCtor();
    } catch (error) {
      onError?.(error);
      cleanup();
      return false;
    }

    listening = true;
    finished = false;
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      if (finished) {
        return;
      }

      const transcript = Array.from(event.results || [])
        .slice(event.resultIndex || 0)
        .map((result) => result?.[0]?.transcript || "")
        .join("")
        .trim();

      if (!transcript) {
        return;
      }

      finished = true;

      try {
        onResult?.(transcript);
      } finally {
        try {
          recognition?.stop();
        } catch {
          // Ignore stop failures when the session is already ending.
        }
      }
    };

    recognition.onerror = (event) => {
      if (finished) {
        return;
      }

      finished = true;
      const error = new Error(event?.error || "speech-recognition-error");
      error.code = event?.error || "speech-recognition-error";
      onError?.(error);
      cleanup();
    };

    recognition.onend = () => {
      if (!finished) {
        finished = true;
        const error = new Error("no-speech");
        error.code = "no-speech";
        onError?.(error);
      }

      cleanup();
    };

    try {
      recognition.start();
      return true;
    } catch (error) {
      onError?.(error);
      cleanup();
      return false;
    }
  }

  function isListening() {
    return listening;
  }

  return {
    start,
    stop,
    isListening
  };
}

export function getAsrCapabilities(config) {
  const enabled = Boolean(config.asr?.enabled);
  const provider = String(config.asr?.provider || "placeholder").trim().toLowerCase();
  const available = provider === "webspeech";

  return {
    id: provider,
    label: provider === "webspeech" ? "Web Speech API" : "ASR Placeholder",
    available,
    configured: enabled,
    status: enabled ? (available ? "ready" : "placeholder") : "idle",
    reason: enabled
      ? available
        ? "webspeech-ready"
        : "asr-placeholder"
      : "asr-disabled",
    capabilities: {
      streamingInput: false,
      oneShotInput: available
    }
  };
}
