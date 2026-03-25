import { useEffect, useRef, useState } from "react";
import { VrmAvatarController } from "./core/vrm-avatar-controller.js";

const DAY_BACKGROUND_PATH = "D:\\Vela\\assets\\backgrounds\\bg-day.png";
const NIGHT_BACKGROUND_PATH = "D:\\Vela\\assets\\backgrounds\\bg-night.png";
const BACKGROUND_REFRESH_MS = 5 * 60 * 1000;

function toBlobPart(binaryPayload) {
  if (binaryPayload instanceof ArrayBuffer) {
    return binaryPayload;
  }

  if (ArrayBuffer.isView(binaryPayload)) {
    return binaryPayload.buffer.slice(
      binaryPayload.byteOffset,
      binaryPayload.byteOffset + binaryPayload.byteLength
    );
  }

  return binaryPayload;
}

function getTimeSceneType(date = new Date()) {
  const hour = date.getHours();
  return hour >= 6 && hour < 18 ? "day" : "night";
}

export function VrmAvatarStage({ avatar, avatarAsset }) {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const controllerRef = useRef(null);
  const [controllerReady, setControllerReady] = useState(false);
  const [demoLabel, setDemoLabel] = useState(null);
  const [sceneType, setSceneType] = useState(() => getTimeSceneType());
  const [backgrounds, setBackgrounds] = useState({
    day: "",
    night: ""
  });
  const [loadState, setLoadState] = useState({
    status: "idle",
    message: ""
  });

  useEffect(() => {
    setSceneType(getTimeSceneType());

    const intervalId = window.setInterval(() => {
      const nextSceneType = getTimeSceneType();
      setSceneType((prev) => (prev === nextSceneType ? prev : nextSceneType));
    }, BACKGROUND_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const objectUrls = [];

    async function loadBackgrounds() {
      if (typeof window.vela?.readBinaryFile !== "function") {
        return;
      }

      try {
        const [dayPayload, nightPayload] = await Promise.all([
          window.vela.readBinaryFile(DAY_BACKGROUND_PATH),
          window.vela.readBinaryFile(NIGHT_BACKGROUND_PATH)
        ]);

        if (cancelled) {
          return;
        }

        const dayBlob = new Blob([toBlobPart(dayPayload)], { type: "image/png" });
        const nightBlob = new Blob([toBlobPart(nightPayload)], { type: "image/png" });

        const dayUrl = URL.createObjectURL(dayBlob);
        const nightUrl = URL.createObjectURL(nightBlob);

        objectUrls.push(dayUrl, nightUrl);

        setBackgrounds({
          day: dayUrl,
          night: nightUrl
        });
      } catch {
        // Keep existing gradient backdrop if binary scene backgrounds fail to load.
      }
    }

    void loadBackgrounds();

    return () => {
      cancelled = true;
      objectUrls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !stageRef.current) {
      return undefined;
    }

    const controller = new VrmAvatarController({
      canvas: canvasRef.current,
      onPresetDemoStateChange: (state) => {
        setDemoLabel(state.enabled ? state.emotion : null);
      }
    });
    controllerRef.current = controller;
    setControllerReady(true);

    const setMouthOpenness = (value) => {
      controllerRef.current?.setMouthOpenness?.(value);
    };

    const setVisemeWeights = (visemeMap) => {
      controllerRef.current?.setVisemeWeights?.(visemeMap);
    };

    window.__velaSetMouthOpenness = setMouthOpenness;
    window.__velaSetVisemeWeights = setVisemeWeights;

    const resize = () => {
      const stageNode = stageRef.current;

      if (!stageNode) {
        return;
      }

      const rect = stageNode.getBoundingClientRect();
      controller.resize(rect.width, rect.height);
    };

    resize();

    const resizeObserver = new ResizeObserver(() => {
      resize();
    });
    resizeObserver.observe(stageRef.current);

    let animationFrameId = 0;
    let lastFrameAt = performance.now();

    const tick = (frameAt) => {
      controller.update((frameAt - lastFrameAt) / 1000);
      lastFrameAt = frameAt;
      animationFrameId = window.requestAnimationFrame(tick);
    };

    animationFrameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();

      if (window.__velaSetMouthOpenness === setMouthOpenness) {
        delete window.__velaSetMouthOpenness;
      }
      if (window.__velaSetVisemeWeights === setVisemeWeights) {
        delete window.__velaSetVisemeWeights;
      }

      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.setAvatarState(avatar);
  }, [avatar]);

  useEffect(() => {
    if (!controllerReady) {
      return undefined;
    }

    const controller = controllerRef.current;
    const assetPath = String(avatarAsset?.path || "").trim();

    if (!controller || !assetPath) {
      setLoadState({
        status: "error",
        message: "Avatar asset path missing"
      });
      return undefined;
    }

    if (typeof window.vela?.readBinaryFile !== "function") {
      setLoadState({
        status: "error",
        message: "Binary asset bridge unavailable"
      });
      return undefined;
    }

    let cancelled = false;
    setLoadState({
      status: "loading",
      message: "Loading EKU VRM..."
    });

    controller.load({
      assetPath,
      readBinaryFile: (path) => window.vela.readBinaryFile(path)
    })
      .then(() => {
        if (cancelled) {
          return;
        }

        setLoadState({
          status: "ready",
          message: ""
        });

        // Auto-start preset demo if URL has ?preset-demo=true
        const params = new URLSearchParams(window.location.search);
        if (params.get("preset-demo") === "true" && controller) {
          controller.setPresetDemo({
            enabled: true,
            index: 0,
            emotion: "calm",
            label: "calm"
          });
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setLoadState({
          status: "error",
          message: error.message || "Failed to load VRM"
        });
      });

    return () => {
      cancelled = true;
    };
  }, [avatarAsset?.path, controllerReady]);

  const dayVisible = sceneType === "day";

  return (
    <div className="avatar-render-layer" ref={stageRef}>
      <div className="avatar-scene-background" aria-hidden="true">
        {backgrounds.day ? (
          <img
            className={`avatar-scene-image ${dayVisible ? "is-visible" : ""}`}
            src={backgrounds.day}
            alt=""
            draggable={false}
          />
        ) : null}
        {backgrounds.night ? (
          <img
            className={`avatar-scene-image ${!dayVisible ? "is-visible" : ""}`}
            src={backgrounds.night}
            alt=""
            draggable={false}
          />
        ) : null}
      </div>
      <canvas
        ref={canvasRef}
        className="avatar-render-canvas"
        aria-label="Vela VRM avatar"
      />
      {loadState.status !== "ready" ? (
        <div
          className={`avatar-stage-note ${
            loadState.status === "error" ? "is-error" : ""
          }`}
        >
          {loadState.message}
        </div>
      ) : null}
      {demoLabel ? (
        <div style={{
          position: "absolute",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          padding: "6px 18px",
          borderRadius: 8,
          background: "rgba(0,0,0,0.65)",
          color: "#fff",
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: 1,
          zIndex: 100,
          pointerEvents: "none",
          fontFamily: "system-ui, sans-serif"
        }}>
          {demoLabel}
        </div>
      ) : null}
    </div>
  );
}
