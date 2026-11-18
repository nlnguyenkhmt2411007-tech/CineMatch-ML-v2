
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
  Loader2,
} from "lucide-react";

import type { Movie, UserProfile } from "../../types";

// ==========================================================
// PROPS - GIU NGUYEN DE TUONG THICH VOI APP.TSX
// ==========================================================

interface RateMoviesViewProps {
  currentUser: UserProfile;
  allMovies: Movie[];
  onRateMovie: (movieId: number, rating: number) => Promise<void>;
  onRemoveRating: (movieId: number) => Promise<void>;
  onResetRatings: () => Promise<void>;
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
      `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/api/movies/enriched/${movieId}`
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

const cardClass =
  "rounded-[10px] border border-white/[0.08] bg-[#11141C]";

// Accessible half-star input (0.5 increments). No external dependency.
const HalfStarRating: React.FC<{
  movieTitle: string;
  rating?: number;
  disabled: boolean;
  onChange: (rating: number) => void;
}> = ({ movieTitle, rating, disabled, onChange }) => {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? rating ?? 0;

  return (
    <div className="space-y-1.5" onMouseLeave={() => setHover(null)}>
      <div
        role="group"
        aria-label={`Đánh giá ${movieTitle} theo thang 0,5 đến 5 sao`}
        className="flex items-center gap-0.5"
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const fill = Math.max(0, Math.min(1, shown - (star - 1)));
          return (
            <div key={star} className="relative h-9 w-9 shrink-0">
              <Star aria-hidden="true" className="pointer-events-none absolute left-1 top-1 h-7 w-7 text-[#747B88]" strokeWidth={1.6} />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star className="absolute left-1 top-1 h-7 w-7 fill-[#E8BF82] text-[#E8BF82]" strokeWidth={1.6} />
              </div>
              <div className="absolute inset-0 flex">
                {[star - 0.5, star].map((value) => (
                  <button
                    key={value}
                    type="button"
                    disabled={disabled}
                    aria-label={`Chấm ${value.toFixed(1)} sao cho ${movieTitle}`}
                    aria-pressed={rating === value}
                    title={`${value.toFixed(1)} sao`}
                    onMouseEnter={() => setHover(value)}
                    onFocus={() => setHover(value)}
                    onBlur={() => setHover(null)}
                    onClick={() => onChange(value)}
                    className="h-9 w-1/2 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#E8BF82] disabled:cursor-wait"
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-[#A0A7B5]" aria-live="polite">
        {hover !== null
          ? `Chọn ${hover.toFixed(1)}/5 sao`
          : rating !== undefined
            ? `Điểm đã chấm: ${rating.toFixed(1)}/5 · Có thể chấm lại`
            : "Chạm nửa ngôi sao để chọn bước 0,5"}
      </p>
    </div>
  );
};

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
  const [pendingMovieId, setPendingMovieId] = useState<number | null>(null);
  const [resetPending, setResetPending] = useState(false);
  const [feedback, setFeedback] = useState<{
    status: "success" | "error";
    message: string;
  } | null>(null);

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

  const handleRate = async (movieId: number, rating: number) => {
    if (
      rating < 0.5 || rating > 5 ||
      !Number.isFinite(rating) || rating * 2 !== Math.round(rating * 2) ||
      pendingMovieId !== null || resetPending
    ) return;

    setPendingMovieId(movieId);
    setFeedback(null);
    try {
      await onRateMovie(movieId, rating);
      setFeedback({ status: "success", message: `Đã lưu ${rating.toFixed(1)}/5 sao vào tài khoản CineMatch.` });
    } catch (error) {
      setFeedback({ status: "error", message: error instanceof Error ? error.message : "Không lưu được đánh giá. Hãy thử lại." });
    } finally {
      setPendingMovieId(null);
    }
  };

  const handleRemove = async (movieId: number) => {
    if (pendingMovieId !== null || resetPending) return;
    setPendingMovieId(movieId);
    setFeedback(null);
    try {
      await onRemoveRating(movieId);
      setFeedback({ status: "success", message: "Đã xóa đánh giá khỏi tài khoản CineMatch." });
    } catch (error) {
      setFeedback({ status: "error", message: error instanceof Error ? error.message : "Không xóa được đánh giá." });
    } finally {
      setPendingMovieId(null);
    }
  };

  const handleReset = async () => {
    if (resetPending || pendingMovieId !== null) return;
    setResetPending(true);
    setFeedback(null);
    try {
      await onResetRatings();
      setShowResetConfirm(false);
      setPage(1);
      setFeedback({ status: "success", message: "Đã xóa toàn bộ đánh giá của tài khoản CineMatch." });
    } catch (error) {
      setFeedback({ status: "error", message: error instanceof Error ? error.message : "Không thể đặt lại đánh giá." });
    } finally {
      setResetPending(false);
    }
  };

  // ========================================================
  // RENDER
  // ========================================================

  return (
    <div id="cm-rating-studio" className="cm-rating-film-page mx-auto max-w-[1440px] space-y-7 px-6 py-9">

      {/* HEADER */}

      <section className="space-y-3 border-b border-white/[0.08] pb-6">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#E8BF82]">
          <Star className="h-4 w-4" />
          <span>GÓC ĐIỆN ẢNH CỦA BẠN</span>
        </div>

        <h1 className="font-display text-3xl font-bold text-[#F5F2EA] sm:text-4xl">
          Đánh giá phim bạn đã xem
        </h1>

        <p className="max-w-3xl text-sm leading-relaxed text-[#9EA3AE]">
          Chọn số sao cho những bộ phim bạn đã xem để nhận gợi ý ngày càng hợp gu.
        </p>

        <div className="flex flex-wrap gap-2 pt-2">


          <span className="rounded bg-[#191D27] px-3 py-1.5 font-mono text-[11px] text-[#9EA3AE]">
            {allMovies.length.toLocaleString("vi-VN")} phim
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

            <p className="font-mono text-xs text-[#E8BF82]">
              Tài khoản CineMatch · Không phải User MovieLens
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-[#9EA3AE]">
              Số phim đã chấm
            </p>

            <p className="font-display text-3xl font-bold text-[#E8BF82]">
              {ratingCount}
            </p>

            <p className="text-xs text-[#9EA3AE]">
              Lưu theo tài khoản qua FastAPI
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

              <span className="ml-2 text-sm text-[#E8BF82]">
                ★
              </span>
            </p>

            <p className="text-xs text-[#9EA3AE]">
              Tính từ các đánh giá của tài khoản
            </p>
          </div>

          <div className="flex flex-col justify-center gap-2">
            <button
              type="button"
              onClick={() =>
                setShowResetConfirm((value) => !value)
              }
              disabled={pendingMovieId !== null || resetPending}
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
              Bạn có chắc muốn xóa toàn bộ điểm đã lưu trong tài khoản CineMatch?
              Thao tác này không thể hoàn tác.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleReset()}
                 disabled={resetPending}
                className="rounded-[6px] bg-red-500/80 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500"
              >
                {resetPending ? "Đang xóa..." : "Xác nhận xóa tất cả"}
              </button>

              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                 disabled={resetPending}
                className="rounded-[6px] border border-white/10 bg-[#191D27] px-4 py-2 text-xs text-[#F5F2EA]"
              >
                Hủy
              </button>
            </div>
          </div>
        )}
      </section>

      {/* IMPORTANT STATUS */}

      <details className="cm-film-method-note rounded-[10px] border border-[#E8BF82]/20 bg-[#E8BF82]/[0.04] p-4">
        <summary><Info className="h-5 w-5 shrink-0 text-[#E8BF82]" /> Điểm đánh giá được lưu ở đâu?</summary>
        <div className="space-y-2 mt-3">

          <p className="text-xs leading-relaxed text-[#9EA3AE]">
            Khi chọn sao, CineMatch gửi điểm đến FastAPI và lưu trong
            tài khoản đã đăng nhập. Chỉ thông báo “Đã lưu” khi máy chủ
            xác nhận thành công. Điểm này có thể được sử dụng trong
            gợi ý riêng cho tài khoản, nhưng không tự huấn luyện lại mô hình ML.
          </p>

          <p className="text-xs leading-relaxed text-[#9EA3AE]">
            Hồ sơ CineMatch khác với các User 1–610 của MovieLens.
            Train, Validation, Test và các chỉ số ML Dashboard giữ nguyên.
          </p>
        </div>
      </details>

      {feedback && (
        <div
          role={feedback.status === "error" ? "alert" : "status"}
          aria-live={feedback.status === "error" ? "assertive" : "polite"}
          className={`flex items-start gap-2 rounded-[10px] border p-3 text-sm ${
            feedback.status === "success"
              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
              : "border-rose-400/20 bg-rose-400/10 text-rose-200"
          }`}
        >
          {feedback.status === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* FILTER BAR */}

      <section className="space-y-5">

        <div className="flex flex-col items-start justify-between gap-4 border-b border-white/[0.08] pb-5 lg:flex-row lg:items-center">

          <div className="flex flex-wrap gap-2 rounded-[8px] border border-white/[0.08] bg-[#11141C] p-1">

            <button
              type="button"
              onClick={() => setActiveTab("unrated")}
              className={`rounded-[6px] px-4 py-2 text-xs font-semibold transition-colors ${
                activeTab === "unrated"
                  ? "bg-[#E8BF82] text-[#090A0E]"
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
                  ? "bg-[#E8BF82] text-[#090A0E]"
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
                className="w-full rounded-[8px] border border-white/[0.08] bg-[#11141C] py-2.5 pl-9 pr-3 text-xs text-[#F5F2EA] outline-none placeholder:text-[#9EA3AE]/60 focus:border-[#E8BF82]"
              />
            </div>

            <select
              value={filterGenre}
              onChange={(event) =>
                setFilterGenre(event.target.value)
              }
              className="rounded-[8px] border border-white/[0.08] bg-[#11141C] px-3 py-2.5 text-xs text-[#F5F2EA] outline-none focus:border-[#E8BF82]"
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
            <strong className="text-[#E8BF82]">
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
        <section className="cm-rating-films-grid grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">

          {visibleMovies.map((movie) => {
            const enrichedMovie =
              enrichedMovies.get(movie.movieId) ?? movie;
            const currentRating = userRatings[movie.movieId];

            return (
              <div
                key={movie.movieId}
                className={`${cardClass} cm-rating-film-card flex flex-col gap-2 p-2.5 transition-colors hover:border-[#E8BF82]/40`}
              >

                {/* MOVIE THUMBNAIL */}

                <button
                  type="button"
                  onClick={() => onSelectMovie(enrichedMovie)}
                  className="cm-rating-film-poster relative flex aspect-[2/3] w-full shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-white/[0.06] bg-gradient-to-b from-[#191D27] to-[#090A0E]"
                  title={`Xem chi tiết ${movie.title}`}
                >
                  {enrichedMovie.posterUrl ? (
                    <img
                      src={enrichedMovie.posterUrl}
                      alt={movie.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Film className="h-8 w-8 text-[#E8BF82]/60" />
                  )}
                </button>

                {/* MOVIE DETAILS */}

                <div className="cm-rating-film-meta flex min-w-0 flex-1 flex-col justify-between gap-2 px-1 pb-1">

                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => onSelectMovie(enrichedMovie)}
                      className="line-clamp-2 text-left font-display text-sm font-semibold text-[#F5F2EA] hover:text-[#E8BF82]"
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
                        <span className="font-mono text-xs font-bold text-[#E8BF82]">
                          {currentRating.toFixed(1)} ★
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#9EA3AE]">
                          Chưa đánh giá
                        </span>
                      )}
                    </div>

                    {/* HALF-STAR RATING (0.5 TO 5.0) */}
                    <HalfStarRating
                      movieTitle={movie.title}
                      rating={currentRating}
                      disabled={pendingMovieId !== null || resetPending}
                      onChange={(value) => void handleRate(movie.movieId, value)}
                    />

                    <div className="flex items-center justify-between gap-2">
                      {pendingMovieId === movie.movieId ? (
                        <span className="flex items-center gap-1 text-[10px] text-[#E8BF82]" role="status">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Đang đồng bộ với máy chủ...
                        </span>
                      ) : currentRating !== undefined ? (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Đã có trong tài khoản
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#9EA3AE]/70">
                          Chưa chấm điểm
                        </span>
                      )}

                      {currentRating !== undefined && (
                        <button
                          type="button"
                          onClick={() => void handleRemove(movie.movieId)}
                          disabled={pendingMovieId !== null || resetPending}
                          aria-label={`Xóa đánh giá phim ${movie.title}`}
                          title="Xóa đánh giá"
                          className="rounded-[6px] p-1.5 text-[#9EA3AE] hover:bg-red-500/10 hover:text-red-400 disabled:cursor-wait disabled:opacity-40"
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
          <Film className="h-10 w-10 text-[#E8BF82]/40" />

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
            className="mt-2 rounded-[6px] bg-[#E8BF82] px-4 py-2 text-xs font-semibold text-[#090A0E]"
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

          <span className="font-mono text-xs text-[#E8BF82]">
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

