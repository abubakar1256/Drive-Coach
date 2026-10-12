"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useSiteCopy } from "../lib/useLocale";
import { buildChatHistory, chatErrorCode, type ChatMessage } from "../lib/aiChat";
import { accessTokenKey, authFetch, SessionExpiredError } from "../lib/clientSession";
import ChatMessageContent from "./ChatMessageContent";

const API = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

function getPageContext() {
  if (typeof window === "undefined") return {};
  const route = document.querySelector<HTMLElement>("[data-chat-route]");
  return {
    page: window.location.pathname,
    title: document.title,
    selectedPointId: route?.dataset.chatPoint,
  };
}

export default function AIChatbot() {
  const copy = useSiteCopy();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: copy.chatbot.welcome, kind: "welcome" }]);
  const [errorCode, setErrorCode] = useState<string | null>(null);
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
  }, [messages, loading, errorCode]);

  useEffect(() => {
    setMessages((current) => current.map((message) => message.kind === "welcome" ? { ...message, content: copy.chatbot.welcome } : message));
  }, [copy.chatbot.welcome]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || loading) return;

    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    setDraft("");
    setLoading(true);
    setErrorCode(null);

    try {
      const options: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: buildChatHistory(nextMessages), context: getPageContext() }),
      };
      const response = window.sessionStorage.getItem(accessTokenKey)
        ? await authFetch(`${API}/ai/chat`, options)
        : await fetch(`${API}/ai/chat`, options);
      const payload = (await response.json().catch(() => ({}))) as { message?: unknown; code?: unknown };
      if (!response.ok) throw new Error(chatErrorCode(payload, response.status));
      if (typeof payload.message !== "string" || !payload.message.trim()) throw new Error("AI_INCOMPLETE");
      setMessages((current) => [...current, { role: "assistant", content: payload.message as string }]);
    } catch (error) {
      // Keep failures out of subsequent model requests, and preserve the question
      // so it can be retried without asking the learner to retype it.
      setMessages((current) => current.map((message, index) => index === nextMessages.length - 1 ? { ...message, failed: true } : message));
      setErrorCode(error instanceof SessionExpiredError ? "SESSION_EXPIRED" : error instanceof Error ? error.message : "AI_UNAVAILABLE");
      setDraft((current) => current || content);
    } finally {
      setLoading(false);
    }
  }

  const errorText = errorCode === "AI_NOT_CONFIGURED" ? copy.chatbot.notConfigured
    : ["CHAT_RATE_LIMITED", "AI_PROVIDER_RATE_LIMIT"].includes(errorCode ?? "") ? copy.chatbot.rateLimited
    : errorCode === "AI_TIMEOUT" ? copy.chatbot.timeout
    : errorCode === "AI_INCOMPLETE" ? copy.chatbot.incomplete
    : errorCode === "AI_BLOCKED" ? copy.chatbot.blocked
    : errorCode === "SESSION_EXPIRED" ? copy.chatbot.sessionExpired
    : copy.chatbot.temporaryUnavailable;

  return (
    <div className={`ai-chat ${open ? "ai-chat-open" : ""}`}>
      {open && (
        <section className="ai-chat-panel" role="dialog" aria-modal="false" aria-label="Drive Coach AI chat">
          <header className="ai-chat-header">
            <div className="ai-chat-title"><span className="ai-chat-avatar">✦</span><div><strong>Drive Coach AI</strong><span><i /> {copy.chatbot.routeAware}</span></div></div>
            <button className="ai-chat-close" type="button" onClick={() => setOpen(false)} aria-label={copy.chatbot.close}>×</button>
          </header>
          <div className="ai-chat-messages" ref={messagesRef} aria-live="polite">
            {messages.map((message, index) => <div className={`ai-chat-message ai-chat-message-${message.role}`} key={`${message.role}-${index}`}>{message.role === "assistant" ? <ChatMessageContent content={message.content} /> : <span className="ai-chat-bubble">{message.content}</span>}</div>)}
            {messages.length === 1 && <div className="ai-chat-quick"><small>{copy.chatbot.quickLabel}</small>{copy.chatbot.quickPrompts.map((prompt) => <button type="button" key={prompt} onClick={() => setDraft(prompt)}>{prompt}</button>)}</div>}
            {loading && <div className="ai-chat-message ai-chat-message-assistant ai-chat-typing" role="status" aria-label={copy.chatbot.thinking}><span className="ai-chat-bubble"><i /><i /><i /></span></div>}
            {errorCode && <div className="ai-chat-error" role="alert">{errorText}<small>{copy.chatbot.retryHint}</small></div>}
          </div>
          <form className="ai-chat-form" onSubmit={sendMessage}><textarea ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={copy.chatbot.placeholder} rows={2} maxLength={1200} aria-label={copy.chatbot.messageLabel} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><button type="submit" disabled={loading || !draft.trim()} aria-label={errorCode ? copy.chatbot.retry : copy.chatbot.send}>{errorCode ? "↻" : "↗"}</button></form>
          <p className="ai-chat-disclaimer">{copy.chatbot.disclaimer}</p>
        </section>
      )}
      <button className="ai-chat-launcher" type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-label={open ? copy.chatbot.close : copy.chatbot.open}><span className="ai-chat-launcher-icon">{open ? "×" : "✦"}</span>{!open && <span>{copy.chatbot.open}</span>}</button>
    </div>
  );
}
