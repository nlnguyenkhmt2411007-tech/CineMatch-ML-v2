
import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  ChevronDown,
  Clapperboard,
  Film,
  Heart,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Users,
  WandSparkles,
} from "lucide-react";

import type { Movie, UserProfile } from "../../types";
import { cineMatchApi } from "../../services/api";
import { MovieCard } from "../common/MovieCard";

interface ContentBasedViewProps {
  currentUser: UserProfile;
  availableUsers: UserProfile[];
  onSelectUser: (user: UserProfile) => void;
  allMovies: Movie[];
  onSelectMovie: (movie: Movie) => void;
  bookmarkedMovieIds: Set<number>;
  onToggleBookmark: (movieId: number) => void;
}

interface RecommendationItem {
  movieId: number;
  title: string;
  similarity: number;
}

type DiscoverMode = "profile" | "movie";

const MAX_USER_ID = 610;

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
      throw new Error(`Cannot load movie ${movieId}`);
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
  items: RecommendationItem[]
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

function getPoster(movie: Movie | null): string {
  if (!movie) return "";

  const poster = movie.posterUrl || "";

  return poster.startsWith("https://image.tmdb.org/t/p/")
    ? poster
    : "";
}

export const ContentBasedView: React.FC<
  ContentBasedViewProps
> = ({
  currentUser,
  availableUsers,
  onSelectUser,
  allMovies,
  onSelectMovie,
  bookmarkedMovieIds,
  onToggleBookmark,
}) => {
  const [mode, setMode] = useState<DiscoverMode>("profile");

  const [userId, setUserId] = useState<number>(
    currentUser.userId >= 1 &&
      currentUser.userId <= MAX_USER_ID
      ? currentUser.userId
      : 1
  );

  const [topN, setTopN] = useState<number>(10);

  const [recommendations, setRecommendations] = useState<
    RecommendationItem[]
  >([]);

  const [recommendationMovies, setRecommendationMovies] =
    useState<Map<number, Movie>>(new Map());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedMovieId, setSelectedMovieId] =
    useState<number>(1);

  const [movieSearch, setMovieSearch] = useState("");
  const [showMovieOptions, setShowMovieOptions] =
    useState(false);

  const [similarMovies, setSimilarMovies] = useState<
    RecommendationItem[]
  >([]);

  const [similarMovieDetails, setSimilarMovieDetails] =
    useState<Map<number, Movie>>(new Map());

  const [similarLoading, setSimilarLoading] = useState(false);
  const [similarError, setSimilarError] =
    useState<string | null>(null);

  const [showExplanation, setShowExplanation] =
    useState(false);

  const movieMap = useMemo(() => {
    return new Map(
      allMovies.map((movie) => [movie.movieId, movie])
    );
  }, [allMovies]);

  const selectedMovie =
    movieMap.get(selectedMovieId) ??
    enrichedMovieCache.get(selectedMovieId) ??
    null;

  const filteredMovieOptions = useMemo(() => {
    const query = movieSearch.trim().toLowerCase();

    if (!query) {
      return allMovies.slice(0, 24);
    }

    return allMovies
      .filter((movie) =>
        movie.title.toLowerCase().includes(query)
      )
      .slice(0, 24);
  }, [allMovies, movieSearch]);

  const activeItems =
    mode === "profile" ? recommendations : similarMovies;

  const activeLoading =
    mode === "profile" ? loading : similarLoading;

  const activeError =
    mode === "profile" ? error : similarError;

  const activeMovieDetails =
    mode === "profile"
      ? recommendationMovies
      : similarMovieDetails;

  const featuredMovie = useMemo(() => {
    for (const item of activeItems) {
      const movie =
        activeMovieDetails.get(item.movieId) ??
        movieMap.get(item.movieId);

      if (movie && getPoster(movie)) {
        return movie;
      }
    }

    return null;
  }, [activeItems, activeMovieDetails, movieMap]);

  // Gợi ý theo sở thích của hồ sơ MovieLens.
  useEffect(() => {
    if (mode !== "profile") return;

    let cancelled = false;

    async function loadRecommendations() {
      setLoading(true);
      setError(null);
      setRecommendations([]);
      setRecommendationMovies(new Map());

      try {
        const response =
          await cineMatchApi.getContentUserRecommendations(
            userId,
            topN
          );

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
              : "Không thể tải danh sách phim."
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
  }, [mode, userId, topN, refreshKey]);

  // Tìm phim tương tự với phim đã chọn.
  useEffect(() => {
    if (mode !== "movie") return;

    let cancelled = false;

    async function loadSimilarMovies() {
      setSimilarLoading(true);
      setSimilarError(null);
      setSimilarMovies([]);
      setSimilarMovieDetails(new Map());

      try {
        const response = await cineMatchApi.getSimilarMovies(
          selectedMovieId,
          4
        );

        if (cancelled) return;

        const items: RecommendationItem[] =
          response.items.map((item) => ({
            movieId: item.movieId,
            title: item.title,
            similarity: item.similarity,
          }));

        setSimilarMovies(items);

        const enriched = await enrichRecommendations(items);

        if (!cancelled) {
          setSimilarMovieDetails(enriched);
        }
      } catch (err) {
        if (!cancelled) {
          setSimilarError(
            err instanceof Error
              ? err.message
              : "Không thể tìm phim tương tự."
          );
        }
      } finally {
        if (!cancelled) setSimilarLoading(false);
      }
    }

    void loadSimilarMovies();

    return () => {
      cancelled = true;
    };
  }, [mode, selectedMovieId, refreshKey]);

  const handleChangeUser = (nextUserId: number) => {
    if (
      !Number.isInteger(nextUserId) ||
      nextUserId < 1 ||
      nextUserId > MAX_USER_ID
    ) {
      return;
    }

    setUserId(nextUserId);

    const matched = availableUsers.find(
      (user) => user.userId === nextUserId
    );

    if (matched) {
      onSelectUser(matched);
    }
  };

  return (
    <div className="min-h-screen bg-[#090909] text-[#F6F0E7]">
      {/* CINEMATIC HEADER */}
      <section className="relative isolate overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 -z-20">
          {featuredMovie && getPoster(featuredMovie) ? (
            <img
              src={
                featuredMovie.backdropUrl ||
                getPoster(featuredMovie)
              }
              alt=""
              className="h-full w-full scale-105 object-cover opacity-25 blur-[5px] transition-all duration-700"
            />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(ellipse_at_80%_30%,#49321C_0%,#14100D_40%,#090909_75%)]" />
          )}
        </div>

        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#090909] via-[#090909]/85 to-[#090909]/45" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#090909] via-transparent to-[#090909]/25" />

        <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1fr_340px] lg:px-12 lg:py-16">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#DDB878]/30 bg-black/35 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E8C58C]">
              <Sparkles className="h-4 w-4" />
              Dành riêng cho bạn
            </div>

            <h1 className="font-display text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
              Phim hay
              <span className="mt-1 block text-[#E8BF82]">
                đúng gu bạn.
              </span>
            </h1>

            <p className="mt-5 max-w-lg text-sm leading-7 text-[#C4B9AB] sm:text-base">
              Chọn sở thích hoặc một bộ phim bạn yêu thích.
              CineMatch sẽ giúp bạn khám phá những bộ phim tiếp theo.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-4 text-xs text-[#BBAE9D]">
              <span className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-[#E8BF82]" />
                Khám phá theo sở thích
              </span>

              <span className="flex items-center gap-2">
                <Clapperboard className="h-4 w-4 text-[#E8BF82]" />
                Hàng nghìn bộ phim
              </span>
            </div>
          </div>

          <div className="relative hidden items-center justify-center lg:flex">
            <div className="absolute h-64 w-64 rounded-full bg-[#D7AA61]/10 blur-[75px]" />

            {featuredMovie && getPoster(featuredMovie) ? (
              <button
                type="button"
                onClick={() => onSelectMovie(featuredMovie)}
                className="group relative w-48 rotate-3 overflow-hidden rounded-2xl border border-[#D7AA61]/30 shadow-[0_25px_80px_rgba(0,0,0,0.7)] transition duration-500 hover:rotate-0 hover:scale-105"
              >
                <img
                  src={getPoster(featuredMovie)}
                  alt={featuredMovie.title}
                  className="aspect-[2/3] w-full object-cover"
                />
              </button>
            ) : (
              <div className="relative flex h-64 w-48 rotate-3 items-center justify-center rounded-2xl border border-[#D7AA61]/25 bg-[#211A12]">
                <Film className="h-16 w-16 text-[#D7AA61]/50" />
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1440px] space-y-9 px-5 py-10 sm:px-8 lg:px-12">
        {/* DISCOVERY MODE */}
        <section>
          <div className="mb-5">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">
              Bạn muốn tìm phim theo cách nào?
            </h2>
            <p className="mt-2 text-sm text-[#AFA497]">
              Chỉ cần chọn một cách để bắt đầu.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("profile")}
              className={`group relative overflow-hidden rounded-2xl border p-6 text-left transition-all duration-300 hover:-translate-y-1 sm:p-7 ${
                mode === "profile"
                  ? "border-[#E8BF82] bg-gradient-to-br from-[#352719] to-[#181411] shadow-[0_12px_45px_rgba(215,170,97,0.12)]"
                  : "border-white/10 bg-[#171717] hover:border-[#D7AA61]/45"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E8BF82]/15 text-[#E8BF82]">
                  <Heart className="h-6 w-6" />
                </div>

                <ArrowRight
                  className={`h-5 w-5 transition-transform group-hover:translate-x-1 ${
                    mode === "profile"
                      ? "text-[#E8BF82]"
                      : "text-[#8F8578]"
                  }`}
                />
              </div>

              <h3 className="mt-5 text-xl font-bold">
                Theo sở thích
              </h3>

              <p className="mt-2 max-w-sm text-sm leading-6 text-[#BDB1A3]">
                Chọn một hồ sơ xem phim để khám phá những
                bộ phim phù hợp với gu của hồ sơ đó.
              </p>

              <div className="mt-5 text-xs font-semibold text-[#E8BF82]">
                {mode === "profile"
                  ? "Đang khám phá"
                  : "Khám phá ngay"}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode("movie")}
              className={`group relative overflow-hidden rounded-2xl border p-6 text-left transition-all duration-300 hover:-translate-y-1 sm:p-7 ${
                mode === "movie"
                  ? "border-[#E8BF82] bg-gradient-to-br from-[#352719] to-[#181411] shadow-[0_12px_45px_rgba(215,170,97,0.12)]"
                  : "border-white/10 bg-[#171717] hover:border-[#D7AA61]/45"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E8BF82]/15 text-[#E8BF82]">
                  <Film className="h-6 w-6" />
                </div>

                <ArrowRight
                  className={`h-5 w-5 transition-transform group-hover:translate-x-1 ${
                    mode === "movie"
                      ? "text-[#E8BF82]"
                      : "text-[#8F8578]"
                  }`}
                />
              </div>

              <h3 className="mt-5 text-xl font-bold">
                Theo phim bạn thích
              </h3>

              <p className="mt-2 max-w-sm text-sm leading-6 text-[#BDB1A3]">
                Chọn một bộ phim yêu thích để tìm thêm
                những bộ phim có phong cách tương tự.
              </p>

              <div className="mt-5 text-xs font-semibold text-[#E8BF82]">
                {mode === "movie"
                  ? "Đang khám phá"
                  : "Khám phá ngay"}
              </div>
            </button>
          </div>
        </section>

        {/* SELECTION PANEL */}
        <section className="rounded-2xl border border-white/10 bg-[#151413] p-5 sm:p-7">
          {mode === "profile" ? (
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-3 flex items-center gap-2 text-[#E8BF82]">
                  <Users className="h-5 w-5" />
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Chọn hồ sơ
                  </span>
                </div>

                <h2 className="text-xl font-bold sm:text-2xl">
                  Khám phá gu xem phim
                </h2>

                <p className="mt-2 max-w-xl text-sm leading-6 text-[#AFA497]">
                  Thử các hồ sơ có sẵn để xem mỗi người
                  được gợi ý những phim khác nhau.
                </p>
              </div>

              <div className="w-full lg:w-64">
                <label
                  htmlFor="cm-content-user"
                  className="mb-2 block text-xs text-[#C8BBA9]"
                >
                  Hồ sơ đang chọn
                </label>

                <div className="relative">
                  <select
                    id="cm-content-user"
                    value={userId}
                    onChange={(event) =>
                      handleChangeUser(Number(event.target.value))
                    }
                    className="w-full appearance-none rounded-xl border border-[#D7AA61]/30 bg-[#24201B] px-4 py-3.5 pr-10 text-sm font-semibold text-[#F6F0E7] outline-none transition focus:border-[#E8BF82]"
                  >
                    {Array.from(
                      { length: MAX_USER_ID },
                      (_, index) => index + 1
                    ).map((id) => (
                      <option key={id} value={id}>
                        Hồ sơ #{id}
                      </option>
                    ))}
                  </select>

                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#E8BF82]" />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
              <div>
                <div className="mb-3 flex items-center gap-2 text-[#E8BF82]">
                  <Search className="h-5 w-5" />
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Chọn bộ phim
                  </span>
                </div>

                <h2 className="text-xl font-bold sm:text-2xl">
                  Bạn vừa xem phim gì hay?
                </h2>

                <p className="mt-2 text-sm text-[#AFA497]">
                  Tìm tên phim và chọn một kết quả bên dưới.
                </p>

                <div className="relative mt-5 max-w-xl">
                  <Search className="absolute left-4 top-4 h-5 w-5 text-[#D7AA61]" />

                  <input
                    type="text"
                    value={movieSearch}
                    onChange={(event) => {
                      setMovieSearch(event.target.value);
                      setShowMovieOptions(true);
                    }}
                    onFocus={() => setShowMovieOptions(true)}
                    placeholder="Ví dụ: Toy Story, Matrix, Inception..."
                    className="w-full rounded-xl border border-white/15 bg-[#24201B] py-3.5 pl-12 pr-4 text-sm text-[#F6F0E7] outline-none placeholder:text-[#8F8578] focus:border-[#E8BF82]"
                  />

                  {showMovieOptions && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-xl border border-[#D7AA61]/25 bg-[#1D1A17] p-2 shadow-2xl">
                      {filteredMovieOptions.length === 0 ? (
                        <p className="p-4 text-sm text-[#AFA497]">
                          Không tìm thấy phim phù hợp.
                        </p>
                      ) : (
                        filteredMovieOptions.map((movie) => (
                          <button
                            key={movie.movieId}
                            type="button"
                            onClick={() => {
                              setSelectedMovieId(movie.movieId);
                              setMovieSearch(movie.title);
                              setShowMovieOptions(false);
                            }}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-[#D7AA61]/10"
                          >
                            <Film className="h-4 w-4 shrink-0 text-[#D7AA61]" />

                            <span className="min-w-0 flex-1 truncate text-sm text-[#F6F0E7]">
                              {movie.title}
                            </span>

                            <span className="shrink-0 text-xs text-[#9F9485]">
                              {movie.year || ""}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-[#211D18] p-4">
                {selectedMovie && getPoster(selectedMovie) ? (
                  <img
                    src={getPoster(selectedMovie)}
                    alt={selectedMovie.title}
                    className="aspect-[2/3] w-20 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex aspect-[2/3] w-20 shrink-0 items-center justify-center rounded-lg bg-[#342A20]">
                    <Film className="h-8 w-8 text-[#D7AA61]" />
                  </div>
                )}

                <div className="min-w-0">
                  <p className="text-xs text-[#D7AA61]">
                    Phim đã chọn
                  </p>

                  <h3 className="mt-2 line-clamp-2 font-semibold">
                    {selectedMovie?.title || "Chọn một bộ phim"}
                  </h3>

                  <p className="mt-2 text-xs text-[#AFA497]">
                    {selectedMovie?.year || ""}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* RECOMMENDATION RESULTS */}
        <section className="space-y-6">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[#E8BF82]">
                <WandSparkles className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-[0.15em]">
                  CineMatch Picks
                </span>
              </div>

              <h2 className="font-display text-2xl font-bold sm:text-3xl">
                {mode === "profile"
                  ? "Có thể bạn sẽ thích"
                  : "Nếu thích phim này, hãy thử..."}
              </h2>

              <p className="mt-2 text-sm text-[#AFA497]">
                {mode === "profile"
                  ? `Danh sách phim dành cho hồ sơ #${userId}`
                  : `Những bộ phim tương tự ${
                      selectedMovie?.title || "phim bạn chọn"
                    }`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {mode === "profile" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#AFA497]">
                    Hiển thị
                  </span>

                  <select
                    value={topN}
                    onChange={(event) =>
                      setTopN(Number(event.target.value))
                    }
                    className="rounded-lg border border-white/15 bg-[#1C1A18] px-3 py-2 text-sm text-[#F6F0E7] outline-none focus:border-[#D7AA61]"
                  >
                    {[4, 6, 10, 20].map((value) => (
                      <option key={value} value={value}>
                        {value} phim
                      </option>
                    ))}
                  </select>
                </div>
              )}

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

          {activeLoading && (
            <div className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-[#151413]">
              <Loader2 className="h-9 w-9 animate-spin text-[#E8BF82]" />

              <p className="text-sm text-[#C4B9AB]">
                Đang tìm những bộ phim dành cho bạn...
              </p>
            </div>
          )}

          {!activeLoading && activeError && (
            <div className="rounded-2xl border border-red-500/20 bg-red-950/15 px-6 py-10 text-center">
              <p className="font-semibold text-[#F6F0E7]">
                Chưa thể tải danh sách phim
              </p>

              <p className="mt-2 text-sm text-[#C4B9AB]">
                Hãy kiểm tra kết nối và thử lại.
              </p>

              <p className="mt-2 break-words text-xs text-red-300/70">
                {activeError}
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

          {!activeLoading &&
            !activeError &&
            activeItems.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-[#151413] px-6 py-14 text-center">
                <Film className="mx-auto h-10 w-10 text-[#D7AA61]" />

                <p className="mt-4 text-sm text-[#C4B9AB]">
                  Chưa tìm thấy phim phù hợp.
                </p>
              </div>
            )}

          {!activeLoading &&
            !activeError &&
            activeItems.length > 0 && (
              <>
                <div className="flex items-center gap-2 text-xs text-[#AFA497]">
                  <Sparkles className="h-4 w-4 text-[#E8BF82]" />
                  Đã tìm thấy {activeItems.length} phim
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                  {activeItems.map((item) => {
                    const movie =
                      activeMovieDetails.get(item.movieId) ??
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
              </>
            )}
        </section>

        {/* OPTIONAL EXPLANATION */}
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#141312]">
          <button
            type="button"
            onClick={() =>
              setShowExplanation((value) => !value)
            }
            aria-expanded={showExplanation}
            className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-white/[0.03] sm:p-6"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D7AA61]/10 text-[#E8BF82]">
                <Sparkles className="h-5 w-5" />
              </span>

              <span>
                <span className="block text-sm font-semibold text-[#F6F0E7]">
                  CineMatch tìm phim như thế nào?
                </span>

                <span className="mt-1 block text-xs text-[#AFA497]">
                  Tìm hiểu thêm nếu bạn tò mò
                </span>
              </span>
            </span>

            <ChevronDown
              className={`h-5 w-5 shrink-0 text-[#D7AA61] transition-transform ${
                showExplanation ? "rotate-180" : ""
              }`}
            />
          </button>

          {showExplanation && (
            <div className="grid gap-4 border-t border-white/10 p-5 md:grid-cols-2 sm:p-6">
              <div className="rounded-xl bg-[#211D18] p-5">
                <Heart className="mb-3 h-6 w-6 text-[#E8BF82]" />

                <h3 className="font-semibold">
                  Theo sở thích
                </h3>

                <p className="mt-2 text-sm leading-6 text-[#BDB1A3]">
                  CineMatch xem các thể loại phim mà hồ sơ
                  từng đánh giá, sau đó tìm những bộ phim
                  có thể loại phù hợp.
                </p>
              </div>

              <div className="rounded-xl bg-[#211D18] p-5">
                <Star className="mb-3 h-6 w-6 text-[#E8BF82]" />

                <h3 className="font-semibold">
                  Theo phim bạn thích
                </h3>

                <p className="mt-2 text-sm leading-6 text-[#BDB1A3]">
                  CineMatch so sánh thể loại của phim
                  bạn chọn với các phim khác để tìm
                  những bộ phim có nét tương đồng.
                </p>
              </div>

              <p className="text-xs leading-6 text-[#8F8578] md:col-span-2">
                Các gợi ý được lấy từ mô hình Content-Based
                của dự án. Hồ sơ MovieLens là dữ liệu mẫu,
                không phải tài khoản cá nhân của người truy cập.
              </p>
            </div>
          )}
        </section>

        <div className="flex items-center justify-center gap-2 pb-4 text-xs text-[#786E62]">
          <Bookmark className="h-3.5 w-3.5" />
          Chạm vào biểu tượng lưu để giữ lại phim yêu thích
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </main>
    </div>
  );
};
