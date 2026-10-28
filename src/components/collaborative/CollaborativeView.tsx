
import React, { useEffect, useMemo, useState } from "react";

import {
  Users,
  TrendingUp,
  BookOpen,
  Star,
  UserCheck,
  Calculator,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Database,
  Film,
  Info,
} from "lucide-react";

import type { Movie, UserProfile } from "../../types";
import { cineMatchApi, type EvaluationResponse } from "../../services/api";
import { MovieCard } from "../common/MovieCard";

// =====================================================
// PROPS
// =====================================================

interface CollaborativeViewProps {
  currentUser: UserProfile;
  availableUsers: UserProfile[];
  onSelectUser: (user: UserProfile) => void;
  allMovies: Movie[];
  onSelectMovie: (movie: Movie) => void;
  bookmarkedMovieIds: Set<number>;
  onToggleBookmark: (movieId: number) => void;
}

// =====================================================
// TYPES
// =====================================================

interface CFRecommendation {
  movieId: number;
  title: string;
  predicted_rating: number;
}

interface CFNeighbor {
  userId: number;
  similarity: number;
  rating: number;
  userMean: number;
  deviation: number;
  weightedContribution: number;
}

interface CFExplanation {
  userId: number;
  movieId: number;
  title: string;
  k: number;
  baseline: number;
  neighborCount: number;
  numerator: number;
  denominator: number;
  rawPrediction: number;
  predictedRating: number;
  neighbors: CFNeighbor[];
}
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

async function enrichRecommendations(
  items: CFRecommendation[]
): Promise<Map<number, Movie>> {
  const results = await Promise.all(
    items.map(async (item) => {
      try {
        const movie = await getEnrichedMovie(item.movieId);
        return [item.movieId, movie] as const;
      } catch {
        return null;
      }
    })
  );

  return new Map(
    results.filter(
      (entry): entry is readonly [number, Movie] =>
        entry !== null
    )
  );
}
const BEST_K = 20;
const TOTAL_USERS = 610;

const cardClass =
  "rounded-[10px] border border-white/[0.08] bg-[#11141C]";

function formatMetric(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "--";
  }
  return value.toFixed(4);
}

// =====================================================
// COMPONENT
// =====================================================

export const CollaborativeView: React.FC<CollaborativeViewProps> = ({
  currentUser,
  availableUsers,
  onSelectUser,
  allMovies,
  onSelectMovie,
  bookmarkedMovieIds,
  onToggleBookmark,
}) => {
  // ===================================================
  // 1. STATE
  // ===================================================

  const [userId, setUserId] = useState<number>(
    currentUser.userId >= 1 &&
      currentUser.userId <= TOTAL_USERS
      ? currentUser.userId
      : 1
  );

  const [topN, setTopN] = useState<number>(10);

  const [recommendations, setRecommendations] = useState<
    CFRecommendation[]
  >([]);

  const [recommendationMovies, setRecommendationMovies] =
    useState<Map<number, Movie>>(new Map());

  const [explainOpen, setExplainOpen] = useState(false);
  const [explainMovieId, setExplainMovieId] = useState<number | null>(null);
  const [explanation, setExplanation] = useState<CFExplanation | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const [evaluation, setEvaluation] =
    useState<EvaluationResponse | null>(null);

  const [evaluationError, setEvaluationError] =
    useState<string | null>(null);

  // ===================================================
  // 2. MOVIE LOOKUP
  // ===================================================

  const movieMap = useMemo(() => {
    return new Map<number, Movie>(
      allMovies.map((movie) => [
        movie.movieId,
        movie,
      ])
    );
  }, [allMovies]);

  // ===================================================
  // 3. LOAD USER-BASED CF RECOMMENDATIONS
  // ===================================================

  useEffect(() => {
    let cancelled = false;

    async function loadRecommendations() {
      setLoading(true);
      setError(null);
      setRecommendations([]);

      try {
        const response =
          await cineMatchApi.getUserRecommendations(
            userId,
            topN
          );

        if (cancelled) return;

        setRecommendations(response.items);

        const enriched = await enrichRecommendations(response.items);

        if (!cancelled) {
          setRecommendationMovies(enriched);
        }
      } catch (err) {
        if (cancelled) return;

        setError(
          err instanceof Error
            ? err.message
            : "Không thể kết nối mô hình User-Based CF."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadRecommendations();

    return () => {
      cancelled = true;
    };
  }, [userId, topN, refreshKey]);

  useEffect(() => {
    if (!explainOpen || explainMovieId === null) {
      setExplanation(null);
      setExplainError(null);
      setExplainLoading(false);
      return;
    }

    let cancelled = false;

    async function loadExplanation() {
      setExplainLoading(true);
      setExplainError(null);
      setExplanation(null);

      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/api/recommend/user/${userId}/explain/${explainMovieId}`
        );

        if (!response.ok) {
          throw new Error(`API giải thích trả về HTTP ${response.status}`);
        }

        const data = (await response.json()) as CFExplanation;

        if (!cancelled) {
          setExplanation(data);
        }
      } catch (err) {
        if (!cancelled) {
          setExplainError(
            err instanceof Error ? err.message : "Không tải được dữ liệu giải thích."
          );
        }
      } finally {
        if (!cancelled) {
          setExplainLoading(false);
        }
      }
    }

    void loadExplanation();

    return () => {
      cancelled = true;
    };
  }, [userId, explainMovieId, explainOpen]);
  // ===================================================
  // 4. LOAD REAL EVALUATION METRICS
  // ===================================================

  useEffect(() => {
    let cancelled = false;

    async function loadEvaluation() {
      try {
        const response = await cineMatchApi.getEvaluation();

        if (!cancelled) {
          setEvaluation(response);
          setEvaluationError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setEvaluation(null);
          setEvaluationError(
            err instanceof Error
              ? err.message
              : "Không tải được kết quả đánh giá."
          );
        }
      }
    }

    void loadEvaluation();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // ===================================================
  // 5. EXTRACT REAL METRICS
  // ===================================================

  const cfRanking = evaluation?.ranking.find(
    (item) => item.model === "User-Based CF"
  );

  const cfRating = evaluation?.rating_prediction.find(
    (item) => item.model === "User-Based CF"
  );

  // ===================================================
  // 6. CHANGE USER
  // ===================================================

  const handleChangeUser = (nextUserId: number) => {
    if (
      !Number.isInteger(nextUserId) ||
      nextUserId < 1 ||
      nextUserId > TOTAL_USERS
    ) {
      return;
    }

    setUserId(nextUserId);

    // Chi dong bo Navbar neu user ton tai
    // trong danh sach hien tai cua giao dien.
    const foundUser = availableUsers.find(
      (user) => user.userId === nextUserId
    );

    if (foundUser) {
      onSelectUser(foundUser);
    }
  };

  // ===================================================
  // 7. RENDER
  // ===================================================

  return (
    <div className="mx-auto max-w-[1440px] space-y-10 px-6 py-12">
      {/* HEADER */}

      <section className="space-y-4 border-b border-white/[0.08] pb-7">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#E8B65B]">
          <Users className="h-4 w-4" />
          <span>
            Mô hình 2 · CineMatch Machine Learning
          </span>
        </div>

        <h1 className="font-display text-3xl font-bold text-[#F5F2EA] sm:text-4xl">
          User-Based Collaborative Filtering
        </h1>

        <p className="max-w-3xl text-sm leading-relaxed text-[#9EA3AE]">
          Hệ thống gợi ý phim dựa trên sự tương đồng
          giữa những người dùng trong tập MovieLens.
          Thuật toán sử dụng Mean-Centering,
          Cosine Similarity và K-Nearest Neighbors
          để dự đoán mức rating cho các phim.
        </p>

        <div className="flex flex-wrap gap-2">
          <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 font-mono text-[11px] text-emerald-400">
            Python FastAPI · ML thật
          </span>

          <span className="rounded bg-[#191D27] px-3 py-1.5 font-mono text-[11px] text-[#9EA3AE]">
            User-Based CF
          </span>

          <span className="rounded bg-[#191D27] px-3 py-1.5 font-mono text-[11px] text-[#9EA3AE]">
            Mean-Centering
          </span>

          <span className="rounded bg-[#191D27] px-3 py-1.5 font-mono text-[11px] text-[#9EA3AE]">
            K = {BEST_K}
          </span>
        </div>
      </section>

      {/* ALGORITHM THEORY */}

      <section className={`${cardClass} space-y-5 p-6`}>
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-[#F5F2EA]">
          <BookOpen className="h-4 w-4 text-[#E8B65B]" />
          Quy trình hoạt động của thuật toán
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="space-y-2 rounded-[8px] border border-white/[0.06] bg-[#191D27] p-4">
            <p className="font-mono text-xs font-semibold text-[#E8B65B]">
              01 · Mean-Centering
            </p>

            <p className="text-xs leading-relaxed text-[#9EA3AE]">
              Trừ điểm trung bình của từng người dùng
              khỏi các rating đã cho để giảm ảnh hưởng
              của thói quen chấm điểm.
            </p>

            <p className="font-mono text-[11px] text-[#F5F2EA]">
              r'ui = rui - mean(u)
            </p>
          </div>

          <div className="space-y-2 rounded-[8px] border border-white/[0.06] bg-[#191D27] p-4">
            <p className="font-mono text-xs font-semibold text-[#E8B65B]">
              02 · Cosine Similarity
            </p>

            <p className="text-xs leading-relaxed text-[#9EA3AE]">
              Xác định những người dùng có lịch sử
              đánh giá tương đồng với người dùng mục tiêu.
            </p>
          </div>

          <div className="space-y-2 rounded-[8px] border border-white/[0.06] bg-[#191D27] p-4">
            <p className="font-mono text-xs font-semibold text-[#E8B65B]">
              03 · Chọn K láng giềng
            </p>

            <p className="text-xs leading-relaxed text-[#9EA3AE]">
              Sử dụng K = 20, đã được lựa chọn dựa
              trên sai số RMSE của tập Validation.
            </p>
          </div>

          <div className="space-y-2 rounded-[8px] border border-white/[0.06] bg-[#191D27] p-4">
            <p className="font-mono text-xs font-semibold text-[#E8B65B]">
              04 · Dự đoán Rating
            </p>

            <p className="text-xs leading-relaxed text-[#9EA3AE]">
              Tổng hợp điểm đánh giá của các láng giềng
              có trọng số tương đồng để dự đoán rating
              trên thang từ 0.5 đến 5 sao.
            </p>
          </div>
        </div>
      </section>

      {/* USER SELECTOR */}

      <section className={`${cardClass} space-y-6 p-6`}>
        <div className="flex flex-col justify-between gap-4 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[#E8B65B]">
              <UserCheck className="h-4 w-4" />
              Người dùng mục tiêu
            </div>

            <h2 className="font-display text-xl font-bold text-[#F5F2EA]">
              Chọn User để dự đoán rating
            </h2>

            <p className="text-xs text-[#9EA3AE]">
              Mô hình được xây dựng từ 610 người dùng MovieLens.
              Tài khoản khách #999 không có lịch sử Train.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label
              htmlFor="collaborative-user-id"
              className="text-xs text-[#9EA3AE]"
            >
              User ID
            </label>

            <select
              id="collaborative-user-id"
              value={userId}
              onChange={(event) =>
                handleChangeUser(Number(event.target.value))
              }
              className="rounded-[8px] border border-white/[0.12] bg-[#191D27] px-4 py-2.5 text-sm text-[#F5F2EA] outline-none focus:border-[#E8B65B]"
            >
              {Array.from(
                { length: TOTAL_USERS },
                (_, index) => index + 1
              ).map((id) => (
                <option key={id} value={id}>
                  User #{id}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-[8px] border border-white/[0.06] bg-[#191D27] p-4">
            <div className="flex items-center gap-2 text-xs text-[#9EA3AE]">
              <Users className="h-4 w-4 text-[#E8B65B]" />
              Người dùng đang phân tích
            </div>

            <p className="mt-2 font-display text-2xl font-bold text-[#E8B65B]">
              #{userId}
            </p>
          </div>

          <div className="rounded-[8px] border border-white/[0.06] bg-[#191D27] p-4">
            <div className="flex items-center gap-2 text-xs text-[#9EA3AE]">
              <Calculator className="h-4 w-4 text-[#E8B65B]" />
              Số láng giềng
            </div>

            <p className="mt-2 font-display text-2xl font-bold text-[#F5F2EA]">
              K = {BEST_K}
            </p>
          </div>

          <div className="rounded-[8px] border border-white/[0.06] bg-[#191D27] p-4">
            <div className="flex items-center gap-2 text-xs text-[#9EA3AE]">
              <Database className="h-4 w-4 text-[#E8B65B]" />
              Dữ liệu huấn luyện
            </div>

            <p className="mt-2 text-sm font-semibold text-[#F5F2EA]">
              ratings_train.csv
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-[8px] border border-[#E8B65B]/20 bg-[#E8B65B]/[0.05] p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#E8B65B]" />

          <p className="text-xs leading-relaxed text-[#9EA3AE]">
            API hiện tại trả về kết quả dự đoán rating,
            chưa cung cấp thông tin chi tiết của từng láng giềng
            như User ID, độ tương đồng hay số phim cùng đánh giá.
            Vì vậy, phần danh sách láng giềng DEMO đã được bỏ
            để tránh trình bày dữ liệu không có thật.
          </p>
        </div>
      </section>

      {/* TEST EVALUATION */}

      <section className={`${cardClass} space-y-5 p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-[#F5F2EA]">
            <TrendingUp className="h-5 w-5 text-[#E8B65B]" />
            Chất lượng mô hình trên Test
          </h2>

          <span className="font-mono text-xs text-[#9EA3AE]">
            K = {BEST_K}
          </span>
        </div>

        {evaluationError && (
          <p className="rounded-[8px] border border-amber-500/20 bg-amber-950/20 p-3 text-xs text-amber-300">
            Chưa tải được chỉ số đánh giá: {evaluationError}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-[8px] border border-white/[0.06] bg-[#191D27] p-4">
            <p className="text-xs text-[#9EA3AE]">
              Precision@10 ↑
            </p>

            <p className="mt-2 font-mono text-2xl font-bold text-[#E8B65B]">
              {formatMetric(cfRanking?.precision_at_10)}
            </p>
          </div>

          <div className="rounded-[8px] border border-white/[0.06] bg-[#191D27] p-4">
            <p className="text-xs text-[#9EA3AE]">
              Recall@10 ↑
            </p>

            <p className="mt-2 font-mono text-2xl font-bold text-[#E8B65B]">
              {formatMetric(cfRanking?.recall_at_10)}
            </p>
          </div>

          <div className="rounded-[8px] border border-white/[0.06] bg-[#191D27] p-4">
            <p className="text-xs text-[#9EA3AE]">
              MAE ↓
            </p>

            <p className="mt-2 font-mono text-2xl font-bold text-emerald-400">
              {formatMetric(cfRating?.mae)}
            </p>
          </div>

          <div className="rounded-[8px] border border-white/[0.06] bg-[#191D27] p-4">
            <p className="text-xs text-[#9EA3AE]">
              RMSE ↓
            </p>

            <p className="mt-2 font-mono text-2xl font-bold text-emerald-400">
              {formatMetric(cfRating?.rmse)}
            </p>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-[#9EA3AE]">
          Precision@10 và Recall@10 được tính trên tập ứng viên
          lấy mẫu, không phải toàn bộ danh mục phim.
          MAE và RMSE đo sai số dự đoán rating trên tập Test.
        </p>
      </section>

      {/* TOP N RECOMMENDATIONS */}

      <section className="space-y-6">
        <div className="flex flex-col justify-between gap-4 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-[#E8B65B]" />

              <h2 className="font-display text-2xl font-bold text-[#F5F2EA]">
                Top-{topN} phim gợi ý cho User #{userId}
              </h2>
            </div>

            <p className="text-xs text-[#9EA3AE]">
              Điểm rating dự đoán được tính bởi User-Based CF
              trong FastAPI, không sử dụng thuật toán DEMO của React.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 text-xs text-[#9EA3AE]">
              Top-N:
            </span>

            {[4, 6, 10, 20].map((number) => (
              <button
                key={number}
                type="button"
                onClick={() => setTopN(number)}
                className={`rounded-[6px] px-3 py-1.5 font-mono text-xs transition-colors ${
                  topN === number
                    ? "bg-[#E8B65B] font-bold text-[#090A0E]"
                    : "border border-white/[0.08] bg-[#191D27] text-[#9EA3AE] hover:text-[#F5F2EA]"
                }`}
              >
                N={number}
              </button>
            ))}

            <button
              type="button"
              onClick={() =>
                setRefreshKey((value) => value + 1)
              }
              title="Tải lại kết quả"
              aria-label="Tải lại kết quả"
              className="ml-2 rounded-[6px] border border-[#E8B65B]/30 bg-[#E8B65B]/10 p-2 text-[#E8B65B] hover:bg-[#E8B65B]/20"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* LOADING */}

        {loading && (
          <div className={`${cardClass} flex items-center justify-center gap-3 p-12 text-sm text-[#9EA3AE]`}>
            <RefreshCw className="h-5 w-5 animate-spin text-[#E8B65B]" />
            Đang tính dự đoán rating từ Python...
          </div>
        )}

        {/* ERROR */}

        {!loading && error && (
          <div className="flex items-start gap-3 rounded-[10px] border border-red-500/30 bg-red-950/20 p-5 text-sm text-red-300">
            <AlertCircle className="h-5 w-5 shrink-0" />

            <div className="space-y-2">
              <p className="font-semibold">
                Không thể tải gợi ý User-Based CF
              </p>

              <p className="text-xs">{error}</p>

              <p className="text-xs">
                Kiểm tra FastAPI:
                {" "}{import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/api/recommend/user/1
              </p>
            </div>
          </div>
        )}

        {/* EMPTY */}

        {!loading &&
          !error &&
          recommendations.length === 0 && (
            <div className={`${cardClass} p-10 text-center text-sm text-[#9EA3AE]`}>
              Chưa có phim gợi ý cho User #{userId}.
            </div>
          )}

        {/* REAL RECOMMENDATIONS */}

        {!loading &&
          !error &&
          recommendations.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                Đã nhận {recommendations.length} phim
                từ mô hình User-Based CF Python.
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {recommendations.map((item) => {
                  const movie =
                    recommendationMovies.get(item.movieId) ??
                    movieMap.get(item.movieId);

                  if (!movie) {
                    return (
                      <div
                        key={item.movieId}
                        className={`${cardClass} space-y-3 p-4`}
                      >
                        <Film className="h-8 w-8 text-[#E8B65B]" />

                        <p className="text-sm font-semibold text-[#F5F2EA]">
                          {item.title}
                        </p>

                        <p className="font-mono text-xs text-[#E8B65B]">
                          Dự đoán:{" "}
                          {item.predicted_rating.toFixed(2)}★
                        </p>
                      </div>
                    );
                  }

                  return (
                    <MovieCard
                      key={item.movieId}
                      movie={movie}
                      onClick={() => onSelectMovie(movie)}
                      predictedRating={item.predicted_rating}
                      isBookmarked={bookmarkedMovieIds.has(
                        item.movieId
                      )}
                      onToggleBookmark={(event) => {
                        event.stopPropagation();
                        onToggleBookmark(item.movieId);
                      }}
                      userRating={
                        currentUser.ratings[item.movieId]
                      }
                    />
                  );
                })}
              </div>
            </>
          )}

        {!loading && !error && recommendations.length > 0 && (
          <div className={`${cardClass} space-y-4 p-5`}>
            <button
              type="button"
              onClick={() => {
                setExplainOpen((value) => !value);
                if (explainMovieId === null) {
                  setExplainMovieId(recommendations[0].movieId);
                }
              }}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="flex items-center gap-2 font-semibold text-[#F5F2EA]">
                <Calculator className="h-5 w-5 text-[#E8B65B]" />
                Vì sao phim này được đề xuất?
              </span>
              <span className="text-xs text-[#E8B65B]">
                {explainOpen ? "Thu gọn −" : "Xem bằng chứng ML +"}
              </span>
            </button>

            {explainOpen && (
              <div className="space-y-4">
                <label className="block space-y-2 text-sm text-[#9EA3AE]">
                  <span>Chọn phim trong danh sách gợi ý</span>
                  <select
                    value={explainMovieId ?? recommendations[0].movieId}
                    onChange={(event) =>
                      setExplainMovieId(Number(event.target.value))
                    }
                    className="w-full rounded-lg border border-white/10 bg-[#1B1F29] p-3 text-[#F5F2EA]"
                  >
                    {recommendations.map((item) => (
                      <option key={item.movieId} value={item.movieId}>
                        {item.title} — {item.predicted_rating.toFixed(3)} sao
                      </option>
                    ))}
                  </select>
                </label>

                {explainLoading && (
                  <p className="text-sm text-[#9EA3AE]">
                    Đang tải bằng chứng từ mô hình Python...
                  </p>
                )}

                {explainError && (
                  <p className="text-sm text-red-400">{explainError}</p>
                )}

                {explanation && !explainLoading && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                      <div>
                        <p className="text-[#9EA3AE]">User</p>
                        <p className="font-semibold text-[#F5F2EA]">
                          #{explanation.userId}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#9EA3AE]">Điểm trung bình</p>
                        <p className="font-semibold text-[#F5F2EA]">
                          {explanation.baseline.toFixed(4)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#9EA3AE]">Láng giềng tham gia</p>
                        <p className="font-semibold text-[#F5F2EA]">
                          {explanation.neighborCount}/{explanation.k}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#9EA3AE]">Điểm dự đoán</p>
                        <p className="font-semibold text-[#E8B65B]">
                          {explanation.predictedRating.toFixed(4)} ★
                        </p>
                      </div>
                    </div>

                    <p className="text-xs leading-relaxed text-[#9EA3AE]">
                      Mô hình tính cosine similarity từ rating đã trừ điểm
                      trung bình, chọn tối đa K người dùng có độ tương đồng
                      dương đã đánh giá phim, rồi tính trung bình có trọng số
                      của độ lệch rating.
                    </p>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[620px] text-left text-xs">
                        <thead className="border-b border-white/10 text-[#E8B65B]">
                          <tr>
                            <th className="p-2">User</th>
                            <th className="p-2">Cosine</th>
                            <th className="p-2">Rating</th>
                            <th className="p-2">TB User</th>
                            <th className="p-2">Đóng góp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {explanation.neighbors.map((neighbor) => (
                            <tr
                              key={neighbor.userId}
                              className="border-b border-white/[0.06] text-[#F5F2EA]"
                            >
                              <td className="p-2">#{neighbor.userId}</td>
                              <td className="p-2">
                                {neighbor.similarity.toFixed(6)}
                              </td>
                              <td className="p-2">
                                {neighbor.rating.toFixed(1)}
                              </td>
                              <td className="p-2">
                                {neighbor.userMean.toFixed(4)}
                              </td>
                              <td className="p-2">
                                {neighbor.weightedContribution.toFixed(6)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <p className="text-xs text-[#9EA3AE]">
                      Dự đoán = {explanation.baseline.toFixed(4)} +
                      ({explanation.numerator.toFixed(6)} /
                      {explanation.denominator.toFixed(6)}).
                      Kết quả cuối cùng được giới hạn trong khoảng 0.5–5 sao.
                      Đây là dữ liệu thật từ mô hình Python.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div className="flex items-start gap-2 rounded-[8px] border border-[#E8B65B]/20 bg-[#E8B65B]/[0.04] p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#E8B65B]" />

          <p className="text-xs leading-relaxed text-[#9EA3AE]">
            Điểm dự đoán là mức rating mà mô hình ước tính
            người dùng có thể chấm cho phim. Đây không phải
            điểm rating trung bình MovieLens và không đảm bảo
            người dùng thực tế sẽ đánh giá đúng số sao đó.
            Các đánh giá mới trong giao diện chưa tự động
            được đưa vào mô hình Python.
          </p>
        </div>
      </section>
    </div>
  );
};


