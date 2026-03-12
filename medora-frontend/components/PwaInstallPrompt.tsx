"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
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

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible || !deferredPrompt) return null;

  const installApp = async () => {
    await deferredPrompt.prompt();

    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      console.log("User installed MEDORA");
    }

    setVisible(false);
    setDeferredPrompt(null);
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-sm bg-white shadow-xl border border-purple-100 rounded-2xl px-4 py-3 flex items-center gap-3">

      <div className="flex-1">
        <p className="text-xs font-semibold text-[#7C6EE6]">
          Install MEDORA
        </p>

        <p className="text-[11px] text-gray-600">
          Add MEDORA to your home screen for faster access
        </p>
      </div>

      <div className="flex flex-col gap-1 items-end">

        <button
          onClick={installApp}
          className="text-[11px] px-3 py-1.5 rounded-full bg-[#7C6EE6] text-white font-semibold hover:bg-[#6B5DDA]"
        >
          Install
        </button>

        <button
          onClick={() => setVisible(false)}
          className="text-[10px] text-gray-400 hover:text-gray-600"
        >
          Not now
        </button>

      </div>

    </div>
  );
}
