
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
} from "lucide-react";

import type { Movie, UserProfile } from "../../types";
import { cineMatchApi } from "../../services/api";
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

const TOTAL_USERS = 610;

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

function formatStars(value: number): string {
  return Number.isFinite(value)
    ? value.toFixed(1)
    : "--";
}

export const CollaborativeView: React.FC<
  CollaborativeViewProps
> = ({
  currentUser,
  allMovies,
  onSelectMovie,
  bookmarkedMovieIds,
  onToggleBookmark,
}) => {
  // Only the active profile may receive its own recommendations.
  // Never fall back to a different MovieLens user for new accounts.
  const userId = currentUser.userId;
  const hasModelHistory =
    Number.isInteger(userId) && userId >= 1 && userId <= TOTAL_USERS;

  const [topN, setTopN] = useState(10);
  const [refreshKey, setRefreshKey] = useState(0);

  const [recommendations, setRecommendations] = useState<
    CFRecommendation[]
  >([]);

  const [recommendationMovies, setRecommendationMovies] =
    useState<Map<number, Movie>>(new Map());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedForUserId, setLoadedForUserId] = useState<number | null>(null);

  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const movieMap = useMemo(
    () =>
      new Map<number, Movie>(
        allMovies.map((movie) => [movie.movieId, movie])
      ),
    [allMovies]
  );

  // Prevent a previous profile's recommendations from flashing on account switch.
  const visibleRecommendations =
    hasModelHistory && loadedForUserId === userId ? recommendations : [];
  const visibleLoading = hasModelHistory && (loading || loadedForUserId !== userId);

  const featuredMovie = useMemo(() => {
    for (const item of visibleRecommendations) {
      const movie =
        recommendationMovies.get(item.movieId) ??
        movieMap.get(item.movieId);

      if (movie?.posterUrl) return movie;
    }

    return null;
  }, [visibleRecommendations, recommendationMovies, movieMap]);

  const featuredRecommendation = featuredMovie
    ? visibleRecommendations.find(
        (item) => item.movieId === featuredMovie.movieId
      )
    : undefined;

  useEffect(() => {
    let cancelled = false;

    async function loadRecommendations() {
      setLoading(true);
      setError(null);
      setRecommendations([]);
      setRecommendationMovies(new Map());
      setLoadedForUserId(null);

      // A newly registered user must not see the results of MovieLens User 1.
      if (!hasModelHistory) {
        setLoading(false);
        return;
      }

      try {
        const response =
          await cineMatchApi.getUserRecommendations(userId, topN);

        if (cancelled) return;

        const enriched = await enrichRecommendations(
          response.items
        );

        if (!cancelled) {
          setRecommendations(response.items);
          setRecommendationMovies(enriched);
          setLoadedForUserId(userId);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadedForUserId(userId);
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
  }, [userId, hasModelHistory, topN, refreshKey]);

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
              <Sparkles className="h-4 w-4" />
              Lựa chọn dành cho bạn
            </div>

            <h1 className="font-display text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
              Phim dành cho bạn.
              <span className="mt-1 block text-[#E8BF82]">
                Theo đúng gu xem.
              </span>
            </h1>

            <p className="mt-5 max-w-lg text-sm leading-7 text-[#C4B9AB] sm:text-base">
              Những bộ phim phù hợp được gợi ý cho chính bạn,
              dựa trên sở thích và lịch sử đánh giá của tài khoản hiện tại.
            </p>

            <div className="mt-7 flex flex-wrap gap-5 text-xs text-[#BBAE9D]">
              <span className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-[#E8BF82]" />
                Cá nhân hóa theo gu xem
              </span>

              <span className="flex items-center gap-2">
                <Star className="h-4 w-4 text-[#E8BF82]" />
                Điểm sao dành riêng cho bạn
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
                <Sparkles className="h-16 w-16 text-[#D7AA61]/50" />
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1440px] space-y-9 px-5 py-10 sm:px-8 lg:px-12">
        {/* PRIVATE PROFILE STATUS: no account selector or user IDs */}
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#D7AA61]/15 bg-[#151413] px-5 py-5 sm:px-7">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D7AA61]/10 text-[#E8BF82]">
              <Heart className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#F6F0E7]">Gợi ý theo sở thích của bạn</p>
              <p className="mt-1 text-xs leading-5 text-[#AFA497]">
                Riêng cho hồ sơ hiện tại. Không hiển thị đánh giá của người khác.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#D7AA61]/25 bg-[#D7AA61]/[0.07] px-3 py-1.5 text-xs font-medium text-[#E8BF82]">
            <Sparkles className="h-3.5 w-3.5" />
            Đề xuất tự động
          </span>
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
                Dành riêng cho bạn
              </h2>

              <p className="mt-2 text-sm text-[#AFA497]">
                Danh sách phim được dự đoán phù hợp với sở thích của bạn.
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

          {visibleLoading && (
            <div className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-[#151413]">
              <Loader2 className="h-9 w-9 animate-spin text-[#E8BF82]" />
              <p className="text-sm text-[#C4B9AB]">
                Đang tìm những bộ phim hợp gu...
              </p>
            </div>
          )}

          {hasModelHistory && !visibleLoading && error && (
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

          {!hasModelHistory && (
            <div className="rounded-2xl border border-[#D7AA61]/20 bg-[#171411] px-6 py-12 text-center sm:px-10">
              <Heart className="mx-auto h-10 w-10 text-[#E8BF82]" />
              <h3 className="mt-4 font-display text-2xl font-bold">Hãy bắt đầu khám phá gu phim của bạn</h3>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#BDB1A3]">
                Hồ sơ này chưa có lịch sử đánh giá trong mô hình gợi ý theo cộng đồng.
                Bạn vẫn có thể xem phim ở mục Khám phá hoặc dùng gợi ý theo thể loại yêu thích.
              </p>
              <p className="mt-4 text-xs text-[#887E71]">
                CineMatch không sử dụng dữ liệu của tài khoản khác để thay thế cho bạn.
              </p>
            </div>
          )}

          {hasModelHistory && !visibleLoading &&
            !error &&
            visibleRecommendations.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-[#151413] px-6 py-14 text-center">
                <Film className="mx-auto h-10 w-10 text-[#D7AA61]" />
                <p className="mt-4 text-sm text-[#C4B9AB]">
                  Chưa có phim phù hợp ở thời điểm này.
                </p>
              </div>
            )}

          {hasModelHistory && !visibleLoading &&
            !error &&
            visibleRecommendations.length > 0 && (
              <>
                <div className="flex items-center gap-2 text-xs text-[#AFA497]">
                  <Sparkles className="h-4 w-4 text-[#E8BF82]" />
                  Đã tìm thấy {visibleRecommendations.length} phim
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                  {visibleRecommendations.map((item) => {
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
                  ước tính cho tài khoản hiện tại, không phải điểm
                  trung bình của phim.
                </p>
              </>
            )}
        </section>

        {/* HUMAN-FRIENDLY EXPLANATION, WITHOUT IDENTIFYING OTHER USERS */}
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#141312]">
          <button
            type="button"
            onClick={() => setShowHowItWorks((value) => !value)}
            aria-expanded={showHowItWorks}
            className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-white/[0.03] sm:p-6"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D7AA61]/10 text-[#E8BF82]">
                <Heart className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold">Vì sao CineMatch gợi ý những phim này?</span>
                <span className="mt-1 block text-xs text-[#AFA497]">Một cách giải thích ngắn gọn, không hiển thị dữ liệu cá nhân của người khác</span>
              </span>
            </span>
            <ChevronDown className={`h-5 w-5 shrink-0 text-[#D7AA61] transition-transform ${showHowItWorks ? "rotate-180" : ""}`} />
          </button>
          {showHowItWorks && (
            <div className="grid gap-4 border-t border-white/10 p-5 md:grid-cols-3 sm:p-6">
              {[
                {
                  title: "01 · Hiểu sở thích",
                  description: "Phân tích các điểm đánh giá trong lịch sử của chính bạn.",
                },
                {
                  title: "02 · Tìm xu hướng phù hợp",
                  description: "Sử dụng sự tương đồng trong dữ liệu đánh giá để lựa chọn các phim tiềm năng, không công khai hồ sơ khác.",
                },
                {
                  title: "03 · Xếp hạng phim",
                  description: "Ước tính mức độ bạn có thể yêu thích từng phim và sắp xếp danh sách đề xuất.",
                },
              ].map((step) => (
                <div key={step.title} className="rounded-xl bg-[#211D18] p-5">
                  <h3 className="text-sm font-semibold text-[#E8BF82]">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#BDB1A3]">{step.description}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex items-center justify-center gap-2 pb-4 text-center text-xs text-[#786E62]">
          <Heart className="h-3.5 w-3.5" />
          Mỗi gợi ý là một bộ phim mới để bạn khám phá
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </main>
    </div>
  );
};
