import { useState } from "react";
import { Check, Copy, Code2 } from "lucide-react";

export default function EmbeddableBadge({ assetId }) {
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const verifyUrl = `${window.location.origin}/assets/${assetId}`;
  const snippet = `<a href="${verifyUrl}" target="_blank" rel="noopener noreferrer" aria-label="Verified on ProofChain">\n  <span style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid #b7dfc3;border-radius:6px;background:#eaf6ee;color:#10632e;font:600 13px/1.2 Arial,sans-serif;">\n    <span aria-hidden="true">✓</span> Verified on ProofChain\n  </span>\n</a>`;

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="card embeddable-badge">
      <div className="embeddable-badge-heading">
        <div>
          <h2>Embeddable verification badge</h2>
          <p className="note">
            Show a live ProofChain verification link on your portfolio or
            profile.
          </p>
        </div>
        <span className="proofchain-live-badge">
          <Check size={13} strokeWidth={3} /> Verified on ProofChain
        </span>
      </div>

      <div className="embeddable-badge-actions">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setShowCode((visible) => !visible)}
        >
          <Code2 size={15} strokeWidth={2} />
          {showCode ? "Hide embed code" : "Get embed code"}
        </button>
        {showCode && (
          <button type="button" className="btn-secondary" onClick={copySnippet}>
            {copied ? (
              <Check size={15} strokeWidth={2} />
            ) : (
              <Copy size={15} strokeWidth={2} />
            )}
            {copied ? "Copied" : "Copy HTML"}
          </button>
        )}
      </div>

      {showCode && (
        <pre className="embeddable-badge-code">
          <code>{snippet}</code>
        </pre>
      )}
    </section>
  );
}
