/** Ambient background: calm gradient blobs. Motion is CSS-only and disabled
 *  under prefers-reduced-motion (see globals.css). Purely decorative. */
export function Background() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden"
      style={{ background: "#070B12" }}
    >
      {/* Emerald dominates the canvas; cyan and violet are faint, smaller
          accents so the palette commits to one signature colour. */}
      <div
        className="blob"
        style={{
          width: 640,
          height: 640,
          background: "radial-gradient(circle, #3FCB9B, transparent 70%)",
          top: -200,
          insetInlineEnd: -160,
          opacity: 0.3,
        }}
      />
      <div
        className="blob"
        style={{
          width: 460,
          height: 460,
          background: "radial-gradient(circle, #3FCB9B, transparent 70%)",
          bottom: -220,
          insetInlineStart: -180,
          opacity: 0.16,
        }}
      />
      <div
        className="blob"
        style={{
          width: 360,
          height: 360,
          background: "radial-gradient(circle, #3EC6FF, transparent 70%)",
          top: "36%",
          insetInlineStart: "16%",
          opacity: 0.1,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(7,11,18,0) 0%, rgba(7,11,18,0.6) 60%, rgba(7,11,18,0.95) 100%)",
        }}
      />
    </div>
  );
}
