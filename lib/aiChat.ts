export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  kind?: "welcome";
  failed?: boolean;
};

// The UI can retain the conversation, while each API request stays within the
// validated limit. Welcome text and failed requests are not model history.
export function buildChatHistory(messages: ChatMessage[]) {
  const recent = messages.filter((message) => !message.kind && !message.failed && message.content.trim()).slice(-19);
  const firstUser = recent.findIndex((message) => message.role === "user");
  // Larger answers remain fully visible, but history entries must also respect
  // the DTO's per-message limit on the next question.
  return firstUser < 0 ? [] : recent.slice(firstUser).map(({ role, content }) => ({ role, content: content.slice(0, 4000) }));
}

export type ChatBlock = { type: "paragraph" | "unordered-list" | "ordered-list"; lines: string[] };

// A deliberately small Markdown subset. React escapes all text; no HTML or
// arbitrary provider-supplied links are interpreted.
export function parseChatBlocks(content: string): ChatBlock[] {
  const blocks: ChatBlock[] = [];
  let current: ChatBlock | undefined;
  for (const rawLine of content.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) { current = undefined; continue; }
    const bullet = line.match(/^[-*•]\s+(.+)$/);
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    const type = bullet ? "unordered-list" : ordered ? "ordered-list" : "paragraph";
    const text = bullet?.[1] ?? ordered?.[1] ?? line.replace(/^#{1,6}\s+/, "");
    if (!current || current.type !== type) {
      current = { type, lines: [] };
      blocks.push(current);
    }
    current.lines.push(text);
  }
  return blocks;
}

export function chatErrorCode(payload: { code?: unknown }, status: number) {
  if (typeof payload.code === "string") return payload.code;
  if (status === 429) return "CHAT_RATE_LIMITED";
  if (status === 504) return "AI_TIMEOUT";
  if (status === 401) return "SESSION_EXPIRED";
  return "AI_UNAVAILABLE";
}
