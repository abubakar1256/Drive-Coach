"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSiteCopy } from "../lib/useLocale";
import { buildChatHistory, chatErrorCode, type ChatMessage } from "../lib/aiChat";
import { accessTokenKey, authFetch, SessionExpiredError, userKey } from "../lib/clientSession";
import { useAIChatAccess } from "../lib/useAIChatAccess";
import ChatMessageContent from "./ChatMessageContent";
import AIChatAccessGate from "./AIChatAccessGate";

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

function getChatAccount() {
  if (!window.sessionStorage.getItem(accessTokenKey)) return null;
  try { return JSON.parse(window.sessionStorage.getItem(userKey) ?? "null")?.id ?? window.sessionStorage.getItem(accessTokenKey); }
  catch { return window.sessionStorage.getItem(accessTokenKey); }
}

export default function AIChatbot() {
  const copy = useSiteCopy();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [sharePreparation, setSharePreparation] = useState(false);
  const { access, checkAccess } = useAIChatAccess(open);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: copy.chatbot.welcome, kind: "welcome" }]);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const conversationVersion = useRef(0);
  const pendingRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    let account = getChatAccount();
    const authChanged = () => {
      const nextAccount = getChatAccount();
      if (nextAccount === account) return;
      account = nextAccount;
      ++conversationVersion.current;
      pendingRequest.current?.abort();
      setMessages((current) => current.filter((message) => message.kind === "welcome"));
      setDraft(""); setErrorCode(null); setLoading(false); setSharePreparation(false);
    };
    window.addEventListener("routepilot-auth-change", authChanged);
    return () => { ++conversationVersion.current; window.removeEventListener("routepilot-auth-change", authChanged); pendingRequest.current?.abort(); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => { document.removeEventListener("keydown", onKeyDown); window.clearTimeout(focusTimer); };
  }, [open, access.status]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, errorCode]);

  useEffect(() => {
    setMessages((current) => current.map((message) => message.kind === "welcome" ? { ...message, content: copy.chatbot.welcome } : message));
  }, [copy.chatbot.welcome]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || loading || access.status !== "allowed") return;
    const version = conversationVersion.current;
    const controller = new AbortController();
    pendingRequest.current = controller;

    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    setDraft("");
    setLoading(true);
    setErrorCode(null);

    try {
      const options: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: buildChatHistory(nextMessages), context: { ...getPageContext(), sharePreparation } }),
        signal: controller.signal,
      };
      const response = await authFetch(`${API}/ai/chat`, options);
      const payload = (await response.json().catch(() => ({}))) as { message?: unknown; code?: unknown };
      if (version !== conversationVersion.current) return;
      if (!response.ok) throw new Error(chatErrorCode(payload, response.status));
      if (typeof payload.message !== "string" || !payload.message.trim()) throw new Error("AI_INCOMPLETE");
      setMessages((current) => [...current, { role: "assistant", content: payload.message as string }]);
    } catch (error) {
      if (version !== conversationVersion.current) return;
      // Keep failures out of subsequent model requests, and preserve the question
      // so it can be retried without asking the learner to retype it.
      setMessages((current) => current.map((message, index) => index === nextMessages.length - 1 ? { ...message, failed: true } : message));
      const code = error instanceof SessionExpiredError ? "SESSION_EXPIRED" : error instanceof Error ? error.message : "AI_UNAVAILABLE";
      setErrorCode(code);
      if (["SESSION_EXPIRED", "AI_PLAN_REQUIRED", "AI_ACCESS_UNAVAILABLE"].includes(code)) void checkAccess();
      setDraft((current) => current || content);
    } finally {
      if (version === conversationVersion.current) setLoading(false);
    }
  }

  const errorText = errorCode === "AI_NOT_CONFIGURED" ? copy.chatbot.notConfigured
    : ["CHAT_RATE_LIMITED", "AI_PROVIDER_RATE_LIMIT"].includes(errorCode ?? "") ? copy.chatbot.rateLimited
    : errorCode === "AI_TIMEOUT" ? copy.chatbot.timeout
    : errorCode === "AI_INCOMPLETE" ? copy.chatbot.incomplete
    : errorCode === "AI_BLOCKED" ? copy.chatbot.blocked
    : errorCode === "SESSION_EXPIRED" ? copy.chatbot.sessionExpired
    : errorCode === "AI_PLAN_REQUIRED" ? copy.chatbot.lockedDescription
    : errorCode === "AI_ACCESS_UNAVAILABLE" ? copy.chatbot.accessUnavailable
    : copy.chatbot.temporaryUnavailable;

  return (
    <div className={`ai-chat ${open ? "ai-chat-open" : ""}`}>
      {open && (
        <section className="ai-chat-panel" role="dialog" aria-modal="false" aria-label="Drive Coach AI chat">
          <header className="ai-chat-header">
            <div className="ai-chat-title"><span className="ai-chat-avatar">✦</span><div><strong>Drive Coach AI</strong><span><i /> {copy.chatbot.routeAware}</span></div></div>
            <button className="ai-chat-close" type="button" onClick={() => setOpen(false)} aria-label={copy.chatbot.close}>×</button>
          </header>
          {access.status === "allowed" ? <><div className="ai-chat-messages" ref={messagesRef} aria-live="polite">
            {messages.map((message, index) => <div className={`ai-chat-message ai-chat-message-${message.role}`} key={`${message.role}-${index}`}>{message.role === "assistant" ? <ChatMessageContent content={message.content} /> : <span className="ai-chat-bubble">{message.content}</span>}</div>)}
            {messages.length === 1 && <div className="ai-chat-quick"><small>{copy.chatbot.quickLabel}</small>{copy.chatbot.quickPrompts.map((prompt) => <button type="button" key={prompt} onClick={() => setDraft(prompt)}>{prompt}</button>)}</div>}
            {loading && <div className="ai-chat-message ai-chat-message-assistant ai-chat-typing" role="status" aria-label={copy.chatbot.thinking}><span className="ai-chat-bubble"><i /><i /><i /></span></div>}
            {errorCode && <div className="ai-chat-error" role="alert">{errorText}<small>{copy.chatbot.retryHint}</small></div>}
          </div>
          <label className="ai-preparation-consent"><input type="checkbox" checked={sharePreparation} onChange={e=>setSharePreparation(e.target.checked)} /> Share my chosen level & reported focus with AI for this chat. No age, town or GPS.</label>
          <button className="ai-new-conversation" type="button" onClick={()=>{conversationVersion.current++;pendingRequest.current?.abort();setMessages([{role:"assistant",content:copy.chatbot.welcome,kind:"welcome"}]);setDraft("");setLoading(false);setErrorCode(null);setSharePreparation(false);}}>New conversation · clear local context</button>
          <form className="ai-chat-form" onSubmit={sendMessage}><textarea ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={copy.chatbot.placeholder} rows={2} maxLength={1200} aria-label={copy.chatbot.messageLabel} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><button type="submit" disabled={loading || !draft.trim()} aria-label={errorCode ? copy.chatbot.retry : copy.chatbot.send}>{errorCode ? "↻" : "↗"}</button></form></>
            : <AIChatAccessGate status={access.status} copy={copy.chatbot} loginHref={`/auth/login?next=${encodeURIComponent(pathname ?? "/")}`} onRetry={() => void checkAccess()} onNavigate={() => setOpen(false)} />}
          <p className="ai-chat-disclaimer">{copy.chatbot.disclaimer}</p>
        </section>
      )}
      <button className="ai-chat-launcher" type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-label={open ? copy.chatbot.close : copy.chatbot.open}><span className="ai-chat-launcher-icon">{open ? "×" : "✦"}</span>{!open && <span>{copy.chatbot.open}</span>}</button>
    </div>
  );
}
