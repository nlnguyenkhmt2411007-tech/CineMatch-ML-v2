import React from "react";

interface CineMatchLogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  animated?: boolean;
}

export const CineMatchLogo: React.FC<CineMatchLogoProps> = ({
  size = 52,
  showWordmark = true,
  className = "",
  animated = false,
}) => {
  return (
    <div
      className={`inline-flex items-center gap-3 ${className}`}
      aria-label="CineMatch - Cinematic Intelligence"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="CineMatch logo"
        className={animated ? "motion-safe:animate-pulse" : ""}
      >
        <defs>
          <linearGradient
            id="cinematch-logo-gold"
            x1="0"
            y1="0"
            x2="100"
            y2="100"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#FFF1CA" />
            <stop offset="0.5" stopColor="#D9A64E" />
            <stop offset="1" stopColor="#9C6629" />
          </linearGradient>
        </defs>

        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx="19"
          fill="#D9A64E"
          fillOpacity="0.06"
          stroke="url(#cinematch-logo-gold)"
          strokeWidth="2"
        />

        {[18, 38, 58, 78].map((y) => (
          <React.Fragment key={y}>
            <rect
              x="9"
              y={y}
              width="6"
              height="9"
              rx="1"
              fill="#D9A64E"
            />
            <rect
              x="85"
              y={y}
              width="6"
              height="9"
              rx="1"
              fill="#D9A64E"
            />
          </React.Fragment>
        ))}

        <path
          d="M47 27 A24 24 0 1 0 47 73"
          stroke="url(#cinematch-logo-gold)"
          strokeWidth="7"
          strokeLinecap="round"
        />

        <path
          d="M55 72 V28 L65 48 L75 28 V72"
          stroke="url(#cinematch-logo-gold)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {showWordmark && (
        <div className="flex flex-col justify-center">
          <span
            className="font-display text-xl font-extrabold tracking-[0.08em] text-[#F5F1E8]"
          >
            CINEMATCH
          </span>
          <span
            className="mt-1 text-[8px] font-semibold uppercase tracking-[0.25em] text-[#D9A64E]"
          >
            CINEMATIC INTELLIGENCE
          </span>
        </div>
      )}
    </div>
  );
};
