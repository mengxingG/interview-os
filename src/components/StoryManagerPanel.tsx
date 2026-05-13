"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { StoryCard } from "@/components/StoryCard";
import { toastFetch } from "@/lib/toast-utils";

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
    id: "s-local-1",
    title: "从 0 到 1 推出 AI Copilot",
    situation: "团队需要在 3 周内验证新功能价值。",
    task: "定义 MVP 方案并协调跨团队交付。",
    action: "拆解需求、制定优先级、按周复盘关键指标。",
    result: "按期上线并验证付费意向。",
    earnedSecret: "先验证高频核心链路，再做功能完整度。",
    tags: ["产品战略", "执行推进"],
    strength: 4,
  },
];

type FormState = {
  title: string;
  situation: string;
  task: string;
  actionText: string;
  result: string;
  earnedSecret: string;
  tags: string;
  strength: number;
};

const initialForm: FormState = {
  title: "",
  situation: "",
  task: "",
  actionText: "",
  result: "",
  earnedSecret: "",
  tags: "",
  strength: 3,
};

export function StoryManagerPanel() {
  const [stories, setStories] = useState<Story[]>(fallbackStories);
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("正在加载 Notion 故事库...");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadStories() {
      try {
        const response = await fetch("/api/notion/stories", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = (await response.json()) as { stories?: Story[] };
        if (mounted && Array.isArray(payload.stories) && payload.stories.length > 0) {
          setStories(payload.stories);
          setStatus("已连接 Notion StoryBank");
        } else if (mounted) {
          setStatus("Notion 暂无故事数据，显示本地示例");
        }
      } catch {
        if (mounted) {
          setStatus("Notion 不可用，显示本地示例数据");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadStories();
    return () => {
      mounted = false;
    };
  }, []);

  const preview = useMemo(
    () =>
      `${form.situation}\n${form.task}\n${form.actionText}\n${form.result}\nEarned Secret: ${form.earnedSecret}`,
    [form],
  );

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) {
      return;
    }
    setSubmitting(true);

    const tags = form.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    toastFetch(
      "/api/notion/stories",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          situation: form.situation.trim(),
          task: form.task.trim(),
          actionText: form.actionText.trim(),
          result: form.result.trim(),
          earnedSecret: form.earnedSecret.trim(),
          tags,
          strength: form.strength,
        }),
      },
      {
        loading: "正在保存故事到 Notion...",
        success: "✨ 故事已成功保存到 StoryBank！",
        error: (err) => `❌ 保存失败：${err.message}`,
      },
      () => {
        setStories((prev) => [
          {
            id: crypto.randomUUID(),
            title: form.title,
            situation: form.situation,
            task: form.task,
            action: form.actionText,
            result: form.result,
            earnedSecret: form.earnedSecret,
            tags,
            strength: form.strength,
          },
          ...prev,
        ]);
        setForm(initialForm);
        setStatus("故事已保存到 Notion");
      },
    );

    setSubmitting(false);
  };

  return (
    <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
      <div className="neon-card rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-100">StoryBank</h2>
          <span className="text-xs text-zinc-500">{status}</span>
        </div>
        {loading ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-sm text-zinc-500">
            正在同步故事列表...
          </div>
        ) : (
          <div className="grid gap-3">
            {stories.slice(0, 4).map((story) => (
              <StoryCard
                key={story.id}
                title={story.title}
                content={`${story.situation} ${story.task} ${story.action} ${story.result}`}
                tag={story.tags[0] ?? `Strength ${story.strength}`}
              />
            ))}
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="neon-card rounded-2xl p-4">
        <h2 className="mb-3 text-lg font-medium text-zinc-100">新增 STAR 故事</h2>
        <div className="grid gap-2">
          <p className="text-xs text-zinc-500">标题</p>
          <input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="标题（例如：推动跨团队完成 AI 上线）"
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            required
          />
          <p className="text-xs text-zinc-500">场景（Situation）</p>
          <textarea
            value={form.situation}
            onChange={(event) => setForm((prev) => ({ ...prev, situation: event.target.value }))}
            placeholder="Situation"
            className="min-h-16 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            required
          />
          <p className="text-xs text-zinc-500">任务（Task）</p>
          <textarea
            value={form.task}
            onChange={(event) => setForm((prev) => ({ ...prev, task: event.target.value }))}
            placeholder="Task"
            className="min-h-14 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            required
          />
          <p className="text-xs text-zinc-500">行动（Action）</p>
          <textarea
            value={form.actionText}
            onChange={(event) => setForm((prev) => ({ ...prev, actionText: event.target.value }))}
            placeholder="Action"
            className="min-h-16 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            required
          />
          <p className="text-xs text-zinc-500">结果（Result）</p>
          <textarea
            value={form.result}
            onChange={(event) => setForm((prev) => ({ ...prev, result: event.target.value }))}
            placeholder="Result"
            className="min-h-16 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            required
          />
          <p className="text-xs text-zinc-500">关键洞察（Earned Secret）</p>
          <textarea
            value={form.earnedSecret}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, earnedSecret: event.target.value }))
            }
            placeholder="Earned Secret"
            className="min-h-14 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            required
          />
          <p className="text-xs text-zinc-500">标签（Tags）</p>
          <input
            value={form.tags}
            onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
            placeholder="Tags（逗号分隔）"
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />
          <label className="text-xs text-zinc-500">
            Strength: {form.strength}
            <input
              type="range"
              min={1}
              max={5}
              value={form.strength}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, strength: Number(event.target.value) }))
              }
              className="mt-1 w-full"
            />
          </label>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3 text-xs text-zinc-500">
            预览：
            <pre className="mt-1 whitespace-pre-wrap font-mono">{preview}</pre>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg border border-violet-400/45 bg-violet-500/15 px-3 py-2 text-sm text-violet-100 transition hover:bg-violet-500/25 disabled:opacity-60"
          >
            {submitting ? "提交中..." : "保存到 StoryBank"}
          </button>
        </div>
      </form>
    </section>
  );
}
