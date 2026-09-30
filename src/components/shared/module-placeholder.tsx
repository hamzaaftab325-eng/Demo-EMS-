import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ModulePlaceholderProps = {
  title: string;
  description: string;
  phase: number;
  items: string[];
};

export function ModulePlaceholder({
  title,
  description,
  phase,
  items,
}: ModulePlaceholderProps) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge>Phase {phase}</Badge>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            {description}
          </p>
        </div>

        <div className="inline-flex items-center gap-2 self-start rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          Planned module
          <ArrowRight className="size-3.5" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
          >
            <CheckCircle2 className="size-5 text-cyan-600" aria-hidden="true" />
            <p className="mt-4 text-sm font-semibold leading-6 text-slate-800">
              {item}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
