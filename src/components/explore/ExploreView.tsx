
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  ChevronDown,
  ChevronRight,
  Film,
  Loader2,
  Play,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  X,
} from "lucide-react";

import type { Movie } from "../../types";
import { MovieCard } from "../common/MovieCard";
import { adaptApiMovie } from "../../services/movieAdapter";

interface ExploreViewProps {
  allMovies: Movie[];
  onSelectMovie: (movie: Movie) => void;
  bookmarkedMovieIds: Set<number>;
  onToggleBookmark: (movieId: number) => void;
  userRatings: Record<number, number>;
}

interface ExploreResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: Array<{
    movieId: number;
    title: string;
    year: number | null;
    genres: string[];
    avgRating: number | null;
    ratingsCount: number;
    posterUrl: string;
    backdropUrl: string;
    synopsis: string;
  }>;
}

const API_BASE =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

const PAGE_SIZE = 24;

const GENRES = [
  { id: "All", label: "Tất cả" },
  { id: "Action", label: "Hành động" },
  { id: "Comedy", label: "Hài" },
  { id: "Drama", label: "Chính kịch" },
  { id: "Romance", label: "Tình cảm" },
  { id: "Sci-Fi", label: "Viễn tưởng" },
  { id: "Horror", label: "Kinh dị" },
  { id: "Animation", label: "Hoạt hình" },
  { id: "Thriller", label: "Giật gân" },
  { id: "Adventure", label: "Phiêu lưu" },
  { id: "Crime", label: "Tội phạm" },
  { id: "Fantasy", label: "Giả tưởng" },
  { id: "Mystery", label: "Bí ẩn" },
  { id: "Documentary", label: "Tài liệu" },
  { id: "Children", label: "Thiếu nhi" },
  { id: "Musical", label: "Âm nhạc" },
  { id: "War", label: "Chiến tranh" },
  { id: "Western", label: "Miền Tây" },
  { id: "Film-Noir", label: "Film Noir" },
  { id: "IMAX", label: "IMAX" },
];

const FEATURED_GENRES = [
  { id: "Action", label: "Hành động", tone: "from-red-950 to-stone-950" },
  { id: "Sci-Fi", label: "Viễn tưởng", tone: "from-indigo-950 to-slate-950" },
  { id: "Romance", label: "Tình cảm", tone: "from-rose-950 to-stone-950" },
  { id: "Comedy", label: "Hài hước", tone: "from-amber-950 to-stone-950" },
  { id: "Horror", label: "Kinh dị", tone: "from-zinc-800 to-black" },
  { id: "Animation", label: "Hoạt hình", tone: "from-teal-950 to-slate-950" },
];

function safeImage(value?: string | null): string {
  if (!value) return "";
  const url = value.trim();

  return url.startsWith("https://image.tmdb.org/t/p/")
    ? url
    : "";
}

function MovieRail({
  title,
  movies,
  onSelectMovie,
  bookmarkedMovieIds,
  onToggleBookmark,
  userRatings,
}: {
  title: string;
  movies: Movie[];
  onSelectMovie: (movie: Movie) => void;
  bookmarkedMovieIds: Set<number>;
  onToggleBookmark: (movieId: number) => void;
  userRatings: Record<number, number>;
}) {
  if (movies.length === 0) return null;

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
          {title}
        </h2>

        <ChevronRight className="h-5 w-5 text-[#D8AD70]" />
      </div>

      <div className="-mx-5 overflow-x-auto px-5 pb-5 sm:-mx-8 sm:px-8 [scrollbar-width:thin]">
        <div className="flex gap-3 sm:gap-5">
          {movies.map((movie) => (
            <div
              key={movie.movieId}
              className="w-[145px] shrink-0 sm:w-[180px] lg:w-[205px]"
            >
              <MovieCard
                movie={movie}
                onClick={() => onSelectMovie(movie)}
                isBookmarked={bookmarkedMovieIds.has(movie.movieId)}
                onToggleBookmark={(event) => {
                  event.stopPropagation();
                  onToggleBookmark(movie.movieId);
                }}
                userRating={userRatings[movie.movieId]}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ExploreView({
  allMovies,
  onSelectMovie,
  bookmarkedMovieIds,
  onToggleBookmark,
  userRatings,
}: ExploreViewProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [genre, setGenre] = useState("All");
  const [minRating, setMinRating] = useState("0");
  const [sort, setSort] = useState("popular");
  const [page, setPage] = useState(1);

  const [showFilters, setShowFilters] = useState(false);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const knownMovies = useMemo(
    () => new Map(allMovies.map((movie) => [movie.movieId, movie])),
    [allMovies]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, genre, minRating, sort]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPage() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(page),
          page_size: String(PAGE_SIZE),
          search: debouncedSearch,
          genre,
          min_rating: minRating,
          sort,
        });

        const response = await fetch(
          `${API_BASE}/api/explore?${params.toString()}`,
          {
            signal: controller.signal,
            headers: { Accept: "application/json" },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result =
          (await response.json()) as ExploreResponse;

        if (controller.signal.aborted) return;

        setMovies(
          result.items.map((item) =>
            adaptApiMovie({
              ...item,
              year: item.year ?? null,
            })
          )
        );

        setTotal(result.total);
        setTotalPages(result.total_pages);
      } catch (err) {
        if (controller.signal.aborted) return;

        console.error("Explore API:", err);
        setMovies([]);
        setTotal(0);
        setTotalPages(0);
        setError("Chưa thể tải phim. Hãy thử lại nhé.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadPage();
    return () => controller.abort();
  }, [page, debouncedSearch, genre, minRating, sort, retryKey]);

  const displayMovies = useMemo(
    () =>
      movies.map((movie) => {
        const known = knownMovies.get(movie.movieId);

        if (!known) return movie;

        return {
          ...movie,
          posterUrl: movie.posterUrl || known.posterUrl,
          backdropUrl: movie.backdropUrl || known.backdropUrl,
          synopsis: movie.synopsis || known.synopsis,
        };
      }),
    [movies, knownMovies]
  );

  const isDefaultView =
    page === 1 &&
    debouncedSearch === "" &&
    genre === "All" &&
    minRating === "0" &&
    sort === "popular";

  const hasActiveFilters =
    search.trim() !== "" ||
    genre !== "All" ||
    minRating !== "0" ||
    sort !== "popular";

  const featuredMovie = useMemo(() => {
    return (
      displayMovies.find((movie) => safeImage(movie.backdropUrl)) ||
      displayMovies.find((movie) => safeImage(movie.posterUrl)) ||
      displayMovies[0]
    );
  }, [displayMovies]);

  const topRatedMovies = useMemo(
    () =>
      [...displayMovies]
        .filter((movie) => movie.ratingsCount > 0)
        .sort((a, b) => b.avgRating - a.avgRating)
        .slice(0, 12),
    [displayMovies]
  );

  const recentMovies = useMemo(
    () =>
      [...displayMovies]
        .filter((movie) => Boolean(movie.year))
        .sort((a, b) => Number(b.year) - Number(a.year))
        .slice(0, 12),
    [displayMovies]
  );

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setGenre("All");
    setMinRating("0");
    setSort("popular");
    setPage(1);
  };

  const selectGenre = (value: string) => {
    setGenre(value);
    setPage(1);

    window.setTimeout(() => {
      document
        .getElementById("cm-movie-library")
        ?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const changePage = (nextPage: number) => {
    setPage(nextPage);

    document
      .getElementById("cm-movie-library")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  const heroBackdrop = featuredMovie
    ? safeImage(featuredMovie.backdropUrl)
    : "";

  const heroPoster = featuredMovie
    ? safeImage(featuredMovie.posterUrl)
    : "";

  return (
    <main className="min-h-screen bg-[#090909] pb-24 text-[#F5F1E9]">
      {/* CINEMATIC HERO */}
      {isDefaultView && !loading && !error && featuredMovie && (
        <section className="relative min-h-[430px] overflow-hidden bg-[#141414] sm:min-h-[540px] lg:min-h-[630px]">
          {(heroBackdrop || heroPoster) && (
            <img
              src={heroBackdrop || heroPoster}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center opacity-60"
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-r from-[#090909] via-[#090909]/75 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090909] via-transparent to-black/20" />

          <div className="relative mx-auto flex min-h-[430px] max-w-[1440px] items-end px-5 pb-14 sm:min-h-[540px] sm:px-8 sm:pb-20 lg:min-h-[630px]">
            <div className="max-w-[650px]">
              <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#E3B775]">
                <Sparkles className="h-4 w-4" />
                Phim nổi bật
              </div>

              <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                {featuredMovie.title}
              </h1>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-[#DDD4C8]">
                {featuredMovie.year && (
                  <span>{featuredMovie.year}</span>
                )}

                {featuredMovie.ratingsCount > 0 && (
                  <span className="flex items-center gap-1 text-[#F2C783]">
                    <Star className="h-4 w-4 fill-current" />
                    {featuredMovie.avgRating.toFixed(1)}
                  </span>
                )}

                {featuredMovie.genres.slice(0, 2).map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>

              {featuredMovie.synopsis && (
                <p className="mt-5 line-clamp-3 max-w-lg text-sm leading-7 text-[#D0C8BE] sm:text-base">
                  {featuredMovie.synopsis}
                </p>
              )}

              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onSelectMovie(featuredMovie)}
                  className="inline-flex items-center gap-2 rounded-full bg-[#E5B979] px-6 py-3 text-sm font-bold text-[#17110A] transition hover:bg-[#F5D29D]"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Xem chi tiết
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onToggleBookmark(featuredMovie.movieId)
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/20"
                >
                  <Bookmark
                    className={`h-4 w-4 ${
                      bookmarkedMovieIds.has(featuredMovie.movieId)
                        ? "fill-current"
                        : ""
                    }`}
                  />
                  {bookmarkedMovieIds.has(featuredMovie.movieId)
                    ? "Đã lưu"
                    : "Lưu phim"}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-[1440px] space-y-12 px-5 pt-10 sm:space-y-16 sm:px-8 sm:pt-14">
        {/* MOVIE COLLECTIONS */}
        {isDefaultView && !loading && !error && displayMovies.length > 0 && (
          <>
            <MovieRail
              title="Được yêu thích"
              movies={displayMovies.slice(0, 12)}
              onSelectMovie={onSelectMovie}
              bookmarkedMovieIds={bookmarkedMovieIds}
              onToggleBookmark={onToggleBookmark}
              userRatings={userRatings}
            />

            <MovieRail
              title="Đánh giá cao"
              movies={topRatedMovies}
              onSelectMovie={onSelectMovie}
              bookmarkedMovieIds={bookmarkedMovieIds}
              onToggleBookmark={onToggleBookmark}
              userRatings={userRatings}
            />

            {/* GENRE COLLECTIONS */}
            <section className="space-y-5">
              <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                Khám phá theo thể loại
              </h2>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                {FEATURED_GENRES.map((item) => {
                  const preview = displayMovies.find(
                    (movie) =>
                      movie.genres.includes(item.id) &&
                      safeImage(movie.posterUrl)
                  );

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectGenre(item.id)}
                      className={`group relative flex min-h-[135px] items-end overflow-hidden rounded-2xl bg-gradient-to-br ${item.tone} p-4 text-left transition-transform hover:-translate-y-1 sm:min-h-[165px]`}
                    >
                      {preview && (
                        <img
                          src={safeImage(preview.posterUrl)}
                          alt=""
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover opacity-40 transition-transform duration-500 group-hover:scale-110"
                        />
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />

                      <span className="relative z-10 text-sm font-semibold text-white">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <MovieRail
              title="Khám phá thêm"
              movies={recentMovies}
              onSelectMovie={onSelectMovie}
              bookmarkedMovieIds={bookmarkedMovieIds}
              onToggleBookmark={onToggleBookmark}
              userRatings={userRatings}
            />
          </>
        )}

        {/* SEARCH & LIBRARY */}
        <section id="cm-movie-library" className="scroll-mt-24 space-y-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[#D8AD70]">
                CineMatch Collection
              </span>

              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Tìm phim bạn thích
              </h2>
            </div>

            {!loading && !error && (
              <span className="text-sm text-[#A9A198]">
                {total.toLocaleString("vi-VN")} phim
              </span>
            )}
          </div>

          {/* SEARCH */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D8AD70]" />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tên phim bạn muốn tìm..."
              aria-label="Tìm kiếm phim"
              className="w-full rounded-2xl border border-white/10 bg-[#191919] py-4 pl-14 pr-12 text-sm text-white outline-none transition placeholder:text-[#888078] focus:border-[#D8AD70]/60"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Xóa tìm kiếm"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#AAA29A] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* GENRE CHIPS */}
          <div className="flex flex-wrap items-center gap-2">
            {GENRES.slice(0, 9).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setGenre(item.id)}
                className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                  genre === item.id
                    ? "border-[#E5B979] bg-[#E5B979] text-[#17110A]"
                    : "border-white/10 bg-[#191919] text-[#BDB4AA] hover:border-[#D8AD70]/50 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              aria-expanded={showFilters}
              className="inline-flex items-center gap-2 rounded-full border border-[#D8AD70]/30 px-4 py-2 text-xs text-[#E5B979]"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Bộ lọc
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>

          {showFilters && (
            <div className="grid gap-4 rounded-2xl border border-white/10 bg-[#151515] p-5 sm:grid-cols-3">
              <label className="space-y-2 text-xs text-[#BDB4AA]">
                <span>Thể loại</span>
                <select
                  value={genre}
                  onChange={(event) => setGenre(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#242424] p-3 text-sm text-white outline-none"
                >
                  {GENRES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-xs text-[#BDB4AA]">
                <span>Điểm đánh giá</span>
                <select
                  value={minRating}
                  onChange={(event) => setMinRating(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#242424] p-3 text-sm text-white outline-none"
                >
                  <option value="0">Tất cả</option>
                  <option value="3">Từ 3 sao</option>
                  <option value="3.5">Từ 3.5 sao</option>
                  <option value="4">Từ 4 sao</option>
                  <option value="4.5">Từ 4.5 sao</option>
                </select>
              </label>

              <label className="space-y-2 text-xs text-[#BDB4AA]">
                <span>Sắp xếp</span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#242424] p-3 text-sm text-white outline-none"
                >
                  <option value="popular">Phổ biến</option>
                  <option value="rating">Đánh giá cao</option>
                  <option value="newest">Mới nhất</option>
                  <option value="title">Tên A - Z</option>
                </select>
              </label>
            </div>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-2 text-xs text-[#D8AD70] hover:text-[#F5D29D]"
            >
              <X className="h-3.5 w-3.5" />
              Xóa bộ lọc
            </button>
          )}

          {/* LOADING */}
          {loading && (
            <div
              role="status"
              className="flex min-h-[280px] flex-col items-center justify-center gap-4"
            >
              <Loader2 className="h-8 w-8 animate-spin text-[#D8AD70]" />
              <p className="text-sm text-[#AAA29A]">
                Đang tải phim...
              </p>
            </div>
          )}

          {/* ERROR */}
          {!loading && error && (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-2xl bg-[#171717] px-6 text-center">
              <Film className="h-9 w-9 text-[#D8AD70]" />

              <p className="text-sm text-[#C7BEB4]">
                {error}
              </p>

              <button
                type="button"
                onClick={() => setRetryKey((value) => value + 1)}
                className="inline-flex items-center gap-2 rounded-full bg-[#E5B979] px-5 py-2.5 text-sm font-semibold text-[#17110A]"
              >
                <RefreshCw className="h-4 w-4" />
                Thử lại
              </button>
            </div>
          )}

          {/* MOVIE GRID */}
          {!loading && !error && displayMovies.length > 0 && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {displayMovies.map((movie) => (
                <MovieCard
                  key={movie.movieId}
                  movie={movie}
                  onClick={() => onSelectMovie(movie)}
                  isBookmarked={bookmarkedMovieIds.has(movie.movieId)}
                  onToggleBookmark={(event) => {
                    event.stopPropagation();
                    onToggleBookmark(movie.movieId);
                  }}
                  userRating={userRatings[movie.movieId]}
                />
              ))}
            </div>
          )}

          {/* EMPTY */}
          {!loading && !error && displayMovies.length === 0 && (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-2xl bg-[#171717] px-6 text-center">
              <Search className="h-9 w-9 text-[#D8AD70]" />

              <h3 className="text-lg font-semibold text-white">
                Chưa tìm thấy phim
              </h3>

              <p className="text-sm text-[#AAA29A]">
                Thử tìm bằng tên hoặc thể loại khác.
              </p>

              <button
                type="button"
                onClick={resetFilters}
                className="rounded-full bg-[#E5B979] px-5 py-2.5 text-sm font-semibold text-[#17110A]"
              >
                Xem tất cả
              </button>
            </div>
          )}

          {/* PAGINATION */}
          {!loading && !error && totalPages > 1 && (
            <div className="flex items-center justify-center gap-5 pt-8">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => changePage(page - 1)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-white transition hover:border-[#D8AD70] disabled:opacity-30"
                aria-label="Trang trước"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <span className="text-sm text-[#BDB4AA]">
                {page} / {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => changePage(page + 1)}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E5B979] text-[#17110A] transition hover:bg-[#F5D29D] disabled:opacity-30"
                aria-label="Trang sau"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
