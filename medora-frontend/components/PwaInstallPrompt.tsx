"use client";

import { useEffect, useState } from "react";

declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{
      outcome: "accepted" | "dismissed";
      platform: string;
    }>;
  }
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const evt = e as BeforeInstallPromptEvent;
      evt.preventDefault();
      setDeferredPrompt(evt);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  if (!visible || !deferredPrompt) return null;

  const onInstallClick = async () => {
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      console.log("MEDORA install choice:", choice.outcome);
    } catch (err) {
      console.error("PWA install failed:", err);
    } finally {
      setVisible(false);
      setDeferredPrompt(null);
    }
  };

  const onClose = () => {
    setVisible(false);
  };

  return (
    <div
      className="
        fixed bottom-4 left-1/2 -translate-x-1/2
        w-[92%] max-w-md
        z-[9999]
        rounded-2xl border border-[var(--border)]
        bg-white/95 backdrop-blur-xl
        shadow-2xl
        px-4 py-4
        flex items-center gap-3
      "
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--secondary)]/40">
        <img src="/logo.png" alt="MEDORA" className="h-7 w-7 object-contain" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[var(--primary-dark)]">
          Install MEDORA
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--text-soft)]">
          Add MEDORA to your device for a faster app-like experience with quick
          access to uploads, reports, and clinical review tools.
        </p>
      </div>

      <div className="flex flex-col items-end gap-1.5">
        <button
          onClick={onInstallClick}
          className="
            rounded-full bg-[var(--primary-dark)] px-3.5 py-1.5
            text-xs font-semibold text-white
            hover:bg-[var(--primary)]
            transition
          "
        >
          Install
        </button>

        <button
          onClick={onClose}
          className="text-[11px] text-[var(--text-soft)] hover:text-[var(--foreground)]"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
