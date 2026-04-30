"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isWide, setIsWide] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      const wide = query.matches;
      setIsWide(wide);
      setMenuOpen(wide);
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (isWide !== false) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = menuOpen ? "hidden" : original;
    return () => {
      document.body.style.overflow = original;
    };
  }, [isWide, menuOpen]);

  return (
    <div className="mx-auto flex w-full max-w-[1300px] gap-4 px-4 py-4 lg:gap-6 lg:px-6">
      {/* Always-visible sidebar collapse/expand button */}
      <div className="w-10 shrink-0">
        <div className={`sticky ${isWide ? "top-4" : "top-3"}`}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="z-50 h-9 w-9 rounded-lg border border-zinc-700 bg-zinc-900/90 text-sm text-zinc-200"
            aria-label={menuOpen ? "收起菜单" : "展开菜单"}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {isWide === true && menuOpen ? (
        <div className="w-64 shrink-0">
          <div className="sticky top-4 h-[calc(100vh-2rem)]">
            <Sidebar />
          </div>
        </div>
      ) : null}

      {isWide === false ? (
        <div
          className={`fixed inset-0 z-40 flex transition-opacity duration-200 ${
            menuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div
            className={`h-full w-[84%] max-w-xs p-3 transition-transform duration-200 ${
              menuOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <Sidebar className="h-full" onNavigate={() => setMenuOpen(false)} />
          </div>
          <button
            type="button"
            className="h-full flex-1 bg-black/60"
            aria-label="关闭菜单遮罩"
            onClick={() => setMenuOpen(false)}
          />
        </div>
      ) : null}

      <div className="flex min-h-[calc(100vh-2rem)] min-w-0 flex-1 flex-col gap-4">
        {children}
      </div>
    </div>
  );
}
