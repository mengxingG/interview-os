import { PageGuide } from "@/components/PageGuide";
import { ScoreRadar } from "@/components/ScoreRadar";
import { TodayReviewPlan } from "@/components/TodayReviewPlan";
import { TrainPanel } from "@/components/TrainPanel";
import { UpcomingInterviewFocus } from "@/components/UpcomingInterviewFocus";

export default function TrainPage() {
  return (
    <main className="flex w-full flex-col gap-4">
      <section className="neon-card rounded-2xl p-6">
        <h1 className="text-2xl font-semibold">知识训练（SM-2）</h1>
        <p className="mt-2 text-sm text-zinc-400">
          基于遗忘曲线的 SM-2 间隔复习系统。每天花 10 分钟，把知识点从短期记忆转为长期记忆。
        </p>
      </section>
      <PageGuide
        pageKey="train"
        items={[
          "先添加知识点（如 AI PM 核心概念、RAG 架构、推荐系统指标等）。",
          "每天打开页面，系统自动推送到期复习卡片。",
          "翻转卡片后诚实自评：完全忘记→熟练，系统会自动调整下次复习时间。",
          "越难的知识点复习越频繁，越熟的间隔越长。",
        ]}
      />
      <UpcomingInterviewFocus />
      <section className="grid gap-4 lg:grid-cols-2">
        <TodayReviewPlan />
        <ScoreRadar
          scores={[6, 8, 7, 7, 8]}
          title="全局面试表现（Global Profile）"
          subtitle="该图来自题库练习与模拟面试的综合能力画像，不代表当前 SM-2 记忆评分。"
        />
      </section>
      <TrainPanel />
    </main>
  );
}
