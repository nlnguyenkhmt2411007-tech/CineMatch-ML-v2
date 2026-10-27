
import React, { useEffect, useMemo, useState } from "react";
import {
  Sliders,
  Sparkles,
  BookOpen,
  Film,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  UserRound,
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
const MAX_USER_ID = 610;

function formatScore(value: number): string {
  return Number.isFinite(value) ? value.toFixed(4) : "--";
}

export const ContentBasedView: React.FC<ContentBasedViewProps> = ({
  currentUser,
  availableUsers,
  onSelectUser,
  allMovies,
  onSelectMovie,
  bookmarkedMovieIds,
  onToggleBookmark,
}) => {
  // =========================================================
  // 1. TRANG THAI
  // =========================================================

  const [userId, setUserId] = useState<number>(
    currentUser.userId >= 1 && currentUser.userId <= MAX_USER_ID
      ? currentUser.userId
      : 1
  );

  const [topN, setTopN] = useState<number>(10);

  const [recommendations, setRecommendations] = useState<
    RecommendationItem[]
  >([]);

  const [recommendationMovies, setRecommendationMovies] =
    useState<Map<number, Movie>>(new Map());

  const [similarMovieDetails, setSimilarMovieDetails] =
    useState<Map<number, Movie>>(new Map());

  const [loading, setLoading] = useState<boolean>(true);

  const [error, setError] = useState<string | null>(null);

  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Chon phim de tim phim tuong tu.
  const [selectedMovieId, setSelectedMovieId] = useState<number>(1);

  const [movieSearch, setMovieSearch] = useState<string>("");

  const [similarMovies, setSimilarMovies] = useState<
    RecommendationItem[]
  >([]);

  const [similarLoading, setSimilarLoading] =
    useState<boolean>(true);

  const [similarError, setSimilarError] =
    useState<string | null>(null);

  // =========================================================
  // 2. TRA CUU PHIM TRONG CATALOG
  // =========================================================

  const movieMap = useMemo(() => {
    return new Map(
      allMovies.map((movie) => [movie.movieId, movie])
    );
  }, [allMovies]);

  const selectedMovie =
    movieMap.get(selectedMovieId) ?? null;

  const filteredMovieOptions = useMemo(() => {
    const query = movieSearch.trim().toLowerCase();

    if (!query) {
      return allMovies.slice(0, 30);
    }

    return allMovies
      .filter((movie) =>
        movie.title.toLowerCase().includes(query)
      )
      .slice(0, 30);
  }, [allMovies, movieSearch]);

  // =========================================================
  // 3. GOI API CONTENT-BASED THEO USER
  // =========================================================

  useEffect(() => {
    let cancelled = false;

    async function loadRecommendations() {
      setLoading(true);
      setError(null);
      setRecommendations([]);

      try {
        const response =
          await cineMatchApi.getContentUserRecommendations(
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
            : "Không thể tải gợi ý từ FastAPI."
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

  // =========================================================
  // 4. GOI API PHIM TUONG TU THEO MOVIE ID
  // =========================================================

  useEffect(() => {
    let cancelled = false;

    async function loadSimilarMovies() {
      setSimilarLoading(true);
      setSimilarError(null);
      setSimilarMovies([]);

      try {
        const response =
          await cineMatchApi.getSimilarMovies(
            selectedMovieId,
            4
          );

        if (cancelled) return;

        const items = response.items.map((item) => ({
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
        if (cancelled) return;

        setSimilarError(
          err instanceof Error
            ? err.message
            : "Không thể tải danh sách phim tương tự."
        );
      } finally {
        if (!cancelled) {
          setSimilarLoading(false);
        }
      }
    }

    void loadSimilarMovies();

    return () => {
      cancelled = true;
    };
  }, [selectedMovieId, refreshKey]);

  // =========================================================
  // 5. DONG BO USER VOI NAVBAR KHI DUNG USER MOVIELENS
  // =========================================================

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

  // =========================================================
  // 6. RENDER
  // =========================================================

  return (
    <div className="mx-auto max-w-[1440px] space-y-10 px-6 py-12">
      {/* HEADER */}

      <section className="space-y-3 border-b border-white/[0.08] pb-6">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#E8B65B]">
          <Sliders className="h-4 w-4" />
          <span>Mô hình 1 · CineMatch Machine Learning</span>
        </div>

        <h1 className="font-display text-3xl font-bold text-[#F5F2EA] sm:text-4xl">
          Content-Based Filtering
        </h1>

        <p className="max-w-3xl text-sm leading-relaxed text-[#9EA3AE]">
          Hệ thống đề xuất phim theo hồ sơ sở thích của người
          dùng, được xây dựng từ lịch sử đánh giá trong tập
          Train. Phim được biểu diễn bằng 19 đặc trưng thể loại
          Multi-Hot Encoding và xếp hạng bằng Cosine Similarity.
        </p>

        <div className="flex flex-wrap gap-2 pt-2">
          <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 font-mono text-[11px] text-emerald-400">
            Python FastAPI · ML thật
          </span>

          <span className="rounded bg-[#191D27] px-3 py-1.5 font-mono text-[11px] text-[#9EA3AE]">
            19 đặc trưng
          </span>

          <span className="rounded bg-[#191D27] px-3 py-1.5 font-mono text-[11px] text-[#9EA3AE]">
            Cosine Similarity
          </span>

          <span className="rounded bg-[#191D27] px-3 py-1.5 font-mono text-[11px] text-[#9EA3AE]">
            Train only
          </span>
        </div>
      </section>

      {/* GIAI THICH THUAT TOAN */}

      <section className="space-y-5 rounded-[10px] border border-white/[0.08] bg-[#11141C] p-6">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-[#F5F2EA]">
          <BookOpen className="h-4 w-4 text-[#E8B65B]" />
          Nguyên lý hoạt động
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2 rounded-[8px] border border-white/[0.06] bg-[#191D27] p-4">
            <p className="font-mono text-xs font-semibold text-[#E8B65B]">
              01 · Multi-Hot Encoding
            </p>

            <p className="text-xs leading-relaxed text-[#9EA3AE]">
              Biểu diễn mỗi bộ phim bằng vector 19 thể loại
              như Action, Comedy, Drama, Sci-Fi và Romance.
            </p>
          </div>

          <div className="space-y-2 rounded-[8px] border border-white/[0.06] bg-[#191D27] p-4">
            <p className="font-mono text-xs font-semibold text-[#E8B65B]">
              02 · Hồ sơ người dùng
            </p>

            <p className="text-xs leading-relaxed text-[#9EA3AE]">
              Kết hợp vector thể loại của các phim được đánh
              giá từ 4 sao trở lên trong Train, có trọng số
              theo rating. Nếu không có phim đạt ngưỡng,
              mô hình dùng lịch sử Train hiện có.
            </p>
          </div>

          <div className="space-y-2 rounded-[8px] border border-white/[0.06] bg-[#191D27] p-4">
            <p className="font-mono text-xs font-semibold text-[#E8B65B]">
              03 · Cosine Similarity
            </p>

            <p className="text-xs leading-relaxed text-[#9EA3AE]">
              Tính mức tương đồng giữa vector phim ứng viên
              và hồ sơ người dùng, rồi trả về Top-N phim
              chưa xuất hiện trong lịch sử Train.
            </p>

            <p className="font-mono text-xs text-[#E8B65B]">
              similarity = cosine(profile, movie)
            </p>
          </div>
        </div>
      </section>

      {/* LUA CHON USER */}

      <section className="space-y-6 rounded-[10px] border border-white/[0.08] bg-[#11141C] p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-white/[0.08] pb-4 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[#E8B65B]">
              <UserRound className="h-4 w-4" />
              Hồ sơ người dùng MovieLens
            </div>

            <h2 className="font-display text-xl font-bold text-[#F5F2EA]">
              Chọn người dùng để gợi ý phim
            </h2>

            <p className="text-xs text-[#9EA3AE]">
              Dữ liệu Train chứa 610 người dùng.
              User #999 là tài khoản khách DEMO,
              không có hồ sơ trong mô hình Python.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="content-user-id"
              className="text-xs text-[#9EA3AE]"
            >
              User ID
            </label>

            <select
              id="content-user-id"
              value={userId}
              onChange={(event) =>
                handleChangeUser(Number(event.target.value))
              }
              className="rounded-[8px] border border-white/[0.12] bg-[#191D27] px-4 py-2.5 text-sm text-[#F5F2EA] outline-none focus:border-[#E8B65B]"
            >
              {Array.from(
                { length: MAX_USER_ID },
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
            <p className="text-xs text-[#9EA3AE]">
              Người dùng đang phân tích
            </p>

            <p className="mt-2 font-display text-2xl font-bold text-[#E8B65B]">
              #{userId}
            </p>
          </div>

          <div className="rounded-[8px] border border-white/[0.06] bg-[#191D27] p-4">
            <p className="text-xs text-[#9EA3AE]">
              Phương pháp
            </p>

            <p className="mt-2 text-sm font-semibold text-[#F5F2EA]">
              User Genre Profile
            </p>
          </div>

          <div className="rounded-[8px] border border-white/[0.06] bg-[#191D27] p-4">
            <p className="text-xs text-[#9EA3AE]">
              Nguồn dữ liệu huấn luyện
            </p>

            <p className="mt-2 text-sm font-semibold text-[#F5F2EA]">
              ratings_train.csv
            </p>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-[#9EA3AE]">
          Trọng số chi tiết của 19 thể loại chưa được trả về
          bởi API hiện tại. Vì vậy, trang này chỉ hiển thị
          kết quả gợi ý thực tế, không sử dụng vector DEMO.
          Việc đổi User ID tại đây không tạo tài khoản mới.
        </p>
      </section>

      {/* KET QUA GOI Y THEO USER */}

      <section className="space-y-6">
        <div className="flex flex-col justify-between gap-4 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[#E8B65B]">
              <Sparkles className="h-5 w-5" />

              <h2 className="font-display text-2xl font-bold text-[#F5F2EA]">
                Top-{topN} phim gợi ý cho User #{userId}
              </h2>
            </div>

            <p className="text-xs text-[#9EA3AE]">
              Kết quả trả về trực tiếp từ mô hình
              Content-Based Python.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 text-xs text-[#9EA3AE]">
              Top-N:
            </span>

            {[4, 6, 10, 20].map((number) => (
              <button
                type="button"
                key={number}
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
              onClick={() => setRefreshKey((value) => value + 1)}
              className="ml-2 rounded-[6px] border border-[#E8B65B]/30 bg-[#E8B65B]/10 p-2 text-[#E8B65B] hover:bg-[#E8B65B]/20"
              title="Tải lại gợi ý"
              aria-label="Tải lại gợi ý"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-3 rounded-[10px] border border-white/[0.08] bg-[#11141C] p-12 text-sm text-[#9EA3AE]">
            <RefreshCw className="h-5 w-5 animate-spin text-[#E8B65B]" />
            Đang tính gợi ý từ mô hình Python...
          </div>
        )}

        {!loading && error && (
          <div className="flex items-start gap-3 rounded-[10px] border border-red-500/30 bg-red-950/20 p-5 text-sm text-red-300">
            <AlertCircle className="h-5 w-5 shrink-0" />

            <div className="space-y-1">
              <p className="font-semibold">
                Không tải được gợi ý Content-Based
              </p>

              <p className="text-xs">{error}</p>

              <p className="text-xs">
                Kiểm tra FastAPI ở địa chỉ:
                http://127.0.0.1:8000/api/recommend/content-user/1
              </p>
            </div>
          </div>
        )}

        {!loading && !error && recommendations.length === 0 && (
          <div className="rounded-[10px] border border-white/[0.08] bg-[#11141C] p-10 text-center text-sm text-[#9EA3AE]">
            Chưa có phim gợi ý cho người dùng này.
          </div>
        )}

        {!loading && !error && recommendations.length > 0 && (
          <>
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Đã nhận {recommendations.length} gợi ý từ FastAPI.
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
                      className="rounded-[8px] border border-white/[0.08] bg-[#11141C] p-4"
                    >
                      <Film className="mb-3 h-7 w-7 text-[#E8B65B]" />

                      <p className="text-sm font-semibold text-[#F5F2EA]">
                        {item.title}
                      </p>

                      <p className="mt-2 font-mono text-xs text-[#E8B65B]">
                        Similarity: {formatScore(item.similarity)}
                      </p>
                    </div>
                  );
                }

                return (
                  <MovieCard
                    key={item.movieId}
                    movie={movie}
                    similarityScore={item.similarity}
                    onClick={() => onSelectMovie(movie)}
                    isBookmarked={bookmarkedMovieIds.has(item.movieId)}
                    onToggleBookmark={(event) => {
                      event.stopPropagation();
                      onToggleBookmark(item.movieId);
                    }}
                    userRating={currentUser.ratings[item.movieId]}
                  />
                );
              })}
            </div>
          </>
        )}

        <div className="rounded-[8px] border border-[#E8B65B]/15 bg-[#E8B65B]/[0.04] p-4 text-xs leading-relaxed text-[#9EA3AE]">
          <strong className="text-[#E8B65B]">
            Lưu ý:
          </strong>{" "}
          Điểm Similarity từ 0 đến 1 đo mức tương đồng
          thể loại giữa phim và hồ sơ sở thích của người dùng.
          Đây không phải xác suất thích phim hay độ chính xác
          của mô hình.
        </div>
      </section>

      {/* PHONG THI NGHIEM PHIM TUONG TU */}

      <section className="space-y-6 rounded-[10px] border border-white/[0.08] bg-[#11141C] p-6">
        <div className="space-y-2 border-b border-white/[0.08] pb-5">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[#E8B65B]">
            <Film className="h-4 w-4" />
            Item-to-Item Similarity
          </div>

          <h2 className="font-display text-xl font-bold text-[#F5F2EA]">
            Phòng thí nghiệm phim tương tự
          </h2>

          <p className="text-xs leading-relaxed text-[#9EA3AE]">
            Chọn một bộ phim trong MovieLens để tìm những phim
            có vector thể loại tương đồng. Kết quả được tính
            từ Python và trả về qua FastAPI.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* PHIM MUC TIEU */}

          <div className="space-y-4 rounded-[8px] border border-white/[0.06] bg-[#191D27] p-4 lg:col-span-4">
            <label
              htmlFor="content-movie-search"
              className="text-xs font-semibold uppercase tracking-wider text-[#E8B65B]"
            >
              Tìm phim mục tiêu
            </label>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9EA3AE]" />

              <input
                id="content-movie-search"
                type="text"
                value={movieSearch}
                onChange={(event) =>
                  setMovieSearch(event.target.value)
                }
                placeholder="Ví dụ: Toy Story, Matrix..."
                className="w-full rounded-[6px] border border-white/[0.12] bg-[#11141C] py-2.5 pl-9 pr-3 text-xs text-[#F5F2EA] outline-none focus:border-[#E8B65B]"
              />
            </div>

            <select
              value={selectedMovieId}
              onChange={(event) =>
                setSelectedMovieId(Number(event.target.value))
              }
              size={Math.min(
                Math.max(filteredMovieOptions.length, 1),
                5
              )}
              className="w-full rounded-[6px] border border-white/[0.12] bg-[#11141C] p-2 text-xs text-[#F5F2EA] outline-none focus:border-[#E8B65B]"
            >
              {selectedMovie &&
                !filteredMovieOptions.some(
                  (movie) => movie.movieId === selectedMovieId
                ) && (
                  <option value={selectedMovie.movieId}>
                    {selectedMovie.title} (đang chọn)
                  </option>
                )}

              {filteredMovieOptions.map((movie) => (
                <option key={movie.movieId} value={movie.movieId}>
                  {movie.title} ({movie.year || "N/A"})
                </option>
              ))}
            </select>

            {selectedMovie ? (
              <div className="flex items-start gap-3 rounded-[8px] border border-white/[0.06] bg-[#11141C] p-3">
                <div className="flex aspect-[2/3] w-16 shrink-0 items-center justify-center rounded border border-[#E8B65B]/20 bg-[#191D27]">
                  <Film className="h-7 w-7 text-[#E8B65B]" />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[#F5F2EA]">
                    {selectedMovie.title}
                  </p>

                  <p className="font-mono text-xs text-[#9EA3AE]">
                    Movie ID: {selectedMovie.movieId}
                  </p>

                  <p className="text-xs text-[#9EA3AE]">
                    {selectedMovie.year || "Chưa rõ năm"}
                  </p>

                  <div className="flex flex-wrap gap-1">
                    {selectedMovie.genres.map((genre) => (
                      <span
                        key={genre}
                        className="rounded bg-[#191D27] px-2 py-1 text-[10px] text-[#F5F2EA]"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#9EA3AE]">
                Đang tải danh sách phim...
              </p>
            )}
          </div>

          {/* KET QUA PHIM TUONG TU */}

          <div className="space-y-4 lg:col-span-8">
            <h3 className="text-sm font-semibold text-[#F5F2EA]">
              Các phim tương tự{" "}
              {selectedMovie ? `"${selectedMovie.title}"` : ""}
            </h3>

            {similarLoading && (
              <div className="flex items-center gap-2 rounded-[8px] bg-[#191D27] p-6 text-sm text-[#9EA3AE]">
                <RefreshCw className="h-4 w-4 animate-spin text-[#E8B65B]" />
                Đang tính Cosine Similarity...
              </div>
            )}

            {!similarLoading && similarError && (
              <div className="flex items-center gap-2 rounded-[8px] border border-red-500/30 bg-red-950/20 p-4 text-xs text-red-300">
                <AlertCircle className="h-4 w-4" />
                {similarError}
              </div>
            )}

            {!similarLoading &&
              !similarError &&
              similarMovies.length === 0 && (
                <p className="rounded-[8px] bg-[#191D27] p-6 text-sm text-[#9EA3AE]">
                  Chưa có kết quả phim tương tự.
                </p>
              )}

            {!similarLoading &&
              !similarError &&
              similarMovies.length > 0 && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {similarMovies.map((item) => {
                    const movie =
                      similarMovieDetails.get(item.movieId) ??
                      movieMap.get(item.movieId);

                    if (!movie) {
                      return (
                        <div
                          key={item.movieId}
                          className="rounded-[8px] border border-white/[0.08] bg-[#191D27] p-4"
                        >
                          <Film className="mb-3 h-7 w-7 text-[#E8B65B]" />

                          <p className="text-xs font-semibold text-[#F5F2EA]">
                            {item.title}
                          </p>

                          <p className="mt-2 font-mono text-xs text-[#E8B65B]">
                            Sim: {formatScore(item.similarity)}
                          </p>
                        </div>
                      );
                    }

                    return (
                      <MovieCard
                        key={item.movieId}
                        movie={movie}
                        similarityScore={item.similarity}
                        onClick={() => onSelectMovie(movie)}
                        isBookmarked={bookmarkedMovieIds.has(item.movieId)}
                        onToggleBookmark={(event) => {
                          event.stopPropagation();
                          onToggleBookmark(item.movieId);
                        }}
                        userRating={currentUser.ratings[item.movieId]}
                      />
                    );
                  })}
                </div>
              )}
          </div>
        </div>
      </section>
    </div>
  );
};

