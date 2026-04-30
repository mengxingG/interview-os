import { PROMPT_REFERENCE_MAP, type PromptPageKey } from "@/lib/prompts/references";

export function composeReferenceBackedPrompt(page: PromptPageKey, body: string) {
  const spec = PROMPT_REFERENCE_MAP[page];
  return `
Reference-backed instruction (do not ignore):
- Reuse core logic from:
${spec.files.map((f) => `  - ${f}`).join("\n")}
- Execution priorities:
${spec.coreLogic.map((c) => `  - ${c}`).join("\n")}

${body.trim()}
`.trim();
}
