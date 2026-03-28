import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_MINIMAX_TTS_VOICE_ID,
  getLlmProviderDefaults,
  isLlmApiKeyRequired,
  LLM_PROVIDER_OPTIONS,
  TTS_PROVIDER_OPTIONS
} from "./settings-schema.js";

function SelectorCard({ option, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`provider-card compact ${selected ? "selected" : ""}`}
      onClick={() => onSelect(option.id)}
    >
      <div className="provider-card-head">
        <div className="provider-card-title-row">
          <strong>{option.label}</strong>
          {option.badge ? <span className="provider-badge">{option.badge}</span> : null}
        </div>
        <span className="provider-checkmark" aria-hidden="true" />
      </div>
      <p>{option.description}</p>
    </button>
  );
}

function SettingsSection({ title, description, children }) {
  return (
    <section className="settings-section">
      <div className="settings-section-copy">
        <h4>{title}</h4>
        <p>{description}</p>
      </div>
      <div className="settings-section-body">{children}</div>
    </section>
  );
}

export function SettingsModal({
  isOpen,
  initialValues,
  onClose,
  onSaved,
  models,
  selectedModel,
  onModelSwitch
}) {
  const [userName, setUserName] = useState("");
  const [llmProvider, setLlmProvider] = useState("openai-compatible");
  const [llmBaseUrl, setLlmBaseUrl] = useState("https://api.openai.com/v1");
  const [llmModel, setLlmModel] = useState("gpt-4.1-mini");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [ttsProvider, setTtsProvider] = useState("off");
  const [ttsApiKey, setTtsApiKey] = useState("");
  const [voiceId, setVoiceId] = useState(DEFAULT_MINIMAX_TTS_VOICE_ID);
  const [showLlmApiKey, setShowLlmApiKey] = useState(false);
  const [showTtsApiKey, setShowTtsApiKey] = useState(false);
  const [webSpeechVoices, setWebSpeechVoices] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testState, setTestState] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const nextProvider = String(
      initialValues?.llmProvider || "openai-compatible"
    ).trim().toLowerCase() || "openai-compatible";
    const defaults = getLlmProviderDefaults(nextProvider);

    setUserName(initialValues?.userName || "");
    setLlmProvider(nextProvider);
    setLlmBaseUrl(initialValues?.llmBaseUrl || defaults.baseUrl);
    setLlmModel(initialValues?.llmModel || defaults.model);
    setLlmApiKey(initialValues?.llmApiKey || "");
    setTtsProvider(initialValues?.ttsProvider || "off");
    setTtsApiKey(initialValues?.ttsApiKey || "");
    setVoiceId(initialValues?.voiceId || DEFAULT_MINIMAX_TTS_VOICE_ID);
    setShowLlmApiKey(false);
    setShowTtsApiKey(false);
    setTestState(null);
    setError("");
  }, [initialValues, isOpen]);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined" || !window.speechSynthesis) {
      return;
    }

    const syncVoices = () => {
      const voices = Array.from(window.speechSynthesis.getVoices() || []);
      setWebSpeechVoices(voices);
    };

    syncVoices();

    if (typeof window.speechSynthesis.addEventListener === "function") {
      window.speechSynthesis.addEventListener("voiceschanged", syncVoices);
      return () => {
        window.speechSynthesis.removeEventListener("voiceschanged", syncVoices);
      };
    }

    window.speechSynthesis.onvoiceschanged = syncVoices;
    return () => {
      if (window.speechSynthesis.onvoiceschanged === syncVoices) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (ttsProvider !== "minimax-websocket") {
      return;
    }

    if (!String(ttsApiKey || "").trim() && llmProvider === "minimax-messages") {
      setTtsApiKey(String(llmApiKey || "").trim());
    }
  }, [llmApiKey, llmProvider, ttsApiKey, ttsProvider]);

  useEffect(() => {
    if (ttsProvider !== "webspeech" || webSpeechVoices.length === 0) {
      return;
    }

    const voiceExists = webSpeechVoices.some((voice) => voice.name === voiceId);
    if (!voiceExists) {
      setVoiceId(webSpeechVoices[0].name);
    }
  }, [ttsProvider, voiceId, webSpeechVoices]);

  const llmApiKeyIsRequired = useMemo(
    () => isLlmApiKeyRequired(llmProvider, llmBaseUrl),
    [llmBaseUrl, llmProvider]
  );
  const effectiveTtsApiKey = useMemo(() => {
    if (ttsProvider !== "minimax-websocket") {
      return "";
    }

    return String(ttsApiKey || "").trim() || (
      llmProvider === "minimax-messages" ? String(llmApiKey || "").trim() : ""
    );
  }, [llmApiKey, llmProvider, ttsApiKey, ttsProvider]);
  const modelOptions = Array.isArray(models) ? models : [];
  const currentModel = selectedModel || "auto";
  const selectedWebSpeechVoice = webSpeechVoices.some(
    (voice) => voice.name === voiceId
  )
    ? voiceId
    : "";

  if (!isOpen) {
    return null;
  }

  function selectLlmProvider(nextProvider) {
    const defaults = getLlmProviderDefaults(nextProvider);
    setLlmProvider(nextProvider);
    setLlmBaseUrl(defaults.baseUrl);
    setLlmModel(defaults.model);
    setTestState(null);
    setError("");
  }

  function validateForm() {
    const trimmedUserName = String(userName || "").trim().slice(0, 20);

    if (!trimmedUserName) {
      return "Your name cannot be empty.";
    }

    if (!String(llmBaseUrl || "").trim()) {
      return "Base URL is required.";
    }

    if (!String(llmModel || "").trim()) {
      return "Model name is required.";
    }

    if (llmApiKeyIsRequired && !String(llmApiKey || "").trim()) {
      return "This LLM provider needs an API key.";
    }

    if (
      ttsProvider === "minimax-websocket" &&
      !String(effectiveTtsApiKey || "").trim()
    ) {
      return "MiniMax Voice needs an API key.";
    }

    return "";
  }

  function buildPayload() {
    return {
      userName: String(userName || "").trim().slice(0, 20),
      llmProvider,
      llmBaseUrl: String(llmBaseUrl || "").trim(),
      llmModel: String(llmModel || "").trim(),
      llmApiKey: String(llmApiKey || "").trim(),
      ttsProvider,
      ttsApiKey:
        ttsProvider === "minimax-websocket"
          ? String(effectiveTtsApiKey || "").trim()
          : "",
      voiceId:
        ttsProvider === "off"
          ? ""
          : ttsProvider === "webspeech"
            ? selectedWebSpeechVoice
            : String(voiceId || "").trim() || DEFAULT_MINIMAX_TTS_VOICE_ID
    };
  }

  async function handleSave() {
    if (isSaving) {
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = buildPayload();
    setIsSaving(true);
    setError("");

    try {
      const nextState = await window.vela.ipcRenderer.invoke(
        "vela:update-settings",
        payload
      );
      await onSaved?.(nextState, payload);
      onClose?.();
    } catch (saveError) {
      setError(saveError?.message || "Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTestConnection() {
    const validationError =
      !String(llmBaseUrl || "").trim()
        ? "Base URL is required."
        : !String(llmModel || "").trim()
          ? "Model name is required."
          : llmApiKeyIsRequired && !String(llmApiKey || "").trim()
            ? "This LLM provider needs an API key."
            : "";

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsTesting(true);
    setTestState(null);
    setError("");

    try {
      const result = await window.vela.testLlmConnection({
        llmProvider,
        llmBaseUrl,
        llmModel,
        llmApiKey
      });
      setTestState({
        tone: "success",
        message: `Connected to ${result.model || llmModel}.`
      });
    } catch (testError) {
      setTestState({
        tone: "error",
        message: testError?.message || "Connection test failed."
      });
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <div className="settings-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="settings-modal settings-modal-wide"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="settings-modal-header">
          <h3>Settings</h3>
          <p>Switch providers and fine-tune how Vela replies.</p>
        </div>

        <div className="settings-modal-body">
          <SettingsSection
            title="Profile"
            description="This name is used in conversation and memory."
          >
            <label className="field-block">
              <span>Your Name</span>
              <input
                value={userName}
                onChange={(event) => setUserName(event.target.value.slice(0, 20))}
                placeholder="How should Vela address you?"
                maxLength={20}
              />
            </label>
          </SettingsSection>

          <SettingsSection
            title="LLM"
            description="Pick the chat provider and verify it before saving."
          >
            <div className="provider-grid compact">
              {LLM_PROVIDER_OPTIONS.map((option) => (
                <SelectorCard
                  key={option.id}
                  option={option}
                  selected={llmProvider === option.id}
                  onSelect={selectLlmProvider}
                />
              ))}
            </div>

            {llmProvider === "minimax-messages" ? (
              <div className="summary-panel compact">
                <div className="summary-item">
                  <span>Base URL</span>
                  <strong>{llmBaseUrl}</strong>
                </div>
              </div>
            ) : (
              <label className="field-block">
                <span>Base URL</span>
                <input
                  value={llmBaseUrl}
                  onChange={(event) => setLlmBaseUrl(event.target.value)}
                  placeholder={
                    llmProvider === "openai-compatible"
                      ? "http://localhost:11434/v1"
                      : getLlmProviderDefaults(llmProvider).baseUrl
                  }
                />
              </label>
            )}

            <label className="field-block">
              <span>Model Name</span>
              <input
                value={llmModel}
                onChange={(event) => setLlmModel(event.target.value)}
                placeholder={getLlmProviderDefaults(llmProvider).model}
              />
            </label>

            <label className="field-block">
              <span>API Key</span>
              <div className="field-inline">
                <input
                  type={showLlmApiKey ? "text" : "password"}
                  value={llmApiKey}
                  onChange={(event) => setLlmApiKey(event.target.value.trim())}
                  placeholder={
                    llmProvider === "openai-compatible"
                      ? "Optional for Ollama/local"
                      : "Enter the provider API key"
                  }
                />
                <button
                  type="button"
                  className="btn-secondary field-toggle"
                  onClick={() => setShowLlmApiKey((current) => !current)}
                >
                  {showLlmApiKey ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <div className="settings-inline-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void handleTestConnection()}
                disabled={isTesting}
              >
                {isTesting ? "Testing..." : "Test Connection"}
              </button>
              {testState ? (
                <span className={`status-inline is-${testState.tone}`}>
                  {testState.message}
                </span>
              ) : null}
            </div>

            {modelOptions.length > 0 ? (
              <div className="field-block">
                <span>Runtime Route</span>
                <div className="settings-model-list">
                  {modelOptions.map((modelOption) => (
                    <button
                      key={modelOption.id}
                      type="button"
                      className={`settings-model-item ${
                        currentModel === modelOption.id ? "is-selected" : ""
                      }`}
                      onClick={() => onModelSwitch?.(modelOption.id)}
                    >
                      <span>{modelOption.label}</span>
                      {currentModel === modelOption.id ? (
                        <span className="settings-model-check">Active</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </SettingsSection>

          <SettingsSection
            title="Voice"
            description="Switch between MiniMax streaming voice, browser speech, or text-only."
          >
            <div className="provider-grid compact">
              {TTS_PROVIDER_OPTIONS.map((option) => (
                <SelectorCard
                  key={option.id}
                  option={option}
                  selected={ttsProvider === option.id}
                  onSelect={setTtsProvider}
                />
              ))}
            </div>

            {ttsProvider === "minimax-websocket" ? (
              <>
                <label className="field-block">
                  <span>MiniMax API Key</span>
                  <div className="field-inline">
                    <input
                      type={showTtsApiKey ? "text" : "password"}
                      value={ttsApiKey}
                      onChange={(event) => setTtsApiKey(event.target.value.trim())}
                      placeholder="Enter the MiniMax TTS key"
                    />
                    <button
                      type="button"
                      className="btn-secondary field-toggle"
                      onClick={() => setShowTtsApiKey((current) => !current)}
                    >
                      {showTtsApiKey ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>

                <label className="field-block">
                  <span>Voice ID</span>
                  <input
                    value={voiceId}
                    onChange={(event) => setVoiceId(event.target.value)}
                    placeholder={DEFAULT_MINIMAX_TTS_VOICE_ID}
                  />
                </label>
              </>
            ) : null}

            {ttsProvider === "webspeech" ? (
              <label className="field-block">
                <span>Voice Picker</span>
                <select
                  value={selectedWebSpeechVoice}
                  onChange={(event) => setVoiceId(event.target.value)}
                >
                  <option value="">
                    {webSpeechVoices.length > 0 ? "Use system default" : "Loading voices..."}
                  </option>
                  {webSpeechVoices.map((voice) => (
                    <option key={`${voice.name}-${voice.lang}`} value={voice.name}>
                      {voice.name} {voice.lang ? `(${voice.lang})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </SettingsSection>

          {error ? <p className="error-text">{error}</p> : null}
        </div>

        <div className="settings-modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={isSaving}
          >
            Close
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void handleSave()}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
        <div className="settings-footer-danger">
          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              if (window.confirm("Reset all data and start over? This cannot be undone.")) {
                void window.vela.ipcRenderer.invoke("vela:factory-reset").then(() => {
                  window.location.reload();
                });
              }
            }}
          >
            Factory Reset
          </button>
        </div>
      </div>
    </div>
  );
}
