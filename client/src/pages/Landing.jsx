import { Link } from "react-router-dom";
import ProvenanceHero from "../components/ProvenanceHero";
import ParticleField from "../components/ParticleField";
import ScrollReveal from "../components/ScrollReveal";

export default function Landing() {
  return (
    <div className="landing">
      {/* 01 — Hero / thesis + 02 — Interactive provenance network */}
      <section className="hero">
        <ParticleField />
        <div className="hero-copy">
          <h1>Proof for the work behind AI-generated content.</h1>
          <p className="hero-subtitle">
            Register content, anchor its fingerprint on-chain, and verify
            whether new work is genuinely original or semantically close to
            something already registered.
          </p>
          <div className="hero-ctas">
            <Link to="/register-account" className="btn-primary">
              Register content
            </Link>
            <a href="#how-it-works" className="btn-secondary">
              See how proof works
            </a>
          </div>
        </div>
        <div className="hero-3d">
          <ProvenanceHero />
        </div>
      </section>

      {/* 03 — Register */}
      <section className="section" id="how-it-works">
        <ScrollReveal>
          <h2>Two layers of trust, not one</h2>
        </ScrollReveal>
        <div className="two-col">
          <ScrollReveal delay={0.05}>
            <div className="card">
              <h3>Ownership proof</h3>
              <p>
                Every registration produces a SHA-256 fingerprint anchored on
                Ethereum Sepolia — a timestamped, publicly verifiable record of
                who registered the work and when.
              </p>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={0.15}>
            <div className="card">
              <h3>Originality analysis</h3>
              <p>
                A separate similarity engine compares new submissions against
                everything already registered — text embeddings, perceptual
                image hashing, audio fingerprinting, and frame-based video
                comparison.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* 04 — On-chain proof / 05 — Semantic originality */}
      <section className="section">
        <ScrollReveal>
          <h2>Two questions, answered separately</h2>
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <div className="proof-vs-originality">
            <div className="pvo-block">
              <span className="badge badge-verified">Blockchain</span>
              <p className="pvo-question">
                Who registered this content, and when?
              </p>
              <p className="note">
                Answered by an on-chain record. Exact and immutable.
              </p>
            </div>
            <div className="pvo-divider" aria-hidden="true" />
            <div className="pvo-block">
              <span className="badge badge-derivative">Originality engine</span>
              <p className="pvo-question">
                How similar is this to work already registered?
              </p>
              <p className="note">
                Answered by comparison. A technical indicator, not a legal
                ruling.
              </p>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* 06 — Creative Evidence Score */}
      <section className="section">
        <ScrollReveal>
          <h2>Evidence you can read, not a black box</h2>
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <div className="card" style={{ maxWidth: 420, margin: "0 auto" }}>
            <div className="evidence-score-block">
              <span className="evidence-score-number">82</span>
              <span className="evidence-score-max">/100</span>
              <span className="evidence-score-qualifier">Strong evidence</span>
            </div>
            {[
              ["Registration history", 100],
              ["Ownership proof", 100],
              ["Similarity", 70],
              ["Version history", 90],
              ["AI model metadata", 60],
            ].map(([label, pct]) => (
              <div className="evidence-factor-row" key={label}>
                <div className="evidence-factor-top">
                  <span className="evidence-factor-name">{label}</span>
                </div>
                <div className="evidence-bar-track">
                  <div
                    className="evidence-bar-fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </section>

      {/* 08 — Public verification */}
      <section className="section cta-section">
        <ScrollReveal>
          <h2>Already have an Asset ID?</h2>
          <p className="note">
            Anyone can verify a registered asset's ownership proof — no account
            required.
          </p>
          <Link to="/explorer" className="btn-primary">
            Open public explorer
          </Link>
        </ScrollReveal>
      </section>

      {/* 09 — Technical architecture */}
      <section className="section">
        <ScrollReveal>
          <h2>Built for every digital creator</h2>
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <div className="tag-row">
            <span className="tag">Prompt</span>
            <span className="tag">Article</span>
            <span className="tag">Image</span>
            <span className="tag">Music</span>
            <span className="tag">Video</span>
          </div>
        </ScrollReveal>
      </section>

      {/* 10 — Final CTA */}
      <section className="section cta-section">
        <ScrollReveal>
          <h2>Register your first work</h2>
          <Link to="/register-account" className="btn-primary">
            Register content
          </Link>
        </ScrollReveal>
      </section>

      {/* 11 — Footer */}
      <footer className="footer">
        <p>ProofChain — Register. Verify. Protect. Prove.</p>
        <p className="note">
          Technical evidence, not legal judgment. ProofChain does not determine
          copyright infringement and is not a replacement for provenance
          standards like C2PA.
        </p>
      </footer>
    </div>
  );
}
