import { LockSimple, Warning } from "@phosphor-icons/react";

import type { AuthorityView } from "./types";

export function AuthorityBanner({ authority }: { authority: AuthorityView }) {
  if (!authority.packagingLocked) return null;

  return (
    <section className="authority-banner" role="status" aria-live="polite">
      <span className="authority-icon"><Warning aria-hidden="true" size={22} weight="fill" /></span>
      <div>
        <span className="section-eyebrow">Human authority changed</span>
        <strong><LockSimple aria-hidden="true" size={17} weight="bold" />Packaging is locked · prior scenario heads are historical</strong>
      </div>
      <dl>
        <div><dt>Blocked</dt><dd>{authority.blockedControls.join(" · ")}</dd></div>
        <div><dt>Modeled effect</dt><dd>Tick {authority.effectiveTick} · T+{authority.effectiveElapsedMinutes} min</dd></div>
        <div><dt>Authority revision</dt><dd>Lock r{authority.lockRevision}</dd></div>
      </dl>
    </section>
  );
}
