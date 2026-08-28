import { useEffect, useRef } from "react";
import { CheckCircle, Fingerprint, Function, X } from "@phosphor-icons/react";

import type { ScenarioView } from "./types";

interface EvidenceDialogProps {
  scenario: ScenarioView | undefined;
  open: boolean;
  onClose: () => void;
}

export interface ProofPresentation {
  tone: "conclusive" | "inconclusive" | "historical";
  eyebrow: string;
  title: string;
  comparison: string;
  explanation: string;
}

export function describeProof(scenario: ScenarioView): ProofPresentation | null {
  const proof = scenario.infeasibilityProof;
  if (!proof) return null;
  const upperBound = proof.goodOutputUpperBound.toLocaleString("en-US");
  const target = proof.targetGoodOutputUnits.toLocaleString("en-US");

  if (!proof.sourceCurrent || scenario.status === "STALE") {
    return {
      tone: "historical",
      eyebrow: "Historical lock-bound analysis",
      title: "Receipt is stale under the current factory state",
      comparison: proof.proven
        ? proof.exactInequality
        : `${proof.goodOutputUpperBound} ≥ ${proof.targetGoodOutputUnits}`,
      explanation: `This ${upperBound}-unit bound was computed for an earlier scenario or lock revision. It remains auditable evidence, but it does not prove the current mission infeasible.`,
    };
  }

  if (!proof.proven || scenario.status !== "PROVEN INFEASIBLE") {
    return {
      tone: "inconclusive",
      eyebrow: "Lock-bound upper-bound analysis",
      title: "The bound does not prove infeasibility",
      comparison: `${proof.goodOutputUpperBound} ≥ ${proof.targetGoodOutputUnits}`,
      explanation: `The computed upper bound is ${upperBound} good units against a ${target}-unit target. Because the bound does not fall below the target, this analysis is not an infeasibility proof.`,
    };
  }

  return {
    tone: "conclusive",
    eyebrow: "Lock-bound upper-bound proof",
    title: "Mission proven infeasible under the human lock",
    comparison: proof.exactInequality,
    explanation: `At most ${upperBound} good units can reach the warehouse while Packaging remains locked. The mission requires ${target}.`,
  };
}

export function EvidenceDialog({ scenario, open, onClose }: EvidenceDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const scenarioId = scenario?.id;
  const receiptId = scenario?.receiptId;
  const proofPresentation = scenario ? describeProof(scenario) : null;

  useEffect(() => {
    if (!open || !scenarioId || !receiptId) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    };
  }, [open, scenarioId, receiptId]);

  if (!open || !scenario || !receiptId) return null;

  return (
    <dialog
      ref={dialogRef}
      className="evidence-dialog"
      aria-labelledby="evidence-dialog-title"
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const outside = event.clientX < bounds.left || event.clientX > bounds.right
          || event.clientY < bounds.top || event.clientY > bounds.bottom;
        if (outside) onClose();
      }}
    >
        <header>
          <div>
            <span className="section-eyebrow">Deterministic receipt</span>
            <h2 id="evidence-dialog-title">Why {scenario.name} got this result</h2>
          </div>
          <button className="dialog-close" type="button" aria-label="Close evidence" onClick={onClose} autoFocus>
            <X aria-hidden="true" size={19} weight="bold" />
          </button>
        </header>
        <div className="evidence-summary">
          <span><Fingerprint aria-hidden="true" size={20} />Receipt <code>{receiptId}</code></span>
          <span><Function aria-hidden="true" size={20} />Engine <code>{scenario.engineVersion ?? "—"}</code></span>
          <span><CheckCircle aria-hidden="true" size={20} weight="fill" />No model-generated metrics</span>
        </div>
        {scenario.infeasibilityProof && proofPresentation && (
          <section className={`proof-panel proof-panel--${proofPresentation.tone}`} aria-labelledby="proof-panel-title">
            <span className="section-eyebrow">{proofPresentation.eyebrow}</span>
            <h3 id="proof-panel-title">{proofPresentation.title}</h3>
            <code className="proof-inequality">{proofPresentation.comparison}</code>
            <p>{proofPresentation.explanation}</p>
            <small>
              {scenario.infeasibilityProof.proofVersion} · {scenario.infeasibilityProof.method} · {" "}
              {scenario.infeasibilityProof.sourceCurrent ? "CURRENT SOURCE" : "STALE SOURCE"} · {" "}
              {scenario.infeasibilityProof.proven ? "PROVEN" : "NOT PROVEN"}
            </small>
          </section>
        )}
        <section>
          <h3>Constraint evidence</h3>
          <dl className="formula-list">
            <div><dt>Output</dt><dd>{scenario.metrics.outputDelta} vs. required +20.0%</dd></div>
            <div><dt>Operating cost</dt><dd>{scenario.metrics.costDelta} vs. allowed +8.0%</dd></div>
            <div><dt>Defect rate</dt><dd>{scenario.metrics.defectDelta} vs. baseline</dd></div>
            <div><dt>Machine additions</dt><dd>{scenario.metrics.machineAdditions}; asset inventory hash unchanged</dd></div>
          </dl>
        </section>
        <section className="truth-note">
          The agent proposes changes. The simulator computes the consequences. This page never accepts free-form model prose as operational evidence.
        </section>
    </dialog>
  );
}
