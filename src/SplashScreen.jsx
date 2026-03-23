import { useEffect, useMemo, useState } from "react";

const SPLASH_LOGO_PATH = "D:\\Vela\\assets\\splash\\k-studio-logo.png";
const FADE_IN_MS = 600;
const HOLD_MS = 2500;
const FADE_OUT_MS = 800;
const EXIT_AT_MS = FADE_IN_MS + HOLD_MS;
const DONE_AT_MS = EXIT_AT_MS + FADE_OUT_MS;

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

export function SplashScreen({ onDone }) {
  const [isExiting, setIsExiting] = useState(false);
  const [logoSrc, setLogoSrc] = useState("");

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";

    async function loadLogo() {
      if (typeof window.vela?.readBinaryFile !== "function") {
        return;
      }

      try {
        const payload = await window.vela.readBinaryFile(SPLASH_LOGO_PATH);

        if (cancelled) {
          return;
        }

        const blob = new Blob([toBlobPart(payload)], { type: "image/png" });
        objectUrl = URL.createObjectURL(blob);
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
    () =>
      `splash-screen-overlay ${
        isExiting ? "is-exiting" : "is-entering"
      }`,
    [isExiting]
  );

  return (
    <div className={overlayClassName} aria-hidden="true">
      {logoSrc ? (
        <img className="splash-screen-logo" src={logoSrc} alt="" draggable={false} />
      ) : null}
    </div>
  );
}
