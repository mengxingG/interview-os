"use client";

import { useEffect, useMemo, useState } from "react";
import ChatPanel from "@/components/ChatPanel";

type ProgressPayload = {
  dashboard?: {
    stories?: number;
    jd?: number;
    mocks?: number;
    knowledgeMastery?: number;
  };
};

const fallback = {
  stories: 0,
  jd: 0,
  mocks: 0,
  knowledgeMastery: 0,
};

const navSystemPrompt = `你是 InterviewOS 的导航助手（AI 教练助手）。
你的职责：基于用户当前进度（故事库数量、面试题练习、JD 解码、模拟面试次数、知识掌握度）给出下一步行动建议。
限制：
1) 不做面试模拟，明确引导去“模拟面试”模块。
2) 不做回答评分，明确引导去“回答评分”模块。
3) 建议必须具体到模块与按钮路径（例如：面试题库 -> AI 批量生成）。`;

function buildGreeting(stats: typeof fallback) {
  const storyAdvice = stats.stories < 5 ? `故事库 ${stats.stories} 条（建议补充到 5 条）` : `故事库 ${stats.stories} 条`;
  const questionHint = "面试题练习建议先从「面试题库」开始补题并练习";
  const knowledgeAdvice = `知识点掌握度 ${stats.knowledgeMastery}/5`;
  return `👋 你好！基于你当前的准备进度：${storyAdvice}、JD 解码 ${stats.jd} 条、模拟面试 ${stats.mocks} 次、${knowledgeAdvice}。建议你先从面试题库开始，点击左侧菜单的「面试题库」→「AI 批量生成」快速添加 10 道高频题，再进入「模拟面试」练习。${questionHint}。有其他问题随时问我！`;
}

export function DashboardCoachAssistant() {
  const [stats, setStats] = useState(fallback);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const response = await fetch("/api/notion/progress");
        if (!response.ok) return;
        const payload = (await response.json()) as ProgressPayload;
        if (!mounted || !payload.dashboard) return;
        setStats({
          stories: Number(payload.dashboard.stories ?? 0),
          jd: Number(payload.dashboard.jd ?? 0),
          mocks: Number(payload.dashboard.mocks ?? 0),
          knowledgeMastery: Number(payload.dashboard.knowledgeMastery ?? 0),
        });
      } catch {
        // keep fallback
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const greeting = useMemo(() => buildGreeting(stats), [stats]);

  return (
    <ChatPanel
      systemPrompt={navSystemPrompt}
      modelType="fast"
      assistantName="AI 教练助手"
      inputPlaceholder="问我：下一步该做什么？/ 帮我分析薄弱环节 / 怎么准备 XX 公司面试"
      initialAssistantMessage={greeting}
      emptyStateText="AI 教练助手已就位。"
      modelStorageKey="dashboard-coach"
    />
  );
}

