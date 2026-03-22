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
  modelStatus: {
    availableModels: [],
    selectedModel: "auto",
    selectedLabel: "自动",
    activeLabel: "主模型",
    fallbackUsed: false,
    fallbackReason: null,
    manualSelection: false,
    cooldownUntil: null,
    cooldownActive: false
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

function Icon({ children, className = "", size = 20, strokeWidth = 1.8 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function MicIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
      <path d="M6 11.5a6 6 0 0 0 12 0" />
      <path d="M12 17.5V21" />
    </Icon>
  );
}

function SendIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 12h14" />
      <path d="m13 5 7 7-7 7" />
    </Icon>
  );
}

function ReplayIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3 11a8 8 0 1 1 2.34 5.66" />
      <path d="M3 5v6h6" />
    </Icon>
  );
}

function WaveIcon(props) {
  return (
    <Icon {...props}>
      <path d="M5 15c1.4 0 1.4-4 2.8-4S9.2 17 10.6 17s1.4-7 2.8-7 1.4 4 2.8 4 1.4-3 2.8-3" />
    </Icon>
  );
}

function UpRightIcon(props) {
  return (
    <Icon {...props}>
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
    </Icon>
  );
}

function upsertAssistantMessage(messages, messageId, content, streaming, patch = {}) {
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
      ...(patch.variant ? { variant: patch.variant } : {}),
      ...(patch.replayAudio ? { replayAudio: patch.replayAudio } : {}),
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
      ...(patch.variant ? { variant: patch.variant } : {}),
      ...(patch.replayAudio ? { replayAudio: patch.replayAudio } : {}),
      ...(patch.llm ? { llm: patch.llm } : {})
    });
  }

  return nextMessages;
}

function attachReplayToLatestAssistant(messages, replayAudio) {
  let applied = false;
  const nextMessages = [...messages];

  for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
    const message = nextMessages[index];
    if (message.role !== "assistant" || message.streaming) {
      continue;
    }

    nextMessages[index] = {
      ...message,
      replayAudio
    };
    applied = true;
    break;
  }

  return applied ? nextMessages : messages;
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

function buildAvatarPresenceCopy(avatar) {
  const presence = avatar?.presence || "idle";
  const emotion = avatar?.emotion || "calm";

  if (presence === "thinking") {
    return {
      kicker: "她在整理语气",
      title: "先把这句话接稳",
      caption: "会慢一点，但不会把你晾在这里。"
    };
  }

  if (presence === "listening") {
    return {
      kicker: "她在听",
      title: "你可以继续往下说",
      caption: "不用把第一句整理得太完整。"
    };
  }

  if (presence === "speaking") {
    if (emotion === "concerned") {
      return {
        kicker: "她放轻了语气",
        title: "更像是在先接住你",
        caption: "不是劝说，是先把情绪托住。"
      };
    }

    if (emotion === "affectionate" || emotion === "whisper") {
      return {
        kicker: "距离稍微近了一点",
        title: "但不会突然越界",
        caption: "亲近感应该自然，不该用力。"
      };
    }

    return {
      kicker: "她在回应",
      title: "把这句话慢慢接上",
      caption: "你说下去就好。"
    };
  }

  return {
    kicker: "她在这里",
    title: "等你开口",
    caption: "安静，但不是空白。"
  };
}

function buildVoiceModeCopy(voiceMode) {
  if (voiceMode.enabled && voiceMode.available) {
    return {
      title: "语音回复已开启",
      detail: "她会把回复说出来，也可以在消息里重播。"
    };
  }

  if (voiceMode.enabled) {
    return {
      title: "语音回复待命中",
      detail: "这轮先用文字继续，语音链路还没完全接上。"
    };
  }

  return {
    title: "当前以文字回复",
    detail: "需要时可以切到语音回复。"
  };
}

function buildModelNotice(modelStatus, providerMeta) {
  if (providerMeta?.fallbackUsed || modelStatus?.fallbackUsed) {
    return "当前使用备用模型";
  }

  if (modelStatus?.manualSelection) {
    return `当前固定为 ${modelStatus.activeLabel}`;
  }

  return `当前主模型：${modelStatus?.activeLabel || "主模型"}`;
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
      thinkingMode: event.thinkingMode || state.thinkingMode,
      modelStatus: event.modelStatus || state.modelStatus
    };
  }

  if (event.type === "assistant-stream-start") {
    return {
      ...state,
      messages: upsertAssistantMessage(state.messages, event.messageId, "", true)
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

function StatusBadge({ label, subtle = false, icon = null }) {
  return (
    <div className={`status-badge ${subtle ? "is-subtle" : ""}`}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

function AvatarPanel({ avatar, avatarAsset, app, persona }) {
  const presenceCopy = buildAvatarPresenceCopy(avatar);

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
          {!avatarAsset?.path ? (
            <div className="stage-copy">
              <span className="stage-kicker">{presenceCopy.kicker}</span>
              <strong>{presenceCopy.title}</strong>
              <p>{avatar?.caption || presenceCopy.caption}</p>
            </div>
          ) : null}
        </div>

        <div className="panel-copy">
          <span className="eyebrow">{app?.tagline || "克制而持续地在场"}</span>
          <h1>{persona?.name || "Vela"}</h1>
          <p>{persona?.shortBio}</p>
        </div>

      </div>
    </section>
  );
}

function MessageList({ messages, welcomeNote, isBusy, assistantName, onReplay }) {
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
          <p>想说什么就说什么，她在听。</p>
        </div>
      ) : null}

      {messages.map((message) => (
        <article
          key={message.id}
          className={`message-row is-${message.role} ${message.variant === "system-tip" ? "is-system-tip" : ""}`}
        >
          <div
            className={`message-bubble ${message.streaming ? "is-streaming" : ""} ${message.variant === "system-tip" ? "is-tip" : ""}`}
          >
            <div className="message-heading">
              <span className="message-role">
                {message.role === "assistant" ? assistantName || "Vela" : "你"}
              </span>
              {message.replayAudio ? (
                <button
                  type="button"
                  className="message-icon-button"
                  onClick={() => onReplay(message.replayAudio)}
                  title="重播语音"
                >
                  <ReplayIcon size={16} />
                </button>
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
            <p>她正在把这句话接稳。</p>
          </div>
        </article>
      ) : null}
    </div>
  );
}

const WAKE_TRANSITION_MS = 220;
const WAKE_PROGRESS_MIN_MS = 3200;
const WAKE_SUCCESS_HOLD_MS = 1600;

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
        <div className="chat-header-copy">
          <span className="eyebrow">First Wake</span>
          <h2>把这次见面做成自然唤醒</h2>
          <p>不用填很多设置，先轻轻叫醒她。</p>
        </div>
      </div>

      <div className="onboarding-form">
        {phase === "welcome" ? (
          <section className="onboarding-step">
            <div className="onboarding-copy">
              <span className="onboarding-step-label">Step 1 / 4</span>
              <p>准备好后，我们就从第一声称呼开始。</p>
            </div>
            <div className="composer-actions">
              <span className="onboarding-hint">这一步只负责开始，不需要复杂设置。</span>
              <button type="button" onClick={() => setPhase("setup")} disabled={isSubmitting}>
                开始唤醒
              </button>
            </div>
          </section>
        ) : null}

        {phase === "setup" ? (
          <form className="onboarding-step" onSubmit={handleWakeSubmit}>
            <div className="onboarding-copy">
              <span className="onboarding-step-label">Step 2 / 4</span>
              <p>{onboarding.prompt}</p>
            </div>

            <label className="field-block">
              <span>她怎么叫你会更自然？</span>
              <input
                value={userName}
                onChange={(event) => setUserName(event.target.value)}
                placeholder="可以留空，之后再改"
              />
            </label>

            <div className="composer-actions">
              {submitError ? (
                <p className="error-text">{submitError}</p>
              ) : (
                <span className="onboarding-hint">先完成这个轻设置，其他内容后面再说。</span>
              )}
              <button type="submit" disabled={isSubmitting}>
                进入唤醒
              </button>
            </div>
          </form>
        ) : null}

        {phase === "waking" ? (
          <section className="onboarding-step onboarding-status">
            <div className="onboarding-copy">
              <span className="onboarding-step-label">Step 3 / 4</span>
              <p className="onboarding-status-title">正在唤醒</p>
              <p>她的语气、记忆和关系状态正在对齐，请稍等片刻。</p>
            </div>
          </section>
        ) : null}

        {phase === "success" ? (
          <section className="onboarding-step onboarding-status">
            <div className="onboarding-copy">
              <span className="onboarding-step-label">Step 4 / 4</span>
              <p className="onboarding-status-title">唤醒完成</p>
              <p>她已经在这里了，接下来直接开始对话就好。</p>
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

      const replay =
        event.type === "speech-finished" && !event.cancelled
          ? audioPlayerRef.current?.finish(event.sessionId || "vela-tts")
          : null;

      if (event.type === "speech-finished" && event.cancelled) {
        audioPlayerRef.current?.reset();
      }

      if (event.type === "speech-error") {
        audioPlayerRef.current?.reset();
      }

      setState((current) => {
        const nextState = applyRuntimeEvent(current, event);

        if (replay?.url) {
          return {
            ...nextState,
            messages: attachReplayToLatestAssistant(nextState.messages, replay)
          };
        }

        return nextState;
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (state.voiceMode.enabled || state.avatar?.presence !== "speaking") {
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


  const naturalComposerHint = useMemo(() => {
    if (state.voiceMode.enabled && !state.voiceMode.available) {
      return "语音回复还没完全接通，这轮会先用文字继续。";
    }

    if (state.modelStatus?.fallbackUsed || latestAssistantProviderMeta?.fallbackUsed) {
      return "当前会自动走备用模型，不影响继续对话。";
    }

    return "不用整理得太完整，先说最想说的那一句。";
  }, [
    latestAssistantProviderMeta?.fallbackUsed,
    state.modelStatus?.fallbackUsed,
    state.voiceMode.available,
    state.voiceMode.enabled
  ]);

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
            actionLabel: "安静地等着",
            caption: "她在想怎么把这句话接稳。"
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

  function handleReplay(replayAudio) {
    audioPlayerRef.current?.playReplay(replayAudio);
  }

  return (
    <main className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      {isLoading ? (
        <div className="loading-screen">Vela 正在把记忆和状态接回来…</div>
      ) : (
        <div className="surface">
          <AvatarPanel
            avatar={state.avatar}
            avatarAsset={state.avatarAsset}
            app={state.app}
            persona={state.persona}
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

              <MessageList
                messages={state.messages}
                welcomeNote={state.welcomeNote}
                isBusy={isSending}
                assistantName={state.persona?.name || "Vela"}
                onReplay={handleReplay}
              />

              <form className="composer" onSubmit={handleSubmit}>
                <label className="composer-field">
                  <span className="sr-only">输入消息</span>
                  <textarea
                    rows="3"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={
                      state.voiceMode.enabled
                        ? state.voiceMode.available
                          ? "先把话写下来，她会尽量开口回应你。"
                          : "先把话写下来，文字回复不会受影响。"
                        : "把现在最想说的那句交给她。"
                    }
                  />

                  <div className="composer-primary-action">
                    {draft.trim() ? (
                      <button
                        type="submit"
                        className="round-action primary"
                        disabled={isSending}
                        title="发送"
                      >
                        <SendIcon size={18} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`round-action ${state.voiceMode.enabled ? "is-active" : ""}`}
                        onClick={handleVoiceToggle}
                        disabled={isSwitchingVoice}
                        title={state.voiceMode.enabled ? "关闭语音回复" : "开启语音回复"}
                      >
                        <MicIcon size={18} />
                      </button>
                    )}
                  </div>
                </label>

                <div className="composer-actions">
                  {error ? (
                    <p className="error-text">{error}</p>
                  ) : (
                    <span className="composer-hint">{naturalComposerHint}</span>
                  )}

                  <div className="composer-secondary-actions">
                    {canInterrupt ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={handleInterrupt}
                      >
                        <UpRightIcon size={15} />
                        <span>先停一下</span>
                      </button>
                    ) : null}
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




