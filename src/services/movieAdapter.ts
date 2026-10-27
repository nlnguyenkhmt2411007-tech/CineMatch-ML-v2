
import type { Movie } from "../types";

// ============================================================
// 1. DU LIEU PHIM TU FASTAPI
// ============================================================

export interface ApiMovie {
  movieId: number;
  title: string;
  year: number | null;
  genres: string[];
  avgRating: number | null;
  ratingsCount: number;

  // Metadata tu TMDb (co the khong co o API cu)
  posterUrl?: string | null;
  backdropUrl?: string | null;
  synopsis?: string | null;
  imdbId?: string | null;
  tmdbId?: number | null;
  tags?: string[] | null;
}

// ============================================================
// 2. KIEM TRA DUONG DAN ANH TMDB
// ============================================================

function validTmdbImageUrl(
  value: string | null | undefined
): string {
  if (!value || typeof value !== "string") {
    return "";
  }

  const url = value.trim();

  // Chi chap nhan URL anh tu TMDb.
  // Khong tu gan anh demo hoac anh ngau nhien.
  if (
    url.startsWith(
      "https://image.tmdb.org/t/p/"
    )
  ) {
    return url;
  }

  return "";
}

// ============================================================
// 3. CHUYEN DU LIEU FASTAPI SANG REACT
// ============================================================

export function adaptApiMovie(
  movie: ApiMovie
): Movie {
  return {
    movieId: movie.movieId,
    title: movie.title,
    year: movie.year ?? 0,
    genres: movie.genres ?? [],

    // Giu nguyen poster va backdrop do TMDb cung cap.
    posterUrl: validTmdbImageUrl(
      movie.posterUrl
    ),

    backdropUrl: validTmdbImageUrl(
      movie.backdropUrl
    ),

    synopsis:
      movie.synopsis?.trim() ||
      "Chưa có mô tả nội dung phim.",

    imdbId: movie.imdbId ?? undefined,
    tmdbId: movie.tmdbId ?? undefined,
    tags: movie.tags ?? [],

    avgRating: movie.avgRating ?? 0,
    ratingsCount: movie.ratingsCount ?? 0,
  };
}
