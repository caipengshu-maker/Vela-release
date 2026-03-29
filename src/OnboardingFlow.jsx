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
import { getStrings } from "./i18n/strings.js";

const TTS_VOICE_MAP = {
  "zh-CN": "Chinese (Mandarin)_Sweet_Lady",
  en: "Sweet_Girl"
};

function getSteps(t) {
  return [t["onboarding.steps.name"], t["onboarding.steps.llm"], t["onboarding.steps.voice"], t["onboarding.steps.review"]];
}

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
  const [locale, setLocale] = useState(initialValues?.locale || "");
  const [step, setStep] = useState(locale ? 1 : 0);
  const t = getStrings(locale || "en");
  const STEPS = getSteps(t);
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

    const nextLocale = initialValues?.locale || "";
    setLocale(nextLocale);
    setStep(nextLocale ? 1 : 0);
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
      return t["onboarding.name.error"];
    }

    return "";
  }

  function validateStepTwo() {
    if (!String(llmBaseUrl || "").trim()) {
      return t["onboarding.error.baseUrl"];
    }

    if (!String(llmModel || "").trim()) {
      return t["onboarding.error.model"];
    }

    if (llmApiKeyIsRequired && !String(llmApiKey || "").trim()) {
      return t["onboarding.error.llmKey"];
    }

    return "";
  }

  function validateStepThree() {
    if (
      ttsProvider === "minimax-websocket" &&
      !String(effectiveTtsApiKey || "").trim()
    ) {
      return t["onboarding.error.ttsKey"];
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
        locale: locale || "zh-CN",
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
            ? String(voiceId || "").trim() || TTS_VOICE_MAP[locale] || DEFAULT_MINIMAX_TTS_VOICE_ID
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
          <span className="eyebrow">{step === 0 ? "Language" : t["onboarding.eyebrow"]}</span>
          <h2>{step === 0 ? "Choose Your Language" : t["onboarding.title"]}</h2>
          <p>
            {step === 0
              ? "Select the language Vela will use to talk with you."
              : t["onboarding.subtitle"]}
          </p>
        </div>
      </div>

      {step > 0 ? (
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
      ) : null}

      <section className="onboarding-step-card">
        {step === 0 ? (
          <>
            <div className="step-copy">
              <h3>🌐</h3>
            </div>
            <div className="provider-grid">
              <button
                type="button"
                className={`provider-card ${locale === "zh-CN" ? "selected" : ""}`}
                onClick={() => { setLocale("zh-CN"); setVoiceId(TTS_VOICE_MAP["zh-CN"]); setStep(1); }}
              >
                <div className="provider-card-head">
                  <strong>中文</strong>
                  <span className="provider-checkmark" aria-hidden="true" />
                </div>
                <p>Vela 将用中文和你聊天</p>
              </button>
              <button
                type="button"
                className={`provider-card ${locale === "en" ? "selected" : ""}`}
                onClick={() => { setLocale("en"); setVoiceId(TTS_VOICE_MAP["en"]); setStep(1); }}
              >
                <div className="provider-card-head">
                  <strong>English</strong>
                  <span className="provider-checkmark" aria-hidden="true" />
                </div>
                <p>Vela will chat with you in English</p>
              </button>
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div className="step-copy">
              <h3>{t["onboarding.name.title"]}</h3>
              <p>{t["onboarding.name.desc"]}</p>
            </div>

            <label className="field-block">
              <span>{t["onboarding.name.label"]}</span>
              <input
                value={userName}
                onChange={(event) => setUserName(event.target.value.slice(0, 20))}
                placeholder={t["onboarding.name.placeholder"]}
                maxLength={20}
              />
            </label>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="step-copy">
              <h3>{t["onboarding.llm.title"]}</h3>
              <p>{t["onboarding.llm.desc"]}</p>
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
              <h3>{t["onboarding.voice.title"]}</h3>
              <p>{t["onboarding.voice.desc"]}</p>
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
                {t["onboarding.voice.webspeech"]}
              </div>
            ) : null}

            {ttsProvider === "off" ? (
              <div className="onboarding-note">
                {t["onboarding.voice.off"]}
              </div>
            ) : null}

            {ttsProvider === "minimax-websocket" && llmProvider === "minimax-messages" && String(llmApiKey || "").trim() ? (
              <p className="onboarding-note">
                {t["onboarding.voice.minimaxNote"]}
              </p>
            ) : null}
          </>
        ) : null}

        {step === 4 ? (
          <>
            <div className="step-copy">
              <h3>{t["onboarding.review.title"]}</h3>
              <p>{t["onboarding.review.desc"]}</p>
            </div>

            <div className="summary-panel">
              <SummaryItem label={t["common.name"]} value={String(userName || "").trim() || t["onboarding.review.notSet"]} />
              <SummaryItem label={t["common.model"]} value={llmOption.label} />
              <SummaryItem label={t["common.baseUrl"]} value={String(llmBaseUrl || "").trim()} />
              <SummaryItem label={t["common.model"]} value={String(llmModel || "").trim()} />
              <SummaryItem
                label={t["common.apiKey"]}
                value={
                  llmApiKeyIsRequired || String(llmApiKey || "").trim()
                    ? summarizeApiKey(llmApiKey)
                    : t["onboarding.review.localNoKey"]
                }
              />
              <SummaryItem label={t["common.voice"]} value={ttsOption.label} />
              {ttsProvider === "minimax-websocket" ? (
                <>
                  <SummaryItem
                    label={t["common.voiceKey"]}
                    value={summarizeApiKey(effectiveTtsApiKey)}
                  />
                  <SummaryItem
                    label={t["common.voiceId"]}
                    value={String(voiceId || "").trim() || TTS_VOICE_MAP[locale] || DEFAULT_MINIMAX_TTS_VOICE_ID}
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
              {t["onboarding.btn.back"]}
            </button>
          ) : null}

          {step > 0 && step < 4 ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => moveToStep(step + 1)}
            >
              {t["onboarding.btn.next"]}
            </button>
          ) : null}

          {step === 4 ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleFinish()}
              disabled={isSubmitting}
            >
              {isSubmitting ? t["onboarding.btn.saving"] : t["onboarding.btn.finish"]}
            </button>
          ) : null}
        </div>
      </section>
    </section>
  );
}
