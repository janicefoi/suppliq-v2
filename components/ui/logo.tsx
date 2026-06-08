interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
}

export function Logo({ width = 460, height = 160, className }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 460 160"
      width={width}
      height={height}
      className={className}
      aria-label="JSH Motorcycle Spare Parts"
    >
      {/* Gear body */}
      <polygon
        fill="#38bdf8"
        points="60.1,32.0 66.7,13.3 90.6,12.8 99.9,32.0 117.8,23.5 135.0,40.0 128.0,60.1 147.2,69.4 147.2,90.6 128.0,99.9 135.0,120.0 117.8,136.5 99.9,128.0 90.6,147.2 66.7,146.7 60.1,128.0 42.2,136.5 25.0,120.0 32.0,99.9 12.8,90.6 12.8,69.4 32.0,60.1 25.0,40.0 42.2,23.5"
      />
      {/* Orange accent ring → white */}
      <circle cx="80" cy="80" r="43" fill="none" stroke="#ffffff" strokeWidth="3" />
      {/* White inner field */}
      <circle cx="80" cy="80" r="40" fill="#ffffff" />
      {/* Wheel rim */}
      <circle cx="80" cy="80" r="31" fill="none" stroke="#38bdf8" strokeWidth="4.5" />
      {/* 6 spokes */}
      <g stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round">
        <line x1="80" y1="80" x2="80" y2="50" />
        <line x1="80" y1="80" x2="80" y2="50" transform="rotate(60 80 80)" />
        <line x1="80" y1="80" x2="80" y2="50" transform="rotate(120 80 80)" />
        <line x1="80" y1="80" x2="80" y2="50" transform="rotate(180 80 80)" />
        <line x1="80" y1="80" x2="80" y2="50" transform="rotate(240 80 80)" />
        <line x1="80" y1="80" x2="80" y2="50" transform="rotate(300 80 80)" />
      </g>
      {/* Hub */}
      <circle cx="80" cy="80" r="9"   fill="#ffffff" />
      <circle cx="80" cy="80" r="4.5" fill="#38bdf8" />
      {/* Separator */}
      <line x1="162" y1="22" x2="162" y2="138" stroke="#7dd3fc" strokeWidth="1.5" />
      {/* JSH wordmark */}
      <text
        x="178" y="100"
        fontFamily="'Arial Black','Helvetica Neue',Arial,sans-serif"
        fontWeight="900"
        fontSize="74"
        fill="#38bdf8"
        letterSpacing="-2"
      >
        JSH
      </text>
      {/* Tagline */}
      <text
        x="181" y="124"
        fontFamily="Arial,Helvetica,sans-serif"
        fontWeight="700"
        fontSize="13"
        fill="#ffffff"
        letterSpacing="3.5"
      >
        MOTORCYCLE SPARE PARTS
      </text>
      {/* Underline bar */}
      <rect x="181" y="133" width="250" height="3.5" rx="1.75" fill="#ffffff" />
    </svg>
  );
}
