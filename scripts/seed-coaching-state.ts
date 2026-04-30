import { addStory, addInterviewRecord } from "@/lib/notion";
import { storySeeds, userProfile } from "@/lib/user-profile";

async function seedStories() {
  for (const story of storySeeds) {
    await addStory({
      title: story.title,
      situation: story.situation,
      task: story.task,
      action: `${story.action}\n\nDeploy for: ${story.deployFor}\n\n关键 tradeoff: ${story.tradeoff}`,
      result: story.result,
      earnedSecret: story.earnedSecret,
      tags: story.tags,
      strength: story.strength,
    });
  }
}

async function seedScores() {
  for (const record of userProfile.scoreHistory) {
    await addInterviewRecord({
      title: `Practice Score - ${record.context}`,
      company: "Interview Coach Practice",
      type: "Behavioral",
      date: record.date,
      transcript: `Practice context: ${record.context}`,
      aiAnalysis: JSON.stringify(
        {
          source: "coaching_state.md",
          scores: {
            Substance: record.scores.substance,
            Structure: record.scores.structure,
            Relevance: record.scores.relevance,
            Credibility: record.scores.credibility,
            Differentiation: record.scores.differentiation,
          },
        },
        null,
        2,
      ),
    });
  }
}

async function main() {
  await seedStories();
  await seedScores();
  console.log("Coaching state seeds imported.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

