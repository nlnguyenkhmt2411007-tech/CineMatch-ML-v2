import { useEffect, useMemo, useState } from "react";

import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Clapperboard,
  Database,
  Film,
  Play,
  Sparkles,
  Star,
  Users,
} from "lucide-react";

import type { Movie, UserProfile } from "../../types";
import type { NavTab } from "../layout/Navbar";

import { cineMatchApi } from "../../services/api";
import { MovieCard } from "../common/MovieCard";

interface HomeViewProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
  allMovies: Movie[];
  onSelectMovie: (movie: Movie) => void;
  onNavigateTab: (tab: NavTab) => void;
  onOpenFastApiModal: () => void;
  bookmarkedMovieIds: Set<number>;
  onToggleBookmark: (movieId: number) => void;
}

interface ApiRecommendation {
  movieId: number;
}

const panelClass =
  "rounded-2xl border border-cyan-400/15 bg-[#0C1725]/85 shadow-[0_15px_50px_rgba(0,0,0,0.18)]";

export function HomeView({
  currentUser,
  allMovies,
  onSelectMovie,
  onNavigateTab,
  bookmarkedMovieIds,
  onToggleBookmark,
}: HomeViewProps) {
  const [contentIds, setContentIds] = useState<number[]>([]);
  const [cfIds, setCfIds] = useState<number[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);

  const validMovieLensUser =
    Number.isInteger(currentUser.userId) &&
    currentUser.userId >= 1 &&
    currentUser.userId <= 610;

  const movieMap = useMemo(
    () =>
      new Map<number, Movie>(
        allMovies.map((movie) => [movie.movieId, movie])
      ),
    [allMovies]
  );

  const featuredMovie = useMemo(
    () =>
      movieMap.get(79132) ||
      allMovies.find((movie) => Boolean(movie.posterUrl)) ||
      allMovies[0],
    [allMovies, movieMap]
  );

  const featuredCollection = useMemo(() => {
    const preferredIds = [
      79132, 109487, 58559, 318, 296, 2571,
      260, 356, 2959, 4993, 527, 50,
    ];

    const selected = preferredIds
      .map((id) => movieMap.get(id))
      .filter((movie): movie is Movie => Boolean(movie));

    return selected.length > 0
      ? selected
      : allMovies.slice(0, 12);
  }, [allMovies, movieMap]);

  const popularMovies = useMemo(() => {
    return [...allMovies]
      .filter(
        (movie) =>
          movie.ratingsCount >= 20 &&
          Number.isFinite(movie.avgRating)
      )
      .map((movie) => ({
        movie,
        score:
          (movie.ratingsCount * movie.avgRating + 50 * 3.5) /
          (movie.ratingsCount + 50),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((item) => item.movie);
  }, [allMovies]);

  const mainCollection =
    featuredCollection.length > 0
      ? featuredCollection
      : popularMovies;

  useEffect(() => {
    let cancelled = false;

    setContentIds([]);
    setCfIds([]);

    if (!validMovieLensUser) {
      setRecsLoading(false);
      return;
    }

    async function loadRecommendations() {
      setRecsLoading(true);

      try {
        const results = await Promise.allSettled([
          cineMatchApi.getContentUserRecommendations(
            currentUser.userId,
            12
          ),
          cineMatchApi.getUserRecommendations(
            currentUser.userId,
            12
          ),
        ]);

        if (cancelled) return;

        const [contentResult, cfResult] = results;

        if (contentResult.status === "fulfilled") {
          setContentIds(
            contentResult.value.items.map(
              (item: ApiRecommendation) => item.movieId
            )
          );
        }

        if (cfResult.status === "fulfilled") {
          setCfIds(
            cfResult.value.items.map(
              (item: ApiRecommendation) => item.movieId
            )
          );
        }
      } catch (error) {
        console.error("Không thể tải gợi ý:", error);
      } finally {
        if (!cancelled) setRecsLoading(false);
      }
    }

    void loadRecommendations();

    return () => {
      cancelled = true;
    };
  }, [currentUser.userId, validMovieLensUser]);

  const contentMovies = contentIds
    .map((id) => movieMap.get(id))
    .filter((movie): movie is Movie => Boolean(movie));

  const cfMovies = cfIds
    .map((id) => movieMap.get(id))
    .filter((movie): movie is Movie => Boolean(movie));

  const renderMovieCards = (movies: Movie[]) => (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {movies.slice(0, 6).map((movie) => (
        <MovieCard
          key={movie.movieId}
          movie={movie}
          onClick={() => onSelectMovie(movie)}
          isBookmarked={bookmarkedMovieIds.has(movie.movieId)}
          onToggleBookmark={(event) => {
            event.stopPropagation();
            onToggleBookmark(movie.movieId);
          }}
          userRating={currentUser.ratings[movie.movieId]}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen overflow-hidden bg-[#050A13] pb-20 text-white">

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-cyan-400/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_30%,rgba(6,182,212,0.16),transparent_55%),linear-gradient(120deg,#050A13,#0D1930)]" />

        {featuredMovie?.backdropUrl && (
          <img
            src={featuredMovie.backdropUrl}
            alt=""
            loading="eager"
            className="absolute inset-0 h-full w-full object-cover opacity-20"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-r from-[#050A13] via-[#050A13]/90 to-[#050A13]/40" />

        <div className="relative mx-auto grid max-w-[1440px] items-center gap-10 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">

          {/* HERO CONTENT */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-cyan-300">
              <Sparkles className="h-4 w-4" />
              CineMatch ML
            </div>

            <h1 className="max-w-2xl font-display text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl xl:text-[56px]">
              Tìm bộ phim tiếp theo
              <span className="mt-2 block bg-gradient-to-r from-[#FFE0A0] to-[#F3B35A] bg-clip-text text-transparent">
                dành cho bạn
              </span>
            </h1>

            <p className="max-w-xl text-sm leading-8 text-slate-300 sm:text-base">
              Khám phá hàng nghìn bộ phim và trải nghiệm
              hệ thống gợi ý sử dụng hai thuật toán
              Machine Learning trên dữ liệu MovieLens.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onNavigateTab("explore")}
                className="inline-flex items-center gap-2 rounded-xl bg-[#F5BD66] px-6 py-3.5 text-sm font-bold text-[#08111E] transition hover:bg-[#FFD08A]"
              >
                Khám phá phim
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab("content-based")}
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <Play className="h-4 w-4 text-cyan-300" />
                Trải nghiệm gợi ý
              </button>
            </div>

            <p className="flex items-center gap-2 text-xs text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              MovieLens · FastAPI · TMDb
            </p>
          </div>

          {/* FEATURED MOVIE */}
          {featuredMovie && (
            <div className={`${panelClass} mx-auto w-full max-w-[500px] p-5 sm:p-6`}>
              <div className="mb-5 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#F5BD66]">
                  <Star className="h-4 w-4 fill-current" />
                  Phim nổi bật
                </span>

                <span className="text-[10px] text-slate-500">
                  MovieLens #{featuredMovie.movieId}
                </span>
              </div>

              <div className="flex gap-5">
                <div className="flex aspect-[2/3] w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#18253A] sm:w-36">
                  {featuredMovie.posterUrl ? (
                    <img
                      src={featuredMovie.posterUrl}
                      alt={featuredMovie.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Clapperboard className="h-10 w-10 text-cyan-300" />
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
                    Featured Movie
                  </span>

                  <h2 className="text-xl font-bold sm:text-2xl">
                    {featuredMovie.title}
                  </h2>

                  <p className="text-xs leading-6 text-slate-400">
                    {featuredMovie.year || "Chưa rõ năm"}
                    {" · "}
                    {featuredMovie.genres.slice(0, 3).join(", ")}
                  </p>

                  <p className="flex items-center gap-2 text-sm text-[#F5BD66]">
                    <Star className="h-4 w-4 fill-current" />
                    <span className="font-bold">
                      {featuredMovie.ratingsCount > 0
                        ? featuredMovie.avgRating.toFixed(1)
                        : "--"}
                    </span>
                    <span className="text-xs text-slate-400">
                      ({featuredMovie.ratingsCount} đánh giá)
                    </span>
                  </p>
                </div>
              </div>

              <p className="mt-5 line-clamp-2 text-xs leading-6 text-slate-400">
                {featuredMovie.synopsis?.trim() ||
                  "Khám phá thông tin chi tiết về bộ phim nổi bật."}
              </p>

              <button
                type="button"
                onClick={() => onSelectMovie(featuredMovie)}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/20"
              >
                Xem chi tiết phim
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* DATASET STATISTICS */}
      <section className="mx-auto max-w-[1440px] px-6 pt-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: "Bộ phim", value: "9.742", icon: Film },
            { label: "Người dùng", value: "610", icon: Users },
            { label: "Lượt đánh giá", value: "100.836", icon: Star },
          ].map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className={`${panelClass} flex items-center gap-4 p-5`}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                  <Icon className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-xs text-slate-400">{stat.label}</p>
                  <p className="mt-1 text-2xl font-extrabold">
                    {stat.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mx-auto mt-14 max-w-[1440px] space-y-16 px-6">

        {/* GET STARTED */}
        <section className="space-y-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-300">
              Getting Started
            </span>

            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              Bạn muốn làm gì hôm nay?
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Chọn một cách bắt đầu phù hợp với bạn.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <button
              type="button"
              onClick={() => onNavigateTab("explore")}
              className={`${panelClass} group p-6 text-left transition hover:border-cyan-300/40 hover:bg-[#102237]`}
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                <Clapperboard className="h-6 w-6" />
              </div>

              <h3 className="text-lg font-bold">Khám phá phim</h3>

              <p className="mt-3 text-sm leading-7 text-slate-400">
                Tìm kiếm phim, xem poster, thể loại,
                điểm đánh giá và thông tin chi tiết.
              </p>

              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#F5BD66]">
                Mở thư viện phim
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab("content-based")}
              className={`${panelClass} group p-6 text-left transition hover:border-cyan-300/40 hover:bg-[#102237]`}
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                <BrainCircuit className="h-6 w-6" />
              </div>

              <h3 className="text-lg font-bold">Trải nghiệm gợi ý phim</h3>

              <p className="mt-3 text-sm leading-7 text-slate-400">
                Thử hai phương pháp gợi ý:
                Content-Based và User-Based Collaborative Filtering.
              </p>

              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#F5BD66]">
                Xem hệ thống gợi ý
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          </div>
        </section>

        {/* USER GUIDANCE */}
        {!validMovieLensUser && (
          <section className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-6">
            <div className="flex items-start gap-4">
              <Users className="mt-1 h-6 w-6 shrink-0 text-[#F5BD66]" />

              <div>
                <h3 className="text-lg font-bold text-white">
                  Bạn đang sử dụng tài khoản demo
                </h3>

                <p className="mt-2 text-sm leading-7 text-slate-300">
                  User #{currentUser.userId} không thuộc 610
                  người dùng trong tập MovieLens.
                  Để thử kết quả gợi ý từ mô hình đã xây dựng,
                  hãy chọn một User ID từ 1 đến 610
                  trong danh sách người dùng được hỗ trợ.
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  Việc đánh giá phim trên giao diện chưa được xác nhận
                  là sẽ cập nhật trực tiếp mô hình ở backend.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* FEATURED COLLECTION */}
        <section className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-cyan-300">
                Movie Collection
              </span>

              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                Phim <span className="text-[#F5BD66]">nổi bật</span>
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Những bộ phim được tuyển chọn từ thư viện CineMatch.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab("explore")}
              className="flex items-center gap-2 text-sm font-semibold text-[#F5BD66]"
            >
              Xem tất cả
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {renderMovieCards(mainCollection)}
        </section>

        {/* CONTENT-BASED RECOMMENDATIONS */}
        {validMovieLensUser && (
          <section className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-cyan-300">
                  Content-Based Filtering
                </span>

                <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                  Gợi ý theo sở thích
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  Kết quả dành cho MovieLens User #{currentUser.userId},
                  dựa trên hồ sơ thể loại.
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab("content-based")}
                className="flex items-center gap-2 text-sm font-semibold text-[#F5BD66]"
              >
                Xem đầy đủ
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {contentMovies.length > 0 ? (
              renderMovieCards(contentMovies)
            ) : (
              <div className={`${panelClass} p-6 text-sm text-slate-400`}>
                {recsLoading
                  ? "Đang tải kết quả gợi ý..."
                  : "Chưa có phim gợi ý để hiển thị trên trang chủ. Hãy mở trang Content-Based để kiểm tra kết quả."}
              </div>
            )}
          </section>
        )}

        {/* USER-BASED CF RECOMMENDATIONS */}
        {validMovieLensUser && (
          <section className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-cyan-300">
                  User-Based CF · K = 20
                </span>

                <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                  Người giống bạn cũng thích
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  Gợi ý dựa trên lịch sử đánh giá
                  của những người dùng tương đồng.
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab("collaborative")}
                className="flex items-center gap-2 text-sm font-semibold text-[#F5BD66]"
              >
                Xem đầy đủ
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {cfMovies.length > 0 ? (
              renderMovieCards(cfMovies)
            ) : (
              <div className={`${panelClass} p-6 text-sm text-slate-400`}>
                {recsLoading
                  ? "Đang tải kết quả gợi ý..."
                  : "Chưa có phim gợi ý để hiển thị trên trang chủ. Hãy mở trang User-Based CF để kiểm tra kết quả."}
              </div>
            )}
          </section>
        )}

        {/* ML LAB */}
        <section className={`${panelClass} p-6 sm:p-9`}>
          <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-cyan-300">
                <BarChart3 className="h-4 w-4" />
                Machine Learning Lab
              </span>

              <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
                Công nghệ phía sau mỗi gợi ý
              </h2>

              <p className="mt-3 text-sm leading-7 text-slate-400">
                Tìm hiểu hai thuật toán gợi ý phim,
                dữ liệu MovieLens và các kết quả đánh giá
                Precision@10, Recall@10, MAE và RMSE.
              </p>

              <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <Database className="h-4 w-4 text-cyan-300" />
                MovieLens Latest Small
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab("dashboard")}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-6 py-3.5 text-sm font-bold text-cyan-100 hover:bg-cyan-300/20"
            >
              Mở ML Lab
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}