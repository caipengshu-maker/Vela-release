import { useEffect, useMemo, useRef, useState } from "react";
import { AudioPlayerService } from "./audio-player.js";
import {
  releaseCloseCamera,
  settleAvatarState
} from "./core/avatar-state.js";
import { VrmAvatarStage } from "./vrm-avatar-stage.jsx";

const initialState = {
  app: null,
  persona: null,
  avatar: null,
  avatarAsset: null,
  messages: [],
  welcomeNote: "",
  memoryPeek: null,
  voiceMode: {
    enabled: false,
    available: false,
    inputMode: "text",
    outputMode: "text"
  },
  thinkingMode: "balanced",
  thinkingModes: [],
  tts: null,
  asr: null,
  onboarding: {
    required: false,
    completed: true
  },
  status: {
    phase: "idle",
    speech: {
      status: "idle"
    },
    asr: {
      status: "idle"
    }
  },
  session: {
    launchTurnCount: 0,
    lifetimeTurnCount: 0
  }
};

function upsertAssistantMessage(
  messages,
  messageId,
  content,
  streaming,
  patch = {}
) {
  let found = false;
  const nextMessages = messages.map((message) => {
    if (message.id !== messageId) {
      return message;
    }

    found = true;
    return {
      ...message,
      content,
      streaming,
      ...(patch.llm
        ? {
            llm: {
              ...(message.llm || {}),
              ...patch.llm
            }
          }
        : {})
    };
  });

  if (!found) {
    nextMessages.push({
      id: messageId,
      role: "assistant",
      content,
      streaming,
      ...(patch.llm ? { llm: patch.llm } : {})
    });
  }

  return nextMessages;
}

function getLatestAssistantProviderMeta(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.role === "assistant") {
      return message.llm?.providerMeta || null;
    }
  }

  return null;
}

const thinkingModeLabels = {
  fast: "轻一点",
  balanced: "刚好",
  deep: "想深一点"
};

function buildAvatarPresenceCopy(avatar) {
  const presence = avatar?.presence || "idle";
  const emotion = avatar?.emotion || "calm";
  const camera = avatar?.camera || "wide";

  if (presence === "thinking") {
    return {
      kicker: "她停了一下",
      title: "在想怎么把这句接住",
      caption: "别急，她没有离开。"
    };
  }

  if (presence === "listening") {
    return {
      kicker: "她在听",
      title: "你可以继续往下说",
      caption: "她会先把你的语气接稳。"
    };
  }

  if (presence === "speaking") {
    if (emotion === "concerned") {
      return {
        kicker: camera === "close" ? "她靠近了一点" : "她把声音放轻了",
        title: "像是在先接住你",
        caption: "这句会比刚才更轻，也更稳。"
      };
    }

    if (emotion === "affectionate" || emotion === "whisper") {
      return {
        kicker: camera === "close" ? "她把距离收近了" : "她的语气更柔了",
        title: "只是靠近一点，没有抢戏",
        caption: "她把回应放软了一些。"
      };
    }

    if (emotion === "playful" || emotion === "happy") {
      return {
        kicker: "她带了一点笑意",
        title: "让这句回应没那么绷",
        caption: "轻一些，但还在场。"
      };
    }

    if (emotion === "sad") {
      return {
        kicker: "她把语气压低了",
        title: "先陪你把情绪放稳",
        caption: "她没有急着把你往外拽。"
      };
    }

    if (emotion === "angry") {
      return {
        kicker: "她语气收紧了一点",
        title: "但还克制着",
        caption: "更硬一点，却没有失控。"
      };
    }

    return {
      kicker: "她在回应",
      title: "慢慢把这句话接上来",
      caption: "你可以继续往下说。"
    };
  }

  return {
    kicker: "她在这里",
    title: "安静地等你开口",
    caption: "你不必把第一句想得很完整。"
  };
}

function buildVoiceModeCopy(voiceMode) {
  if (voiceMode.enabled && voiceMode.available) {
    return {
      title: "她会开口回你",
      detail: "输入还是文字，但她已经可以把回应说出来。"
    };
  }

  if (voiceMode.enabled) {
    return {
      title: "先等她开口",
      detail: "语音路由还没完全接通，这一轮先用文字继续。"
    };
  }

  return {
    title: "先用文字接住",
    detail: "把话先交给她，声音留到后面再靠近。"
  };
}

function formatThinkingModeLabel(modeId) {
  return thinkingModeLabels[modeId] || modeId;
}

function applyRuntimeEvent(state, event) {
  if (!event || !event.type) {
    return state;
  }

  if (event.type === "assistant-state") {
    return {
      ...state,
      avatar: event.avatar || state.avatar,
      status: event.status || state.status,
      voiceMode: event.voiceMode || state.voiceMode,
      thinkingMode: event.thinkingMode || state.thinkingMode
    };
  }

  if (event.type === "assistant-stream-start") {
    return {
      ...state,
      messages: upsertAssistantMessage(
        state.messages,
        event.messageId,
        "",
        true
      )
    };
  }

  if (event.type === "assistant-stream-delta") {
    return {
      ...state,
      messages: upsertAssistantMessage(
        state.messages,
        event.messageId,
        event.content,
        true
      )
    };
  }

  if (event.type === "assistant-stream-complete") {
    return {
      ...state,
      messages: upsertAssistantMessage(
        state.messages,
        event.messageId,
        event.content,
        false,
        event.providerMeta
          ? {
              llm: {
                providerMeta: event.providerMeta
              }
            }
          : {}
      )
    };
  }

  if (event.type === "speech-state") {
    return {
      ...state,
      status: {
        ...(state.status || {}),
        speech: event.speech
      }
    };
  }

  if (event.type === "speech-error") {
    return {
      ...state,
      status: {
        ...(state.status || {}),
        speech: {
          ...(state.status?.speech || {}),
          status: "error",
          lastError: event.message
        }
      }
    };
  }

  return state;
}

function AvatarPanel({
  avatar,
  avatarAsset,
  app,
  persona,
  voiceMode
}) {
  const presenceCopy = buildAvatarPresenceCopy(avatar);
  const voiceModeCopy = buildVoiceModeCopy(voiceMode);

  return (
    <section className="avatar-shell">
      <div className="avatar-panel">
        <div
          className={`avatar-stage is-${avatar?.presence || "idle"} camera-${avatar?.camera || "wide"} emotion-${avatar?.emotion || "calm"} action-${avatar?.action || "none"}`}
        >
          <div className="scene-backdrop" />
          <div className="scene-glow" />
          <div className="avatar-halo" />
          <div className="avatar-orbit avatar-orbit-a" />
          <div className="avatar-orbit avatar-orbit-b" />
          <VrmAvatarStage avatar={avatar} avatarAsset={avatarAsset} />
          <div className="stage-copy">
            <span className="stage-kicker">{presenceCopy.kicker}</span>
            <strong>{presenceCopy.title}</strong>
            <p>{avatar?.caption || presenceCopy.caption}</p>
          </div>
        </div>

        <div className="panel-copy">
          <span className="eyebrow">{app?.tagline || "克制而持续地在场"}</span>
          <h1>{persona?.name || "Vela"}</h1>
          <p>{persona?.shortBio}</p>
        </div>

        <div className="presence-brief">
          <span>今晚先这样和她说</span>
          <strong>{voiceModeCopy.title}</strong>
          <small>{voiceModeCopy.detail}</small>
        </div>
      </div>
    </section>
  );
}

function MessageList({ messages, welcomeNote, isBusy, assistantName }) {
  const listRef = useRef(null);
  const hasStreamingAssistant = messages.some(
    (message) => message.role === "assistant" && message.streaming
  );

  useEffect(() => {
    const node = listRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages, isBusy]);

  return (
    <div className="conversation" ref={listRef}>
      {welcomeNote ? <div className="welcome-card">{welcomeNote}</div> : null}

      {messages.length === 0 ? (
        <div className="empty-card">
          <span>今晚</span>
          <p>不用组织得很完整。你可以直接把第一句话交给她。</p>
        </div>
      ) : null}

      {messages.map((message) => (
        <article
          key={message.id}
          className={`message-row is-${message.role}`}
        >
          <div
            className={`message-bubble ${message.streaming ? "is-streaming" : ""}`}
          >
            <div className="message-heading">
              <span className="message-role">
                {message.role === "assistant" ? assistantName || "Vela" : "你"}
              </span>
              {message.role === "assistant" && message.llm?.providerMeta?.fallbackUsed ? (
                <span
                  className="message-badge"
                  title="链路切到备用回复"
                >
                  兜底回应
                </span>
              ) : null}
            </div>
            <p>
              {message.content}
              {message.streaming ? <span className="stream-caret" /> : null}
            </p>
          </div>
        </article>
      ))}

      {isBusy && !hasStreamingAssistant ? (
        <article className="message-row is-assistant">
          <div className="message-bubble is-pending">
            <span className="message-role">{assistantName || "Vela"}</span>
            <p>让我先把这句话接稳一点。</p>
          </div>
        </article>
      ) : null}
    </div>
  );
}

const WAKE_TRANSITION_MS = 220;
const WAKE_PROGRESS_MIN_MS = 5200;
const WAKE_SUCCESS_HOLD_MS = 5000;

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function OnboardingPanel({ onboarding, onConfirm, onComplete, isSubmitting }) {
  const [userName, setUserName] = useState(onboarding.fields.userName || "");
  const [phase, setPhase] = useState("welcome");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    setPhase("welcome");
    setSubmitError("");
    setUserName(onboarding.fields.userName || "");
  }, [onboarding.fields.userName, onboarding.required]);

  async function handleWakeSubmit(event) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setSubmitError("");
    setPhase("waking");

    try {
      const payload = {
        velaName: onboarding.fields.velaName || "Vela",
        userName: userName.trim(),
        temperament: onboarding.fields.temperament || "gentle-cool",
        distance: onboarding.fields.distance || "warm"
      };
      const [nextState] = await Promise.all([
        onConfirm(payload),
        wait(WAKE_PROGRESS_MIN_MS)
      ]);

      setPhase("success");
      await wait(WAKE_SUCCESS_HOLD_MS);
      onComplete(nextState);
    } catch (error) {
      setPhase("setup");
      setSubmitError(error.message || "唤醒失败，请再试一次。");
    }
  }

  return (
    <section className="chat-shell onboarding-shell">
      <div className="chat-header">
        <div>
          <span className="eyebrow">First Wake</span>
          <h2>把这次见面做成自然唤醒。</h2>
          <p>先轻轻叫醒她，再从第一句话开始。</p>
        </div>
      </div>

      <div className="onboarding-form">
        {phase === "welcome" ? (
          <section className="onboarding-step" key="welcome">
            <div className="onboarding-copy">
              <span className="onboarding-step-label">Step 1 / 4</span>
              <p>欢迎来到 Vela。准备好后，我们就开始唤醒她。</p>
            </div>
            <div className="composer-actions">
              <span className="onboarding-hint">这一步只做开始，先轻轻叫醒她。</span>
              <button
                type="button"
                onClick={() => setPhase("setup")}
                disabled={isSubmitting}
              >
                开始唤醒她
              </button>
            </div>
          </section>
        ) : null}

        {phase === "setup" ? (
          <form className="onboarding-step" onSubmit={handleWakeSubmit} key="setup">
            <div className="onboarding-copy">
              <span className="onboarding-step-label">Step 2 / 4</span>
              <p>{onboarding.prompt}</p>
            </div>

            <label className="field-block">
              <span>她怎么称呼你会更自然？</span>
              <input
                value={userName}
                onChange={(event) => setUserName(event.target.value)}
                placeholder="可以留空，后面再改"
              />
            </label>

            <div className="composer-actions">
              {submitError ? (
                <p className="error-text">{submitError}</p>
              ) : (
                <span className="onboarding-hint">先完成这个轻设置，其它内容后面再说。</span>
              )}
              <button type="submit" disabled={isSubmitting}>
                进入唤醒
              </button>
            </div>
          </form>
        ) : null}

        {phase === "waking" ? (
          <section className="onboarding-step onboarding-status" key="waking">
            <div className="onboarding-copy">
              <span className="onboarding-step-label">Step 3 / 4</span>
              <p className="onboarding-status-title">唤醒中</p>
              <p>正在把语气和记忆慢慢接上，请稍等片刻。</p>
            </div>
          </section>
        ) : null}

        {phase === "success" ? (
          <section className="onboarding-step onboarding-status" key="success">
            <div className="onboarding-copy">
              <span className="onboarding-step-label">Step 4 / 4</span>
              <p className="onboarding-status-title">唤醒成功</p>
              <p>她已经在场。接下来会平滑进入主界面。</p>
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}

export default function App() {
  const [state, setState] = useState(initialState);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [isMainEntering, setIsMainEntering] = useState(false);
  const [isSwitchingVoice, setIsSwitchingVoice] = useState(false);
  const [isSwitchingThinking, setIsSwitchingThinking] = useState(false);
  const [error, setError] = useState("");
  const audioPlayerRef = useRef(null);

  useEffect(() => {
    const player = new AudioPlayerService();
    audioPlayerRef.current = player;

    return () => {
      void player.dispose();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const nextState = await window.vela.bootstrap();
        if (isMounted) {
          setState(nextState);
          setIsMainEntering(false);
        }
      } catch (bootstrapError) {
        if (isMounted) {
          setError(bootstrapError.message || "启动 Vela 失败。");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = window.vela.onEvent((event) => {
      if (event.type === "speech-audio-chunk") {
        audioPlayerRef.current?.appendChunk(event.chunk);
      }

      if (event.type === "speech-finished") {
        if (event.cancelled) {
          audioPlayerRef.current?.reset();
        } else {
          audioPlayerRef.current?.finish(event.sessionId || "vela-tts");
        }
      }

      if (event.type === "speech-error") {
        audioPlayerRef.current?.reset();
      }

      setState((current) => applyRuntimeEvent(current, event));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (state.voiceMode.enabled) {
      return undefined;
    }

    if (state.avatar?.presence !== "speaking") {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setState((current) => {
        if (current.voiceMode.enabled || current.avatar?.presence !== "speaking") {
          return current;
        }

        const nextAvatar = settleAvatarState(current.avatar, {
          voiceModeEnabled: false
        });

        return {
          ...current,
          avatar: nextAvatar,
          status: {
            ...(current.status || {}),
            phase: nextAvatar.presence
          }
        };
      });
    }, 1100);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [state.avatar, state.voiceMode.enabled]);

  useEffect(() => {
    if (!state.avatar?.cameraHoldMs || state.avatar.camera !== "close") {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setState((current) => {
        if (!current.avatar || current.avatar.camera !== "close") {
          return current;
        }

        return {
          ...current,
          avatar: releaseCloseCamera(current.avatar)
        };
      });
    }, state.avatar.cameraHoldMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [state.avatar]);

  useEffect(() => {
    if (!isMainEntering) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setIsMainEntering(false);
    }, WAKE_TRANSITION_MS + 30);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isMainEntering]);

  const headerMeta = useMemo(() => {
    if (!state.session) {
      return "慢一点也没关系，她会等你。";
    }

    return `这次已经聊到第 ${state.session.launchTurnCount} 轮 · 你们一共聊过 ${state.session.lifetimeTurnCount} 轮`;
  }, [state.session]);

  const canInterrupt = useMemo(() => {
    return (
      state.status?.phase === "speaking" ||
      ["queued", "speaking", "finishing"].includes(state.status?.speech?.status)
    );
  }, [state.status]);
  const latestAssistantProviderMeta = useMemo(
    () => getLatestAssistantProviderMeta(state.messages),
    [state.messages]
  );
  const voiceModeCopy = useMemo(
    () => buildVoiceModeCopy(state.voiceMode),
    [state.voiceMode]
  );
  const fallbackNotice = useMemo(() => {
    if (!latestAssistantProviderMeta?.fallbackUsed) {
      return "";
    }

    if (
      latestAssistantProviderMeta?.adapter === "mock" &&
      latestAssistantProviderMeta.fallbackReason?.includes("missing-api-key")
    ) {
      return "外部模型这轮没接上，刚才那句先由本地兜底接住了。";
    }

    return "刚才那句走了兜底链路，但对话没有断。";
  }, [latestAssistantProviderMeta]);
  const naturalComposerHint = useMemo(() => {
    if (state.voiceMode.enabled && !state.voiceMode.available) {
      return "她还没法真正开口，这一轮先让文字替她把话接住。";
    }

    if (fallbackNotice) {
      return "先继续说下去，她会把这一轮稳住。";
    }

    return "不用整理得太完整，先把最想说的那句交给她。";
  }, [fallbackNotice, state.voiceMode.available, state.voiceMode.enabled]);

  async function handleOnboarding(payload) {
    setIsOnboarding(true);
    setError("");

    try {
      return await window.vela.completeOnboarding(payload);
    } catch (submitError) {
      const message = submitError.message || "初始化失败。";
      setError(message);
      throw new Error(message);
    } finally {
      setIsOnboarding(false);
    }
  }

  function handleOnboardingComplete(nextState) {
    setError("");
    setState(nextState);
    setIsMainEntering(true);
  }

  async function handleInterrupt() {
    setError("");

    try {
      const nextState = await window.vela.interruptOutput();
      audioPlayerRef.current?.reset();
      setState(nextState);
    } catch (interruptError) {
      setError(interruptError.message || "停止当前语音失败。");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmed = draft.trim();
    if (!trimmed || isSending) {
      return;
    }

    if (canInterrupt) {
      try {
        const interruptedState = await window.vela.interruptOutput();
        audioPlayerRef.current?.reset();
        setState(interruptedState);
      } catch (interruptError) {
        setError(interruptError.message || "打断当前输出失败。");
      }
    }

    const optimisticMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed
    };

    setDraft("");
    setError("");
    setIsSending(true);
    setState((current) => ({
      ...current,
      welcomeNote: "",
      avatar: current.avatar
        ? {
            ...current.avatar,
            presence: "thinking",
            label: "她停一下在想",
            action: "none",
            actionLabel: "安静地待着",
            caption: "她停了一下，在想怎么把这句接住。"
          }
        : current.avatar,
      status: {
        ...(current.status || {}),
        phase: "thinking"
      },
      messages: [...current.messages, optimisticMessage]
    }));

    try {
      const nextState = await window.vela.sendMessage(trimmed);
      setState(nextState);
    } catch (sendError) {
      setError(sendError.message || "消息发送失败。");
      audioPlayerRef.current?.reset();
    } finally {
      setIsSending(false);
    }
  }

  async function handleVoiceToggle() {
    setIsSwitchingVoice(true);
    setError("");

    try {
      const nextState = await window.vela.setVoiceMode(!state.voiceMode.enabled);
      if (state.voiceMode.enabled) {
        audioPlayerRef.current?.reset();
      }
      setState(nextState);
    } catch (toggleError) {
      setError(toggleError.message || "语音模式切换失败。");
    } finally {
      setIsSwitchingVoice(false);
    }
  }

  async function handleThinkingModeChange(mode) {
    if (!mode || mode === state.thinkingMode || isSwitchingThinking) {
      return;
    }

    setIsSwitchingThinking(true);
    setError("");

    try {
      const nextState = await window.vela.setThinkingMode(mode);
      setState(nextState);
    } catch (modeError) {
      setError(modeError.message || "thinking mode 切换失败。");
    } finally {
      setIsSwitchingThinking(false);
    }
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      {isLoading ? (
        <div className="loading-screen">Vela 正在把记忆和语气接回来...</div>
      ) : (
        <div className="surface">
          <AvatarPanel
            avatar={state.avatar}
            avatarAsset={state.avatarAsset}
            app={state.app}
            persona={state.persona}
            voiceMode={state.voiceMode}
          />

          {state.onboarding?.required ? (
            <OnboardingPanel
              onboarding={state.onboarding}
              onConfirm={handleOnboarding}
              onComplete={handleOnboardingComplete}
              isSubmitting={isOnboarding}
            />
          ) : (
            <section className={`chat-shell ${isMainEntering ? "is-main-enter" : ""}`}>
              <header className="chat-header">
                <div className="chat-header-copy">
                  <span className="eyebrow">你们的对话</span>
                  <h2>慢慢说，她会接住。</h2>
                  <p>{headerMeta}</p>
                </div>
              </header>

              {fallbackNotice ? (
                <div className="fallback-banner">{fallbackNotice}</div>
              ) : null}

              <MessageList
                messages={state.messages}
                welcomeNote={state.welcomeNote}
                isBusy={isSending}
                assistantName={state.persona?.name || "Vela"}
              />

              <form className="composer" onSubmit={handleSubmit}>
                <div className="composer-tools">
                  <button
                    type="button"
                    className={`voice-toggle ${state.voiceMode.enabled ? "is-active" : ""}`}
                    onClick={handleVoiceToggle}
                    disabled={isSwitchingVoice}
                  >
                    <span>回应方式</span>
                    <strong>{voiceModeCopy.title}</strong>
                    <small>{voiceModeCopy.detail}</small>
                  </button>

                  <div className="thinking-panel">
                    <span className="tool-label">回应节奏</span>
                    <div className="thinking-row">
                      {state.thinkingModes.map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          className={`thinking-chip ${state.thinkingMode === mode.id ? "is-active" : ""}`}
                          onClick={() => handleThinkingModeChange(mode.id)}
                          disabled={isSwitchingThinking}
                          title={mode.summary}
                        >
                          {formatThinkingModeLabel(mode.id)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <label className="composer-field">
                  <span className="sr-only">输入消息</span>
                  <textarea
                    rows="3"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={
                      state.voiceMode.enabled
                        ? state.voiceMode.available
                          ? "先把话打下来。她会尽量开口回你。"
                          : "先把话打下来。她还没法开口，但不会影响继续聊。"
                        : "把今晚最想说的那句话交给她。"
                    }
                  />
                </label>

                <div className="composer-actions">
                  {error ? (
                    <p className="error-text">{error}</p>
                  ) : (
                    <span className="composer-hint">{naturalComposerHint}</span>
                  )}
                  <div className="composer-buttons">
                    {canInterrupt ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={handleInterrupt}
                      >
                        先停一下
                      </button>
                    ) : null}
                    <button type="submit" disabled={isSending || !draft.trim()}>
                      {isSending ? "她在接" : "交给她"}
                    </button>
                  </div>
                </div>
              </form>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
