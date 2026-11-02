/**
 * Shimmering placeholder blocks for loading states. Reserves the real layout space
 * (avoids CLS) instead of a bare "Loading..." string, per ui-ux-pro-max's loading-
 * feedback and layout-stability guidance.
 */
export function SkeletonLine({ width = "100%", height = "1rem" }) {
  return <div className="skeleton" style={{ width, height }} />;
}

export function SkeletonCard() {
  return (
    <div className="card">
      <SkeletonLine width="40%" height="0.85rem" />
      <div style={{ height: "0.6rem" }} />
      <SkeletonLine width="70%" height="1.6rem" />
    </div>
  );
}
