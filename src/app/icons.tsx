type IconProps = {
  className?: string;
};

// Small stroke icons kept inline rather than pulling in an icon library
// (ADR 0004) — the increment/decrement controls and the account avatar.
// Edit/Delete moved to the lucide-react overflow menu trigger and text
// menu items (ADR 0004, PER-266), so their glyphs no longer live here.
export function MinusIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 8h10" />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M2.5 14c0-2.9 2.5-5 5.5-5s5.5 2.1 5.5 5" />
    </svg>
  );
}
