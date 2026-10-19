export type IconName =
  | "today"
  | "plan"
  | "receipt"
  | "settings"
  | "arrow"
  | "check"
  | "clock"
  | "camera"
  | "person"
  | "close"
  | "download"
  | "reset"
  | "link"
  | "warning";
const paths: Record<IconName, React.ReactNode> = {
  today: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="3" />
      <path d="M8 3v4m8-4v4M4 11h16m-12 5h3" />
    </>
  ),
  plan: (
    <>
      <path d="M9 5h11M9 12h11M9 19h11" />
      <circle cx="4" cy="5" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="19" r="1" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
      <path d="M9 8h6m-6 4h6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 3-1 2 2 3-2v-3l3-1 1-4-3-1-1-3-3 1-2-2Z" />
    </>
  ),
  arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  camera: (
    <>
      <rect x="3" y="6" width="14" height="13" rx="3" />
      <path d="m17 10 4-3v11l-4-3" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21v-3a8 8 0 0 1 16 0v3" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  download: (
    <>
      <path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4" />
    </>
  ),
  reset: (
    <>
      <path d="M4 10a8 8 0 1 1 2 8M4 3v7h7" />
    </>
  ),
  link: (
    <>
      <path
        d="m10 14 4-4M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m5-1 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0"
        transform="translate(1 0) scale(.92)"
      />
    </>
  ),
  warning: (
    <>
      <path d="m12 3 10 18H2L12 3Z" />
      <path d="M12 9v5m0 3h.01" />
    </>
  ),
};
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function BrandMark() {
  return (
    <svg
      width="33"
      height="33"
      viewBox="0 0 36 36"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
    >
      <rect
        x="5"
        y="6"
        width="15"
        height="22"
        rx="7.5"
        transform="rotate(32 12.5 17)"
      />
      <rect
        x="16"
        y="8"
        width="15"
        height="22"
        rx="7.5"
        transform="rotate(32 23.5 19)"
      />
    </svg>
  );
}
