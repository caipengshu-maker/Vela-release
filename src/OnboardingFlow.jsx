import { useEffect, useState } from "react";

const llmAdvancedSnippet = `// vela.jsonc 示例
{
  "llm": {
    "provider": "openai-compatible",
    "baseUrl": "https://api.openai.com/v1",
    "model": "gpt-4.1-mini",
    "apiKey": "YOUR_API_KEY"
  }
}`;

const voiceAdvancedSnippet = `// vela.jsonc 示例
{
  "asr": { "enabled": true, "provider": "placeholder" },
  "tts": { "enabled": true, "provider": "minimax-websocket" }
}`;

export function OnboardingFlow({ isSubmitting, initialValues, onComplete }) {
  const [step, setStep] = useState(1);
  const [userName, setUserName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [asrEnabled, setAsrEnabled] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setStep(1);
    setUserName(initialValues?.userName || "");
    setApiKey(initialValues?.llmApiKey || "");
    setAsrEnabled(Boolean(initialValues?.asrEnabled));
    setTtsEnabled(Boolean(initialValues?.ttsEnabled));
    setError("");
  }, [initialValues]);

  async function handleFinish() {
    if (isSubmitting) {
      return;
    }

    setError("");

    try {
      await onComplete?.({
        userName: String(userName || "").trim(),
        llmApiKey: String(apiKey || "").trim(),
        asrEnabled: Boolean(asrEnabled),
        ttsEnabled: Boolean(ttsEnabled)
      });
    } catch (submitError) {
      setError(submitError?.message || "初始化失败，请重试。");
    }
  }

  return (
    <section className="chat-shell onboarding-shell onboarding-v2">
      <div className="chat-header onboarding-header">
        <div className="chat-header-copy">
          <span className="eyebrow">First Run</span>
          <h2>欢迎来到 Vela</h2>
          <p>三步完成基础配置，后续随时可在 Settings 继续调整。</p>
        </div>
      </div>

      <div className="onboarding-steps-indicator">Step {step} / 3</div>

      {step === 1 ? (
        <section className="onboarding-step-card">
          <h3>Step 1 · Welcome & Alias</h3>
          <p>先设置你的称呼，Vela 会在对话里优先使用它。</p>
          <label className="field-block">
            <span>你的称呼：</span>
            <input
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
              placeholder="比如：舒总"
            />
          </label>

          <div className="onboarding-actions">
            <button type="button" onClick={() => setStep(2)}>
              下一步
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="onboarding-step-card">
          <h3>Step 2 · LLM Configuration（MiniMax）</h3>
          <label className="field-block">
            <span>MiniMax API Key</span>
            <input
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="填入 MiniMax API Key"
            />
          </label>

          <div className="onboarding-warning">
            推荐订阅 MiniMax Token Plan 或相关资源包，否则计费昂贵。
          </div>

          <div className="onboarding-advanced">
            <p>高级用户：如需其他 LLM 提供商，建议直接编辑 vela.jsonc：</p>
            <pre>{llmAdvancedSnippet}</pre>
          </div>

          <div className="onboarding-actions">
            <button type="button" className="secondary-button" onClick={() => setStep(1)}>
              上一步
            </button>
            <button type="button" onClick={() => setStep(3)}>
              下一步
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="onboarding-step-card">
          <h3>Step 3 · Voice Configuration（MiniMax）</h3>

          <label className="onboarding-toggle">
            <input
              type="checkbox"
              checked={asrEnabled}
              onChange={(event) => setAsrEnabled(event.target.checked)}
            />
            <span>Enable ASR</span>
          </label>

          <label className="onboarding-toggle">
            <input
              type="checkbox"
              checked={ttsEnabled}
              onChange={(event) => setTtsEnabled(event.target.checked)}
            />
            <span>Enable TTS</span>
          </label>

          {ttsEnabled ? (
            <div className="onboarding-warning">
              MiniMax 语音资费较高，推荐订阅语音资源包，否则计费昂贵。
            </div>
          ) : null}

          <div className="onboarding-advanced">
            <p>高级用户：如需其他 ASR/TTS 提供商，建议直接编辑 vela.jsonc：</p>
            <pre>{voiceAdvancedSnippet}</pre>
          </div>

          {error ? <p className="error-text">{error}</p> : null}

          <div className="onboarding-actions">
            <button type="button" className="secondary-button" onClick={() => setStep(2)} disabled={isSubmitting}>
              上一步
            </button>
            <button type="button" onClick={() => void handleFinish()} disabled={isSubmitting}>
              {isSubmitting ? "完成中..." : "完成初始化"}
            </button>
          </div>
        </section>
      ) : null}
    </section>
  );
}
