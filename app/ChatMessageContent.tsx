import { parseChatBlocks } from "../lib/aiChat";

function inlineText(text: string) {
  return text.split(/(\*\*[^*\n]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : part,
  );
}

export default function ChatMessageContent({ content }: { content: string }) {
  return <div className="ai-chat-bubble ai-chat-answer">{parseChatBlocks(content).map((block, index) => {
    if (block.type === "paragraph") return <p key={index}>{inlineText(block.lines.join("\n"))}</p>;
    const items = block.lines.map((line, itemIndex) => <li key={itemIndex}>{inlineText(line)}</li>);
    return block.type === "ordered-list" ? <ol key={index}>{items}</ol> : <ul key={index}>{items}</ul>;
  })}</div>;
}
