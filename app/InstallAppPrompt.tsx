"use client";

import { useEffect, useState } from "react";
import { useCurrentLocale } from "../lib/useLocale";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export default function InstallAppPrompt() {
  const nl = useCurrentLocale() === "nl";
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
  return <aside className="install-app-prompt" aria-label={nl ? "Drive Coach installeren" : "Install Drive Coach"}>
    <div><strong>{nl ? "Houd Drive Coach bij de hand" : "Keep Drive Coach handy"}</strong><span>{nl ? "Installeer de oefenapp voor snelle toegang op je telefoon." : "Install the practice app for quick access on your phone."}</span></div>
    <button type="button" onClick={() => void install()}>{nl ? "Installeren" : "Install"}</button>
    <button type="button" className="install-dismiss" onClick={dismiss} aria-label={nl ? "Installatieprompt sluiten" : "Dismiss install prompt"}>×</button>
  </aside>;
}
