import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/* Search — exact path from Figma */
export function SearchIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 16.3846 16.3846" fill="none" width="16" height="16" {...props}>
      <path
        d="M15.6769 16.3846L9.41539 10.1231C8.91539 10.5487 8.34039 10.8782 7.69039 11.1115C7.04039 11.3449 6.38718 11.4615 5.73077 11.4615C4.13205 11.4615 2.77725 10.9061 1.66635 9.7952C0.555449 8.6843 0 7.32949 0 5.73077C0 4.13205 0.555449 2.77725 1.66635 1.66635C2.77725 0.555449 4.13205 0 5.73077 0C7.32949 0 8.6843 0.555449 9.7952 1.66635C10.9061 2.77725 11.4615 4.13205 11.4615 5.73077C11.4615 6.42565 11.3385 7.09808 11.0923 7.74808C10.8462 8.39808 10.5231 8.95385 10.1231 9.41539L16.3846 15.6769L15.6769 16.3846ZM5.73077 10.4615C7.0577 10.4615 8.17789 10.0048 9.09135 9.09135C10.0048 8.17789 10.4615 7.0577 10.4615 5.73077C10.4615 4.40385 10.0048 3.28366 9.09135 2.3702C8.17789 1.45674 7.0577 1.00001 5.73077 1.00001C4.40385 1.00001 3.28366 1.45674 2.3702 2.3702C1.45674 3.28366 1.00001 4.40385 1.00001 5.73077C1.00001 7.0577 1.45674 8.17789 2.3702 9.09135C3.28366 10.0048 4.40385 10.4615 5.73077 10.4615Z"
        fill="currentColor"
      />
    </svg>
  );
}

/* Collection / book — exact path from Figma */
export function CollectionIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 17 16" fill="none" width="17" height="16" {...props}>
      <path
        d="M1.61539 16C1.16795 16 0.78686 15.8426 0.472116 15.5279C0.157372 15.2132 0 14.8321 0 14.3846V1.61539C0 1.16795 0.157372 0.78686 0.472116 0.472116C0.78686 0.157372 1.16795 0 1.61539 0H14.3846C14.8321 0 15.2132 0.157372 15.5279 0.472116C15.8426 0.78686 16 1.16795 16 1.61539V4.55769H15V1.61539C15 1.4359 14.9423 1.28847 14.8269 1.17308C14.7115 1.0577 14.5641 1.00001 14.3846 1.00001H1.61539C1.4359 1.00001 1.28847 1.0577 1.17308 1.17308C1.0577 1.28847 1.00001 1.4359 1.00001 1.61539V14.3846C1.00001 14.5641 1.0577 14.7115 1.17308 14.8269C1.28847 14.9423 1.4359 15 1.61539 15H14.3846C14.5641 15 14.7115 14.9423 14.8269 14.8269C14.9423 14.7115 15 14.5641 15 14.3846V11.4423H16V14.3846C16 14.8321 15.8426 15.2132 15.5279 15.5279C15.2132 15.8426 14.8321 16 14.3846 16H1.61539ZM9.61539 12C9.16795 12 8.78686 11.8426 8.47212 11.5279C8.15737 11.2132 8 10.8321 8 10.3846V5.61539C8 5.16795 8.15737 4.78686 8.47212 4.47212C8.78686 4.15737 9.16795 4 9.61539 4H15.3846C15.8321 4 16.2132 4.15737 16.5279 4.47212C16.8426 4.78686 17 5.16795 17 5.61539V10.3846C17 10.8321 16.8426 11.2132 16.5279 11.5279C16.2132 11.8426 15.8321 12 15.3846 12H9.61539ZM15.3846 11C15.5641 11 15.7115 10.9423 15.8269 10.8269C15.9423 10.7115 16 10.5641 16 10.3846V5.61539C16 5.4359 15.9423 5.28847 15.8269 5.17308C15.7115 5.0577 15.5641 5.00001 15.3846 5.00001H9.61539C9.4359 5.00001 9.28847 5.0577 9.17308 5.17308C9.0577 5.28847 9.00001 5.4359 9.00001 5.61539V10.3846C9.00001 10.5641 9.0577 10.7115 9.17308 10.8269C9.28847 10.9423 9.4359 11 9.61539 11H15.3846ZM12 9.50001C12.4167 9.50001 12.7708 9.35417 13.0625 9.06251C13.3542 8.77084 13.5 8.41667 13.5 8.00001C13.5 7.58334 13.3542 7.22917 13.0625 6.93751C12.7708 6.64584 12.4167 6.50001 12 6.50001C11.5833 6.50001 11.2292 6.64584 10.9375 6.93751C10.6458 7.22917 10.5 7.58334 10.5 8.00001C10.5 8.41667 10.6458 8.77084 10.9375 9.06251C11.2292 9.35417 11.5833 9.50001 12 9.50001Z"
        fill="currentColor"
      />
    </svg>
  );
}

/* Arrow (points up by default) — exact path from Figma */
export function ArrowUpIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 14 14" fill="none" width="14" height="14" {...props}>
      <path
        d="M6.5 14V1.92117L0.707697 7.71347L0 7.00001L7.00001 0L14 7.00001L13.2923 7.71347L7.50001 1.92117V14H6.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

/* Generic stroke icons in the same hairline aesthetic */

export function ClockIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="24" height="24" {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" />
      <path d="M12 7.5V12L15 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GavelIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="24" height="24" {...props}>
      <path d="M14.5 4.5 19.5 9.5M12 7 17 12M9.5 9.5 4 15a1.5 1.5 0 0 0 0 2.1l.9.9a1.5 1.5 0 0 0 2.1 0l5.5-5.5M13 16.5 20 23.5M4 21h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="24" height="24" {...props}>
      <circle cx="18" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="18" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8.2 10.8 15.8 6.2M8.2 13.2l7.6 4.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function HistoryIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="24" height="24" {...props}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M4 4v4h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="24" height="24" {...props}>
      <path d="M4 12.5 9.5 18 20 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function VerifiedIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="24" height="24" {...props}>
      <path
        d="m12 2 2.4 1.8 3 .2.2 3L20 12l-1.8 2.4-.2 3-3 .2L12 20l-2.4-1.8-3-.2-.2-3L4 12l1.8-2.4.2-3 3-.2L12 2Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M8.5 12 11 14.5 15.5 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WarningIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="24" height="24" {...props}>
      <path d="M12 3 22 20H2L12 3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M12 10v4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="12" cy="17.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function WalletIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="24" height="24" {...props}>
      <rect x="3" y="6" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 9h13a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H3" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="16.5" cy="12.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="24" height="24" {...props}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="24" height="24" {...props}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="24" height="24" {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DotsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="24" height="24" {...props}>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

/* Solana glyph (simplified) */
export function SolanaIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="24" height="24" {...props}>
      <path d="M5.5 7.2a.9.9 0 0 1 .64-.27H19a.45.45 0 0 1 .32.77l-2.02 2.03a.9.9 0 0 1-.64.27H3.98a.45.45 0 0 1-.32-.77L5.5 7.2Z" fill="currentColor" />
      <path d="M5.5 14.03a.9.9 0 0 1 .64-.26H19a.45.45 0 0 1 .32.76l-2.02 2.03a.9.9 0 0 1-.64.27H3.98a.45.45 0 0 1-.32-.77l1.84-2.03Z" fill="currentColor" />
      <path d="M16.98 10.6a.9.9 0 0 0-.64-.26H3.5a.45.45 0 0 0-.32.77l2.02 2.02a.9.9 0 0 0 .64.27h12.84a.45.45 0 0 0 .32-.77L16.98 10.6Z" fill="currentColor" />
    </svg>
  );
}
