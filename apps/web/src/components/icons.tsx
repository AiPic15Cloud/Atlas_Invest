import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function IconHome(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 10.5 10 4l7 6.5" />
      <path d="M5 9v7h10V9" />
    </svg>
  );
}

export function IconWallet(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2" y="5" width="16" height="11" rx="2" />
      <circle cx="14" cy="10.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconTrendingUp(props: IconProps) {
  return (
    <svg {...base(props)}>
      <polyline points="3,13 8,8 11,11 17,4" />
      <polyline points="12,4 17,4 17,9" />
    </svg>
  );
}

export function IconTarget(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3.5" />
      <circle cx="10" cy="10" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconChartBar(props: IconProps) {
  return (
    <svg {...base(props)} strokeWidth={2}>
      <line x1="4" y1="16" x2="4" y2="10" />
      <line x1="10" y1="16" x2="10" y2="6" />
      <line x1="16" y1="16" x2="16" y2="12" />
    </svg>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="7" cy="6.5" r="2.3" />
      <circle cx="13.2" cy="6.5" r="2.3" />
      <path d="M2.3 16c0-3 2.1-5 4.7-5s4.7 2 4.7 5" />
      <path d="M8.6 16c0-2.6 1.9-4.5 4.3-4.5s4.3 1.9 4.3 4.5" />
    </svg>
  );
}

export function IconShield(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10 2.2 16.5 5v4.5c0 4.7-2.8 7.6-6.5 8.3-3.7-.7-6.5-3.6-6.5-8.3V5L10 2.2Z" />
    </svg>
  );
}

export function IconFlag(props: IconProps) {
  return (
    <svg {...base(props)}>
      <line x1="5" y1="3" x2="5" y2="17" />
      <path d="M5 4h9l-2.5 3L14 10H5" />
    </svg>
  );
}

export function IconBuilding(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="3" width="12" height="14" rx="1" />
      <rect x="6.4" y="5.8" width="1.8" height="1.8" fill="currentColor" stroke="none" />
      <rect x="11.8" y="5.8" width="1.8" height="1.8" fill="currentColor" stroke="none" />
      <rect x="6.4" y="9.6" width="1.8" height="1.8" fill="currentColor" stroke="none" />
      <rect x="11.8" y="9.6" width="1.8" height="1.8" fill="currentColor" stroke="none" />
      <rect x="8.2" y="13.2" width="3.6" height="3.8" />
    </svg>
  );
}

export function IconScissors(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="6" cy="15" r="2" />
      <circle cx="14" cy="15" r="2" />
      <line x1="7.5" y1="13.5" x2="17" y2="4" />
      <line x1="12.5" y1="13.5" x2="3" y2="4" />
    </svg>
  );
}

export function IconRepeat(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 8.5A6.5 6.5 0 0 1 15.3 4.4" />
      <polyline points="15.7,2 15.7,5 12.7,5" />
      <path d="M16.5 11.5A6.5 6.5 0 0 1 4.7 15.6" />
      <polyline points="4.3,18 4.3,15 7.3,15" />
    </svg>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4" width="14" height="13" rx="1.5" />
      <line x1="3" y1="8" x2="17" y2="8" />
      <line x1="6.5" y1="2" x2="6.5" y2="5" />
      <line x1="13.5" y1="2" x2="13.5" y2="5" />
    </svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="10" r="7.3" />
      <line x1="10" y1="10" x2="10" y2="6" />
      <line x1="10" y1="10" x2="13" y2="12" />
    </svg>
  );
}

export function IconDownload(props: IconProps) {
  return (
    <svg {...base(props)}>
      <line x1="10" y1="3" x2="10" y2="12" />
      <polyline points="6,9 10,13 14,9" />
      <path d="M3.5 15v2h13v-2" />
    </svg>
  );
}

export function IconChartLine(props: IconProps) {
  return (
    <svg {...base(props)}>
      <polyline points="3,15 7,10 11,12 17,5" />
      <circle cx="17" cy="5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconSliders(props: IconProps) {
  return (
    <svg {...base(props)}>
      <line x1="3" y1="5" x2="17" y2="5" />
      <circle cx="12" cy="5" r="1.8" fill="currentColor" stroke="none" />
      <line x1="3" y1="10" x2="17" y2="10" />
      <circle cx="7" cy="10" r="1.8" fill="currentColor" stroke="none" />
      <line x1="3" y1="15" x2="17" y2="15" />
      <circle cx="14" cy="15" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <svg {...base(props)}>
      <line x1="3" y1="6" x2="17" y2="6" />
      <line x1="3" y1="10" x2="17" y2="10" />
      <line x1="3" y1="14" x2="17" y2="14" />
    </svg>
  );
}

export function IconX(props: IconProps) {
  return (
    <svg {...base(props)}>
      <line x1="5" y1="5" x2="15" y2="15" />
      <line x1="15" y1="5" x2="5" y2="15" />
    </svg>
  );
}

export function IconLogout(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 3.5H4.5v13H8" />
      <line x1="17" y1="10" x2="7.5" y2="10" />
      <polyline points="13,6.3 17,10 13,13.7" />
    </svg>
  );
}
