
import React, { useEffect, useMemo, useState } from "react";
import {
  Star,
  RotateCcw,
  Trash2,
  Search,
  Film,
  ChevronLeft,
  ChevronRight,
  Info,
  CheckCircle2,
} from "lucide-react";

import type { Movie, UserProfile } from "../../types";

// ==========================================================
// PROPS - GIU NGUYEN DE TUONG THICH VOI APP.TSX
// ==========================================================

interface RateMoviesViewProps {
  currentUser: UserProfile;
  allMovies: Movie[];
  onRateMovie: (movieId: number, rating: number) => void;
  onRemoveRating: (movieId: number) => void;
  onResetRatings: () => void;
  onSelectMovie: (movie: Movie) => void;
}

type RatingTab = "unrated" | "rated";

const enrichedMovieCache = new Map<number, Movie>();
const pendingMovieRequests = new Map<number, Promise<Movie>>();

async function getEnrichedMovie(movieId: number): Promise<Movie> {
  const cached = enrichedMovieCache.get(movieId);
  if (cached) return cached;

  const pending = pendingMovieRequests.get(movieId);
  if (pending) return pending;

  const request = (async () => {
    const response = await fetch(
      `http://127.0.0.1:8000/api/movies/enriched/${movieId}`
    );

    if (!response.ok) {
      throw new Error(`Cannot load enriched movie ${movieId}`);
    }

    const movie = (await response.json()) as Movie;
    enrichedMovieCache.set(movieId, movie);
    return movie;
  })();

  pendingMovieRequests.set(movieId, request);

  try {
    return await request;
  } finally {
    pendingMovieRequests.delete(movieId);
  }
}
const PAGE_SIZE = 18;

const RATING_OPTIONS = [
  0.5, 1.0, 1.5, 2.0, 2.5,
  3.0, 3.5, 4.0, 4.5, 5.0,
];

const cardClass =
  "rounded-[10px] border border-white/[0.08] bg-[#11141C]";

// ==========================================================
// MAIN COMPONENT
// ==========================================================

export const RateMoviesView: React.FC<RateMoviesViewProps> = ({
  currentUser,
  allMovies,
  onRateMovie,
  onRemoveRating,
  onResetRatings,
  onSelectMovie,
}) => {
  // ========================================================
  // STATE
  // ========================================================

  const [enrichedMovies, setEnrichedMovies] =
    useState<Map<number, Movie>>(new Map());

  const [activeTab, setActiveTab] =
    useState<RatingTab>("unrated");

  const [filterGenre, setFilterGenre] =
    useState<string>("all");

  const [quickSearch, setQuickSearch] =
    useState<string>("");

  const [page, setPage] = useState<number>(1);

  const [showResetConfirm, setShowResetConfirm] =
    useState<boolean>(false);

  const userRatings = currentUser.ratings ?? {};

  // ========================================================
  // THONG KE DIEM NGUOI DUNG
  // ========================================================

  const ratingValues = useMemo(() => {
    return Object.values(userRatings).filter(
      (value) => typeof value === "number" && Number.isFinite(value)
    );
  }, [userRatings]);

  const ratingCount = ratingValues.length;

  const userMean = useMemo(() => {
    if (ratingValues.length === 0) {
      return null;
    }

    const total = ratingValues.reduce(
      (sum, value) => sum + value,
      0
    );

    return total / ratingValues.length;
  }, [ratingValues]);

  // ========================================================
  // DANH SACH THE LOAI THUC TE
  // ========================================================

  const allGenres = useMemo(() => {
    const genres = new Set<string>();

    allMovies.forEach((movie) => {
      movie.genres.forEach((genre) => {
        genres.add(genre);
      });
    });

    return Array.from(genres).sort();
  }, [allMovies]);

  // ========================================================
  // PHIM DA CHAM VA CHUA CHAM
  // ========================================================

  const { ratedMovies, unratedMovies } = useMemo(() => {
    const rated: Movie[] = [];
    const unrated: Movie[] = [];

    allMovies.forEach((movie) => {
      if (Object.prototype.hasOwnProperty.call(
        userRatings,
        movie.movieId
      )) {
        rated.push(movie);
      } else {
        unrated.push(movie);
      }
    });

    return {
      ratedMovies: rated,
      unratedMovies: unrated,
    };
  }, [allMovies, userRatings]);

  // ========================================================
  // TIM KIEM VA LOC
  // ========================================================

  const filteredMovies = useMemo(() => {
    const source =
      activeTab === "rated"
        ? ratedMovies
        : unratedMovies;

    const search = quickSearch.trim().toLowerCase();

    return source.filter((movie) => {
      const matchesSearch =
        !search ||
        movie.title.toLowerCase().includes(search) ||
        String(movie.movieId).includes(search);

      const matchesGenre =
        filterGenre === "all" ||
        movie.genres.includes(filterGenre);

      return matchesSearch && matchesGenre;
    });
  }, [
    activeTab,
    ratedMovies,
    unratedMovies,
    quickSearch,
    filterGenre,
  ]);

  // ========================================================
  // PHAN TRANG
  // ========================================================

  const totalPages = Math.max(
    1,
    Math.ceil(filteredMovies.length / PAGE_SIZE)
  );

  const safePage = Math.min(page, totalPages);

  const visibleMovies = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;

    return filteredMovies.slice(
      start,
      start + PAGE_SIZE
    );
  }, [filteredMovies, safePage]);

  // Khi doi tab, tim kiem, the loai -> ve trang 1
  useEffect(() => {
    setPage(1);
  }, [activeTab, filterGenre, quickSearch, currentUser.userId]);

  useEffect(() => {
    let cancelled = false;

    async function loadVisiblePosters() {
      const results = await Promise.all(
        visibleMovies.map(async (movie) => {
          try {
            const enriched = await getEnrichedMovie(movie.movieId);
            return [movie.movieId, enriched] as const;
          } catch {
            return null;
          }
        })
      );

      if (!cancelled) {
        setEnrichedMovies((previous) => {
          const next = new Map(previous);

          for (const entry of results) {
            if (entry) {
              next.set(entry[0], entry[1]);
            }
          }

          return next;
        });
      }
    }

    void loadVisiblePosters();

    return () => {
      cancelled = true;
    };
  }, [visibleMovies]);
  const firstItem =
    filteredMovies.length === 0
      ? 0
      : (safePage - 1) * PAGE_SIZE + 1;

  const lastItem = Math.min(
    safePage * PAGE_SIZE,
    filteredMovies.length
  );

  // ========================================================
  // DANH GIA PHIM
  // ========================================================

  const handleRate = (
    movieId: number,
    rating: number
  ) => {
    if (
      rating < 0.5 ||
      rating > 5 ||
      !Number.isFinite(rating)
    ) {
      return;
    }

    onRateMovie(movieId, rating);
  };

  const handleReset = () => {
    onResetRatings();
    setShowResetConfirm(false);
    setPage(1);
  };

  // ========================================================
  // RENDER
  // ========================================================

  return (
    <div className="mx-auto max-w-[1440px] space-y-8 px-6 py-12">

      {/* HEADER */}

      <section className="space-y-3 border-b border-white/[0.08] pb-6">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#E8B65B]">
          <Star className="h-4 w-4" />
          <span>CineMatch ML · Rating Studio</span>
        </div>

        <h1 className="font-display text-3xl font-bold text-[#F5F2EA] sm:text-4xl">
          Phòng Đánh Giá Phim
        </h1>

        <p className="max-w-3xl text-sm leading-relaxed text-[#9EA3AE]">
          Khám phá thư viện MovieLens và chấm điểm các bộ phim
          yêu thích theo thang từ 0,5 đến 5 sao, bước 0,5.
          Đây là chức năng quản lý đánh giá trên giao diện,
          chưa làm thay đổi mô hình Machine Learning Python.
        </p>

        <div className="flex flex-wrap gap-2 pt-2">
          <span className="rounded bg-[#191D27] px-3 py-1.5 font-mono text-[11px] text-[#9EA3AE]">
            MovieLens Latest Small
          </span>

          <span className="rounded bg-[#191D27] px-3 py-1.5 font-mono text-[11px] text-[#9EA3AE]">
            {allMovies.length.toLocaleString("vi-VN")} phim
          </span>

          <span className="rounded border border-[#E8B65B]/20 bg-[#E8B65B]/10 px-3 py-1.5 font-mono text-[11px] text-[#E8B65B]">
            Rating 0.5 - 5.0
          </span>
        </div>
      </section>

      {/* PROFILE OVERVIEW */}

      <section className={`${cardClass} p-6`}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-[#9EA3AE]">
              Tài khoản đang đánh giá
            </p>

            <p className="font-display text-lg font-bold text-[#F5F2EA]">
              {currentUser.name}
            </p>

            <p className="font-mono text-xs text-[#E8B65B]">
              User #{currentUser.userId}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-[#9EA3AE]">
              Số phim đã chấm
            </p>

            <p className="font-display text-3xl font-bold text-[#E8B65B]">
              {ratingCount}
            </p>

            <p className="text-xs text-[#9EA3AE]">
              Trong hồ sơ React hiện tại
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-[#9EA3AE]">
              Điểm trung bình
            </p>

            <p className="font-display text-3xl font-bold text-[#F5F2EA]">
              {userMean === null
                ? "--"
                : userMean.toFixed(2)}

              <span className="ml-2 text-sm text-[#E8B65B]">
                ★
              </span>
            </p>

            <p className="text-xs text-[#9EA3AE]">
              Tính từ điểm trong hồ sơ giao diện
            </p>
          </div>

          <div className="flex flex-col justify-center gap-2">
            <button
              type="button"
              onClick={() =>
                setShowResetConfirm((value) => !value)
              }
              className="flex items-center justify-center gap-2 rounded-[8px] border border-white/[0.08] bg-[#191D27] px-4 py-3 text-xs font-medium text-[#9EA3AE] transition-colors hover:border-red-500/30 hover:text-red-400"
            >
              <RotateCcw className="h-4 w-4" />
              Đặt lại đánh giá
            </button>
          </div>
        </div>

        {showResetConfirm && (
          <div className="mt-5 space-y-3 rounded-[8px] border border-amber-500/20 bg-amber-950/10 p-4">
            <p className="text-sm text-amber-200">
              Bạn muốn đặt lại đánh giá của tài khoản này
              về dữ liệu hồ sơ DEMO ban đầu?
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-[6px] bg-red-500/80 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500"
              >
                Xác nhận đặt lại
              </button>

              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="rounded-[6px] border border-white/10 bg-[#191D27] px-4 py-2 text-xs text-[#F5F2EA]"
              >
                Hủy
              </button>
            </div>
          </div>
        )}
      </section>

      {/* IMPORTANT STATUS */}

      <section className="flex items-start gap-3 rounded-[10px] border border-[#E8B65B]/20 bg-[#E8B65B]/[0.04] p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#E8B65B]" />

        <div className="space-y-2">
          <p className="text-sm font-semibold text-[#F5F2EA]">
            Trạng thái tích hợp Machine Learning
          </p>

          <p className="text-xs leading-relaxed text-[#9EA3AE]">
            Các điểm chấm tại đây hiện chỉ được cập nhật
            trong trạng thái React. Chúng chưa được gửi
            vào FastAPI, chưa lưu trong cơ sở dữ liệu
            và chưa thay đổi kết quả gợi ý của hai mô hình.
          </p>

          <p className="text-xs leading-relaxed text-[#9EA3AE]">
            Tập Train / Validation / Test và các chỉ số
            thực nghiệm trên ML Dashboard được giữ nguyên.
          </p>
        </div>
      </section>

      {/* FILTER BAR */}

      <section className="space-y-5">

        <div className="flex flex-col items-start justify-between gap-4 border-b border-white/[0.08] pb-5 lg:flex-row lg:items-center">

          <div className="flex flex-wrap gap-2 rounded-[8px] border border-white/[0.08] bg-[#11141C] p-1">

            <button
              type="button"
              onClick={() => setActiveTab("unrated")}
              className={`rounded-[6px] px-4 py-2 text-xs font-semibold transition-colors ${
                activeTab === "unrated"
                  ? "bg-[#E8B65B] text-[#090A0E]"
                  : "text-[#9EA3AE] hover:text-[#F5F2EA]"
              }`}
            >
              Chưa đánh giá (
              {unratedMovies.length.toLocaleString("vi-VN")})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("rated")}
              className={`rounded-[6px] px-4 py-2 text-xs font-semibold transition-colors ${
                activeTab === "rated"
                  ? "bg-[#E8B65B] text-[#090A0E]"
                  : "text-[#9EA3AE] hover:text-[#F5F2EA]"
              }`}
            >
              Đã đánh giá ({ratedMovies.length})
            </button>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">

            <div className="relative flex-1 lg:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9EA3AE]" />

              <input
                type="text"
                value={quickSearch}
                onChange={(event) =>
                  setQuickSearch(event.target.value)
                }
                placeholder="Tìm tên phim hoặc Movie ID..."
                className="w-full rounded-[8px] border border-white/[0.08] bg-[#11141C] py-2.5 pl-9 pr-3 text-xs text-[#F5F2EA] outline-none placeholder:text-[#9EA3AE]/60 focus:border-[#E8B65B]"
              />
            </div>

            <select
              value={filterGenre}
              onChange={(event) =>
                setFilterGenre(event.target.value)
              }
              className="rounded-[8px] border border-white/[0.08] bg-[#11141C] px-3 py-2.5 text-xs text-[#F5F2EA] outline-none focus:border-[#E8B65B]"
            >
              <option value="all">Tất cả thể loại</option>

              {allGenres.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#9EA3AE]">
          <span>
            Tìm thấy{" "}
            <strong className="text-[#E8B65B]">
              {filteredMovies.length.toLocaleString("vi-VN")}
            </strong>{" "}
            phim
          </span>

          <span className="font-mono">
            Hiển thị {firstItem}-{lastItem} · Trang{" "}
            {safePage}/{totalPages}
          </span>
        </div>
      </section>

      {/* MOVIE RATING GRID */}

      {visibleMovies.length > 0 ? (
        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">

          {visibleMovies.map((movie) => {
            const enrichedMovie =
              enrichedMovies.get(movie.movieId) ?? movie;
            const currentRating = userRatings[movie.movieId];

            return (
              <div
                key={movie.movieId}
                className={`${cardClass} flex gap-4 p-4 transition-colors hover:border-white/20`}
              >

                {/* MOVIE THUMBNAIL */}

                <button
                  type="button"
                  onClick={() => onSelectMovie(enrichedMovie)}
                  className="relative flex aspect-[2/3] w-20 shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-white/[0.06] bg-gradient-to-b from-[#191D27] to-[#090A0E]"
                  title={`Xem chi tiết ${movie.title}`}
                >
                  {enrichedMovie.posterUrl ? (
                    <img
                      src={enrichedMovie.posterUrl}
                      alt={movie.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Film className="h-8 w-8 text-[#E8B65B]/60" />
                  )}
                </button>

                {/* MOVIE DETAILS */}

                <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">

                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => onSelectMovie(enrichedMovie)}
                      className="line-clamp-2 text-left font-display text-sm font-semibold text-[#F5F2EA] hover:text-[#E8B65B]"
                    >
                      {movie.title}
                    </button>

                    <p className="text-[11px] text-[#9EA3AE]">
                      {movie.year || "Chưa rõ năm"}
                      {" · "}
                      {movie.genres.slice(0, 2).join(", ")}
                    </p>

                    <p className="font-mono text-[10px] text-[#9EA3AE]/70">
                      Movie ID: {movie.movieId}
                    </p>
                  </div>

                  {/* RATING INPUT */}

                  <div className="space-y-2 border-t border-white/[0.06] pt-3">

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[#9EA3AE]">
                        Điểm của bạn
                      </span>

                      {currentRating !== undefined ? (
                        <span className="font-mono text-xs font-bold text-[#E8B65B]">
                          {currentRating.toFixed(1)} ★
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#9EA3AE]">
                          Chưa đánh giá
                        </span>
                      )}
                    </div>

                    {/* RATING 0.5 - 5.0 */}

                    <select
                      aria-label={`Chấm điểm phim ${movie.title}`}
                      value={currentRating ?? ""}
                      onChange={(event) =>
                        handleRate(
                          movie.movieId,
                          Number(event.target.value)
                        )
                      }
                      className="w-full rounded-[6px] border border-[#E8B65B]/20 bg-[#191D27] px-3 py-2 text-xs text-[#F5F2EA] outline-none focus:border-[#E8B65B]"
                    >
                      <option value="" disabled>
                        Chọn số sao...
                      </option>

                      {RATING_OPTIONS.map((rating) => (
                        <option key={rating} value={rating}>
                          {rating.toFixed(1)} ★
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center justify-between gap-2">
                      {currentRating !== undefined ? (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Đã cập nhật trên giao diện
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#9EA3AE]/70">
                          Bước 0,5 sao
                        </span>
                      )}

                      {currentRating !== undefined && (
                        <button
                          type="button"
                          onClick={() =>
                            onRemoveRating(movie.movieId)
                          }
                          title="Xóa đánh giá"
                          className="rounded-[6px] p-1.5 text-[#9EA3AE] hover:bg-red-500/10 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        <div className={`${cardClass} flex flex-col items-center gap-3 p-12 text-center`}>
          <Film className="h-10 w-10 text-[#E8B65B]/40" />

          <p className="text-sm font-semibold text-[#F5F2EA]">
            Không tìm thấy phim phù hợp
          </p>

          <p className="text-xs text-[#9EA3AE]">
            Hãy thử từ khóa, thể loại hoặc tab khác.
          </p>

          <button
            type="button"
            onClick={() => {
              setQuickSearch("");
              setFilterGenre("all");
              setPage(1);
            }}
            className="mt-2 rounded-[6px] bg-[#E8B65B] px-4 py-2 text-xs font-semibold text-[#090A0E]"
          >
            Xóa bộ lọc
          </button>
        </div>
      )}

      {/* PAGINATION */}

      {filteredMovies.length > PAGE_SIZE && (
        <nav
          aria-label="Phân trang phim"
          className="flex flex-wrap items-center justify-center gap-4 border-t border-white/[0.08] pt-7"
        >
          <button
            type="button"
            disabled={safePage === 1}
            onClick={() =>
              setPage((current) => Math.max(1, current - 1))
            }
            className="flex items-center gap-2 rounded-[8px] border border-white/[0.08] bg-[#191D27] px-4 py-2 text-xs text-[#F5F2EA] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
            Trang trước
          </button>

          <span className="font-mono text-xs text-[#E8B65B]">
            {safePage} / {totalPages}
          </span>

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() =>
              setPage((current) =>
                Math.min(totalPages, current + 1)
              )
            }
            className="flex items-center gap-2 rounded-[8px] border border-white/[0.08] bg-[#191D27] px-4 py-2 text-xs text-[#F5F2EA] disabled:cursor-not-allowed disabled:opacity-30"
          >
            Trang sau
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}

    </div>
  );
};

