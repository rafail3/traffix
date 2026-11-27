import type { SimpleIcon } from "simple-icons";

/** An official brand mark (Android, GitHub) from Simple Icons, drawn in currentColor. */
export function Mark({ icon, size = 24, className }: { icon: SimpleIcon; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" className={className}>
      <path d={icon.path} />
    </svg>
  );
}
