import { NavigationLinks } from "@/components/layout/navigation-links";

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white px-4 py-5 lg:flex lg:flex-col">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="grid size-10 place-items-center rounded-xl bg-[#0D1B2A] text-sm font-black tracking-tight text-white">
          EMS
        </div>
        <div>
          <div className="text-sm font-bold text-slate-950">eMarketSelect</div>
          <div className="text-xs text-slate-500">Employee Management</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        <NavigationLinks />
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">
          Phase 1
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-900">
          Foundation active
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Authentication and live business data are enabled in later phases.
        </p>
      </div>
    </aside>
  );
}
