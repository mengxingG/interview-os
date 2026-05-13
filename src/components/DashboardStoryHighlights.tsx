"use client";

import { useEffect, useState } from "react";
import { StoryCard } from "@/components/StoryCard";

type Story = {
  id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  earnedSecret: string;
  tags: string[];
  strength: number;
};

const fallbackStories: Story[] = [
  {
    id: "fallback-1",
    title: "AI PM 周期复盘案例",
    situation: "",
    task: "",
    action: "",
    result: "将一次从 0 到 1 的 AI 功能上线经历拆成 STAR 结构，准备行为面追问路径。",
    earnedSecret: "",
    tags: [],
    strength: 4,
  },
  {
    id: "fallback-2",
    title: "跨团队推动技术方案",
    situation: "",
    task: "",
    action: "",
    result: "聚焦冲突处理、决策依据和量化结果，强调你在资源受限下的推进方法。",
    earnedSecret: "",
    tags: [],
    strength: 4,
  },
];

function storyPreview(story: Story) {
  return story.result || story.earnedSecret || story.situation || "故事详情请进入故事库查看。";
}

export function DashboardStoryHighlights() {
  const [stories, setStories] = useState<Story[]>(fallbackStories);

  useEffect(() => {
    let mounted = true;
    async function loadStories() {
      try {
        const response = await fetch("/api/notion?resource=stories", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { stories?: Story[] };
        if (!mounted || !Array.isArray(payload.stories) || payload.stories.length === 0) {
          return;
        }
        setStories(payload.stories.slice(0, 2));
      } catch {
        // Keep fallback stories.
      }
    }
    void loadStories();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      {stories.map((story, index) => (
        <StoryCard
          key={story.id}
          title={story.title}
          content={storyPreview(story)}
          tag={`案例 ${String(index + 1).padStart(2, "0")}`}
        />
      ))}
    </div>
  );
}
