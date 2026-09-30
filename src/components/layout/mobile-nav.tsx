"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { NavigationLinks } from "@/components/layout/navigation-links";
import { Button } from "@/components/ui/button";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Button
        variant="ghost"
        className="size-10 px-0"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <aside
            className="h-full w-[min(88vw,320px)] bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-7 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-[#0D1B2A] text-sm font-black text-white">
                  EMS
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-950">
                    eMarketSelect
                  </div>
                  <div className="text-xs text-slate-500">
                    Employee Management
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                className="size-10 px-0"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
              >
                <X className="size-5" />
              </Button>
            </div>

            <NavigationLinks onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
