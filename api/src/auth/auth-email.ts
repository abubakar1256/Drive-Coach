import type { Logger } from "@nestjs/common";

// Never log provider messages verbatim: they can contain keys, recipients,
// IPs or the verification URL. Only fixed diagnostic codes leave this module.
export function emailFailureReason(status: number, payload: unknown) {
  const data = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const message = `${typeof data.code === "string" ? data.code : ""} ${typeof data.message === "string" ? data.message : ""}`.toLowerCase();
  if (/unauthori[sz]ed.{0,40}\bip\b|\bip\b.{0,40}(?:unauthori[sz]ed|blocked)/.test(message)) return "IP_NOT_AUTHORIZED";
  if (/not.*activat|suspend|account.*disabled/.test(message)) return "SENDING_ACCOUNT_INACTIVE";
  if (/sender|from.*(?:invalid|verif)|domain/.test(message)) return "SENDER_NOT_APPROVED";
  if (/credit|quota|limit|rate/.test(message) || status === 429) return "QUOTA_OR_RATE_LIMIT";
  if (status === 401 || /key.*(?:invalid|not found)|unauthorized|authentication/.test(message)) return "INVALID_API_KEY";
  if (status === 403) return "PROVIDER_PERMISSION_DENIED";
  if (status >= 500) return "PROVIDER_UNAVAILABLE";
  return "PROVIDER_REJECTED";
}

export async function sendAuthEmail(to: string, subject: string, link: string, logger: Pick<Logger, "error" | "log">) {
  const brevoKey = process.env.BREVO_API_KEY?.trim();
  const brevoFrom = process.env.BREVO_FROM_EMAIL?.trim();
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const resendFrom = process.env.RESEND_FROM_EMAIL?.trim();
  const provider = brevoKey && brevoFrom ? "brevo" : resendKey && resendFrom ? "resend" : null;
  if (!provider) { logger.error("AUTH_EMAIL provider=none reason=NOT_CONFIGURED"); return false; }
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px"><h2 style="color:#106c55">Drive Coach</h2><p>Continue securely using the button below.</p><p><a href="${link}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#ff8a22;color:#fff;text-decoration:none">Continue</a></p><p style="color:#71817a;font-size:12px">This link expires automatically. If you did not request it, you can ignore this email.</p></div>`;
  const senderMatch = brevoFrom?.match(/^(.*?)\s*<([^>]+)>$/);
  const body = provider === "brevo" ? { sender: { name: senderMatch?.[1]?.trim() || process.env.BREVO_FROM_NAME || "Drive Coach", email: senderMatch?.[2]?.trim() || brevoFrom }, to: [{ email: to }], subject, htmlContent: html } : { from: resendFrom, to: [to], subject, html };
  try {
    const response = await fetch(provider === "brevo" ? "https://api.brevo.com/v3/smtp/email" : "https://api.resend.com/emails", {
      method: "POST", headers: provider === "brevo" ? { "api-key": brevoKey!, "Content-Type": "application/json" } : { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) { logger.error(`AUTH_EMAIL provider=${provider} status=${response.status} reason=${emailFailureReason(response.status, payload)}`); return false; }
    const acceptedId = payload && typeof payload === "object" ? (payload as Record<string, unknown>)[provider === "brevo" ? "messageId" : "id"] : null;
    if (typeof acceptedId !== "string" || !acceptedId.trim()) { logger.error(`AUTH_EMAIL provider=${provider} status=${response.status} reason=INVALID_PROVIDER_RESPONSE`); return false; }
    // Accepted is not the same as delivered; mailbox delivery is provider-managed.
    logger.log(`AUTH_EMAIL provider=${provider} status=${response.status} result=ACCEPTED`);
    return true;
  } catch (error) {
    const timeout = error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name);
    logger.error(`AUTH_EMAIL provider=${provider} reason=${timeout ? "REQUEST_TIMEOUT" : "NETWORK_ERROR"}`);
    return false;
  }
}
