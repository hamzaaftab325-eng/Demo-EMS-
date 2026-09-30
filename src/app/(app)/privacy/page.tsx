import { PageHead } from "@/components/shared/prototype";

export default function PrivacyPage() {
  return (
    <>
      <PageHead
        title="What we record"
        subtitle="The same privacy rules apply to everyone in the company"
      />

      <div className="card">
        <div className="bd prose">
          <p>
            The EMS observes activity only inside its own browser tab. When the
            tab stops sending heartbeats, EMS receives no new interaction data;
            the last recorded state remains part of attendance history.
          </p>

          <h2>What is recorded</h2>
          <ul>
            <li>When you sign in and sign off, and your scrum entries</li>
            <li>Breaks and meetings you mark yourself</li>
            <li>A small heartbeat about once a minute while EMS is open</li>
            <li>
              The time of your last click or key press inside EMS — never what
              you typed
            </li>
            <li>Requests you file once the Requests module is enabled</li>
          </ul>

          <h2>What is never recorded</h2>
          <ul>
            <li>Keystroke content or anything you type outside EMS</li>
            <li>Screenshots or your screen</li>
            <li>Webcam or microphone</li>
            <li>Browsing history or other websites</li>
          </ul>

          <h2>Who can see your data</h2>
          <p>
            You, managers/directors above you in the reporting chain, and Super
            Admins. Colleagues at the same level cannot see each other&apos;s
            attendance, presence, or scrums.
          </p>
        </div>
      </div>
    </>
  );
}
