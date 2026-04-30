import { generateText, streamText } from "ai";
import { getModel, type ModelType } from "@/lib/llm";
import { buildDebriefSystemPrompt } from "@/lib/prompts/debrief";
import { buildDecodeSystemPrompt } from "@/lib/prompts/decode";
import { buildEvaluateSystemPrompt } from "@/lib/prompts/evaluate";
import { buildMockSystemPrompt } from "@/lib/prompts/mock";
import { buildResumeSystemPrompt } from "@/lib/prompts/resume";
import { buildUserContextForPrompt } from "@/lib/user-profile";

type PromptType = "mock" | "evaluate" | "decode" | "debrief" | "resume";

type ModelMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

function resolveSystemPrompt(
  promptType: PromptType,
  promptContext: Record<string, unknown> = {},
) {
  switch (promptType) {
    case "evaluate":
      return buildEvaluateSystemPrompt(promptContext);
    case "decode":
      return buildDecodeSystemPrompt(promptContext);
    case "debrief":
      return buildDebriefSystemPrompt(promptContext);
    case "resume":
      return buildResumeSystemPrompt(promptContext);
    case "mock":
    default:
      return buildMockSystemPrompt(promptContext);
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string) {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    }),
  ]);
}

function normalizeMessages(input: unknown): ModelMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Record<string, unknown>;
      const role = row.role;
      if (role !== "user" && role !== "assistant" && role !== "system") return null;

      let content = "";
      if (typeof row.content === "string") {
        content = row.content;
      } else if (Array.isArray(row.parts)) {
        content = row.parts
          .map((part) => {
            if (!part || typeof part !== "object") return "";
            const p = part as Record<string, unknown>;
            if (p.type !== "text") return "";
            return typeof p.text === "string" ? p.text : "";
          })
          .join("\n")
          .trim();
      }
      if (!content.trim()) return null;
      return { role, content };
    })
    .filter((item): item is ModelMessage => Boolean(item));
}

export async function POST(req: Request) {
  try {
    const {
      messages,
      modelType = "fast",
      promptType = "mock",
      promptContext = {},
      systemPrompt,
      originalStory,
    }: {
      messages: unknown[];
      modelType?: ModelType;
      promptType?: PromptType;
      promptContext?: Record<string, unknown>;
      systemPrompt?: string;
      originalStory?: unknown;
    } = await req.json();

    const system =
      typeof systemPrompt === "string" && systemPrompt.trim().length > 0
        ? systemPrompt
        : `${resolveSystemPrompt(promptType, promptContext)}\n\nUse this fixed candidate context:\n${buildUserContextForPrompt()}`;
    const safeMessages = normalizeMessages(messages);
    const isStoryContextMode = Boolean(originalStory);
    const filteredMessages = isStoryContextMode
      ? safeMessages.filter((m) => {
          if (m.role !== "user") return true;
          const content = m.content ?? "";
          const looksLikeStar =
            /Situation\s*[:：]|Task\s*[:：]|Action\s*[:：]|Result\s*[:：]|Earned Secret\s*[:：]/i.test(content);
          // If old dirty history contains the whole STAR inside the user content,
          // keep the prompt clean by dropping that user message (story will be injected via system message).
          return !(looksLikeStar && content.length > 300);
        })
      : safeMessages;

    const storySystemMessage: ModelMessage | null = isStoryContextMode
      ? {
          role: "system",
          content: `你是一个资深的面试教练。请根据用户发出的具体指令，优化或分析以下候选人的原始 STAR 故事底稿。\n\n【候选人原始故事】:\n${JSON.stringify(
            originalStory,
          )}`,
        }
      : null;
    let resolvedModelType: ModelType = modelType;

    // Higher-tier models can be intermittently unreachable; preflight with timeout and gracefully fallback.
    if (modelType === "pro" || modelType === "deep") {
      try {
        await withTimeout(
          generateText({
            model: getModel(modelType),
            prompt: "health check",
            maxOutputTokens: 4,
          }),
          8000,
          "Model preflight timeout",
        );
      } catch {
        resolvedModelType = modelType === "pro" ? "deep" : "fast";
        if (resolvedModelType === "deep") {
          try {
            await withTimeout(
              generateText({
                model: getModel("deep"),
                prompt: "health check",
                maxOutputTokens: 4,
              }),
              8000,
              "Deep model preflight timeout",
            );
          } catch {
            resolvedModelType = "fast";
          }
        }
      }
    }

    const result = streamText({
      model: getModel(resolvedModelType),
      system,
      messages: (storySystemMessage ? [storySystemMessage, ...filteredMessages] : filteredMessages) as never,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    return Response.json(
      {
        error: "Chat generation failed.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
