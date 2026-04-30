import { ProgressPanel } from "@/components/ProgressPanel";
import { PageGuide } from "@/components/PageGuide";

export default function ProgressPage() {
  return (
    <main className="flex w-full flex-col gap-4">
      <section className="neon-card rounded-2xl p-6">
        <h1 className="text-2xl font-semibold">进度仪表盘</h1>
        <p className="mt-2 text-sm text-zinc-400">
          你的面试能力成长曲线。追踪五维评分趋势、知识掌握度和投递状态。
        </p>
      </section>
      <PageGuide
        pageKey="progress"
        items={[
          "五维评分趋势图展示你每次模拟/复盘的分数变化。",
          "关注最低维度——那是你最需要提升的方向。",
          "知识掌握度分布图帮你识别知识盲区。",
          "JD 投递看板让你掌控整体求职节奏。",
        ]}
      />
      <ProgressPanel />
    </main>
  );
}
