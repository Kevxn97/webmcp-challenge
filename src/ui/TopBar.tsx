import { ArrowClockwise, BracketsCurly } from "@phosphor-icons/react";

import type { MissionConstraintView } from "./types";

interface TopBarProps {
  revision: number;
  webMcpStatus: "ready" | "unavailable";
  constraints: MissionConstraintView[];
  onReset: () => void;
}

export function TopBar({ revision, webMcpStatus, constraints, onReset }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand-block">
        <span className="brand-kicker">Agentic</span>
        <strong>Sandbox</strong>
        <span className="brand-subtitle">Factory decision lab</span>
      </div>

      <section className="mission-brief" aria-labelledby="mission-title">
        <span className="section-eyebrow" id="mission-title">
          Mission brief
        </span>
        <div className="mission-constraints">
          {constraints.map((constraint) => (
            <span key={constraint.id} title={constraint.detail}>
              {constraint.label}
            </span>
          ))}
        </div>
      </section>

      <div className="runtime-meta">
        <div className="runtime-cell">
          <span className="section-eyebrow">State</span>
          <strong>Revision {revision}</strong>
        </div>
        <div className="runtime-cell runtime-cell--status">
          <span className="section-eyebrow">Site tools</span>
          <span className={`site-tools-status site-tools-status--${webMcpStatus}`}>
            <BracketsCurly aria-hidden="true" size={16} weight="bold" />
            {webMcpStatus === "ready" ? "WebMCP ready" : "Human mode"}
          </span>
        </div>
        <button className="icon-text-button" type="button" onClick={onReset}>
          <ArrowClockwise aria-hidden="true" size={17} weight="bold" />
          Reset demo
        </button>
      </div>
    </header>
  );
}
