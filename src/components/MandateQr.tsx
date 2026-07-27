/**
 * Print-friendly QR for Mandate verification.
 * Uses a public QR image endpoint so we stay dependency-free;
 * the encoded payload is only the public verify URL (no PII beyond the code).
 */
export function MandateQr({
  verifyUrl,
  size = 140,
  label,
}: {
  verifyUrl: string;
  size?: number;
  label?: string;
}) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encodeURIComponent(verifyUrl)}`;
  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        width={size}
        height={size}
        alt={label || "QR verify"}
        className="rounded-lg border border-[#c9d3d2] bg-white"
      />
      {label ? <div className="text-[11px] text-[#5a6b6a] text-center">{label}</div> : null}
    </div>
  );
}
