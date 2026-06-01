import { generateText } from "ai";
import { withClaudeRoleLock } from "@/config/prompts";
import { getModel, getModelFallbackOrder, type ModelType } from "@/lib/llm";
import { buildDebriefSystemPrompt } from "@/lib/prompts/debrief";
import { buildUserContextForPrompt } from "@/lib/user-profile";

type RequestBody = {
  transcript: string;
  modelType?: ModelType;
};

function detectTranscriptFormat(input: string) {
  const head = input.slice(0, 1200);
  if (/WEBVTT/i.test(head)) return { source: "Zoom VTT", confidence: "High" as const };
  if (/Transcribed by Otter/i.test(head) || /Speaker \d+/i.test(head)) return { source: "Otter", confidence: "Medium" as const };
  if (/Meeting started|Microsoft Teams/i.test(head)) return { source: "Microsoft Teams", confidence: "Medium" as const };
  if (/\d{1,2}:\d{2}:\d{2}\s*-->\s*\d{1,2}:\d{2}:\d{2}/.test(head)) return { source: "VTT-like", confidence: "Medium" as const };
  return { source: "Manual/Generic", confidence: "Low" as const };
}

function normalizeTranscript(input: string) {
  return input
    .split("\n")
    .map((line) => line.replace(/^\d+\s*$/, "").replace(/\d{1,2}:\d{2}(:\d{2})?(\.\d+)?\s*-->\s*\d{1,2}:\d{2}(:\d{2})?(\.\d+)?/g, "").trim())
    .filter(Boolean)
    .join("\n");
}

function parseJson(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON found");
  return JSON.parse(raw.slice(start, end + 1));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const requestedModel = body.modelType ?? "mock";
    if (!body.transcript?.trim()) {
      return Response.json({ error: "Missing transcript." }, { status: 400 });
    }
    const detected = detectTranscriptFormat(body.transcript);
    const normalized = normalizeTranscript(body.transcript);
    const speakerCount = new Set(
      normalized
        .split("\n")
        .map((line) => line.match(/^([A-Za-z\u4e00-\u9fa5 ]+):/)?.[1]?.trim())
        .filter(Boolean),
    ).size;
    const system = withClaudeRoleLock(`${buildDebriefSystemPrompt({
      targetRole: "AI Product Manager",
      emphasis: ["transcript normalization", "q&a scoring", "triage path", "inner monologue"],
    })}

Additionally include:
{
  "formatDetection": { "source": string, "confidence": "High" | "Medium" | "Low", "speakerCount": number },
  "triageDecision": string
}
Return JSON only.`);
    let text = "";
    for (const type of getModelFallbackOrder(requestedModel)) {
      try {
        text = (
          await generateText({
            model: getModel(type),
            system,
            prompt: `Candidate baseline:\n${buildUserContextForPrompt()}\n\nDetected format=${detected.source}, confidence=${detected.confidence}, speakerCount=${speakerCount}.\nNormalized transcript:\n${normalized}`,
          })
        ).text;
        break;
      } catch {
        // try next fallback
      }
    }
    if (!text) {
      throw new Error("All models failed");
    }
    return Response.json({
      result: {
        ...parseJson(text),
        formatDetection: { source: detected.source, confidence: detected.confidence, speakerCount },
        normalizedPreview: normalized.slice(0, 3000),
      },
    });
  } catch (error) {
    return Response.json(
      { error: "Failed to analyze transcript.", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}

