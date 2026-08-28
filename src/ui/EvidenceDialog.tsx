import { useEffect, useRef } from "react";
import { CheckCircle, Fingerprint, Function, X } from "@phosphor-icons/react";

import type { ScenarioView } from "./types";

interface EvidenceDialogProps {
  scenario: ScenarioView | undefined;
  open: boolean;
  onClose: () => void;
}

export function EvidenceDialog({ scenario, open, onClose }: EvidenceDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const scenarioId = scenario?.id;
  const receiptId = scenario?.receiptId;

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
          <span><Function aria-hidden="true" size={20} />Engine <code>factory-sim/1.0.0</code></span>
          <span><CheckCircle aria-hidden="true" size={20} weight="fill" />No model-generated metrics</span>
        </div>
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
