
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Compass,
  Heart,
  Play,
  Sparkles,
  Star,
  Users,
} from "lucide-react";

import type { Movie, UserProfile } from "../../types";
import type { NavTab } from "../layout/Navbar";
import { cineMatchApi } from "../../services/api";
import { MovieCard } from "../common/MovieCard";
import { HeroBanner } from "./HeroBanner";

interface HomeViewProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  allMovies: Movie[];
  onSelectMovie: (movie: Movie) => void;
  onNavigateTab: (tab: NavTab) => void;
  onOpenFastApiModal: () => void;
  bookmarkedMovieIds: Set<number>;
  onToggleBookmark: (movieId: number) => void;
}

interface MovieRailProps {
  title: string;
  subtitle?: string;
  movies: Movie[];
  currentUser: UserProfile;
  bookmarkedMovieIds: Set<number>;
  onToggleBookmark: (movieId: number) => void;
  onSelectMovie: (movie: Movie) => void;
  onViewAll?: () => void;
}

const FEATURED_IDS = [
  79132,  // Inception
  109487, // Interstellar
  58559,  // The Dark Knight
  2571,   // The Matrix
  4993,   // The Lord of the Rings
  260,    // Star Wars
  318,    // The Shawshank Redemption
  296,    // Pulp Fiction
  356,    // Forrest Gump
  2959,   // Fight Club
  527,    // Schindler's List
  50,     // The Usual Suspects
];

const GENRE_CATEGORIES = [
  { name: "Hành động", genre: "Action" },
  { name: "Viễn tưởng", genre: "Sci-Fi" },
  { name: "Tình cảm", genre: "Romance" },
  { name: "Kinh dị", genre: "Horror" },
  { name: "Hài hước", genre: "Comedy" },
  { name: "Phiêu lưu", genre: "Adventure" },
];

function isValidTmdbImage(url?: string | null): boolean {
  return Boolean(
    url?.startsWith("https://image.tmdb.org/t/p/")
  );
}

function MovieRail({
  title,
  subtitle,
  movies,
  currentUser,
  bookmarkedMovieIds,
  onToggleBookmark,
  onSelectMovie,
  onViewAll,
}: MovieRailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: number) => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    scrollRef.current?.scrollBy({
      left: direction * 650,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  if (!movies.length) return null;

  return (
    <section className="cm-reveal cm-section">
      <div className="mb-7 flex items-end justify-between gap-4">
        <div>
          {subtitle && (
            <p className="cm-eyebrow mb-3 flex items-center gap-2">
              <span className="cm-eyebrow-line" />
              {subtitle}
            </p>
          )}

          <h2 className="text-2xl font-bold tracking-tight text-[#F8F1E6] sm:text-3xl">
            {title}
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="group mr-2 hidden items-center gap-2 text-sm font-semibold text-[#E7BC7A] transition hover:text-white sm:inline-flex"
            >
              Xem thêm
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </button>
          )}

          <button
            type="button"
            onClick={() => scroll(-1)}
            aria-label={`Cuộn trái ${title}`}
            className="cm-arrow"
          >
            <ChevronLeft size={19} />
          </button>

          <button
            type="button"
            onClick={() => scroll(1)}
            aria-label={`Cuộn phải ${title}`}
            className="cm-arrow"
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        aria-label={title}
        className="cm-movie-track flex snap-x snap-mandatory gap-4 overflow-x-auto pb-8 pt-3 sm:gap-5"
      >
        {movies.map((movie, index) => (
          <div
            key={movie.movieId}
            className="cm-poster-shell w-[145px] shrink-0 snap-start sm:w-[185px] lg:w-[205px]"
            style={{
              animationDelay: `${Math.min(index, 8) * 65}ms`,
            }}
          >
            <div className="cm-poster-frame">
              <MovieCard
                movie={movie}
                onClick={() => onSelectMovie(movie)}
                isBookmarked={bookmarkedMovieIds.has(
                  movie.movieId
                )}
                onToggleBookmark={(event) => {
                  event.stopPropagation();
                  onToggleBookmark(movie.movieId);
                }}
                userRating={
                  currentUser.ratings?.[movie.movieId]
                }
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const homeStyles = `
  .cm-cinematic-home {
    position: relative;
    isolation: isolate;
    background:
      radial-gradient(
        ellipse at 50% 12%,
        rgba(195,133,58,.09),
        transparent 42%
      ),
      radial-gradient(
        ellipse at 8% 65%,
        rgba(140,90,42,.055),
        transparent 36%
      ),
      #080807;
  }

  .cm-eyebrow {
    color: #D8AD70;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .19em;
    text-transform: uppercase;
  }

  .cm-eyebrow-line {
    display: inline-block;
    width: 23px;
    height: 2px;
    border-radius: 20px;
    background: linear-gradient(
      90deg,
      #F3CF96,
      #A76C34
    );
    box-shadow: 0 0 12px rgba(232,191,130,.4);
  }

  .cm-movie-track {
    scrollbar-width: none;
    scroll-behavior: smooth;
    overscroll-behavior-inline: contain;
  }

  .cm-movie-track::-webkit-scrollbar {
    display: none;
  }

  .cm-arrow {
    display: flex;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(215,170,97,.28);
    border-radius: 50%;
    color: #E7BC7A;
    background: rgba(255,255,255,.035);
    backdrop-filter: blur(10px);
    transition:
      color 250ms ease,
      background 250ms ease,
      transform 250ms ease,
      box-shadow 250ms ease;
  }

  .cm-arrow:hover {
    color: #17110A;
    background: #E7BC7A;
    transform: scale(1.1);
    box-shadow: 0 0 25px rgba(215,170,97,.3);
  }

  .cm-featured-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #70604A;
    transition:
      width 350ms ease,
      background 350ms ease,
      box-shadow 350ms ease;
  }

  .cm-featured-dot:hover {
    background: #E7BC7A;
  }

  .cm-featured-dot.active {
    width: 28px;
    border-radius: 8px;
    background: #E7BC7A;
    box-shadow: 0 0 15px rgba(215,170,97,.45);
  }

  .cm-reveal {
    opacity: 0;
    transform: translateY(35px);
    transition:
      opacity 800ms cubic-bezier(.2,.7,.2,1),
      transform 800ms cubic-bezier(.2,.7,.2,1);
  }

  .cm-reveal.cm-visible {
    opacity: 1;
    transform: translateY(0);
  }

  .cm-poster-shell {
    position: relative;
    transform-origin: center bottom;
    transition:
      transform 380ms cubic-bezier(.2,.8,.2,1),
      filter 380ms ease;
  }

  .cm-poster-frame {
    position: relative;
    border-radius: 16px;
    transition: box-shadow 380ms ease;
  }

  .cm-poster-frame::before {
    content: "";
    position: absolute;
    inset: -3px;
    z-index: -1;
    border-radius: 19px;
    background: linear-gradient(
      135deg,
      rgba(255,220,155,.5),
      transparent 35%,
      transparent 65%,
      rgba(215,170,97,.35)
    );
    opacity: 0;
    filter: blur(10px);
    transition: opacity 380ms ease;
    pointer-events: none;
  }

  .cm-poster-shell:hover {
    transform: translateY(-10px) scale(1.035);
    z-index: 5;
    filter: brightness(1.07);
  }

  .cm-poster-shell:hover .cm-poster-frame {
    box-shadow:
      0 20px 45px rgba(0,0,0,.55),
      0 0 25px rgba(215,170,97,.12);
  }

  .cm-poster-shell:hover .cm-poster-frame::before {
    opacity: 1;
  }

  .cm-genre-card {
    position: relative;
    min-height: 215px;
    overflow: hidden;
    border: 1px solid rgba(215,170,97,.12);
    border-radius: 20px;
    background: #201A14;
    isolation: isolate;
    transition:
      transform 400ms ease,
      box-shadow 400ms ease,
      border-color 400ms ease;
  }

  .cm-genre-card:hover {
    transform: translateY(-8px);
    border-color: rgba(232,191,130,.55);
    box-shadow:
      0 20px 50px rgba(0,0,0,.5),
      0 0 30px rgba(215,170,97,.12);
  }

  .cm-genre-card img {
    transition:
      transform 800ms ease,
      filter 600ms ease;
  }

  .cm-genre-card:hover img {
    transform: scale(1.13);
    filter: brightness(1.14) saturate(1.12);
  }

  .cm-genre-card::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    background: linear-gradient(
      0deg,
      rgba(0,0,0,.94),
      rgba(0,0,0,.06) 85%
    );
    pointer-events: none;
  }

  .cm-promo {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    background:
      radial-gradient(
        circle at 80% 30%,
        rgba(215,170,97,.2),
        transparent 45%
      ),
      linear-gradient(
        125deg,
        #251A0F,
        #100D0A 70%
      );
  }

  .cm-promo::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      115deg,
      transparent 30%,
      rgba(255,225,165,.045) 50%,
      transparent 70%
    );
    background-size: 220% 100%;
    animation: cmPromoShimmer 9s ease-in-out infinite;
    pointer-events: none;
  }

  .cm-promo-glow {
    position: absolute;
    width: 380px;
    height: 380px;
    right: -100px;
    top: -120px;
    border-radius: 50%;
    background: rgba(215,170,97,.15);
    filter: blur(75px);
    animation: cmGlow 7s ease-in-out infinite alternate;
    pointer-events: none;
  }

  .cm-promo-button {
    transition:
      transform 300ms ease,
      background 300ms ease,
      box-shadow 300ms ease;
  }

  .cm-promo-button:hover {
    transform: translateY(-5px);
    background: #F4D49F;
    box-shadow: 0 15px 45px rgba(215,170,97,.3);
  }

  .cm-quick-action {
    transition:
      transform 350ms ease,
      border-color 350ms ease,
      background 350ms ease,
      box-shadow 350ms ease;
  }

  .cm-quick-action:hover {
    transform: translateY(-6px);
    border-color: rgba(215,170,97,.5);
    background: rgba(215,170,97,.075);
    box-shadow: 0 15px 35px rgba(0,0,0,.25);
  }

  .cm-ambient-light {
    position: absolute;
    width: 460px;
    height: 460px;
    border-radius: 50%;
    background: rgba(215,170,97,.055);
    filter: blur(100px);
    pointer-events: none;
    animation: cmAmbientDrift 12s ease-in-out infinite alternate;
  }

  .cm-hero-enter {
    animation: cmHeroEnter 850ms cubic-bezier(.2,.7,.2,1) both;
  }

  @keyframes cmHeroEnter {
    from {
      opacity: 0;
      transform: scale(1.025);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes cmAmbientDrift {
    from {
      transform: translate3d(-30px,0,0);
    }
    to {
      transform: translate3d(40px,-50px,0);
    }
  }

  @keyframes cmGlow {
    from {
      transform: translate(-25px,15px);
    }
    to {
      transform: translate(35px,-15px);
    }
  }

  @keyframes cmPromoShimmer {
    0%, 100% {
      background-position: 100% 0;
    }
    50% {
      background-position: 0 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cm-reveal {
      opacity: 1 !important;
      transform: none !important;
      transition: none !important;
    }

    .cm-promo::before,
    .cm-promo-glow,
    .cm-ambient-light,
    .cm-hero-enter {
      animation: none !important;
    }

    .cm-poster-shell,
    .cm-poster-frame,
    .cm-genre-card,
    .cm-genre-card img,
    .cm-arrow,
    .cm-promo-button,
    .cm-quick-action,
    .cm-featured-dot {
      transition: none !important;
    }

    .cm-poster-shell:hover,
    .cm-genre-card:hover,
    .cm-genre-card:hover img,
    .cm-arrow:hover,
    .cm-promo-button:hover,
    .cm-quick-action:hover {
      transform: none !important;
    }

    .cm-movie-track {
      scroll-behavior: auto;
    }
  }
`;

export function HomeView({
  currentUser,
  allMovies,
  onSelectMovie,
  onNavigateTab,
  bookmarkedMovieIds,
  onToggleBookmark,
}: HomeViewProps) {
  const [featuredIndex, setFeaturedIndex] = useState(0);

  const [enrichedFeatured, setEnrichedFeatured] = useState<
    Map<number, Movie>
  >(() => new Map());

  const [contentIds, setContentIds] = useState<number[]>([]);
  const [cfIds, setCfIds] = useState<number[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);

  const validMovieLensUser =
    Number.isInteger(currentUser.userId) &&
    currentUser.userId >= 1 &&
    currentUser.userId <= 610;

  const movieMap = useMemo(
    () =>
      new Map<number, Movie>(
        allMovies.map((movie) => [
          movie.movieId,
          movie,
        ])
      ),
    [allMovies]
  );

  // Load featured TMDb artwork progressively.
  // Update each movie as soon as its request finishes.
  useEffect(() => {
    let cancelled = false;

    setEnrichedFeatured(new Map<number, Movie>());

    FEATURED_IDS.forEach((movieId) => {
      void cineMatchApi
        .getEnrichedMovie(movieId)
        .then((movie) => {
          if (cancelled) return;

          const original = movieMap.get(movieId);

          const posterUrl = isValidTmdbImage(movie.posterUrl)
            ? movie.posterUrl
            : original?.posterUrl;

          const backdropUrl = isValidTmdbImage(movie.backdropUrl)
            ? movie.backdropUrl
            : original?.backdropUrl;

          const merged = {
            ...(original ?? {}),
            ...movie,
            posterUrl,
            backdropUrl,
          } as Movie;

          if (
            !isValidTmdbImage(merged.backdropUrl) &&
            !isValidTmdbImage(merged.posterUrl)
          ) {
            return;
          }

          setEnrichedFeatured((previous) => {
            const next = new Map(previous);
            next.set(movieId, merged);
            return next;
          });
        })
        .catch((error) => {
          if (!cancelled) {
            console.warn(
              `Cannot load featured artwork for movie ${movieId}:`,
              error
            );
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [movieMap]);

  // Featured order is stable: Inception always comes first
  // when it is available, followed by Interstellar and Batman.
  const featuredMovies = useMemo(() => {
    const selected = FEATURED_IDS
      .map(
        (id) =>
          enrichedFeatured.get(id) ??
          movieMap.get(id)
      )
      .filter(
        (movie): movie is Movie =>
          Boolean(movie) &&
          Boolean(
            movie?.backdropUrl ||
            movie?.posterUrl
          )
      );

    if (selected.length > 0) {
      return selected;
    }

    return allMovies
      .filter(
        (movie) =>
          Boolean(movie.backdropUrl) ||
          Boolean(movie.posterUrl)
      )
      .slice(0, 12);
  }, [allMovies, movieMap, enrichedFeatured]);

  const popularMovies = useMemo(() => {
    return [...allMovies]
      .filter(
        (movie) =>
          movie.ratingsCount >= 20 &&
          Number.isFinite(movie.avgRating)
      )
      .map((movie) => ({
        movie,
        score:
          (
            movie.ratingsCount *
              (movie.avgRating ?? 0) +
            50 * 3.5
          ) /
          (movie.ratingsCount + 50),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 18)
      .map((item) => item.movie);
  }, [allMovies]);

  const genreCards = useMemo(() => {
    return GENRE_CATEGORIES.map((category) => {
      const movie =
        allMovies.find(
          (item) =>
            item.genres?.includes(category.genre) &&
            Boolean(item.backdropUrl)
        ) ??
        allMovies.find(
          (item) =>
            item.genres?.includes(category.genre) &&
            Boolean(item.posterUrl)
        );

      return {
        ...category,
        movie,
      };
    });
  }, [allMovies]);

  const activeMovie =
    featuredMovies[
      featuredIndex %
        Math.max(featuredMovies.length, 1)
    ];

  // Automatic carousel.
  useEffect(() => {
    if (featuredMovies.length <= 1) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reducedMotion) return;

    const interval = window.setInterval(() => {
      setFeaturedIndex(
        (index) =>
          (index + 1) % featuredMovies.length
      );
    }, 9000);

    return () => {
      window.clearInterval(interval);
    };
  }, [featuredMovies.length]);

  // Fetch personalized ML recommendations.
  useEffect(() => {
    let cancelled = false;

    setContentIds([]);
    setCfIds([]);

    if (!validMovieLensUser) {
      setRecsLoading(false);
      return;
    }

    async function loadRecommendations() {
      setRecsLoading(true);

      try {
        const results = await Promise.allSettled([
          cineMatchApi.getContentUserRecommendations(
            currentUser.userId,
            12
          ),
          cineMatchApi.getUserRecommendations(
            currentUser.userId,
            12
          ),
        ]);

        if (cancelled) return;

        const [contentResult, cfResult] = results;

        if (contentResult.status === "fulfilled") {
          setContentIds(
            contentResult.value.items.map(
              (item) => item.movieId
            )
          );
        }

        if (cfResult.status === "fulfilled") {
          setCfIds(
            cfResult.value.items.map(
              (item) => item.movieId
            )
          );
        }
      } catch (error) {
        console.error(
          "Không thể tải gợi ý:",
          error
        );
      } finally {
        if (!cancelled) {
          setRecsLoading(false);
        }
      }
    }

    void loadRecommendations();

    return () => {
      cancelled = true;
    };
  }, [
    currentUser.userId,
    validMovieLensUser,
  ]);

  const contentMovies = contentIds
    .map((id) => movieMap.get(id))
    .filter(
      (movie): movie is Movie => Boolean(movie)
    );

  const cfMovies = cfIds
    .map((id) => movieMap.get(id))
    .filter(
      (movie): movie is Movie => Boolean(movie)
    );

  // Reveal sections as they enter the viewport.
  useEffect(() => {
    const elements = document.querySelectorAll(
      ".cm-cinematic-home .cm-reveal"
    );

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (
      !("IntersectionObserver" in window) ||
      reducedMotion
    ) {
      elements.forEach((element) => {
        element.classList.add("cm-visible");
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(
              "cm-visible"
            );
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.08,
        rootMargin: "0px 0px 80px 0px",
      }
    );

    elements.forEach((element) => {
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
    };
  }, [
    allMovies.length,
    contentMovies.length,
    cfMovies.length,
    validMovieLensUser,
  ]);

  const changeFeatured = (direction: number) => {
    if (!featuredMovies.length) return;

    setFeaturedIndex(
      (index) =>
        (
          index +
          direction +
          featuredMovies.length
        ) % featuredMovies.length
    );
  };

  return (
    <div className="cm-cinematic-home min-h-screen overflow-hidden text-[#F8F1E6]">
      <style>{homeStyles}</style>

      {/* CINEMATIC FEATURED HERO */}
      {activeMovie && (
        <section className="relative">
          <div
            key={activeMovie.movieId}
            className="cm-hero-enter"
          >
            <HeroBanner
              movie={activeMovie}
              onOpenDetails={onSelectMovie}
              onFindSimilar={() =>
                onNavigateTab("content-based")
              }
            />
          </div>

          {featuredMovies.length > 1 && (
            <div className="relative z-10 -mt-2 flex items-center justify-center gap-3 pb-8 pt-5">
              <button
                type="button"
                onClick={() => changeFeatured(-1)}
                className="cm-arrow"
                aria-label="Phim nổi bật trước"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="flex items-center gap-2">
                {featuredMovies
                  .slice(0, 8)
                  .map((movie, index) => (
                    <button
                      key={movie.movieId}
                      type="button"
                      onClick={() =>
                        setFeaturedIndex(index)
                      }
                      className={`cm-featured-dot ${
                        featuredIndex === index
                          ? "active"
                          : ""
                      }`}
                      aria-label={`Hiển thị phim ${
                        index + 1
                      }`}
                      aria-pressed={
                        featuredIndex === index
                      }
                    />
                  ))}
              </div>

              <button
                type="button"
                onClick={() => changeFeatured(1)}
                className="cm-arrow"
                aria-label="Phim nổi bật tiếp theo"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </section>
      )}

      <main className="relative mx-auto max-w-[1500px] space-y-14 px-5 pb-20 pt-8 sm:px-8 lg:space-y-20 lg:px-12">
        <div
          className="cm-ambient-light -left-56 top-[15%] -z-10"
          aria-hidden="true"
        />

        {/* FEATURED MOVIES */}
        <MovieRail
          title="Phim không thể bỏ lỡ"
          subtitle="Tuyển chọn cho bạn"
          movies={featuredMovies}
          currentUser={currentUser}
          bookmarkedMovieIds={bookmarkedMovieIds}
          onToggleBookmark={onToggleBookmark}
          onSelectMovie={onSelectMovie}
          onViewAll={() =>
            onNavigateTab("explore")
          }
        />

        {/* POPULAR MOVIES */}
        <MovieRail
          title="Được yêu thích nhất"
          subtitle="Những bộ phim được đánh giá cao"
          movies={popularMovies}
          currentUser={currentUser}
          bookmarkedMovieIds={bookmarkedMovieIds}
          onToggleBookmark={onToggleBookmark}
          onSelectMovie={onSelectMovie}
          onViewAll={() =>
            onNavigateTab("explore")
          }
        />

        {/* GENRE DISCOVERY */}
        <section className="cm-reveal">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="cm-eyebrow mb-3 flex items-center gap-2">
                <span className="cm-eyebrow-line" />
                Khám phá thế giới điện ảnh
              </p>

              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Hôm nay bạn muốn xem gì?
              </h2>
            </div>

            <button
              type="button"
              onClick={() =>
                onNavigateTab("explore")
              }
              className="group hidden items-center gap-2 text-sm font-semibold text-[#E7BC7A] transition hover:text-white sm:inline-flex"
            >
              Khám phá tất cả
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-6">
            {genreCards.map((category) => (
              <button
                key={category.genre}
                type="button"
                onClick={() =>
                  onNavigateTab("explore")
                }
                className="cm-genre-card group text-left"
                title={`Khám phá phim ${category.name}`}
              >
                {category.movie?.backdropUrl ||
                category.movie?.posterUrl ? (
                  <img
                    src={
                      category.movie.backdropUrl ||
                      category.movie.posterUrl
                    }
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 -z-20 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 -z-20 bg-gradient-to-br from-[#3B2A19] to-[#100E0B]" />
                )}

                <div className="absolute inset-x-0 bottom-0 z-10 p-4">
                  <p className="text-base font-bold text-white drop-shadow-lg">
                    {category.name}
                  </p>

                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#E8C28B] transition-all group-hover:gap-2">
                    Khám phá
                    <ArrowRight size={13} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* PERSONALIZED ML RECOMMENDATIONS */}
        {validMovieLensUser && (
          <>
            {contentMovies.length > 0 ? (
              <MovieRail
                title="Có thể bạn sẽ thích"
                subtitle="Dành riêng cho bạn"
                movies={contentMovies}
                currentUser={currentUser}
                bookmarkedMovieIds={
                  bookmarkedMovieIds
                }
                onToggleBookmark={
                  onToggleBookmark
                }
                onSelectMovie={onSelectMovie}
                onViewAll={() =>
                  onNavigateTab("content-based")
                }
              />
            ) : (
              <section className="cm-reveal">
                <div className="rounded-2xl border border-[#D7AA61]/20 bg-[#17130F] p-6">
                  <p className="flex items-center gap-2 font-semibold">
                    <Sparkles
                      size={18}
                      className="text-[#E7BC7A]"
                    />
                    Có thể bạn sẽ thích
                  </p>

                  <p className="mt-2 text-sm text-[#AFA395]">
                    {recsLoading
                      ? "Đang tìm phim phù hợp với bạn..."
                      : "Chưa có gợi ý. Hãy thử khám phá thêm phim."}
                  </p>

                  {!recsLoading && (
                    <button
                      type="button"
                      onClick={() =>
                        onNavigateTab(
                          "content-based"
                        )
                      }
                      className="mt-4 text-sm font-semibold text-[#E7BC7A] transition hover:text-white"
                    >
                      Khám phá gợi ý →
                    </button>
                  )}
                </div>
              </section>
            )}

            <MovieRail
              title="Người cùng gu cũng thích"
              subtitle="Thêm lựa chọn thú vị"
              movies={cfMovies}
              currentUser={currentUser}
              bookmarkedMovieIds={
                bookmarkedMovieIds
              }
              onToggleBookmark={
                onToggleBookmark
              }
              onSelectMovie={onSelectMovie}
              onViewAll={() =>
                onNavigateTab("collaborative")
              }
            />
          </>
        )}

        {/* DEMO USER NOTICE */}
        {!validMovieLensUser && (
          <section className="cm-reveal rounded-2xl border border-[#D7AA61]/20 bg-[#17130F] px-6 py-5">
            <div className="flex items-start gap-3">
              <Users
                size={20}
                className="mt-1 shrink-0 text-[#E7BC7A]"
              />

              <div>
                <h3 className="font-semibold">
                  Khám phá phim theo sở thích
                </h3>

                <p className="mt-2 text-sm leading-6 text-[#B6AA99]">
                  Chọn một hồ sơ từ 1 đến 610 ở
                  thanh trên để xem những bộ phim
                  được gợi ý riêng.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* CINEMATIC PROMOTION */}
        <section className="cm-reveal cm-promo rounded-[28px] border border-[#D7AA61]/25 px-6 py-12 shadow-[0_20px_70px_rgba(0,0,0,.2)] sm:px-10 lg:px-14 lg:py-20">
          <div
            className="cm-promo-glow"
            aria-hidden="true"
          />

          <div className="relative z-10 flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <p className="cm-eyebrow mb-5 flex items-center gap-2">
                <Clapperboard size={16} />
                CineMatch Experience
              </p>

              <h2 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                Bộ phim tiếp theo
                <span className="mt-2 block bg-gradient-to-r from-[#FFF0D0] via-[#E7BC7A] to-[#BD874B] bg-clip-text text-transparent">
                  đang chờ bạn khám phá.
                </span>
              </h2>

              <p className="mt-6 max-w-lg text-sm leading-7 text-[#D0C0AB]">
                Bước vào thế giới điện ảnh đầy
                cảm xúc. Tìm một câu chuyện mới,
                lưu phim yêu thích và khám phá
                những lựa chọn hợp gu của bạn.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                onNavigateTab("explore")
              }
              className="cm-promo-button group inline-flex shrink-0 items-center gap-3 rounded-xl bg-[#E7BC7A] px-8 py-4 font-bold text-[#1A130A]"
            >
              <Play
                size={18}
                fill="currentColor"
              />
              Khám phá ngay
              <ArrowRight
                size={18}
                className="transition-transform group-hover:translate-x-1"
              />
            </button>
          </div>
        </section>

        {/* QUICK ACTIONS */}
        <section className="cm-reveal grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Compass,
              title: "Khám phá phim",
              description:
                "Tìm phim theo sở thích",
              tab: "explore" as NavTab,
            },
            {
              icon: Heart,
              title: "Dành cho bạn",
              description:
                "Những gợi ý hợp gu",
              tab: "content-based" as NavTab,
            },
            {
              icon: Bookmark,
              title: "Đánh giá phim",
              description:
                "Chia sẻ cảm nhận của bạn",
              tab: "rate" as NavTab,
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.title}
                type="button"
                onClick={() =>
                  onNavigateTab(item.tab)
                }
                className="cm-quick-action group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[.025] p-5 text-left"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#D7AA61]/10 text-[#E7BC7A]">
                  <Icon size={22} />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-[#F8F1E6]">
                    {item.title}
                  </h3>

                  <p className="mt-1 text-xs text-[#AFA395]">
                    {item.description}
                  </p>
                </div>

                <ChevronRight
                  size={18}
                  className="shrink-0 text-[#E7BC7A] transition-transform group-hover:translate-x-1"
                />
              </button>
            );
          })}
        </section>
      </main>
    </div>
  );
}
