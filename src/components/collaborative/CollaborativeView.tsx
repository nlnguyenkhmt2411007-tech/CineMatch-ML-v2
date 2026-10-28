
import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Film,
  Heart,
  Info,
  Loader2,
  RefreshCw,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";

import type { Movie, UserProfile } from "../../types";
import {
  cineMatchApi,
  type EvaluationResponse,
} from "../../services/api";
import { MovieCard } from "../common/MovieCard";

interface CollaborativeViewProps {
  currentUser: UserProfile;
  availableUsers: UserProfile[];
  onSelectUser: (user: UserProfile) => void;
  allMovies: Movie[];
  onSelectMovie: (movie: Movie) => void;
  bookmarkedMovieIds: Set<number>;
  onToggleBookmark: (movieId: number) => void;
}

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

const TOTAL_USERS = 610;
const BEST_K = 20;

const enrichedMovieCache = new Map<number, Movie>();
const pendingMovieRequests = new Map<number, Promise<Movie>>();

async function getEnrichedMovie(movieId: number): Promise<Movie> {
  const cached = enrichedMovieCache.get(movieId);
  if (cached) return cached;

  const pending = pendingMovieRequests.get(movieId);
  if (pending) return pending;

  const request = (async () => {
    const baseUrl =
      import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

    const response = await fetch(
      `${baseUrl}/api/movies/enriched/${movieId}`
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

function formatMetric(value: number | undefined): string {
  return value !== undefined && Number.isFinite(value)
    ? value.toFixed(4)
    : "--";
}

function formatStars(value: number): string {
  return Number.isFinite(value)
    ? value.toFixed(1)
    : "--";
}

export const CollaborativeView: React.FC<
  CollaborativeViewProps
> = ({
  currentUser,
  availableUsers,
  onSelectUser,
  allMovies,
  onSelectMovie,
  bookmarkedMovieIds,
  onToggleBookmark,
}) => {
  const [userId, setUserId] = useState<number>(
    currentUser.userId >= 1 &&
      currentUser.userId <= TOTAL_USERS
      ? currentUser.userId
      : 1
  );

  const [topN, setTopN] = useState(10);
  const [refreshKey, setRefreshKey] = useState(0);

  const [recommendations, setRecommendations] = useState<
    CFRecommendation[]
  >([]);

  const [recommendationMovies, setRecommendationMovies] =
    useState<Map<number, Movie>>(new Map());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [evaluation, setEvaluation] =
    useState<EvaluationResponse | null>(null);

  const [evaluationError, setEvaluationError] =
    useState<string | null>(null);

  const [showMetrics, setShowMetrics] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const [explainOpen, setExplainOpen] = useState(false);
  const [explainMovieId, setExplainMovieId] =
    useState<number | null>(null);

  const [explanation, setExplanation] =
    useState<CFExplanation | null>(null);

  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] =
    useState<string | null>(null);

  const movieMap = useMemo(
    () =>
      new Map<number, Movie>(
        allMovies.map((movie) => [movie.movieId, movie])
      ),
    [allMovies]
  );

  const featuredMovie = useMemo(() => {
    for (const item of recommendations) {
      const movie =
        recommendationMovies.get(item.movieId) ??
        movieMap.get(item.movieId);

      if (movie?.posterUrl) return movie;
    }

    return null;
  }, [recommendations, recommendationMovies, movieMap]);

  const featuredRecommendation = featuredMovie
    ? recommendations.find(
        (item) => item.movieId === featuredMovie.movieId
      )
    : undefined;

  const cfRanking = evaluation?.ranking.find(
    (item) => item.model === "User-Based CF"
  );

  const cfRating = evaluation?.rating_prediction.find(
    (item) => item.model === "User-Based CF"
  );

  useEffect(() => {
    let cancelled = false;

    async function loadRecommendations() {
      setLoading(true);
      setError(null);
      setRecommendations([]);
      setRecommendationMovies(new Map());

      try {
        const response =
          await cineMatchApi.getUserRecommendations(userId, topN);

        if (cancelled) return;

        setRecommendations(response.items);

        const enriched = await enrichRecommendations(
          response.items
        );

        if (!cancelled) {
          setRecommendationMovies(enriched);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Không thể tải gợi ý phim."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadRecommendations();

    return () => {
      cancelled = true;
    };
  }, [userId, topN, refreshKey]);

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
              : "Không tải được chỉ số đánh giá."
          );
        }
      }
    }

    if (showMetrics) void loadEvaluation();

    return () => {
      cancelled = true;
    };
  }, [showMetrics, refreshKey]);

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
        const baseUrl =
          import.meta.env.VITE_API_URL ||
          "http://127.0.0.1:8000";

        const response = await fetch(
          `${baseUrl}/api/recommend/user/${userId}/explain/${explainMovieId}`
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as CFExplanation;

        if (!cancelled) setExplanation(data);
      } catch (err) {
        if (!cancelled) {
          setExplainError(
            err instanceof Error
              ? err.message
              : "Không tải được lời giải thích."
          );
        }
      } finally {
        if (!cancelled) setExplainLoading(false);
      }
    }

    void loadExplanation();

    return () => {
      cancelled = true;
    };
  }, [userId, explainMovieId, explainOpen]);

  const handleChangeUser = (nextUserId: number) => {
    if (
      !Number.isInteger(nextUserId) ||
      nextUserId < 1 ||
      nextUserId > TOTAL_USERS
    ) {
      return;
    }

    setUserId(nextUserId);
    setExplainOpen(false);
    setExplainMovieId(null);

    const matched = availableUsers.find(
      (user) => user.userId === nextUserId
    );

    if (matched) onSelectUser(matched);
  };

  const toggleExplanation = () => {
    if (!explainOpen && recommendations.length > 0) {
      setExplainMovieId(recommendations[0].movieId);
    }

    setExplainOpen((value) => !value);
  };

  return (
    <div className="min-h-screen bg-[#090909] text-[#F6F0E7]">
      {/* HERO */}
      <section className="relative isolate overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 -z-20">
          {featuredMovie?.backdropUrl ||
          featuredMovie?.posterUrl ? (
            <img
              src={
                featuredMovie.backdropUrl ||
                featuredMovie.posterUrl
              }
              alt=""
              className="h-full w-full scale-105 object-cover opacity-25 blur-[5px]"
            />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(ellipse_at_75%_30%,#49321C_0%,#15110D_45%,#090909_80%)]" />
          )}
        </div>

        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#090909] via-[#090909]/85 to-[#090909]/45" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#090909] via-transparent to-[#090909]/30" />

        <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1fr_340px] lg:px-12 lg:py-16">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#DDB878]/30 bg-black/35 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E8C58C]">
              <Users className="h-4 w-4" />
              Khám phá cùng cộng đồng
            </div>

            <h1 className="font-display text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
              Người cùng gu.
              <span className="mt-1 block text-[#E8BF82]">
                Phim cùng thích.
              </span>
            </h1>

            <p className="mt-5 max-w-lg text-sm leading-7 text-[#C4B9AB] sm:text-base">
              Khám phá những bộ phim được đề xuất dựa trên
              sở thích của những người xem có gu tương đồng.
            </p>

            <div className="mt-7 flex flex-wrap gap-5 text-xs text-[#BBAE9D]">
              <span className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-[#E8BF82]" />
                Gợi ý theo cộng đồng
              </span>

              <span className="flex items-center gap-2">
                <Star className="h-4 w-4 text-[#E8BF82]" />
                Dự đoán điểm yêu thích
              </span>
            </div>
          </div>

          <div className="relative hidden justify-center lg:flex">
            <div className="absolute h-64 w-64 rounded-full bg-[#D7AA61]/10 blur-[75px]" />

            {featuredMovie?.posterUrl ? (
              <button
                type="button"
                onClick={() => onSelectMovie(featuredMovie)}
                className="group relative w-48 rotate-3 overflow-hidden rounded-2xl border border-[#D7AA61]/30 shadow-[0_25px_80px_rgba(0,0,0,0.7)] transition duration-500 hover:rotate-0 hover:scale-105"
              >
                <img
                  src={featuredMovie.posterUrl}
                  alt={featuredMovie.title}
                  className="aspect-[2/3] w-full object-cover"
                />

                {featuredRecommendation && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent px-4 pb-4 pt-12">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-[#E8BF82]">
                      <Star className="h-4 w-4 fill-current" />
                      {formatStars(
                        featuredRecommendation.predicted_rating
                      )}
                      / 5 dự đoán
                    </span>
                  </div>
                )}
              </button>
            ) : (
              <div className="relative flex h-64 w-48 rotate-3 items-center justify-center rounded-2xl border border-[#D7AA61]/25 bg-[#211A12]">
                <Users className="h-16 w-16 text-[#D7AA61]/50" />
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1440px] space-y-9 px-5 py-10 sm:px-8 lg:px-12">
        {/* SELECT PROFILE */}
        <section className="rounded-2xl border border-white/10 bg-[#151413] p-5 sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <div className="mb-3 flex items-center gap-2 text-[#E8BF82]">
                <Users className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Bắt đầu khám phá
                </span>
              </div>

              <h2 className="font-display text-2xl font-bold">
                Chọn một hồ sơ xem phim
              </h2>

              <p className="mt-3 text-sm leading-6 text-[#AFA497]">
                Mỗi hồ sơ có lịch sử xem và đánh giá khác nhau.
                Hãy thử đổi hồ sơ để khám phá những danh sách
                phim khác nhau.
              </p>
            </div>

            <div className="w-full lg:w-72">
              <label
                htmlFor="collaborative-user-id"
                className="mb-2 block text-xs font-medium text-[#C8BBA9]"
              >
                Hồ sơ đang chọn
              </label>

              <div className="relative">
                <select
                  id="collaborative-user-id"
                  value={userId}
                  onChange={(event) =>
                    handleChangeUser(Number(event.target.value))
                  }
                  className="w-full appearance-none rounded-xl border border-[#D7AA61]/30 bg-[#24201B] px-4 py-3.5 pr-10 text-sm font-semibold text-[#F6F0E7] outline-none transition focus:border-[#E8BF82]"
                >
                  {Array.from(
                    { length: TOTAL_USERS },
                    (_, index) => index + 1
                  ).map((id) => (
                    <option key={id} value={id}>
                      Hồ sơ #{id}
                    </option>
                  ))}
                </select>

                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#E8BF82]" />
              </div>

              <p className="mt-2 text-xs text-[#887E71]">
                Dữ liệu mẫu MovieLens · 610 hồ sơ
              </p>
            </div>
          </div>
        </section>

        {/* RESULTS */}
        <section className="space-y-6">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[#E8BF82]">
                <Sparkles className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-[0.15em]">
                  CineMatch Picks
                </span>
              </div>

              <h2 className="font-display text-2xl font-bold sm:text-3xl">
                Có thể bạn sẽ thích
              </h2>

              <p className="mt-2 text-sm text-[#AFA497]">
                Những bộ phim được gợi ý cho hồ sơ #{userId}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label
                htmlFor="collaborative-topn"
                className="text-xs text-[#AFA497]"
              >
                Hiển thị
              </label>

              <select
                id="collaborative-topn"
                value={topN}
                onChange={(event) =>
                  setTopN(Number(event.target.value))
                }
                className="rounded-lg border border-white/15 bg-[#1C1A18] px-3 py-2.5 text-sm text-[#F6F0E7] outline-none focus:border-[#D7AA61]"
              >
                {[4, 6, 10, 20].map((value) => (
                  <option key={value} value={value}>
                    {value} phim
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() =>
                  setRefreshKey((value) => value + 1)
                }
                className="inline-flex items-center gap-2 rounded-lg border border-[#D7AA61]/30 bg-[#D7AA61]/10 px-4 py-2.5 text-xs font-semibold text-[#E8BF82] transition hover:bg-[#D7AA61]/20"
              >
                <RefreshCw className="h-4 w-4" />
                Làm mới
              </button>
            </div>
          </div>

          {loading && (
            <div className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-[#151413]">
              <Loader2 className="h-9 w-9 animate-spin text-[#E8BF82]" />
              <p className="text-sm text-[#C4B9AB]">
                Đang tìm những bộ phim hợp gu...
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-950/15 px-6 py-10 text-center">
              <Info className="mx-auto h-8 w-8 text-red-300" />

              <h3 className="mt-4 font-semibold">
                Chưa thể tải gợi ý phim
              </h3>

              <p className="mt-2 text-sm text-[#C4B9AB]">
                Kiểm tra kết nối với máy chủ và thử lại.
              </p>

              <p className="mt-3 break-words text-xs text-red-300/70">
                {error}
              </p>

              <button
                type="button"
                onClick={() =>
                  setRefreshKey((value) => value + 1)
                }
                className="mt-5 rounded-lg bg-[#E8BF82] px-5 py-2.5 text-sm font-semibold text-[#17110A]"
              >
                Thử lại
              </button>
            </div>
          )}

          {!loading &&
            !error &&
            recommendations.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-[#151413] px-6 py-14 text-center">
                <Film className="mx-auto h-10 w-10 text-[#D7AA61]" />
                <p className="mt-4 text-sm text-[#C4B9AB]">
                  Chưa có phim gợi ý cho hồ sơ này.
                </p>
              </div>
            )}

          {!loading &&
            !error &&
            recommendations.length > 0 && (
              <>
                <div className="flex items-center gap-2 text-xs text-[#AFA497]">
                  <Sparkles className="h-4 w-4 text-[#E8BF82]" />
                  Đã tìm thấy {recommendations.length} phim
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                  {recommendations.map((item) => {
                    const movie =
                      recommendationMovies.get(item.movieId) ??
                      movieMap.get(item.movieId);

                    if (!movie) {
                      return (
                        <div
                          key={item.movieId}
                          className="overflow-hidden rounded-xl bg-[#191715]"
                        >
                          <div className="flex aspect-[2/3] items-center justify-center bg-[#28221C]">
                            <Film className="h-10 w-10 text-[#D7AA61]/50" />
                          </div>

                          <div className="p-3">
                            <p className="line-clamp-2 text-sm font-semibold">
                              {item.title}
                            </p>

                            <p className="mt-2 flex items-center gap-1 text-xs text-[#E8BF82]">
                              <Star className="h-3.5 w-3.5 fill-current" />
                              {formatStars(item.predicted_rating)}
                              / 5 dự đoán
                            </p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={item.movieId}
                        className="transition-transform duration-300 hover:-translate-y-1"
                      >
                        <MovieCard
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
                      </div>
                    );
                  })}
                </div>

                <p className="flex items-start gap-2 text-xs leading-6 text-[#887E71]">
                  <Info className="mt-1 h-3.5 w-3.5 shrink-0" />
                  Điểm sao dự đoán là mức đánh giá mà mô hình
                  ước tính cho hồ sơ đã chọn, không phải điểm
                  trung bình của phim.
                </p>
              </>
            )}
        </section>

        {/* HOW IT WORKS */}
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#141312]">
          <button
            type="button"
            onClick={() =>
              setShowHowItWorks((value) => !value)
            }
            aria-expanded={showHowItWorks}
            className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-white/[0.03] sm:p-6"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D7AA61]/10 text-[#E8BF82]">
                <Heart className="h-5 w-5" />
              </span>

              <span>
                <span className="block text-sm font-semibold">
                  Vì sao CineMatch gợi ý những phim này?
                </span>

                <span className="mt-1 block text-xs text-[#AFA497]">
                  Tìm hiểu cách gợi ý theo người cùng gu
                </span>
              </span>
            </span>

            <ChevronDown
              className={`h-5 w-5 shrink-0 text-[#D7AA61] transition-transform ${
                showHowItWorks ? "rotate-180" : ""
              }`}
            />
          </button>

          {showHowItWorks && (
            <div className="space-y-5 border-t border-white/10 p-5 sm:p-6">
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    title: "01 · Tìm người cùng gu",
                    description:
                      "So sánh lịch sử đánh giá để tìm những người có sở thích xem phim tương đồng.",
                  },
                  {
                    title: "02 · Khám phá phim họ thích",
                    description:
                      "Tham khảo đánh giá từ tối đa 20 người dùng tương tự có đánh giá phim.",
                  },
                  {
                    title: "03 · Dự đoán điểm sao",
                    description:
                      "Tổng hợp đánh giá có trọng số để dự đoán mức yêu thích cho từng phim.",
                  },
                ].map((step) => (
                  <div
                    key={step.title}
                    className="rounded-xl bg-[#211D18] p-5"
                  >
                    <h3 className="text-sm font-semibold text-[#E8BF82]">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-[#BDB1A3]">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>

              <p className="text-xs leading-6 text-[#887E71]">
                Mô hình User-Based Collaborative Filtering sử dụng
                Mean-Centering, Cosine Similarity và K-Nearest
                Neighbors (K = {BEST_K}). Các đánh giá mới trên
                giao diện chưa tự động cập nhật mô hình Python.
              </p>
            </div>
          )}
        </section>

        {/* EXPLANATION FROM REAL API */}
        {!loading &&
          !error &&
          recommendations.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#141312]">
              <button
                type="button"
                onClick={toggleExplanation}
                aria-expanded={explainOpen}
                className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-white/[0.03] sm:p-6"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D7AA61]/10 text-[#E8BF82]">
                    <Users className="h-5 w-5" />
                  </span>

                  <span>
                    <span className="block text-sm font-semibold">
                      Khám phá bằng chứng gợi ý
                    </span>
                    <span className="mt-1 block text-xs text-[#AFA497]">
                      Xem người cùng gu đã đóng góp thế nào
                      vào điểm dự đoán
                    </span>
                  </span>
                </span>

                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-[#D7AA61] transition-transform ${
                    explainOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {explainOpen && (
                <div className="space-y-5 border-t border-white/10 p-5 sm:p-6">
                  <label className="block max-w-xl space-y-2">
                    <span className="text-xs text-[#C8BBA9]">
                      Chọn phim muốn tìm hiểu
                    </span>

                    <select
                      value={
                        explainMovieId ??
                        recommendations[0].movieId
                      }
                      onChange={(event) =>
                        setExplainMovieId(
                          Number(event.target.value)
                        )
                      }
                      className="w-full rounded-xl border border-white/15 bg-[#24201B] p-3 text-sm text-[#F6F0E7] outline-none focus:border-[#E8BF82]"
                    >
                      {recommendations.map((item) => (
                        <option
                          key={item.movieId}
                          value={item.movieId}
                        >
                          {item.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  {explainLoading && (
                    <div className="flex items-center gap-3 text-sm text-[#C4B9AB]">
                      <Loader2 className="h-5 w-5 animate-spin text-[#E8BF82]" />
                      Đang tải bằng chứng từ mô hình...
                    </div>
                  )}

                  {explainError && (
                    <p className="text-sm text-red-300">
                      {explainError}
                    </p>
                  )}

                  {!explainLoading && explanation && (
                    <>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        {[
                          {
                            label: "Hồ sơ",
                            value: `#${explanation.userId}`,
                          },
                          {
                            label: "Điểm nền",
                            value: formatMetric(
                              explanation.baseline
                            ),
                          },
                          {
                            label: "Người tham gia",
                            value: `${explanation.neighborCount}/${explanation.k}`,
                          },
                          {
                            label: "Điểm dự đoán",
                            value: `${formatStars(
                              explanation.predictedRating
                            )} / 5`,
                          },
                        ].map((metric) => (
                          <div
                            key={metric.label}
                            className="rounded-xl bg-[#211D18] p-4"
                          >
                            <p className="text-xs text-[#AFA497]">
                              {metric.label}
                            </p>
                            <p className="mt-2 text-lg font-bold text-[#E8BF82]">
                              {metric.value}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-white/10">
                        <table className="w-full min-w-[600px] text-left text-xs">
                          <thead className="bg-[#24201B] text-[#E8BF82]">
                            <tr>
                              <th className="p-3">Hồ sơ</th>
                              <th className="p-3">Tương đồng</th>
                              <th className="p-3">Điểm đã chấm</th>
                              <th className="p-3">Điểm TB</th>
                              <th className="p-3">Đóng góp</th>
                            </tr>
                          </thead>

                          <tbody>
                            {explanation.neighbors.map(
                              (neighbor) => (
                                <tr
                                  key={neighbor.userId}
                                  className="border-t border-white/[0.06] text-[#D6CBBE]"
                                >
                                  <td className="p-3">
                                    #{neighbor.userId}
                                  </td>
                                  <td className="p-3">
                                    {formatMetric(
                                      neighbor.similarity
                                    )}
                                  </td>
                                  <td className="p-3">
                                    {neighbor.rating.toFixed(1)}
                                  </td>
                                  <td className="p-3">
                                    {formatMetric(
                                      neighbor.userMean
                                    )}
                                  </td>
                                  <td className="p-3">
                                    {neighbor.weightedContribution.toFixed(
                                      6
                                    )}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>

                      <p className="text-xs leading-6 text-[#AFA497]">
                        Dự đoán ={" "}
                        {explanation.baseline.toFixed(4)} + (
                        {explanation.numerator.toFixed(6)} /{" "}
                        {explanation.denominator.toFixed(6)}).
                        Kết quả được giới hạn trong thang
                        0.5–5 sao. Đây là dữ liệu trả về từ
                        API giải thích của mô hình Python.
                      </p>
                    </>
                  )}
                </div>
              )}
            </section>
          )}

        {/* EVALUATION METRICS */}
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#141312]">
          <button
            type="button"
            onClick={() =>
              setShowMetrics((value) => !value)
            }
            aria-expanded={showMetrics}
            className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-white/[0.03] sm:p-6"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D7AA61]/10 text-[#E8BF82]">
                <TrendingUp className="h-5 w-5" />
              </span>

              <span>
                <span className="block text-sm font-semibold">
                  Chất lượng mô hình
                </span>

                <span className="mt-1 block text-xs text-[#AFA497]">
                  Dành cho người muốn xem các chỉ số đánh giá
                </span>
              </span>
            </span>

            <ChevronDown
              className={`h-5 w-5 shrink-0 text-[#D7AA61] transition-transform ${
                showMetrics ? "rotate-180" : ""
              }`}
            />
          </button>

          {showMetrics && (
            <div className="space-y-5 border-t border-white/10 p-5 sm:p-6">
              {evaluationError && (
                <p className="text-sm text-amber-300">
                  Chưa tải được chỉ số: {evaluationError}
                </p>
              )}

              {!evaluation && !evaluationError && (
                <div className="flex items-center gap-2 text-sm text-[#AFA497]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#E8BF82]" />
                  Đang tải kết quả đánh giá...
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  {
                    label: "Precision@10",
                    value: formatMetric(
                      cfRanking?.precision_at_10
                    ),
                    description: "Độ chính xác Top-10",
                  },
                  {
                    label: "Recall@10",
                    value: formatMetric(
                      cfRanking?.recall_at_10
                    ),
                    description: "Khả năng tìm phim phù hợp",
                  },
                  {
                    label: "MAE",
                    value: formatMetric(cfRating?.mae),
                    description: "Sai số tuyệt đối TB",
                  },
                  {
                    label: "RMSE",
                    value: formatMetric(cfRating?.rmse),
                    description: "Sai số bình phương TB",
                  },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-xl bg-[#211D18] p-4"
                  >
                    <p className="text-xs text-[#AFA497]">
                      {metric.label}
                    </p>

                    <p className="mt-2 text-2xl font-bold text-[#E8BF82]">
                      {metric.value}
                    </p>

                    <p className="mt-2 text-xs text-[#887E71]">
                      {metric.description}
                    </p>
                  </div>
                ))}
              </div>

              <p className="text-xs leading-6 text-[#887E71]">
                Precision@10 và Recall@10 đánh giá chất lượng
                xếp hạng trên tập ứng viên lấy mẫu. MAE và
                RMSE đánh giá sai số dự đoán điểm trên tập
                Test. Các chỉ số lấy từ API đánh giá của dự án,
                không phải số liệu giả lập trên giao diện.
              </p>
            </div>
          )}
        </section>

        <div className="flex items-center justify-center gap-2 pb-4 text-xs text-[#786E62]">
          <Heart className="h-3.5 w-3.5" />
          Khám phá phim mới theo gu của những người xem tương tự
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </main>
    </div>
  );
};
