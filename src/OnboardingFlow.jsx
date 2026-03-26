import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_MINIMAX_TTS_VOICE_ID,
  getLlmProviderDefaults,
  getLlmProviderOption,
  getTtsProviderOption,
  isLlmApiKeyRequired,
  LLM_PROVIDER_OPTIONS,
  summarizeApiKey,
  TTS_PROVIDER_OPTIONS
} from "./settings-schema.js";

const STEPS = [
  "Your Name",
  "LLM",
  "Voice",
  "Review"
];

function ProviderCard({ option, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`provider-card ${selected ? "selected" : ""}`}
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
      <span className="info-chip" title={option.tooltip}>
        What is this?
      </span>
    </button>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function OnboardingFlow({ isSubmitting, initialValues, onComplete }) {
  const [step, setStep] = useState(1);
  const [userName, setUserName] = useState("");
  const [llmProvider, setLlmProvider] = useState("openai-compatible");
  const [llmBaseUrl, setLlmBaseUrl] = useState("https://api.openai.com/v1");
  const [llmModel, setLlmModel] = useState("gpt-4.1-mini");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [ttsProvider, setTtsProvider] = useState("webspeech");
  const [ttsApiKey, setTtsApiKey] = useState("");
  const [voiceId, setVoiceId] = useState(DEFAULT_MINIMAX_TTS_VOICE_ID);
  const [ttsTouched, setTtsTouched] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const nextLlmProvider = String(
      initialValues?.llmProvider || "openai-compatible"
    ).trim().toLowerCase() || "openai-compatible";
    const llmDefaults = getLlmProviderDefaults(nextLlmProvider);

    setStep(1);
    setUserName(initialValues?.userName || "");
    setLlmProvider(nextLlmProvider);
    setLlmBaseUrl(initialValues?.llmBaseUrl || llmDefaults.baseUrl);
    setLlmModel(initialValues?.llmModel || llmDefaults.model);
    setLlmApiKey(initialValues?.llmApiKey || "");
    setTtsProvider(initialValues?.ttsProvider || "webspeech");
    setTtsApiKey(initialValues?.ttsApiKey || "");
    setVoiceId(initialValues?.voiceId || DEFAULT_MINIMAX_TTS_VOICE_ID);
    setTtsTouched(false);
    setError("");
  }, [initialValues]);

  useEffect(() => {
    if (llmProvider === "minimax-messages") {
      if (!ttsTouched) {
        setTtsProvider("minimax-websocket");
      }

      if (!String(ttsApiKey || "").trim() && String(llmApiKey || "").trim()) {
        setTtsApiKey(String(llmApiKey || "").trim());
      }

      return;
    }

    if (!ttsTouched && ttsProvider === "minimax-websocket") {
      setTtsProvider("webspeech");
    }
  }, [llmApiKey, llmProvider, ttsApiKey, ttsProvider, ttsTouched]);

  const llmOption = useMemo(
    () => getLlmProviderOption(llmProvider),
    [llmProvider]
  );
  const ttsOption = useMemo(
    () => getTtsProviderOption(ttsProvider),
    [ttsProvider]
  );
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

  function selectLlmProvider(nextProvider) {
    const nextDefaults = getLlmProviderDefaults(nextProvider);
    setLlmProvider(nextProvider);
    setLlmBaseUrl(nextDefaults.baseUrl);
    setLlmModel(nextDefaults.model);
    setError("");
  }

  function selectTtsProvider(nextProvider) {
    setTtsTouched(true);
    setTtsProvider(nextProvider);
    if (nextProvider === "minimax-websocket" && !String(ttsApiKey || "").trim()) {
      setTtsApiKey(String(llmApiKey || "").trim());
    }
    setError("");
  }

  function validateStepOne() {
    if (!String(userName || "").trim()) {
      return "Tell Vela how to address you first.";
    }

    return "";
  }

  function validateStepTwo() {
    if (!String(llmBaseUrl || "").trim()) {
      return "Base URL is required.";
    }

    if (!String(llmModel || "").trim()) {
      return "Model name is required.";
    }

    if (llmApiKeyIsRequired && !String(llmApiKey || "").trim()) {
      return "This provider needs an API key.";
    }

    return "";
  }

  function validateStepThree() {
    if (
      ttsProvider === "minimax-websocket" &&
      !String(effectiveTtsApiKey || "").trim()
    ) {
      return "MiniMax Voice needs an API key.";
    }

    return "";
  }

  function moveToStep(nextStep) {
    const validations = {
      2: validateStepOne,
      3: validateStepTwo,
      4: validateStepThree
    };
    const validator = validations[nextStep];
    const nextError = validator ? validator() : "";

    if (nextError) {
      setError(nextError);
      return;
    }

    setError("");
    setStep(nextStep);
  }

  async function handleFinish() {
    const nextError =
      validateStepOne() || validateStepTwo() || validateStepThree();

    if (nextError) {
      setError(nextError);
      return;
    }

    setError("");

    try {
      await onComplete?.({
        userName: String(userName || "").trim(),
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
          ttsProvider === "minimax-websocket"
            ? String(voiceId || "").trim() || DEFAULT_MINIMAX_TTS_VOICE_ID
            : ""
      });
    } catch (submitError) {
      setError(submitError?.message || "Initialization failed.");
    }
  }

  return (
    <section className="chat-shell onboarding-shell onboarding-v2">
      <div className="chat-header onboarding-header">
        <div className="chat-header-copy">
          <span className="eyebrow">First Run</span>
          <h2>Welcome to Vela</h2>
          <p>
            Four short steps: who you are, which model to use, how replies sound,
            then one last confirmation.
          </p>
        </div>
      </div>

      <div className="step-dots" aria-label="Onboarding progress">
        {STEPS.map((label, index) => {
          const stepNumber = index + 1;
          const stateClass =
            stepNumber === step
              ? "is-current"
              : stepNumber < step
                ? "is-complete"
                : "";

          return (
            <div key={label} className={`step-dot ${stateClass}`}>
              <span className="step-dot-index">{stepNumber}</span>
              <span className="step-dot-label">{label}</span>
            </div>
          );
        })}
      </div>

      <section className="onboarding-step-card">
        {step === 1 ? (
          <>
            <div className="step-copy">
              <h3>Your Name</h3>
              <p>
                This is how Vela will address you in chat, memory, and the quiet
                little welcome-backs later on.
              </p>
            </div>

            <label className="field-block">
              <span>How should she call you?</span>
              <input
                value={userName}
                onChange={(event) => setUserName(event.target.value.slice(0, 20))}
                placeholder="For example: Celine"
                maxLength={20}
              />
            </label>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="step-copy">
              <h3>Choose an LLM</h3>
              <p>
                Pick the chat backend first. You can change providers later in
                Settings without editing files by hand.
              </p>
            </div>

            <div className="provider-grid">
              {LLM_PROVIDER_OPTIONS.map((option) => (
                <ProviderCard
                  key={option.id}
                  option={option}
                  selected={llmProvider === option.id}
                  onSelect={selectLlmProvider}
                />
              ))}
            </div>

            {llmProvider === "minimax-messages" ? (
              <div className="provider-fields">
                <div className="summary-panel compact">
                  <SummaryItem label="Base URL" value={llmBaseUrl} />
                  <SummaryItem label="Model" value={llmModel} />
                </div>
                <label className="field-block">
                  <span>API Key</span>
                  <input
                    type="password"
                    value={llmApiKey}
                    onChange={(event) => setLlmApiKey(event.target.value.trim())}
                    placeholder="Enter your MiniMax API key"
                  />
                </label>
              </div>
            ) : (
              <div className="provider-fields">
                <label className="field-block">
                  <span>Base URL</span>
                  <input
                    value={llmBaseUrl}
                    onChange={(event) => setLlmBaseUrl(event.target.value)}
                    placeholder={
                      llmProvider === "openai-compatible"
                        ? "http://localhost:11434/v1"
                        : llmOption.defaults.baseUrl
                    }
                  />
                </label>

                <label className="field-block">
                  <span>Model</span>
                  <input
                    value={llmModel}
                    onChange={(event) => setLlmModel(event.target.value)}
                    placeholder={llmOption.defaults.model}
                  />
                </label>

                <label className="field-block">
                  <span>API Key</span>
                  <input
                    type="password"
                    value={llmApiKey}
                    onChange={(event) => setLlmApiKey(event.target.value.trim())}
                    placeholder={
                      llmProvider === "openai-compatible"
                        ? "Optional for Ollama/local"
                        : "Enter the provider API key"
                    }
                  />
                </label>
              </div>
            )}

            <p className="onboarding-note">{llmOption.apiKeyHint}</p>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <div className="step-copy">
              <h3>Choose a Voice</h3>
              <p>
                MiniMax sounds best, Web Speech is free and instant, and you can
                always keep things text-only.
              </p>
            </div>

            <div className="provider-grid">
              {TTS_PROVIDER_OPTIONS.map((option) => (
                <ProviderCard
                  key={option.id}
                  option={option}
                  selected={ttsProvider === option.id}
                  onSelect={selectTtsProvider}
                />
              ))}
            </div>

            {ttsProvider === "minimax-websocket" ? (
              <div className="provider-fields">
                <label className="field-block">
                  <span>MiniMax API Key</span>
                  <input
                    type="password"
                    value={ttsApiKey}
                    onChange={(event) => setTtsApiKey(event.target.value.trim())}
                    placeholder="Enter your MiniMax API key"
                  />
                </label>

                <label className="field-block">
                  <span>Voice ID</span>
                  <input
                    value={voiceId}
                    onChange={(event) => setVoiceId(event.target.value)}
                    placeholder={DEFAULT_MINIMAX_TTS_VOICE_ID}
                  />
                </label>

                {llmProvider === "minimax-messages" && String(llmApiKey || "").trim() ? (
                  <p className="onboarding-note">
                    Using the MiniMax key from step 2 as the default voice key.
                  </p>
                ) : null}
              </div>
            ) : null}

            {ttsProvider === "webspeech" ? (
              <div className="onboarding-note">
                Browser Built-in Voice uses your local speech engine, so there is
                nothing else to fill in right now.
              </div>
            ) : null}

            {ttsProvider === "off" ? (
              <div className="onboarding-note">
                Spoken replies will stay off. You can enable a voice provider later.
              </div>
            ) : null}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <div className="step-copy">
              <h3>Confirm Your Setup</h3>
              <p>One last glance before the app writes everything into your local user config.</p>
            </div>

            <div className="summary-panel">
              <SummaryItem label="Name" value={String(userName || "").trim() || "Not set"} />
              <SummaryItem label="LLM" value={llmOption.label} />
              <SummaryItem label="Base URL" value={String(llmBaseUrl || "").trim()} />
              <SummaryItem label="Model" value={String(llmModel || "").trim()} />
              <SummaryItem
                label="LLM API Key"
                value={
                  llmApiKeyIsRequired || String(llmApiKey || "").trim()
                    ? summarizeApiKey(llmApiKey)
                    : "Local provider without key"
                }
              />
              <SummaryItem label="Voice" value={ttsOption.label} />
              {ttsProvider === "minimax-websocket" ? (
                <>
                  <SummaryItem
                    label="Voice Key"
                    value={summarizeApiKey(effectiveTtsApiKey)}
                  />
                  <SummaryItem
                    label="Voice ID"
                    value={String(voiceId || "").trim() || DEFAULT_MINIMAX_TTS_VOICE_ID}
                  />
                </>
              ) : null}
            </div>
          </>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}

        <div className="onboarding-actions">
          {step > 1 ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => moveToStep(step - 1)}
              disabled={isSubmitting}
            >
              Back
            </button>
          ) : null}

          {step < 4 ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => moveToStep(step + 1)}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleFinish()}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Finish Setup"}
            </button>
          )}
        </div>
      </section>
    </section>
  );
}
