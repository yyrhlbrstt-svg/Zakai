/** Ambient background: calm gradient blobs. Motion is CSS-only and disabled
 *  under prefers-reduced-motion (see globals.css). Purely decorative. */
export function Background() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden"
      style={{ background: "#070B12" }}
    >
      <div
        className="blob"
        style={{
          width: 560,
          height: 560,
          background: "radial-gradient(circle, #2CE5A7, transparent 70%)",
          top: -180,
          insetInlineEnd: -140,
          opacity: 0.28,
        }}
      />
      <div
        className="blob"
        style={{
          width: 500,
          height: 500,
          background: "radial-gradient(circle, #8B5CF6, transparent 70%)",
          bottom: -200,
          insetInlineStart: -160,
          opacity: 0.26,
        }}
      />
      <div
        className="blob"
        style={{
          width: 420,
          height: 420,
          background: "radial-gradient(circle, #3EC6FF, transparent 70%)",
          top: "34%",
          insetInlineStart: "16%",
          opacity: 0.18,
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
