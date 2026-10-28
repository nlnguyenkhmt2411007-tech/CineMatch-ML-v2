
import React, { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  CheckCircle2,
  ExternalLink,
  Film,
  Loader2,
  Play,
  Star,
  X,
} from "lucide-react";

import type { Movie } from "../../types";
import { getSimilarMoviesByContent } from "../../services/recommender";

interface MovieModalProps {
  movie: Movie | null;
  onClose: () => void;
  onSelectMovie: (movie: Movie) => void;
  allMovies: Movie[];
  userRating?: number;
  onRateMovie: (movieId: number, rating: number) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
}

interface TrailerData {
  available: boolean;
  videoKey: string | null;
  title?: string;
  message?: string;
}

const API_BASE =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function safePoster(value?: string | null): string {
  if (!value) return "";

  const url = value.trim();

  return url.startsWith("https://image.tmdb.org/t/p/")
    ? url
    : "";
}

function SimilarMoviePoster({
  movie,
  onClick,
}: {
  movie: Movie;
  onClick: () => void;
}) {
  const [imageError, setImageError] = useState(false);
  const poster = safePoster(movie.posterUrl);

  useEffect(() => {
    setImageError(false);
  }, [movie.movieId, poster]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-w-0 text-left"
      aria-label={`Xem phim ${movie.title}`}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-[#22201D] transition duration-300 group-hover:-translate-y-1 group-hover:shadow-2xl">
        {poster && !imageError ? (
          <img
            src={poster}
            alt={`Poster ${movie.title}`}
            loading="lazy"
            onError={() => setImageError(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#30281E] to-[#141414] p-3 text-center">
            <Film className="h-8 w-8 text-[#DDB574]/70" />
            <span className="line-clamp-3 text-xs text-[#E9E1D4]">
              {movie.title}
            </span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E8BF82] text-[#17120C]">
            <Play className="ml-0.5 h-5 w-5 fill-current" />
          </span>
        </div>
      </div>

      <h4 className="mt-3 line-clamp-2 text-sm font-semibold leading-5 text-[#F5F0E8] group-hover:text-[#E8BF82]">
        {movie.title}
      </h4>

      <p className="mt-1 text-xs text-[#A99E90]">
        {movie.year || "Phim"}
      </p>
    </button>
  );
}

export const MovieModal: React.FC<MovieModalProps> = ({
  movie,
  onClose,
  onSelectMovie,
  allMovies,
  userRating,
  onRateMovie,
  isBookmarked = false,
  onToggleBookmark,
}) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [ratedToast, setRatedToast] = useState(false);

  const [trailerData, setTrailerData] =
    useState<TrailerData | null>(null);
  const [trailerLoading, setTrailerLoading] = useState(false);
  const [trailerError, setTrailerError] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);

  const [enrichedMovies, setEnrichedMovies] = useState<
    Map<number, Movie>
  >(new Map());

  const similarMovies = useMemo(
    () =>
      movie
        ? getSimilarMoviesByContent(movie, allMovies, 4)
        : [],
    [movie, allMovies]
  );

  useEffect(() => {
    setTrailerData(null);
    setTrailerError(false);
    setShowTrailer(false);
    setHoverRating(null);
    setRatedToast(false);

    if (!movie) {
      setTrailerLoading(false);
      return;
    }

    const controller = new AbortController();
    setTrailerLoading(true);

    async function loadTrailer(movieId: number) {
      try {
        const response = await fetch(
          `${API_BASE}/api/movies/${movieId}/trailer`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as TrailerData;

        if (!controller.signal.aborted) {
          setTrailerData(data);
          setTrailerError(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setTrailerError(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setTrailerLoading(false);
        }
      }
    }

    void loadTrailer(movie.movieId);

    return () => controller.abort();
  }, [movie?.movieId]);

  useEffect(() => {
    setEnrichedMovies(new Map());

    if (!movie || similarMovies.length === 0) return;

    const controller = new AbortController();

    async function loadPosters() {
      const results = await Promise.all(
        similarMovies.map(async (item) => {
          try {
            const response = await fetch(
              `${API_BASE}/api/movies/enriched/${item.movie.movieId}`,
              { signal: controller.signal }
            );

            if (!response.ok) return null;

            const enriched = (await response.json()) as Movie;

            return [item.movie.movieId, enriched] as const;
          } catch {
            return null;
          }
        })
      );

      if (controller.signal.aborted) return;

      setEnrichedMovies(
        new Map(
          results.filter(
            (entry): entry is readonly [number, Movie] =>
              entry !== null
          )
        )
      );
    }

    void loadPosters();

    return () => controller.abort();
  }, [movie?.movieId, similarMovies]);

  useEffect(() => {
    if (!movie) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () =>
      window.removeEventListener("keydown", handleKeyDown);
  }, [movie, onClose]);

  if (!movie) return null;

  const poster = safePoster(movie.posterUrl);
  const backdrop = safePoster(movie.backdropUrl) || poster;

  const hasCommunityRating =
    movie.ratingsCount > 0 &&
    Number.isFinite(movie.avgRating);

  const hasTrailer =
    trailerData?.available && Boolean(trailerData.videoKey);

  const handleRatingSubmit = (score: number) => {
    onRateMovie(movie.movieId, score);
    setRatedToast(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-5">
      {/* DARK OVERLAY */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-lg"
        onClick={onClose}
      />

      {/* CINEMATIC MOVIE WINDOW */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Chi tiết phim ${movie.title}`}
        className="relative z-10 flex h-full max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden bg-[#101010] shadow-[0_35px_100px_rgba(0,0,0,0.8)] sm:h-auto sm:rounded-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng chi tiết phim"
          className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-md transition hover:bg-[#E8BF82] hover:text-black"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="overflow-y-auto [scrollbar-width:thin]">
          {/* LARGE MOVIE HERO */}
          <div className="relative min-h-[390px] overflow-hidden bg-[#191919] sm:min-h-[460px]">
            {backdrop ? (
              <img
                src={backdrop}
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-center opacity-65"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#382A1C] via-[#171717] to-black" />
            )}

            <div className="absolute inset-0 bg-gradient-to-r from-[#101010] via-[#101010]/65 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#101010] via-transparent to-black/20" />

            <div className="relative flex min-h-[390px] items-end px-6 pb-9 pt-24 sm:min-h-[460px] sm:px-10 sm:pb-12">
              <div className="max-w-2xl">
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#E8BF82]">
                  CineMatch
                </p>

                <h2 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
                  {movie.title}
                </h2>

                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#E2D9CD]">
                  {movie.year && <span>{movie.year}</span>}

                  {hasCommunityRating && (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[#E8BF82]">
                      <Star className="h-4 w-4 fill-current" />
                      {movie.avgRating.toFixed(1)}/5
                    </span>
                  )}

                  {movie.genres.slice(0, 3).map((genre) => (
                    <span key={genre}>{genre}</span>
                  ))}
                </div>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (hasTrailer) {
                        setShowTrailer((current) => !current);
                      }
                    }}
                    disabled={!hasTrailer}
                    className="inline-flex items-center gap-2 rounded-full bg-[#E8BF82] px-6 py-3 text-sm font-bold text-[#19130C] transition hover:bg-[#F6D5A3] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {trailerLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : showTrailer ? (
                      <X className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4 fill-current" />
                    )}

                    {trailerLoading
                      ? "Đang tải..."
                      : showTrailer
                        ? "Đóng trailer"
                        : hasTrailer
                          ? "Xem trailer"
                          : "Chưa có trailer"}
                  </button>

                  {onToggleBookmark && (
                    <button
                      type="button"
                      onClick={onToggleBookmark}
                      className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/35 px-5 py-3 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/15"
                    >
                      <Bookmark
                        className={`h-4 w-4 ${
                          isBookmarked ? "fill-current" : ""
                        }`}
                      />
                      {isBookmarked ? "Đã lưu" : "Lưu phim"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* MOVIE DETAILS */}
          <div className="space-y-10 px-6 pb-12 pt-5 sm:px-10">
            {/* TRAILER */}
            {showTrailer && hasTrailer && (
              <section className="overflow-hidden rounded-xl bg-black">
                <div className="aspect-video w-full">
                  <iframe
                    key={`${movie.movieId}-${trailerData?.videoKey}`}
                    src={`https://www.youtube-nocookie.com/embed/${trailerData?.videoKey}?autoplay=1&rel=0`}
                    title={`Trailer ${movie.title}`}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              </section>
            )}

            {trailerError && (
              <p className="text-xs text-[#A99E90]">
                Trailer hiện chưa tải được.
              </p>
            )}

            {/* SYNOPSIS AND PERSONAL RATING */}
            <div className="grid gap-9 lg:grid-cols-[1fr_270px] lg:gap-12">
              <section className="space-y-4">
                <h3 className="text-xl font-semibold text-white">
                  Nội dung phim
                </h3>

                <p className="max-w-2xl whitespace-pre-line text-sm leading-7 text-[#C8BEB2] sm:text-base">
                  {movie.synopsis?.trim() ||
                    "Nội dung phim đang được cập nhật."}
                </p>

                {movie.genres.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {movie.genres.map((genre) => (
                      <span
                        key={genre}
                        className="rounded-full border border-white/10 bg-[#202020] px-3 py-1.5 text-xs text-[#D4C9BA]"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-4 rounded-xl border border-white/10 bg-[#191919] p-5 self-start">
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Bạn chấm mấy sao?
                  </h3>

                  <p className="mt-1 text-xs text-[#A99E90]">
                    Chọn số sao bạn muốn.
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((value) => {
                    const selected =
                      (hoverRating ?? userRating ?? 0) >= value;

                    return (
                      <button
                        key={value}
                        type="button"
                        onMouseEnter={() => setHoverRating(value)}
                        onMouseLeave={() => setHoverRating(null)}
                        onFocus={() => setHoverRating(value)}
                        onBlur={() => setHoverRating(null)}
                        onClick={() => handleRatingSubmit(value)}
                        title={`Chấm ${value} sao`}
                        aria-label={`Chấm ${value} sao`}
                        className="rounded-md p-1 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E8BF82]"
                      >
                        <Star
                          className={`h-7 w-7 ${
                            selected
                              ? "fill-[#E8BF82] text-[#E8BF82]"
                              : "text-[#615B54]"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                {userRating !== undefined && (
                  <p className="text-xs text-[#E8BF82]">
                    Bạn đã chấm {userRating.toFixed(1)}/5
                  </p>
                )}

                {ratedToast && (
                  <p
                    role="status"
                    className="flex items-center gap-2 text-xs text-[#B8D8B6]"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Đã gửi đánh giá.
                  </p>
                )}
              </section>
            </div>

            {/* SIMILAR MOVIES */}
            {similarMovies.length > 0 && (
              <section className="space-y-5">
                <h3 className="text-xl font-semibold text-white sm:text-2xl">
                  Có thể bạn cũng thích
                </h3>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-5">
                  {similarMovies.map((item) => {
                    const enriched = enrichedMovies.get(
                      item.movie.movieId
                    );

                    const displayMovie: Movie = enriched
                      ? {
                          ...item.movie,
                          ...enriched,
                          posterUrl:
                            enriched.posterUrl ||
                            item.movie.posterUrl,
                          backdropUrl:
                            enriched.backdropUrl ||
                            item.movie.backdropUrl,
                          synopsis:
                            enriched.synopsis ||
                            item.movie.synopsis,
                        }
                      : item.movie;

                    return (
                      <SimilarMoviePoster
                        key={item.movie.movieId}
                        movie={displayMovie}
                        onClick={() => {
                          setShowTrailer(false);
                          onSelectMovie(displayMovie);
                        }}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {/* SMALL EXTERNAL LINKS */}
            {(movie.imdbId || movie.tmdbId) && (
              <div className="flex flex-wrap items-center gap-5 border-t border-white/10 pt-6 text-xs text-[#A99E90]">
                {movie.imdbId && (
                  <a
                    href={`https://www.imdb.com/title/tt${movie.imdbId}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 transition hover:text-[#E8BF82]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    IMDb
                  </a>
                )}

                {movie.tmdbId && (
                  <a
                    href={`https://www.themoviedb.org/movie/${movie.tmdbId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 transition hover:text-[#E8BF82]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    TMDb
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
