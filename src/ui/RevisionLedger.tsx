import {
  FileText,
  Info,
  Robot,
  Stack,
  User,
  Wrench,
  type Icon,
} from "@phosphor-icons/react";

import type { LedgerEventView } from "./types";

const ICONS: Record<LedgerEventView["kind"], Icon> = {
  human: User,
  tool: Wrench,
  agent: Robot,
  simulation: FileText,
  state: Stack,
  system: Info,
};

export function RevisionLedger({ events }: { events: LedgerEventView[] }) {
  return (
    <aside className="revision-ledger" aria-labelledby="revision-ledger-title">
      <header>
        <span className="section-eyebrow" id="revision-ledger-title">Revision ledger</span>
        <strong>Human + agent evidence</strong>
      </header>
      <div className="ledger-events" aria-live="polite">
        {events.map((event) => {
          const EventIcon = ICONS[event.kind];
          return (
            <article className={`ledger-event ledger-event--${event.tone ?? "neutral"}`} key={event.id}>
              <EventIcon className="ledger-icon" aria-hidden="true" size={23} weight="regular" />
              <div className="ledger-copy">
                <div className="ledger-meta">
                  <span>{event.kind}</span>
                  <time>{event.timestamp}</time>
                </div>
                <strong>{event.label}</strong>
                <p>{event.detail}</p>
              </div>
              <span className="ledger-revision">v{event.revision}</span>
            </article>
          );
        })}
      </div>
      <footer>
        <Stack aria-hidden="true" size={18} weight="regular" />
        Append-only · verifiable events only
      </footer>
    </aside>
  );
}
