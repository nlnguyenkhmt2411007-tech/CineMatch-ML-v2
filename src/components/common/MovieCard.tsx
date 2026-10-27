
import React, { useEffect, useState } from "react";
import {
  Star,
  Heart,
  Film,
} from "lucide-react";

import type { Movie } from "../../types";

interface MovieCardProps {
  movie: Movie;
  onClick: () => void;

  similarityScore?: number;
  predictedRating?: number;
  confidence?: number;

  isBookmarked?: boolean;
  onToggleBookmark?: (
    event: React.MouseEvent
  ) => void;

  userRating?: number;
}

// Chi hien thi URL anh chinh thuc tu TMDb.
// Khong tu thay anh phim bang anh ngau nhien.
function getSafePosterUrl(
  value: string | null | undefined
): string {
  if (!value) return "";

  const url = value.trim();

  return url.startsWith(
    "https://image.tmdb.org/t/p/"
  )
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
}) => {
  const [imageError, setImageError] =
    useState(false);

  const posterUrl = getSafePosterUrl(
    movie.posterUrl
  );

  useEffect(() => {
    setImageError(false);
  }, [movie.movieId, posterUrl]);

  const hasPoster =
    Boolean(posterUrl) && !imageError;

  const hasRatings =
    movie.ratingsCount > 0 &&
    Number.isFinite(movie.avgRating);

  const genres = movie.genres ?? [];

  return (
    <div
      onClick={onClick}
      className="group relative flex cursor-pointer select-none flex-col overflow-hidden rounded-xl border border-cyan-400/[0.12] bg-[#101723] shadow-[0_8px_28px_rgba(0,0,0,0.15)] transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/35 hover:shadow-[0_18px_45px_rgba(0,0,0,0.35)]"
    >
      {/* POSTER */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#090F1A]">

        {hasPoster ? (
          <img
            src={posterUrl}
            alt={`Poster phim ${movie.title}`}
            loading="lazy"
            decoding="async"
            onError={() => setImageError(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#153046] via-[#111D30] to-[#0A1020] px-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/[0.07]">
              <Film className="h-7 w-7 text-cyan-200/70" />
            </div>

            <span className="line-clamp-3 font-display text-sm font-semibold leading-relaxed text-white">
              {movie.title}
            </span>

            <span className="font-mono text-xs text-slate-400">
              {movie.year || "Chưa rõ năm"}
            </span>

            <span className="text-[10px] uppercase tracking-widest text-cyan-300/50">
              CineMatch ML
            </span>
          </div>
        )}

        {/* GRADIENT */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#101723]/95 via-transparent to-transparent" />

        {/* DIEM MO HINH ML */}
        <div className="pointer-events-none absolute left-2.5 right-2.5 top-2.5 flex items-start justify-between gap-2">
          <div className="flex flex-col items-start gap-1">

            {similarityScore !== undefined && (
              <span className="rounded-md border border-cyan-300/25 bg-[#07101D]/90 px-2 py-1 font-mono text-[10px] text-cyan-200">
                Sim: {similarityScore.toFixed(3)}
              </span>
            )}

            {predictedRating !== undefined && (
              <span className="rounded-md border border-amber-300/25 bg-[#07101D]/90 px-2 py-1 font-mono text-[10px] text-amber-200">
                Dự đoán: {predictedRating.toFixed(1)}★
              </span>
            )}

            {confidence !== undefined && (
              <span className="rounded-md border border-white/10 bg-[#07101D]/90 px-2 py-1 font-mono text-[10px] text-slate-300">
                Confidence: {confidence.toFixed(2)}
              </span>
            )}
          </div>

          {/* BOOKMARK */}
          {onToggleBookmark && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleBookmark(event);
              }}
              className={`pointer-events-auto ml-auto rounded-lg p-2 transition-all ${
                isBookmarked
                  ? "bg-[#F5BD66] text-[#08111E]"
                  : "border border-white/10 bg-[#07101D]/85 text-slate-300 hover:border-cyan-300/40 hover:text-cyan-200"
              }`}
              aria-label={
                isBookmarked
                  ? `Bỏ lưu ${movie.title}`
                  : `Lưu ${movie.title}`
              }
              title={
                isBookmarked
                  ? "Bỏ lưu phim"
                  : "Lưu vào danh sách"
              }
            >
              <Heart
                className={`h-4 w-4 ${
                  isBookmarked
                    ? "fill-current"
                    : ""
                }`}
              />
            </button>
          )}
        </div>

        {/* RATING */}
        <div className="pointer-events-none absolute bottom-2.5 left-2.5 right-2.5 flex items-end justify-between gap-2 text-xs">

          {hasRatings ? (
            <div className="flex items-center gap-1 rounded-md bg-[#07101D]/85 px-2 py-1 text-[#F5BD66]">
              <Star className="h-3.5 w-3.5 fill-current" />

              <span className="font-mono font-semibold">
                {movie.avgRating.toFixed(1)}
              </span>

              <span className="text-[10px] text-slate-300">
                ({movie.ratingsCount})
              </span>
            </div>
          ) : (
            <span className="rounded-md bg-[#07101D]/85 px-2 py-1 text-[10px] text-slate-400">
              Chưa có đánh giá
            </span>
          )}

          {userRating !== undefined && (
            <span className="rounded-md border border-amber-400/20 bg-[#07101D]/90 px-2 py-1 font-mono text-[10px] text-amber-300">
              Bạn chấm: {userRating}★
            </span>
          )}
        </div>
      </div>

      {/* THONG TIN PHIM */}
      <div className="flex flex-1 flex-col justify-between gap-2 p-3.5">
        <div>
          <h3 className="line-clamp-2 font-display text-sm font-semibold text-white transition-colors group-hover:text-[#F5BD66]">
            {movie.title}
          </h3>

          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-light text-slate-400">
            <span>
              {movie.year || "Chưa rõ năm"}
            </span>

            <span className="opacity-40">·</span>

            <span className="line-clamp-1">
              {genres.length > 0
                ? genres.slice(0, 2).join(", ")
                : "Chưa phân loại"}
            </span>
          </div>
        </div>

        <p className="line-clamp-2 text-[11px] font-light leading-relaxed text-slate-400/90">
          {movie.synopsis?.trim() ||
            "Chưa có mô tả nội dung phim."}
        </p>
      </div>
    </div>
  );
};
