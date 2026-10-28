
import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  Clapperboard,
  Film,
  Play,
  Sparkles,
  Star,
} from "lucide-react";
import type { Movie } from "../../types";

interface HeroBannerProps {
  movie: Movie;
  onOpenDetails: (movie: Movie) => void;
  onFindSimilar: (movie: Movie) => void;
}

function getDisplayTitle(title: string): string {
  const match = title.match(/^(.*), (The|A|An)$/i);

  if (!match) return title;

  return `${match[2]} ${match[1]}`;
}

function getSafeImageUrl(value?: string | null): string {
  if (!value) return "";

  const url = value.trim();

  return url.startsWith("https://image.tmdb.org/t/p/")
    ? url
    : "";
}

const heroStyles = `
  @keyframes cmHeroZoom {
    0% {
      transform: scale(1.09);
      opacity: 0.55;
    }
    18% {
      opacity: 1;
    }
    100% {
      transform: scale(1.0);
      opacity: 1;
    }
  }

  @keyframes cmHeroEnter {
    from {
      opacity: 0;
      transform: translateY(28px);
      filter: blur(7px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
      filter: blur(0);
    }
  }

  @keyframes cmHeroGlow {
    0%, 100% {
      opacity: 0.25;
      transform: translate3d(0, 0, 0) scale(1);
    }
    50% {
      opacity: 0.52;
      transform: translate3d(-35px, 15px, 0) scale(1.12);
    }
  }

  @keyframes cmHeroShine {
    0% {
      transform: translateX(-180%) skewX(-22deg);
    }
    100% {
      transform: translateX(340%) skewX(-22deg);
    }
  }

  @keyframes cmHeroFloat {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-7px);
    }
  }

  @keyframes cmHeroPulse {
    0%, 100% {
      opacity: 0.5;
      box-shadow: 0 0 0 0 rgba(232, 191, 130, 0.2);
    }
    50% {
      opacity: 1;
      box-shadow: 0 0 0 7px rgba(232, 191, 130, 0);
    }
  }

  .cm-hero-image {
    animation: cmHeroZoom 9s ease-out both;
    will-change: transform;
  }

  .cm-hero-enter {
    animation: cmHeroEnter 850ms cubic-bezier(.2,.8,.2,1) both;
  }

  .cm-hero-enter-1 {
    animation-delay: 100ms;
  }

  .cm-hero-enter-2 {
    animation-delay: 220ms;
  }

  .cm-hero-enter-3 {
    animation-delay: 350ms;
  }

  .cm-hero-enter-4 {
    animation-delay: 470ms;
  }

  .cm-hero-glow {
    animation: cmHeroGlow 8s ease-in-out infinite;
  }

  .cm-hero-floating {
    animation: cmHeroFloat 5s ease-in-out infinite;
  }

  .cm-hero-pulse {
    animation: cmHeroPulse 2.8s ease-in-out infinite;
  }

  .cm-hero-primary {
    position: relative;
    isolation: isolate;
    overflow: hidden;
  }

  .cm-hero-primary::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    width: 35%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255,255,255,0.35),
      transparent
    );
    transform: translateX(-180%) skewX(-22deg);
    pointer-events: none;
  }

  .cm-hero-primary:hover::after {
    animation: cmHeroShine 850ms ease-out forwards;
  }

  @media (prefers-reduced-motion: reduce) {
    .cm-hero-image,
    .cm-hero-enter,
    .cm-hero-glow,
    .cm-hero-floating,
    .cm-hero-pulse {
      animation: none !important;
      transform: none !important;
      filter: none !important;
      opacity: 1 !important;
    }

    .cm-hero-primary:hover::after {
      animation: none !important;
    }
  }
`;

export const HeroBanner: React.FC<HeroBannerProps> = ({
  movie,
  onOpenDetails,
  onFindSimilar,
}) => {
  const [imageError, setImageError] = useState(false);

  const backdrop =
    getSafeImageUrl(movie.backdropUrl) ||
    getSafeImageUrl(movie.posterUrl);

  useEffect(() => {
    setImageError(false);
  }, [movie.movieId, backdrop]);

  const displayTitle = getDisplayTitle(movie.title);

  const hasRating =
    movie.ratingsCount > 0 &&
    Number.isFinite(movie.avgRating);

  const genres = movie.genres ?? [];
  const description = movie.synopsis?.trim() || "";

  return (
    <section className="relative isolate w-full overflow-hidden bg-[#08090B] text-white">
      <style>{heroStyles}</style>

      {/* BACKDROP: SHARPER, BRIGHTER, CINEMATIC ZOOM */}
      <div className="absolute inset-0 -z-30 overflow-hidden">
        {backdrop && !imageError ? (
          <img
            key={`${movie.movieId}-${backdrop}`}
            src={backdrop}
            alt=""
            aria-hidden="true"
            onError={() => setImageError(true)}
            className="cm-hero-image h-full w-full object-cover object-center"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(ellipse_at_75%_35%,#634025_0%,#221A17_45%,#08090B_85%)]">
            <Film className="h-24 w-24 text-[#D7AA61]/20" />
          </div>
        )}
      </div>

      {/* GRADIENTS: KEEP TEXT LEGIBLE WITHOUT HIDING THE FILM */}
      <div className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-r from-[#08090B]/95 via-[#08090B]/65 to-transparent" />

      <div className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-t from-[#08090B] via-transparent to-[#08090B]/15" />

      {/* ANIMATED CINEMATIC LIGHTING */}
      <div className="cm-hero-glow pointer-events-none absolute -right-32 top-[5%] -z-10 h-[420px] w-[420px] rounded-full bg-[#D9A65E]/15 blur-[110px]" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-[#08090B] to-transparent" />

      {/* MAIN CONTENT */}
      <div className="relative mx-auto flex min-h-[540px] max-w-[1440px] items-center px-6 pb-24 pt-24 sm:min-h-[620px] sm:px-10 lg:min-h-[690px] lg:px-14">
        <div
          key={movie.movieId}
          className="relative z-10 max-w-[750px]"
        >
          {/* EYEBROW */}
          <div className="cm-hero-enter cm-hero-enter-1 mb-6 flex flex-wrap items-center gap-3">
            <span className="cm-hero-pulse h-2 w-2 rounded-full bg-[#E8BF82]" />

            <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#E8BF82] sm:text-xs">
              CineMatch Spotlight
            </span>

            <span className="hidden h-px w-12 bg-gradient-to-r from-[#E8BF82]/70 to-transparent sm:block" />

            <span className="hidden items-center gap-1.5 text-[11px] text-[#E9D9C4]/80 sm:inline-flex">
              <Clapperboard className="h-3.5 w-3.5" />
              Phim nổi bật
            </span>
          </div>

          {/* MOVIE TITLE */}
          <div className="cm-hero-enter cm-hero-enter-2">
            <h1 className="max-w-[760px] text-5xl font-black leading-[1.05] tracking-[-0.045em] text-[#FFF9F1] drop-shadow-[0_8px_25px_rgba(0,0,0,0.55)] sm:text-6xl lg:text-[76px]">
              {displayTitle}
            </h1>

            <div className="mt-6 h-[3px] w-20 rounded-full bg-gradient-to-r from-[#F5D49C] via-[#D7AA61] to-transparent shadow-[0_0_22px_rgba(232,191,130,0.5)]" />
          </div>

          {/* MOVIE METADATA */}
          <div className="cm-hero-enter cm-hero-enter-3 mt-7 flex flex-wrap items-center gap-3 text-sm text-[#F0E6D9]">
            {hasRating && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E8BF82]/35 bg-[#E8BF82]/10 px-3 py-1.5 font-bold text-[#F4CB8E] backdrop-blur-md">
                <Star className="h-4 w-4 fill-current" />
                {movie.avgRating.toFixed(1)}
              </span>
            )}

            {movie.year && (
              <span className="rounded-full border border-white/20 bg-black/25 px-3 py-1.5 backdrop-blur-sm">
                {movie.year}
              </span>
            )}

            {genres.slice(0, 2).map((genre) => (
              <span
                key={genre}
                className="rounded-full border border-white/20 bg-black/25 px-3 py-1.5 backdrop-blur-sm"
              >
                {genre}
              </span>
            ))}
          </div>

          {/* DESCRIPTION */}
          {description && (
            <p className="cm-hero-enter cm-hero-enter-3 mt-6 line-clamp-3 max-w-[600px] text-sm leading-7 text-[#E9E1D7] drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)] sm:text-base sm:leading-8">
              {description}
            </p>
          )}

          {/* ACTIONS */}
          <div className="cm-hero-enter cm-hero-enter-4 mt-9 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => onOpenDetails(movie)}
              className="cm-hero-primary group inline-flex min-h-14 items-center justify-center gap-3 rounded-xl border border-[#F4D29A]/60 bg-gradient-to-r from-[#F2CD91] via-[#E8BF82] to-[#D9A968] px-8 py-3.5 text-sm font-extrabold text-[#18120B] shadow-[0_8px_35px_rgba(215,170,97,0.23)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_45px_rgba(215,170,97,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5D49C] motion-reduce:transform-none"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#18120B]/10">
                <Play className="h-4 w-4 fill-current" />
              </span>

              Khám phá bộ phim

              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transform-none" />
            </button>

            <button
              type="button"
              onClick={() => onFindSimilar(movie)}
              className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-xl border border-white/30 bg-black/30 px-7 py-3.5 text-sm font-bold text-white shadow-[0_8px_25px_rgba(0,0,0,0.15)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-[#E8BF82]/70 hover:bg-[#E8BF82]/10 hover:shadow-[0_10px_35px_rgba(215,170,97,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8BF82] motion-reduce:transform-none"
            >
              <Sparkles className="h-4 w-4 text-[#E8BF82]" />

              Tìm phim tương tự

              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transform-none" />
            </button>
          </div>

          {/* SUBTLE DECORATIVE DETAIL */}
          <div className="cm-hero-enter cm-hero-enter-4 mt-9 hidden items-center gap-3 text-[10px] font-medium uppercase tracking-[0.22em] text-[#D1B894]/65 sm:flex">
            <span className="h-px w-8 bg-[#D7AA61]/50" />
            Discover your next favorite
          </div>
        </div>

        {/* RIGHT SIDE ACCENT */}
        <div className="cm-hero-floating pointer-events-none absolute bottom-32 right-12 hidden items-center gap-3 rounded-full border border-white/15 bg-black/20 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur-lg xl:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[#E8BF82]" />
          The cinema experience
        </div>
      </div>

      {/* TRANSITION TO NEXT SECTION */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[#090909] via-[#090909]/65 to-transparent" />
    </section>
  );
};
