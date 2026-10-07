import { HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { AiChatDto } from "./dto/ai-chat.dto";

type OpenAiOutputBlock = { type?: unknown; text?: unknown };
type OpenAiOutputItem = { content?: unknown };
type OpenAiResponse = { output_text?: unknown; output?: unknown; error?: { message?: unknown } };

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);
  private readonly requestLog = new Map<string, number[]>();

  async answer(dto: AiChatDto, clientId: string) {
    this.enforceRateLimit(clientId);
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException("The AI coach is not configured yet.");
    }

    const context = Object.entries(dto.context ?? {})
      .filter(([, value]) => typeof value === "string" || typeof value === "number")
      .map(([key, value]) => `${key}: ${String(value).slice(0, 240)}`)
      .join("\n");

    const developerPrompt = [
      "You are Drive Coach AI, a calm and practical driving-test preparation coach.",
      "Help learners understand practice routes, observation, speed, priority, roundabouts, lane choice, manoeuvres, confidence and preparation habits.",
      "Answer in the same language as the learner. English, Dutch, Urdu and Roman Urdu are supported.",
      "Keep answers concise and useful: normally no more than 120 words, with short bullets when helpful.",
      "Never claim that a practice route is an official examiner route, never invent road facts, and say when you do not have enough route data.",
      "Give safety-first guidance. Do not encourage distracted driving or reading messages while driving; suggest stopping safely before using the assistant.",
      context ? `Current page context:\n${context}` : "No specific route context is available.",
    ].join("\n\n");

    const input = dto.messages
      .slice(-12)
      .map((message) => ({ role: message.role, content: message.content.trim().slice(0, 4000) }));

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL?.trim() || "gpt-6-astra",
          store: false,
          max_output_tokens: 450,
          input: [{ role: "developer", content: developerPrompt }, ...input],
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as OpenAiResponse;
      if (!response.ok) {
        const providerMessage = typeof payload.error?.message === "string" ? payload.error.message : "provider error";
        this.logger.error(`OpenAI request failed (${response.status}): ${providerMessage}`);
        throw new ServiceUnavailableException("The AI coach is temporarily unavailable.");
      }

      const message = this.extractText(payload).trim();
      if (!message) throw new ServiceUnavailableException("The AI coach returned an empty answer.");
      return { message };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.error(error instanceof Error ? error.message : "Unknown OpenAI request error");
      throw new ServiceUnavailableException("The AI coach is temporarily unavailable.");
    }
  }

  private extractText(payload: OpenAiResponse) {
    if (typeof payload.output_text === "string") return payload.output_text;
    if (!Array.isArray(payload.output)) return "";

    return payload.output
      .flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const content = (item as OpenAiOutputItem).content;
        return Array.isArray(content) ? content : [];
      })
      .map((block) => (block && typeof block === "object" ? (block as OpenAiOutputBlock).text : ""))
      .filter((text): text is string => typeof text === "string")
      .join("\n");
  }

  private enforceRateLimit(clientId: string) {
    const now = Date.now();
    const windowStart = now - 10 * 60 * 1000;
    const recent = (this.requestLog.get(clientId) ?? []).filter((timestamp) => timestamp > windowStart);
    if (recent.length >= 20) throw new HttpException("Please wait a few minutes before asking more questions.", HttpStatus.TOO_MANY_REQUESTS);
    recent.push(now);
    this.requestLog.set(clientId, recent);
  }
}
