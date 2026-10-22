/** A crosshair that marks a corner of a blueprint frame. */
export default function Tick({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute size-4 ${className}`}
    >
      <span className="absolute left-1/2 top-0 h-full w-px bg-neutral-900" />
      <span className="absolute left-0 top-1/2 h-px w-full bg-neutral-900" />
    </span>
  );
}
