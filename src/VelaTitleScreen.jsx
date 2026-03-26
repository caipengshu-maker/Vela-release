import { useEffect, useMemo, useRef, useState } from "react";
import { createBundledAssetObjectUrl } from "./core/renderer-assets.js";

const TITLE_LOGO_PATH = "assets/splash/vela-title-logo.png";
const FADE_OUT_MS = 900;
const MIN_DISPLAY_MS = 1800;

export function VelaTitleScreen({ isReady, canExit = false, onDone }) {
  const [logoSrc, setLogoSrc] = useState("");
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(0);
  const mountedAtRef = useRef(Date.now());
  const hasFiredDone = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";

    async function loadLogo() {
      try {
        objectUrl = await createBundledAssetObjectUrl(
          TITLE_LOGO_PATH,
          "image/png"
        );
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = "";
          return;
        }
        setLogoSrc(objectUrl);
      } catch {
        // Title screen works fine without the logo (just progress line).
      }
    }

    void loadLogo();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, []);

  // Simulated progress that accelerates when ready
  useEffect(() => {
    let raf;
    let last = performance.now();

    function tick(now) {
      const dt = now - last;
      last = now;

      setProgress((prev) => {
        if (prev >= 1) return 1;

        // Before ready: crawl slowly toward ~70%
        // After ready: rush to 100%
        if (!isReady) {
          const target = 0.7;
          const speed = 0.0003; // slow crawl
          return prev + (target - prev) * speed * dt;
        }

        // Ready: fast fill to 100%
        const speed = 0.006;
        return Math.min(1, prev + speed * dt);
      });

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [isReady]);

  // When progress hits 1 and min display time has passed, begin exit
  useEffect(() => {
    if (progress < 1 || !canExit || isExiting || hasFiredDone.current) {
      return;
    }

    const elapsed = Date.now() - mountedAtRef.current;
    const delay = Math.max(0, MIN_DISPLAY_MS - elapsed);

    const timer = window.setTimeout(() => {
      setIsExiting(true);
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [canExit, progress, isExiting]);

  useEffect(() => {
    if (!isExiting || hasFiredDone.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (!hasFiredDone.current) {
        hasFiredDone.current = true;
        onDone?.();
      }
    }, FADE_OUT_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isExiting, onDone]);

  const overlayClass = useMemo(
    () => `vela-title-overlay${isExiting ? " is-exiting" : ""}`,
    [isExiting]
  );

  return (
    <div className={overlayClass} aria-hidden="true">
      {logoSrc ? (
        <img
          className="vela-title-logo"
          src={logoSrc}
          alt=""
          draggable={false}
        />
      ) : (
        <div className="vela-title-text">Vela</div>
      )}

      <div className="vela-title-progress-track">
        <div
          className="vela-title-progress-fill"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
    </div>
  );
}
