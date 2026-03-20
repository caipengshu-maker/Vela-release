import { useEffect, useMemo, useRef, useState } from "react";
import { AudioStreamPlayer } from "./audio-stream-player.js";
import {
  releaseCloseCamera,
  settleAvatarState
} from "./core/avatar-state.js";

const initialState = {
  app: null,
  persona: null,
  avatar: null,
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

function AvatarPanel({ avatar, app, persona, memoryPeek, status, voiceMode }) {
  const phases = ["idle", "listening", "thinking", "speaking"];

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
          <div className="avatar-silhouette">
            <div className="avatar-face avatar-face-left" />
            <div className="avatar-face avatar-face-right" />
            <div className="avatar-mouth" />
          </div>
          <div className="shot-chip">{avatar?.cameraLabel || "远景"}</div>
        </div>

        <div className="panel-copy">
          <span className="eyebrow">{app?.tagline}</span>
          <h1>{persona?.name || "Vela"}</h1>
          <p>{persona?.shortBio}</p>
        </div>

        <div className="status-row">
          <span className="status-pill">{avatar?.label || "静静在场"}</span>
          <span className="status-pill subtle">{avatar?.emotionLabel || "平静"}</span>
          <span className="status-pill subtle">{avatar?.actionLabel || "停稳"}</span>
        </div>

        <div className="phase-strip">
          {phases.map((phase) => (
            <span
              key={phase}
              className={`phase-chip ${status?.phase === phase ? "is-active" : ""}`}
            >
              {phase}
            </span>
          ))}
        </div>

        <p className="status-caption">{avatar?.caption || "她在这里。"} </p>

        <div className="presence-grid">
          <div className="presence-card">
            <span className="presence-label">Voice</span>
            <strong>
              {voiceMode.enabled
                ? voiceMode.available
                  ? "text-in / voice-out"
                  : "voice route pending"
                : "text-in / text-out"}
            </strong>
            <small>{status?.speech?.status || "idle"}</small>
          </div>
          <div className="presence-card">
            <span className="presence-label">ASR</span>
            <strong>{status?.asr?.available ? "ready" : "placeholder"}</strong>
            <small>{status?.asr?.reason || "asr-disabled"}</small>
          </div>
        </div>

        <div className="memory-card">
          <span className="memory-label">最近留下的线索</span>
          <p>{memoryPeek?.summary || "还没有新的会话摘要。先说第一句吧。"}</p>
          {memoryPeek?.createdAtLabel ? (
            <span className="memory-time">{memoryPeek.createdAtLabel}</span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function MessageList({ messages, welcomeNote, isBusy }) {
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
          <span>Tonight</span>
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
              {message.role === "assistant" ? "Vela" : "你"}
            </span>
            {message.role === "assistant" && message.llm?.providerMeta?.fallbackUsed ? (
              <span
                className="message-badge"
                title={message.llm.providerMeta.fallbackReason || "provider fallback"}
              >
                闄嶇骇鍥炲
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
            <span className="message-role">Vela</span>
            <p>让我先把这句话接稳一点。</p>
          </div>
        </article>
      ) : null}
    </div>
  );
}

function OnboardingPanel({ onboarding, onConfirm, isSubmitting }) {
  const [velaName, setVelaName] = useState(onboarding.fields.velaName || "Vela");
  const [userName, setUserName] = useState(onboarding.fields.userName || "");
  const [temperament, setTemperament] = useState(
    onboarding.fields.temperament || "gentle-cool"
  );
  const [distance, setDistance] = useState(
    onboarding.fields.distance || "warm"
  );

  async function handleSubmit(event) {
    event.preventDefault();
    await onConfirm({
      velaName: velaName.trim() || "Vela",
      userName: userName.trim(),
      temperament,
      distance
    });
  }

  return (
    <section className="chat-shell onboarding-shell">
      <div className="chat-header">
        <div>
          <span className="eyebrow">First Wake</span>
          <h2>先别把这一步做成填表。</h2>
          <p>你不是在配置一个工具，而是在决定她第一次怎么醒来。</p>
        </div>
      </div>

      <form className="onboarding-form" onSubmit={handleSubmit}>
        <div className="onboarding-copy">
          <p>{onboarding.prompt}</p>
        </div>

        <label className="field-block">
          <span>她先叫什么？</span>
          <input
            value={velaName}
            onChange={(event) => setVelaName(event.target.value)}
            placeholder="Vela"
          />
        </label>

        <label className="field-block">
          <span>她怎么叫你会更顺？</span>
          <input
            value={userName}
            onChange={(event) => setUserName(event.target.value)}
            placeholder="可以留空，后面再说"
          />
        </label>

        <div className="field-block">
          <span>先给她一个气质底色</span>
          <div className="choice-grid">
            {onboarding.options.temperament.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`choice-card ${temperament === option.id ? "is-active" : ""}`}
                onClick={() => setTemperament(option.id)}
              >
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="field-block">
          <span>你想让她一开始离你多近？</span>
          <div className="choice-grid compact">
            {onboarding.options.distance.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`choice-card ${distance === option.id ? "is-active" : ""}`}
                onClick={() => setDistance(option.id)}
              >
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="composer-actions">
          <span className="onboarding-hint">后面都还能改，现在只先把她温和地叫醒。</span>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "唤醒中" : "让她这样醒来"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default function App() {
  const [state, setState] = useState(initialState);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [isSwitchingVoice, setIsSwitchingVoice] = useState(false);
  const [isSwitchingThinking, setIsSwitchingThinking] = useState(false);
  const [error, setError] = useState("");
  const audioElementRef = useRef(null);
  const audioPlayerRef = useRef(null);

  useEffect(() => {
    const player = new AudioStreamPlayer();
    player.attach(audioElementRef.current);
    audioPlayerRef.current = player;

    return () => {
      player.reset();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const nextState = await window.vela.bootstrap();
        if (isMounted) {
          setState(nextState);
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
        audioPlayerRef.current?.appendChunk({
          sessionId: event.chunk.sessionId || "vela-tts",
          mimeType: event.chunk.mimeType || "audio/mpeg",
          hex: event.chunk.hex
        });
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

  const headerMeta = useMemo(() => {
    if (!state.session) {
      return "连续人格样机";
    }

    return `本轮 ${state.session.launchTurnCount} 轮 · 累计 ${state.session.lifetimeTurnCount} 轮`;
  }, [state.session]);

  const voiceSummary = useMemo(() => {
    if (!state.voiceMode.enabled) {
      return "text-in / text-out";
    }

    if (state.voiceMode.available) {
      return "text-in / voice-out";
    }

    return "voice route pending";
  }, [state.voiceMode]);

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
  const composerHint = useMemo(() => {
    if (state.voiceMode.enabled && !state.voiceMode.available) {
      return "MiniMax WebSocket TTS 鎺ュ彛浣嶅凡鎺ュソ锛屼絾褰撳墠缂?key 鎴栨湭鍚敤銆?";
    }

    if (
      latestAssistantProviderMeta?.fallbackUsed &&
      latestAssistantProviderMeta?.adapter === "mock" &&
      latestAssistantProviderMeta.fallbackReason?.includes("missing-api-key")
    ) {
      return "OPENAI_API_KEY 褰撳墠涓嶅彲鐢紝宸茶嚜鍔ㄩ檷绾у埌 mock provider銆?";
    }

    if (latestAssistantProviderMeta?.fallbackUsed) {
      return "涓婁竴鏉″洖澶嶅凡缁忚蛋浜嗛檷绾ч摼璺紝娑堟伅姘旀场涓婁細鏍囧嚭銆?";
    }

    return "鏂囨湰浼氳嚜鐒舵祦鍑烘潵锛屼笉鍐嶆暣娈佃烦鍑恒€?";
  }, [latestAssistantProviderMeta, state.voiceMode.available, state.voiceMode.enabled]);

  async function handleOnboarding(payload) {
    setIsOnboarding(true);
    setError("");

    try {
      const nextState = await window.vela.completeOnboarding(payload);
      setState(nextState);
    } catch (submitError) {
      setError(submitError.message || "初始化失败。");
    } finally {
      setIsOnboarding(false);
    }
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
            label: "在想",
            action: "none",
            actionLabel: "停稳",
            caption: "让我先把语境和旧事接上。"
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
      <audio ref={audioElementRef} className="sr-only" />

      {isLoading ? (
        <div className="loading-screen">Vela 正在把记忆和语气接回来...</div>
      ) : (
        <div className="surface">
          <AvatarPanel
            avatar={state.avatar}
            app={state.app}
            persona={state.persona}
            memoryPeek={state.memoryPeek}
            status={state.status}
            voiceMode={state.voiceMode}
          />

          {state.onboarding?.required ? (
            <OnboardingPanel
              onboarding={state.onboarding}
              onConfirm={handleOnboarding}
              isSubmitting={isOnboarding}
            />
          ) : (
            <section className="chat-shell">
              <header className="chat-header">
                <div>
                  <span className="eyebrow">Companion Prototype</span>
                  <h2>{state.app?.name || "Vela"}</h2>
                  <p>{headerMeta}</p>
                </div>

                <div className="header-controls">
                  <button
                    type="button"
                    className={`voice-toggle ${state.voiceMode.enabled ? "is-active" : ""}`}
                    onClick={handleVoiceToggle}
                    disabled={isSwitchingVoice}
                  >
                    <span>Voice Mode</span>
                    <strong>
                      {state.voiceMode.enabled ? "ON" : "OFF"}
                    </strong>
                  </button>

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
                        {mode.id}
                      </button>
                    ))}
                  </div>
                </div>
              </header>

              <div className="meta-bar">
                <span className="mode-pill active">{voiceSummary}</span>
                <span className="mode-pill">{state.status?.phase || "idle"}</span>
                <span className="mode-pill subtle">
                  speech: {state.status?.speech?.status || "idle"}
                </span>
                <span className="mode-pill subtle">
                  asr: {state.status?.asr?.status || "idle"}
                </span>
              </div>

              {latestAssistantProviderMeta?.fallbackUsed ? (
                <div className="fallback-banner">{composerHint}</div>
              ) : null}

              <MessageList
                messages={state.messages}
                welcomeNote={state.welcomeNote}
                isBusy={isSending}
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
                        ? "先保持 text-in。ASR 还在占位，但 voice-out 链路已经接上。"
                        : "把今晚最想说的那句话交给她。"
                    }
                  />
                </label>

                <div className="composer-actions">
                  {error ? <p className="error-text">{error}</p> : <span className="composer-hint">
                    {state.voiceMode.enabled && !state.voiceMode.available
                      ? "MiniMax WebSocket TTS 接口位已接好，但当前缺 key 或未启用。"
                      : "文本会自然流出来，不再整段跳出。"}
                  </span>}
                  <div className="composer-buttons">
                    {canInterrupt ? (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={handleInterrupt}
                      >
                        停止当前输出
                      </button>
                    ) : null}
                    <button type="submit" disabled={isSending || !draft.trim()}>
                      {isSending ? "回应中" : "发送"}
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
