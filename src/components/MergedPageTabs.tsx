"use client";

type TabItem = {
  id: string;
  label: string;
  hint?: string;
  highlight?: boolean;
};

type MergedPageTabsProps = {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
};

export function MergedPageTabs({ tabs, activeTab, onChange }: MergedPageTabsProps) {
  return (
    <section className="neon-card rounded-2xl p-3">
      <div className="flex flex-wrap gap-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`rounded-lg border-b-2 px-4 py-2 text-sm transition ${
                isActive
                  ? "border-cyan-400 bg-cyan-500/10 font-semibold text-cyan-100"
                  : "border-zinc-800 bg-zinc-950/70 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <span>{tab.label}</span>
                {tab.highlight ? <span className="h-2 w-2 rounded-full bg-amber-300" title="重点关注" /> : null}
              </span>
              {tab.hint ? <span className="ml-2 text-xs text-zinc-500">{tab.hint}</span> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
