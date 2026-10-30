
import React, { useEffect, useState } from "react";
import { Bookmark, Film, Play, Star } from "lucide-react";

import type { Movie } from "../../types";

interface MovieCardProps {
  movie: Movie;
  onClick: () => void;

  similarityScore?: number;
  predictedRating?: number;
  confidence?: number;

  isBookmarked?: boolean;
  onToggleBookmark?: (event: React.MouseEvent) => void;

  userRating?: number;

  priority?: boolean;
}

function getSafePosterUrl(
  value: string | null | undefined
): string {
  if (!value) return "";

  const url = value.trim();

  return url.startsWith("https://image.tmdb.org/t/p/")
    ? url
    : "";
}

export const MovieCard: React.FC<MovieCardProps> = ({
  movie,
  onClick,
  similarityScore,
  predictedRating,
  confidence,
  isBookmarked = false,
  onToggleBookmark,
  userRating,
  priority = false,
}) => {
  const [imageError, setImageError] = useState(false);

  const posterUrl = getSafePosterUrl(movie.posterUrl);

  useEffect(() => {
    setImageError(false);
  }, [movie.movieId, posterUrl]);

  const hasPoster = Boolean(posterUrl) && !imageError;

  const hasRatings =
    movie.ratingsCount > 0 &&
    Number.isFinite(movie.avgRating);

  const genres = movie.genres ?? [];

  return (
    <article className="group relative min-w-0">
      {/* POSTER */}
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick();
          }
        }}
        aria-label={`Xem chi tiết phim ${movie.title}`}
        className="relative aspect-[2/3] cursor-pointer overflow-hidden rounded-[12px] bg-[#171717] outline-none ring-offset-2 ring-offset-[#090909] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(0,0,0,0.55)] focus-visible:ring-2 focus-visible:ring-[#D7AA61]"
      >
        {hasPoster ? (
          <img
            src={posterUrl}
            alt={`Poster ${movie.title}`}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            onError={() => setImageError(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.07]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-gradient-to-br from-[#29231C] via-[#191919] to-[#101010] px-5 text-center">
            <Film className="h-9 w-9 text-[#D7AA61]/55" />

            <span className="line-clamp-4 text-sm font-semibold leading-6 text-[#EAE1D4]">
              {movie.title}
            </span>

            <span className="text-xs text-[#9F968B]">
              {movie.year || "CineMatch"}
            </span>
          </div>
        )}

        {/* SUBTLE BOTTOM GRADIENT */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {/* BOOKMARK */}
        {onToggleBookmark && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleBookmark(event);
            }}
            aria-label={
              isBookmarked
                ? `Bỏ lưu ${movie.title}`
                : `Lưu ${movie.title}`
            }
            title={
              isBookmarked
                ? "Bỏ lưu phim"
                : "Lưu phim"
            }
            className={`absolute right-2.5 top-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md transition-all ${
              isBookmarked
                ? "bg-[#D7AA61] text-[#17110A]"
                : "bg-black/55 text-white hover:bg-[#D7AA61] hover:text-[#17110A]"
            }`}
          >
            <Bookmark
              className={`h-4 w-4 ${
                isBookmarked ? "fill-current" : ""
              }`}
            />
          </button>
        )}

        {/* HOVER ACTION */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F0C47D] text-[#17110A] shadow-xl">
            <Play className="ml-0.5 h-5 w-5 fill-current" />
          </div>
        </div>

        {/* RATING BADGE */}
        {hasRatings && (
          <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-md bg-black/65 px-2.5 py-1.5 text-xs font-semibold text-[#F0C47D] backdrop-blur-sm">
            <Star className="h-3.5 w-3.5 fill-current" />
            {movie.avgRating.toFixed(1)}
          </div>
        )}
      </div>

      {/* MOVIE INFORMATION */}
      <div className="pt-3">
        <h3
          title={movie.title}
          className="line-clamp-2 text-[13px] font-semibold leading-5 text-[#F5F0E8] transition-colors group-hover:text-[#E6BA75]"
        >
          {movie.title}
        </h3>

        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[#9F968B]">
          <span>{movie.year || "—"}</span>

          {genres.length > 0 && (
            <>
              <span className="text-[#6B6258]">•</span>
              <span className="truncate">
                {genres.slice(0, 2).join(", ")}
              </span>
            </>
          )}
        </div>

        {userRating !== undefined && (
          <div className="mt-2 flex items-center gap-1 text-[11px] text-[#D7AA61]">
            <Star className="h-3 w-3 fill-current" />
            Bạn đã chấm {userRating.toFixed(1)}
          </div>
        )}

        {/* ML METRICS: ONLY WHEN PROVIDED */}
        {(similarityScore !== undefined ||
          predictedRating !== undefined ||
          confidence !== undefined) && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#A99E8F]">
            {similarityScore !== undefined && (
              <span>
                Tương đồng: {similarityScore.toFixed(3)}
              </span>
            )}

            {predictedRating !== undefined && (
              <span>
                Dự đoán: {predictedRating.toFixed(1)}★
              </span>
            )}

            {confidence !== undefined && (
              <span>
                Tin cậy: {confidence.toFixed(2)}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
};
