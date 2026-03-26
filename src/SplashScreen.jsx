import { useEffect, useMemo, useState } from "react";
import { createBundledAssetObjectUrl } from "./core/renderer-assets.js";

const SPLASH_LOGO_PATH = "assets/splash/k-studio-logo.png";
const FADE_IN_MS = 600;
const HOLD_MS = 2500;
const FADE_OUT_MS = 800;
const EXIT_AT_MS = FADE_IN_MS + HOLD_MS;
const DONE_AT_MS = EXIT_AT_MS + FADE_OUT_MS;

export function SplashScreen({ onDone }) {
  const [isExiting, setIsExiting] = useState(false);
  const [logoSrc, setLogoSrc] = useState("");

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";

    async function loadLogo() {
      try {
        objectUrl = await createBundledAssetObjectUrl(
          SPLASH_LOGO_PATH,
          "image/png"
        );
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = "";
          return;
        }
        setLogoSrc(objectUrl);
      } catch {
        // Keep splash background even if logo load fails.
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

  useEffect(() => {
    const exitTimer = window.setTimeout(() => {
      setIsExiting(true);
    }, EXIT_AT_MS);

    const doneTimer = window.setTimeout(() => {
      onDone?.();
    }, DONE_AT_MS);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onDone]);

  const overlayClassName = useMemo(
    () => `splash-screen-overlay${isExiting ? " is-exiting" : ""}`,
    [isExiting]
  );
  const logoClassName = useMemo(
    () => `splash-screen-logo${isExiting ? "" : " is-entering"}`,
    [isExiting]
  );

  return (
    <div className={overlayClassName} aria-hidden="true">
      {logoSrc ? (
        <img className={logoClassName} src={logoSrc} alt="" draggable={false} />
      ) : null}
    </div>
  );
}
