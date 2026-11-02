import { Bot, User } from "lucide-react";

const KNOWN_AI_MODELS = ["ChatGPT", "Claude", "Gemini", "Midjourney", "Flux", "Stable Diffusion", "Runway"];

/**
 * Displays the creator-declared AI model with clear "creator-declared, not verified"
 * framing — this is user-provided metadata (spec Section 9), never independently
 * confirmed, so the UI must never imply otherwise.
 */
export default function AiModelAttribution({ aiModel }) {
  const isKnownModel = KNOWN_AI_MODELS.includes(aiModel);
  const isHuman = aiModel === "Human-created / Unknown";

  return (
    <div className="ai-attribution">
      <span className="ai-attribution-icon">
        {isHuman ? <User size={16} strokeWidth={2} /> : <Bot size={16} strokeWidth={2} />}
      </span>
      <div>
        <span className="ai-attribution-label">{isHuman ? "Human-created / unknown" : aiModel}</span>
        <p className="note" style={{ margin: 0 }}>
          {isKnownModel
            ? "Creator-declared at registration. Not independently verified."
            : "Creator-declared metadata."}
        </p>
      </div>
    </div>
  );
}
