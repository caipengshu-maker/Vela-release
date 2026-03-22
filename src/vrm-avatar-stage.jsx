import { useEffect, useRef, useState } from "react";
import { VrmAvatarController } from "./core/vrm-avatar-controller.js";

export function VrmAvatarStage({ avatar, avatarAsset }) {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const controllerRef = useRef(null);
  const [controllerReady, setControllerReady] = useState(false);
  const [demoLabel, setDemoLabel] = useState(null);
  const [loadState, setLoadState] = useState({
    status: "idle",
    message: ""
  });

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

    // Press 'P' to toggle preset demo mode
    const onKeyDown = (e) => {
      if (e.key === "p" || e.key === "P") {
        const ctrl = controllerRef.current;
        if (!ctrl) return;
        const isOn = ctrl.presetDemoState?.enabled;
        ctrl.setPresetDemo({
          enabled: !isOn,
          index: 0,
          emotion: "calm",
          label: "calm"
        });
        console.log(`[VRM] Preset demo ${!isOn ? "ON" : "OFF"} (press P to toggle)`);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener("keydown", onKeyDown);
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

  return (
    <div className="avatar-render-layer" ref={stageRef}>
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
