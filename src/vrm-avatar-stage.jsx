import { useEffect, useRef, useState } from "react";
import { VrmAvatarController } from "./core/vrm-avatar-controller.js";

export function VrmAvatarStage({ avatar, avatarAsset }) {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const controllerRef = useRef(null);
  const [controllerReady, setControllerReady] = useState(false);
  const [loadState, setLoadState] = useState({
    status: "idle",
    message: ""
  });

  useEffect(() => {
    if (!canvasRef.current || !stageRef.current) {
      return undefined;
    }

    const controller = new VrmAvatarController({
      canvas: canvasRef.current
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

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
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
    </div>
  );
}
