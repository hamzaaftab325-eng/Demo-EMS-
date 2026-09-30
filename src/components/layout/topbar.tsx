import { Bell, Search } from "lucide-react";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";

export function Topbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <MobileNav />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-950">
            EMS Workspace
          </p>
          <p className="hidden truncate text-xs text-slate-500 sm:block">
            Production application foundation
          </p>
        </div>

        <Button variant="ghost" className="hidden gap-2 md:inline-flex" disabled>
          <Search className="size-4" />
          Search
        </Button>

        <Button
          variant="ghost"
          className="size-10 px-0"
          aria-label="Notifications"
          disabled
        >
          <Bell className="size-4.5" />
        </Button>

        <div className="grid size-9 place-items-center rounded-full bg-[#0D1B2A] text-xs font-bold text-white">
          DA
        </div>
      </div>
    </header>
  );
}
