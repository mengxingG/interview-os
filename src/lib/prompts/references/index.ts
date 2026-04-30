export type PromptPageKey =
  | "research"
  | "decode"
  | "resume"
  | "linkedin"
  | "positioning"
  | "networking"
  | "prep"
  | "mock"
  | "practice"
  | "evaluate"
  | "hype"
  | "debrief"
  | "negotiation"
  | "progress"
  | "stories";

type ReferenceSpec = {
  files: string[];
  coreLogic: string[];
};

export const PROMPT_REFERENCE_MAP: Record<PromptPageKey, ReferenceSpec> = {
  research: {
    files: ["references/commands/research.md"],
    coreLogic: [
      "Output company snapshot, culture signals, interview style prediction, and candidate-fit verdict.",
      "Differentiate evidence confidence levels and include recommended next actions.",
    ],
  },
  decode: {
    files: ["references/commands/decode.md", "references/cross-cutting.md"],
    coreLogic: [
      "Decode explicit requirements and implied hiring signals separately.",
      "Use confidence labels and verification questions for uncertain inferences.",
    ],
  },
  resume: {
    files: [
      "references/commands/resume.md",
      "references/differentiation.md",
      "references/storybank-guide.md",
    ],
    coreLogic: [
      "Keep claims truthful and evidence-backed while maximizing recruiter scan clarity.",
      "Translate strongest stories and earned secrets into differentiated bullets.",
    ],
  },
  linkedin: {
    files: ["references/commands/linkedin.md", "references/differentiation.md"],
    coreLogic: [
      "Audit discoverability, credibility, and differentiation by section.",
      "Enforce cross-channel consistency with resume and positioning statement.",
    ],
  },
  positioning: {
    files: [
      "references/commands/pitch.md",
      "references/differentiation.md",
      "references/storybank-guide.md",
    ],
    coreLogic: [
      "Produce concise role-targeted narrative with clear value transfer logic.",
      "Center earned secret and defensible differentiation in final positioning.",
    ],
  },
  networking: {
    files: ["references/commands/outreach.md", "references/differentiation.md"],
    coreLogic: [
      "Generate outreach scripts with tailored context hooks and clear asks.",
      "Preserve concise, high-signal language with differentiated positioning.",
    ],
  },
  prep: {
    files: [
      "references/commands/prep.md",
      "references/commands/concerns.md",
      "references/commands/questions.md",
      "references/story-mapping-engine.md",
    ],
    coreLogic: [
      "Merge format guidance, concern-counter strategy, predicted questions, and reverse questions.",
      "Map top candidate stories to likely questions with fit rationale.",
    ],
  },
  mock: {
    files: [
      "references/commands/mock.md",
      "references/role-drills.md",
      "references/calibration-engine.md",
    ],
    coreLogic: [
      "Run structured interview flow and keep interviewer-perspective pressure tracking.",
      "Return five-dimension scoring, global arc feedback, and hire signal.",
    ],
  },
  practice: {
    files: ["references/commands/practice.md", "references/role-drills.md"],
    coreLogic: [
      "Score each round on five dimensions and provide targeted next-round adjustment.",
      "Support stage-gated progression and self-calibration feedback.",
    ],
  },
  evaluate: {
    files: [
      "references/rubrics-detailed.md",
      "references/examples.md",
      "references/transcript-processing.md",
    ],
    coreLogic: [
      "Use standardized five-dimension rubric (1-5) with mid-career calibration.",
      "Support transcript normalization, Q/A unit scoring, and triage decision output.",
    ],
  },
  hype: {
    files: ["references/commands/hype.md"],
    coreLogic: [
      "Generate interview-day confidence brief in one-screen format.",
      "Include highlight replay, 3x3 checklist, recovery manual, and focus cue.",
    ],
  },
  debrief: {
    files: ["references/commands/debrief.md", "references/commands/feedback.md"],
    coreLogic: [
      "Run post-interview debrief with per-answer scoring and pattern diagnosis.",
      "Capture recruiter/interviewer signals and outcome-oriented follow-up actions.",
    ],
  },
  negotiation: {
    files: ["references/commands/salary.md", "references/commands/negotiate.md"],
    coreLogic: [
      "Provide market-grounded compensation framing and script options by channel.",
      "Include tradeoff strategy with non-salary levers and walk-away discipline.",
    ],
  },
  progress: {
    files: ["references/commands/progress.md", "references/calibration-engine.md"],
    coreLogic: [
      "Track training trajectory, interview intelligence, and outcome-linked calibration.",
      "Highlight score drift and conflict between coach scoring and external feedback.",
    ],
  },
  stories: {
    files: [
      "references/storybank-guide.md",
      "references/story-mapping-engine.md",
      "references/differentiation.md",
    ],
    coreLogic: [
      "Maintain STAR quality with earned-secret differentiation across stories.",
      "Support retrieval drill, fit-level mapping, and conflict resolution.",
    ],
  },
};
