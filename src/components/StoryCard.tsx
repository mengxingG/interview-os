type StoryCardProps = {
  title: string;
  content: string;
  tag?: string;
};

export function StoryCard({ title, content, tag = "STAR" }: StoryCardProps) {
  return (
    <article className="neon-card rounded-2xl p-4">
      <div className="mb-3 inline-flex rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-xs text-violet-200">
        {tag}
      </div>
      <h3 className="mb-2 text-base font-medium text-zinc-100">{title}</h3>
      <p className="text-sm leading-6 text-zinc-400">{content}</p>
    </article>
  );
}
