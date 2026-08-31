import { useState } from "react";
import { Check, Copy, LockSimple } from "@phosphor-icons/react";

import {
  HUMAN_INTERVENTION_PROMPT,
  PLANNING_MISSION_PROMPT,
} from "../app/demoPrompts";

interface ReplayGuideProps {
  packagingLocked: boolean;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function ReplayGuide({ packagingLocked }: ReplayGuideProps) {
  const [copied, setCopied] = useState<"mission" | "intervention" | null>(null);

  const copy = async (kind: "mission" | "intervention", text: string) => {
    await copyText(text);
    setCopied(kind);
    globalThis.setTimeout(() => setCopied((current) => current === kind ? null : current), 1_600);
  };

  return (
    <section className="replay-guide" aria-label="Replay with ChatGPT">
      <div className="replay-guide-copy">
        <span className="section-eyebrow">Replay with ChatGPT</span>
        <strong>One safe disagreement, end to end</strong>
      </div>
      <ol className="replay-steps">
        <li><b>1</b><span>Reset demo</span></li>
        <li><b>2</b><span>Copy mission</span></li>
        <li className={packagingLocked ? "replay-step--active" : ""}>
          <b>3</b><span><LockSimple aria-hidden="true" size={13} weight="bold" />Lock Packaging after comparison</span>
        </li>
      </ol>
      <div className="replay-actions">
        <button className="copy-action" type="button" onClick={() => void copy("mission", PLANNING_MISSION_PROMPT)}>
          {copied === "mission" ? <Check aria-hidden="true" size={15} weight="bold" /> : <Copy aria-hidden="true" size={15} weight="bold" />}
          {copied === "mission" ? "Mission copied" : "Copy mission"}
        </button>
        <button className="copy-action" type="button" onClick={() => void copy("intervention", HUMAN_INTERVENTION_PROMPT)}>
          {copied === "intervention" ? <Check aria-hidden="true" size={15} weight="bold" /> : <Copy aria-hidden="true" size={15} weight="bold" />}
          {copied === "intervention" ? "Intervention copied" : "Copy intervention"}
        </button>
      </div>
    </section>
  );
}
