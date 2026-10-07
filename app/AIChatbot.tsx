"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

type ChatMessage = { role: "user" | "assistant"; content: string };

const welcomeMessage: ChatMessage = {
  role: "assistant",
  content: "Hi, I’m Drive Coach AI. Ask me about your route, roundabouts, observation, speed or how to prepare for test day.",
};

const quickPrompts = [
  "How should I prepare for my test?",
  "What should I watch for at roundabouts?",
  "How can I improve my observation?",
];

function getPageContext() {
  if (typeof window === "undefined") return {};
  return {
    page: window.location.pathname,
    title: document.title,
  };
}

export default function AIChatbot() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || loading) return;

    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    setDraft("");
    setLoading(true);

    try {
      const response = await fetch(`${API}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, context: getPageContext() }),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(payload.message || "The AI coach is temporarily unavailable.");
      setMessages((current) => [...current, { role: "assistant", content: payload.message || "I’m sorry, I could not answer that just now." }]);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : "The AI coach is temporarily unavailable." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`ai-chat ${open ? "ai-chat-open" : ""}`}>
      {open && (
        <section className="ai-chat-panel" role="dialog" aria-modal="false" aria-label="Drive Coach AI chat">
          <header className="ai-chat-header">
            <div className="ai-chat-title"><span className="ai-chat-avatar">✦</span><div><strong>Drive Coach AI</strong><span><i /> Route-aware practice coach</span></div></div>
            <button className="ai-chat-close" type="button" onClick={() => setOpen(false)} aria-label="Close AI chat">×</button>
          </header>
          <div className="ai-chat-messages" ref={messagesRef} aria-live="polite">
            {messages.map((message, index) => <div className={`ai-chat-message ai-chat-message-${message.role}`} key={`${message.role}-${index}`}><span>{message.content}</span></div>)}
            {messages.length === 1 && <div className="ai-chat-quick"><small>Try asking</small>{quickPrompts.map((prompt) => <button type="button" key={prompt} onClick={() => setDraft(prompt)}>{prompt}</button>)}</div>}
            {loading && <div className="ai-chat-message ai-chat-message-assistant ai-chat-typing"><span><i /><i /><i /></span></div>}
          </div>
          <form className="ai-chat-form" onSubmit={sendMessage}><textarea ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about your driving practice..." rows={2} maxLength={1200} aria-label="Message Drive Coach AI" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><button type="submit" disabled={loading || !draft.trim()} aria-label="Send message">↗</button></form>
          <p className="ai-chat-disclaimer">AI guidance is for practice preparation. Always follow your instructor and local road rules.</p>
        </section>
      )}
      <button className="ai-chat-launcher" type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-label={open ? "Close Drive Coach AI" : "Open Drive Coach AI"}><span className="ai-chat-launcher-icon">{open ? "×" : "✦"}</span>{!open && <span>Ask Drive Coach AI</span>}</button>
    </div>
  );
}
