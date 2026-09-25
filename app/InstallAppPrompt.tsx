"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export default function InstallAppPrompt() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem("routepilot.installDismissed") === "1") return;
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setVisible(false);
    setPromptEvent(null);
  }

  function dismiss() {
    window.localStorage.setItem("routepilot.installDismissed", "1");
    setVisible(false);
    setPromptEvent(null);
  }

  if (!visible || !promptEvent) return null;
  return <aside className="install-app-prompt" aria-label="Install RoutePilot">
    <div><strong>Keep RoutePilot handy</strong><span>Install the practice app for quick access on your phone.</span></div>
    <button type="button" onClick={() => void install()}>Install</button>
    <button type="button" className="install-dismiss" onClick={dismiss} aria-label="Dismiss install prompt">×</button>
  </aside>;
}
