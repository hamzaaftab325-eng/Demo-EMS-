import { PageHead } from "@/components/shared/prototype";

export function PhaseNotice({
  title,
  subtitle,
  phase,
  description,
}: {
  title: string;
  subtitle: string;
  phase: number;
  description: string;
}) {
  return (
    <>
      <PageHead title={title} subtitle={subtitle} />
      <div className="card">
        <div className="bd phase-notice">
          <span className="phase-chip">Phase {phase}</span>
          <h2>No fake operational data</h2>
          <p className="mut">{description}</p>
        </div>
      </div>
    </>
  );
}
