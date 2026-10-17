import Link from "next/link";
import type { SiteCopy } from "../lib/siteCopy";

export default function AIChatAccessGate({ status, copy, loginHref, onRetry, onNavigate }: {
  status: "checking" | "guest" | "locked" | "unavailable";
  copy: SiteCopy["chatbot"];
  loginHref: string;
  onRetry: () => void;
  onNavigate: () => void;
}) {
  if (status === "checking") return <div className="ai-chat-access" role="status"><span className="ai-chat-lock-icon" aria-hidden="true">✦</span><p>{copy.checkingAccess}</p></div>;
  if (status === "unavailable") return <div className="ai-chat-access"><span className="ai-chat-lock-icon" aria-hidden="true">↻</span><p role="alert">{copy.accessUnavailable}</p><button className="button button-small" type="button" onClick={onRetry}>{copy.accessRetry}</button></div>;
  return <div className="ai-chat-access">
    <span className="ai-chat-lock-icon" aria-hidden="true">✦</span>
    <span className="ai-chat-access-label">{copy.paidAccess}</span>
    <h2>{copy.lockedTitle}</h2>
    <p>{copy.lockedDescription}</p>
    <div className="ai-chat-plan-badges"><span>Basic</span><span>Premium</span></div>
    <Link className="button button-small button-full" href="/#pricing" onClick={onNavigate}>{copy.viewPlans} <span aria-hidden="true">↗</span></Link>
    {status === "guest" ? <><small>{copy.loginHint}</small><Link className="ai-chat-access-link" href={loginHref} onClick={onNavigate}>{copy.logIn} →</Link></>
      : <button className="ai-chat-access-link" type="button" onClick={onRetry}>{copy.refreshAccess} ↻</button>}
  </div>;
}
