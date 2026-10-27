
import { useEffect, useMemo, useState } from "react";

import {
  ArrowLeft,
  ArrowRight,
  Film,
  Loader2,
  Search,
  SlidersHorizontal,
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

const GENRES = [
  "All",
  "Action",
  "Adventure",
  "Animation",
  "Children",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Fantasy",
  "Film-Noir",
  "Horror",
  "IMAX",
  "Musical",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Thriller",
  "War",
  "Western",
];

const PAGE_SIZE = 24;

export function ExploreView({
  allMovies,
  onSelectMovie,
  bookmarkedMovieIds,
  onToggleBookmark,
  userRatings,
}: ExploreViewProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] =
    useState("");

  const [genre, setGenre] = useState("All");
  const [minRating, setMinRating] = useState("0");
  const [sort, setSort] = useState("popular");
  const [page, setPage] = useState(1);

  const [movies, setMovies] = useState<Movie[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Phim co poster TMDb da tai o trang chu.
  const knownMovies = useMemo(() => {
    return new Map(
      allMovies.map((movie) => [
        movie.movieId,
        movie,
      ])
    );
  }, [allMovies]);

  // Cho 350 ms sau khi nguoi dung ngung go.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  // Moi khi thay doi bo loc, quay ve trang 1.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, genre, minRating, sort]);

  // Lay dung 24 phim cua trang hien tai.
  // Khong tai toan bo 9742 phim.
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
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(
            `FastAPI HTTP ${response.status}`
          );
        }

        const result =
          (await response.json()) as ExploreResponse;

        if (controller.signal.aborted) return;

        const adapted = result.items.map(
          (item) =>
            adaptApiMovie({
              ...item,
              year: item.year ?? null,
            })
        );

        setMovies(adapted);
        setTotal(result.total);
        setTotalPages(result.total_pages);
      } catch (err) {
        if (controller.signal.aborted) return;

        console.error("Explore API:", err);

        setError(
          "Không tải được danh sách phim. Hãy kiểm tra FastAPI ở cổng 8000."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadPage();

    return () => controller.abort();
  }, [
    page,
    debouncedSearch,
    genre,
    minRating,
    sort,
  ]);

  // Giu anh va mo ta TMDb neu da co san.
  const displayMovies = useMemo(() => {
    return movies.map((movie) => {
      const known = knownMovies.get(movie.movieId);

      if (!known) return movie;

      return {
        ...movie,
        posterUrl:
          movie.posterUrl || known.posterUrl,
        backdropUrl:
          movie.backdropUrl || known.backdropUrl,
        synopsis:
          movie.synopsis || known.synopsis,
      };
    });
  }, [movies, knownMovies]);

  const changePage = (nextPage: number) => {
    setPage(nextPage);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <div className="min-h-screen bg-[#050A13] pb-24 text-white">
      <div className="mx-auto max-w-[1440px] px-5 pt-12 sm:px-6">

        {/* HEADER */}

        <div className="mb-8 border-b border-white/10 pb-7">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-cyan-300">
            <Film className="h-4 w-4" />
            MovieLens Latest Small
          </div>

          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            Khám phá{" "}
            <span className="text-[#F5BD66]">
              Thư viện Điện ảnh
            </span>
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
            Tìm kiếm trong 9.742 phim MovieLens.
            Dữ liệu được phân trang trực tiếp từ
            FastAPI để website hoạt động nhanh hơn.
          </p>
        </div>

        {/* BO LOC */}

        <div className="rounded-2xl border border-cyan-400/15 bg-[#101723] p-4 shadow-xl sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_190px_230px]">

            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Tìm tên phim..."
                className="w-full rounded-xl border border-white/10 bg-[#171D2A] py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/50"
              />
            </div>

            <select
              value={minRating}
              onChange={(event) =>
                setMinRating(event.target.value)
              }
              className="rounded-xl border border-white/10 bg-[#171D2A] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/50"
            >
              <option value="0">Tất cả điểm số</option>
              <option value="3">Từ 3.0 sao</option>
              <option value="3.5">Từ 3.5 sao</option>
              <option value="4">Từ 4.0 sao</option>
              <option value="4.5">Từ 4.5 sao</option>
            </select>

            <select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value)
              }
              className="rounded-xl border border-white/10 bg-[#171D2A] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/50"
            >
              <option value="popular">
                Phổ biến nhất
              </option>
              <option value="rating">
                Đánh giá có trọng số
              </option>
              <option value="newest">
                Mới nhất
              </option>
              <option value="title">
                Tên A - Z
              </option>
            </select>
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-4">
            <SlidersHorizontal className="h-4 w-4 shrink-0 text-cyan-300" />

            <div className="flex gap-2 overflow-x-auto pb-2">
              {GENRES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setGenre(item)}
                  className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    genre === item
                      ? "border-[#F5BD66] bg-[#F5BD66] text-[#09111E]"
                      : "border-white/10 bg-[#171D2A] text-slate-300 hover:border-cyan-400/40"
                  }`}
                >
                  {item === "All"
                    ? "Tất cả"
                    : item}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SO LUONG KET QUA */}

        <div className="my-8 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-400">
            {loading ? (
              "Đang tải phim..."
            ) : (
              <>
                Tìm thấy{" "}
                <span className="font-bold text-white">
                  {total.toLocaleString("vi-VN")}
                </span>{" "}
                phim phù hợp
              </>
            )}
          </p>

          <span className="rounded-full border border-cyan-400/15 bg-cyan-400/5 px-3 py-1.5 text-xs text-cyan-200">
            Trang {page}/{Math.max(totalPages, 1)}
          </span>
        </div>

        {/* LOI API */}

        {error && (
          <div className="mb-6 rounded-xl border border-amber-400/20 bg-amber-400/5 p-5 text-sm text-amber-200">
            {error}
          </div>
        )}

        {/* LOADING */}

        {loading ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-4">
            <Loader2 className="h-9 w-9 animate-spin text-cyan-300" />
            <p className="text-sm text-slate-400">
              Đang lấy 24 phim từ FastAPI...
            </p>
          </div>
        ) : displayMovies.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {displayMovies.map((movie) => (
              <MovieCard
                key={movie.movieId}
                movie={movie}
                onClick={() =>
                  onSelectMovie(movie)
                }
                isBookmarked={
                  bookmarkedMovieIds.has(movie.movieId)
                }
                onToggleBookmark={(event) => {
                  event.stopPropagation();
                  onToggleBookmark(movie.movieId);
                }}
                userRating={
                  userRatings[movie.movieId]
                }
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-[#101723] px-6 py-20 text-center text-sm text-slate-400">
            Không tìm thấy phim phù hợp.
            Hãy thử từ khóa hoặc bộ lọc khác.
          </div>
        )}

        {/* PHAN TRANG */}

        {!loading && !error && totalPages > 1 && (
          <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() =>
                changePage(page - 1)
              }
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-[#101723] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ArrowLeft className="h-4 w-4" />
              Trang trước
            </button>

            <span className="text-sm text-slate-300">
              {page} / {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() =>
                changePage(page + 1)
              }
              className="inline-flex items-center gap-2 rounded-xl bg-[#F5BD66] px-5 py-3 text-sm font-bold text-[#09111E] transition-colors hover:bg-[#FFD08A] disabled:cursor-not-allowed disabled:opacity-30"
            >
              Trang sau
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
