
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Film,
  FlaskConical,
  Info,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Trash2,
  Users,
} from "lucide-react";

import { cineMatchApi } from "../../services/api";
import type { Movie as ApiMovie } from "../../services/api";
import {
  predictMLLab,
  type MLLabPredictionResponse,
} from "../../services/mlLabApi";

type Participant = "A" | "B";
type Ratings = Record<number, number>;

interface RatedMovie {
  movieId: number;
  title: string;
  rating: number;
}

const PANEL =
  "rounded-2xl border border-white/10 bg-[#151413]";

const INPUT =
  "w-full rounded-xl border border-white/15 bg-[#211E1A] px-4 py-3 text-sm text-[#F6F0E7] outline-none transition focus:border-[#E8BF82]";

const RATING_VALUES = Array.from(
  { length: 10 },
  (_, index) => (index + 1) * 0.5
);

function getPoster(movie: ApiMovie): string | undefined {
  const candidate = movie as ApiMovie & {
    posterUrl?: string | null;
    poster_url?: string | null;
  };

  return candidate.posterUrl || candidate.poster_url || undefined;
}

function RatingStars({
  value,
  onChange,
  label,
}: {
  value?: number;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {RATING_VALUES.map((rating) => (
        <button
          key={rating}
          type="button"
          onClick={() => onChange(rating)}
          title={`${rating.toFixed(1)} / 5 sao`}
          aria-label={`${label}: ${rating.toFixed(1)} sao`}
          aria-pressed={value === rating}
          className={`rounded-md px-1.5 py-1.5 text-[11px] font-semibold transition ${
            value === rating
              ? "bg-[#E8BF82] text-[#18120B]"
              : "bg-white/[0.05] text-[#A99C8B] hover:bg-[#E8BF82]/20 hover:text-[#E8BF82]"
          }`}
        >
          {rating.toFixed(1)}
        </button>
      ))}
    </div>
  );
}

export const ABLabView = () => {
  const [search, setSearch] = useState("");
  const [movies, setMovies] = useState<ApiMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ratingsA, setRatingsA] = useState<Ratings>({});
  const [ratingsB, setRatingsB] = useState<Ratings>({});
  const [movieTitles, setMovieTitles] = useState<
    Record<number, string>
  >({});

  const [targetMovieId, setTargetMovieId] =
    useState<number | null>(null);
  const [targetSearch, setTargetSearch] = useState("");
  const [targetMovies, setTargetMovies] = useState<ApiMovie[]>([]);
  const [targetLoading, setTargetLoading] = useState(false);

  const [k, setK] = useState(20);
  const [predictionLoading, setPredictionLoading] =
    useState(false);
  const [predictionError, setPredictionError] =
    useState<string | null>(null);
  const [predictionResult, setPredictionResult] =
    useState<MLLabPredictionResponse | null>(null);

  const [showDetails, setShowDetails] = useState(false);
  const [activeParticipant, setActiveParticipant] =
    useState<Participant>("A");

  const [movieImages, setMovieImages] = useState<
    Record<number, string>
  >({});

  const ratedCountA = Object.keys(ratingsA).length;
  const ratedCountB = Object.keys(ratingsB).length;

  const selectedRatings =
    activeParticipant === "A" ? ratingsA : ratingsB;

  const selectedRatedMovies = useMemo<RatedMovie[]>(
    () =>
      Object.entries(selectedRatings).map(([id, rating]) => ({
        movieId: Number(id),
        title: movieTitles[Number(id)] ?? `Movie #${id}`,
        rating,
      })),
    [selectedRatings, movieTitles]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadMovies() {
      try {
        setLoading(true);
        setError(null);

        const result = await cineMatchApi.getMovies(
          1,
          20,
          search.trim()
        );

        if (!cancelled) setMovies(result.items);
      } catch {
        if (!cancelled) {
          setError("Không thể tải danh sách phim từ FastAPI.");
          setMovies([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const timer = window.setTimeout(() => {
      void loadMovies();
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    async function loadTargetMovies() {
      try {
        setTargetLoading(true);

        const result = await cineMatchApi.getMovies(
          1,
          20,
          targetSearch.trim()
        );

        if (!cancelled) setTargetMovies(result.items);
      } catch {
        if (!cancelled) setTargetMovies([]);
      } finally {
        if (!cancelled) setTargetLoading(false);
      }
    }

    const timer = window.setTimeout(() => {
      void loadTargetMovies();
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [targetSearch]);

  // Poster enrichment is optional. Failure must not block the lab.
  useEffect(() => {
    let cancelled = false;

    async function loadPosters() {
      const missing = movies.filter(
        (movie) =>
          !getPoster(movie) &&
          movieImages[movie.movieId] === undefined
      );

      if (missing.length === 0) return;

      const baseUrl =
        import.meta.env.VITE_API_URL ||
        "http://127.0.0.1:8000";

      const results = await Promise.all(
        missing.map(async (movie) => {
          try {
            const response = await fetch(
              `${baseUrl}/api/movies/enriched/${movie.movieId}`
            );

            if (!response.ok) return null;

            const enriched = (await response.json()) as ApiMovie;
            const poster = getPoster(enriched);

            return poster
              ? ([movie.movieId, poster] as const)
              : null;
          } catch {
            return null;
          }
        })
      );

      if (cancelled) return;

      const next: Record<number, string> = {};

      results.forEach((item) => {
        if (item) next[item[0]] = item[1];
      });

      if (Object.keys(next).length > 0) {
        setMovieImages((previous) => ({
          ...previous,
          ...next,
        }));
      }
    }

    void loadPosters();

    return () => {
      cancelled = true;
    };
    // Reload posters only when the movie search result changes.
  }, [movies]);

  const invalidatePrediction = () => {
    setPredictionResult(null);
    setPredictionError(null);
    setShowDetails(false);
  };

  const rateMovie = (
    participant: Participant,
    movie: ApiMovie,
    rating: number
  ) => {
    invalidatePrediction();

    setMovieTitles((previous) => ({
      ...previous,
      [movie.movieId]: movie.title,
    }));

    const setter =
      participant === "A" ? setRatingsA : setRatingsB;

    setter((previous) => ({
      ...previous,
      [movie.movieId]: rating,
    }));
  };

  const removeRating = (
    participant: Participant,
    movieId: number
  ) => {
    invalidatePrediction();

    const setter =
      participant === "A" ? setRatingsA : setRatingsB;

    setter((previous) => {
      const next = { ...previous };
      delete next[movieId];
      return next;
    });
  };

  const runPrediction = async () => {
    if (predictionLoading) return;

    if (ratedCountB === 0) {
      setPredictionError(
        "Người dùng B cần đánh giá ít nhất một phim."
      );
      return;
    }

    if (targetMovieId === null) {
      setPredictionError("Vui lòng chọn phim cần dự đoán.");
      return;
    }

    if (ratingsB[targetMovieId] !== undefined) {
      setPredictionError(
        "B đã đánh giá phim này. Hãy chọn phim chưa xem."
      );
      return;
    }

    try {
      setPredictionLoading(true);
      setPredictionError(null);
      setPredictionResult(null);

      const result = await predictMLLab({
        ratingsA,
        ratingsB,
        movieId: targetMovieId,
        k,
      });

      setPredictionResult(result);
    } catch (err) {
      setPredictionError(
        err instanceof Error
          ? err.message
          : "Không thể chạy dự đoán ML."
      );
    } finally {
      setPredictionLoading(false);
    }
  };

  const availableTargets = targetMovies.filter(
    (movie) => ratingsB[movie.movieId] === undefined
  );

  return (
    <div className="min-h-screen bg-[#090909] text-[#F6F0E7]">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(ellipse_at_80%_10%,#46311C_0%,#18130E_35%,#090909_75%)]">
        <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#D7AA61]/30 bg-[#D7AA61]/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E8BF82]">
            <FlaskConical className="h-4 w-4" />
            CineMatch · ML Laboratory
          </div>

          <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
            Phòng thực nghiệm
            <span className="block text-[#E8BF82]">
              trí tuệ nhân tạo.
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-[#C4B9AB] sm:text-base">
            Tự tạo sở thích xem phim cho hai người dùng,
            khám phá mức độ giống nhau và xem AI dự đoán
            điểm yêu thích của một bộ phim chưa xem.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            {[
              "01 · Đánh giá phim",
              "02 · Chọn phim dự đoán",
              "03 · Xem kết quả AI",
            ].map((step) => (
              <span
                key={step}
                className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-xs text-[#D8C6AE]"
              >
                {step}
              </span>
            ))}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1440px] space-y-8 px-5 py-10 sm:px-8 lg:px-12">
        {/* STEP 1 */}
        <section className={`${PANEL} overflow-hidden`}>
          <div className="border-b border-white/10 p-5 sm:p-7">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#E8BF82]">
              <Star className="h-4 w-4" />
              Bước 01 · Xây dựng sở thích
            </div>

            <h2 className="font-display text-2xl font-bold">
              Hai người xem, hai gu điện ảnh
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#AFA497]">
              Tìm phim rồi cho điểm từ 0.5 đến 5 sao.
              Hãy thử đánh giá một vài phim cho cả A và B
              để khám phá sự tương đồng.
            </p>
          </div>

          <div className="p-5 sm:p-7">
            {/* USER TABS */}
            <div className="mb-6 grid grid-cols-2 gap-3">
              {(["A", "B"] as const).map((participant) => {
                const active =
                  activeParticipant === participant;

                const count =
                  participant === "A"
                    ? ratedCountA
                    : ratedCountB;

                return (
                  <button
                    key={participant}
                    type="button"
                    onClick={() =>
                      setActiveParticipant(participant)
                    }
                    className={`rounded-xl border p-4 text-left transition ${
                      active
                        ? "border-[#E8BF82]/60 bg-[#D7AA61]/10"
                        : "border-white/10 bg-[#211E1A] hover:border-[#D7AA61]/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Users
                        className={`h-5 w-5 ${
                          active
                            ? "text-[#E8BF82]"
                            : "text-[#AFA497]"
                        }`}
                      />

                      <span className="text-sm font-semibold">
                        Người dùng {participant}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-[#AFA497]">
                      Đã đánh giá {count} phim
                    </p>
                  </button>
                );
              })}
            </div>

            <label
              htmlFor="ab-movie-search"
              className="mb-2 block text-xs font-semibold text-[#C8BBA9]"
            >
              Tìm phim để đánh giá cho người dùng{" "}
              {activeParticipant}
            </label>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#E8BF82]" />

              <input
                id="ab-movie-search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Nhập tên phim, ví dụ: Toy Story"
                className={`${INPUT} pl-12`}
              />
            </div>

            {loading && (
              <p className="mt-3 flex items-center gap-2 text-xs text-[#E8BF82]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tìm phim...
              </p>
            )}

            {error && (
              <p role="alert" className="mt-3 text-xs text-red-300">
                {error}
              </p>
            )}

            {/* MOVIE RESULTS */}
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {movies.map((movie) => {
                const poster =
                  getPoster(movie) ||
                  movieImages[movie.movieId];

                const rating = selectedRatings[movie.movieId];

                return (
                  <div
                    key={movie.movieId}
                    className={`overflow-hidden rounded-xl border bg-[#211E1A] transition ${
                      rating !== undefined
                        ? "border-[#E8BF82]/45"
                        : "border-white/[0.07]"
                    }`}
                  >
                    <div className="flex gap-3 p-3">
                      <div className="h-28 w-[74px] shrink-0 overflow-hidden rounded-lg bg-[#30271D]">
                        {poster ? (
                          <img
                            src={poster}
                            alt={movie.title}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Film className="h-7 w-7 text-[#D7AA61]/50" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-3 text-sm font-semibold leading-5">
                          {movie.title}
                        </p>

                        {movie.year && (
                          <p className="mt-1 text-xs text-[#938779]">
                            {movie.year}
                          </p>
                        )}

                        {rating !== undefined && (
                          <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-[#E8BF82]">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {rating.toFixed(1)} / 5 sao
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-white/[0.07] px-3 py-3">
                      <p className="mb-2 text-[11px] text-[#AFA497]">
                        Chọn điểm đánh giá
                      </p>

                      <RatingStars
                        value={rating}
                        label={`Người dùng ${activeParticipant}, phim ${movie.title}`}
                        onChange={(value) =>
                          rateMovie(
                            activeParticipant,
                            movie,
                            value
                          )
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {!loading && !error && movies.length === 0 && (
              <p className="py-10 text-center text-sm text-[#AFA497]">
                Không tìm thấy phim phù hợp.
              </p>
            )}

            {/* RATED MOVIES */}
            <div className="mt-8 border-t border-white/10 pt-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">
                  Phim người dùng {activeParticipant} đã đánh giá
                </h3>

                <span className="rounded-full bg-[#D7AA61]/10 px-3 py-1 text-xs text-[#E8BF82]">
                  {selectedRatedMovies.length} phim
                </span>
              </div>

              {selectedRatedMovies.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
                  <Film className="mx-auto h-7 w-7 text-[#786E62]" />

                  <p className="mt-3 text-xs text-[#AFA497]">
                    Chưa có phim nào được đánh giá.
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedRatedMovies.map((movie) => (
                    <div
                      key={movie.movieId}
                      className="flex max-w-full items-center gap-3 rounded-lg border border-[#D7AA61]/20 bg-[#D7AA61]/[0.06] px-3 py-2"
                    >
                      <span className="max-w-[180px] truncate text-xs">
                        {movie.title}
                      </span>

                      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[#E8BF82]">
                        <Star className="h-3 w-3 fill-current" />
                        {movie.rating.toFixed(1)}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          removeRating(
                            activeParticipant,
                            movie.movieId
                          )
                        }
                        aria-label={`Xóa đánh giá ${movie.title}`}
                        className="text-[#938779] transition hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#211E1A] p-4">
              <div className="flex items-center gap-2 text-xs text-[#BFB2A2]">
                <Users className="h-4 w-4 text-[#E8BF82]" />
                A: {ratedCountA} phim · B: {ratedCountB} phim
              </div>

              <button
                type="button"
                onClick={() =>
                  setActiveParticipant(
                    activeParticipant === "A" ? "B" : "A"
                  )
                }
                className="flex items-center gap-2 text-xs font-semibold text-[#E8BF82] hover:text-white"
              >
                Chuyển sang người dùng{" "}
                {activeParticipant === "A" ? "B" : "A"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        {/* STEP 2 */}
        <section className={`${PANEL} p-5 sm:p-7`}>
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#E8BF82]">
              <Search className="h-4 w-4" />
              Bước 02 · Chuẩn bị dự đoán
            </div>

            <h2 className="font-display text-2xl font-bold">
              B sẽ thích bộ phim nào?
            </h2>

            <p className="mt-3 text-sm leading-6 text-[#AFA497]">
              Chọn một bộ phim mà người dùng B chưa đánh giá.
              Mô hình sẽ dự đoán B có thể chấm bao nhiêu sao.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-3">
              <label
                htmlFor="ab-target-search"
                className="block text-xs font-semibold text-[#C8BBA9]"
              >
                Tìm phim muốn dự đoán
              </label>

              <input
                id="ab-target-search"
                value={targetSearch}
                onChange={(event) => {
                  setTargetSearch(event.target.value);
                  setTargetMovieId(null);
                  invalidatePrediction();
                }}
                placeholder="Ví dụ: The Shawshank Redemption"
                className={INPUT}
              />

              <select
                aria-label="Chọn phim cần dự đoán"
                value={targetMovieId ?? ""}
                onChange={(event) => {
                  setTargetMovieId(
                    event.target.value
                      ? Number(event.target.value)
                      : null
                  );
                  invalidatePrediction();
                }}
                className={INPUT}
              >
                <option value="">
                  {targetLoading
                    ? "Đang tải phim..."
                    : "Chọn phim chưa được B đánh giá"}
                </option>

                {availableTargets.map((movie) => (
                  <option
                    key={movie.movieId}
                    value={movie.movieId}
                  >
                    {movie.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="ab-neighbor-k"
                className="mb-3 block text-xs font-semibold text-[#C8BBA9]"
              >
                Số người dùng tương tự (K)
              </label>

              <select
                id="ab-neighbor-k"
                value={k}
                onChange={(event) => {
                  setK(Number(event.target.value));
                  invalidatePrediction();
                }}
                className={INPUT}
              >
                {[1, 3, 5, 10, 15, 20].map((value) => (
                  <option key={value} value={value}>
                    K = {value}
                  </option>
                ))}
              </select>

              <p className="mt-3 text-xs leading-5 text-[#938779]">
                Mô hình sử dụng tối đa K người dùng tương tự
                có đánh giá phim cần dự đoán.
              </p>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => void runPrediction()}
              disabled={predictionLoading}
              className="inline-flex items-center justify-center gap-3 rounded-xl bg-[#E8BF82] px-7 py-3.5 text-sm font-bold text-[#18120B] transition hover:bg-[#F5D49C] disabled:cursor-wait disabled:opacity-50"
            >
              {predictionLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Play className="h-5 w-5 fill-current" />
              )}

              {predictionLoading
                ? "Đang tính toán..."
                : "Chạy thực nghiệm AI"}
            </button>

            <span className="flex items-center gap-2 text-xs text-[#938779]">
              <BrainCircuit className="h-4 w-4" />
              Kết quả được tính bởi mô hình Python
            </span>
          </div>

          {predictionError && (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-red-500/20 bg-red-950/15 p-4 text-sm text-red-300"
            >
              {predictionError}
            </p>
          )}
        </section>

        {/* STEP 3 */}
        <section className={`${PANEL} overflow-hidden`}>
          <div className="border-b border-white/10 p-5 sm:p-7">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#E8BF82]">
              <Sparkles className="h-4 w-4" />
              Bước 03 · Kết quả thực nghiệm
            </div>

            <h2 className="font-display text-2xl font-bold">
              AI đã tìm ra điều gì?
            </h2>

            <p className="mt-3 text-sm text-[#AFA497]">
              Khám phá độ tương đồng giữa A và B cùng
              điểm sao dự đoán cho bộ phim đã chọn.
            </p>
          </div>

          {!predictionResult ? (
            <div className="flex min-h-52 flex-col items-center justify-center p-8 text-center">
              {predictionLoading ? (
                <Loader2 className="h-9 w-9 animate-spin text-[#E8BF82]" />
              ) : (
                <FlaskConical className="h-10 w-10 text-[#D7AA61]/50" />
              )}

              <p className="mt-4 text-sm text-[#AFA497]">
                {predictionLoading
                  ? "Mô hình đang xử lý dữ liệu..."
                  : "Chưa có kết quả thực nghiệm."}
              </p>

              {!predictionLoading && (
                <p className="mt-2 text-xs text-[#786E62]">
                  Hoàn thành các bước phía trên rồi chạy AI.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-6 p-5 sm:p-7">
              <div className="flex items-center gap-2 text-sm text-[#BFB2A2]">
                <CheckCircle2 className="h-5 w-5 text-[#E8BF82]" />
                Đã tính toán thành công cho phim:
              </div>

              <h3 className="font-display text-xl font-bold text-[#F6F0E7]">
                {predictionResult.title}
              </h3>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-[#D7AA61]/25 bg-[#D7AA61]/[0.07] p-5">
                  <p className="text-xs text-[#BFB2A2]">
                    Độ tương đồng A – B
                  </p>

                  <p className="mt-3 text-3xl font-bold text-[#E8BF82]">
                    {predictionResult.comparison.similarity.toFixed(4)}
                  </p>

                  <p className="mt-3 text-xs text-[#938779]">
                    Cosine Similarity
                  </p>
                </div>

                <div className="rounded-xl border border-[#D7AA61]/40 bg-[#D7AA61]/10 p-5">
                  <p className="text-xs text-[#BFB2A2]">
                    Điểm dự đoán cho B
                  </p>

                  <p className="mt-3 flex items-center gap-2 text-3xl font-bold text-[#E8BF82]">
                    <Star className="h-7 w-7 fill-current" />
                    {predictionResult.prediction.predictedRating.toFixed(
                      2
                    )}
                  </p>

                  <p className="mt-3 text-xs text-[#938779]">
                    Trên thang 5 sao
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#211E1A] p-5">
                  <p className="text-xs text-[#BFB2A2]">
                    Người dùng tham gia dự đoán
                  </p>

                  <p className="mt-3 text-3xl font-bold text-[#F6F0E7]">
                    {predictionResult.prediction.neighborCount}
                  </p>

                  <p className="mt-3 text-xs text-[#938779]">
                    Tối đa K = {k}
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-[#211E1A] p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#E8BF82]">
                  <Info className="h-4 w-4" />
                  Cách hiểu kết quả
                </div>

                <p className="text-sm leading-7 text-[#C4B9AB]">
                  A và B có{" "}
                  <strong className="text-[#F6F0E7]">
                    {
                      predictionResult.comparison.commonCount
                    }{" "}
                    phim cùng đánh giá
                  </strong>
                  . Dựa trên dữ liệu đánh giá và những người
                  dùng tương tự, mô hình ước tính B có thể
                  chấm{" "}
                  <strong className="text-[#E8BF82]">
                    {predictionResult.prediction.predictedRating.toFixed(
                      2
                    )}{" "}
                    sao
                  </strong>{" "}
                  cho phim đã chọn.
                </p>
              </div>

              {/* TECHNICAL DETAILS */}
              <div className="overflow-hidden rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() =>
                    setShowDetails((value) => !value)
                  }
                  aria-expanded={showDetails}
                  className="flex w-full items-center justify-between gap-3 bg-[#211E1A] p-5 text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <BrainCircuit className="h-5 w-5 text-[#E8BF82]" />
                    Xem cách mô hình tính toán
                  </span>

                  <ChevronDown
                    className={`h-5 w-5 text-[#E8BF82] transition-transform ${
                      showDetails ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {showDetails && (
                  <div className="space-y-6 p-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg bg-[#211E1A] p-4">
                        <p className="text-xs text-[#AFA497]">
                          Điểm trung bình của B
                        </p>

                        <p className="mt-2 text-lg font-semibold text-[#E8BF82]">
                          {predictionResult.prediction.baseline.toFixed(
                            4
                          )}
                        </p>
                      </div>

                      <div className="rounded-lg bg-[#211E1A] p-4">
                        <p className="text-xs text-[#AFA497]">
                          Số phim A và B cùng đánh giá
                        </p>

                        <p className="mt-2 text-lg font-semibold text-[#E8BF82]">
                          {
                            predictionResult.comparison
                              .commonCount
                          }
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-[#211E1A] p-4 font-mono text-xs leading-7 text-[#D8C6AE]">
                      <p className="text-[#E8BF82]">
                        Prediction = Mean(B) + Numerator / Denominator
                      </p>

                      <p>
                        ={" "}
                        {predictionResult.prediction.baseline.toFixed(
                          4
                        )}{" "}
                        +{" "}
                        {predictionResult.prediction.numerator.toFixed(
                          4
                        )}{" "}
                        /{" "}
                        {predictionResult.prediction.denominator.toFixed(
                          4
                        )}
                      </p>

                      <p className="text-[#938779]">
                        Kết quả được giới hạn trong thang
                        0.5–5 sao.
                      </p>
                    </div>

                    <div>
                      <h4 className="mb-4 text-sm font-semibold">
                        Những người dùng đóng góp vào dự đoán
                      </h4>

                      {predictionResult.prediction.neighbors.length ===
                      0 ? (
                        <p className="rounded-xl bg-[#211E1A] p-4 text-sm text-[#AFA497]">
                          Không có láng giềng có độ tương đồng
                          dương. Mô hình sử dụng điểm trung bình
                          của B.
                        </p>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-white/10">
                          <table className="w-full min-w-[620px] text-left text-xs">
                            <thead className="bg-[#211E1A] text-[#E8BF82]">
                              <tr>
                                <th className="p-3">
                                  Người dùng
                                </th>
                                <th className="p-3">
                                  Tương đồng
                                </th>
                                <th className="p-3">
                                  Điểm phim
                                </th>
                                <th className="p-3">
                                  Độ lệch
                                </th>
                                <th className="p-3">
                                  Đóng góp
                                </th>
                              </tr>
                            </thead>

                            <tbody>
                              {predictionResult.prediction.neighbors.map(
                                (neighbor, index) => (
                                  <tr
                                    key={`${neighbor.source}-${neighbor.userId}-${index}`}
                                    className="border-t border-white/[0.06] text-[#D6CBBE]"
                                  >
                                    <td className="p-3">
                                      {neighbor.source === "A"
                                        ? "Người dùng A"
                                        : `MovieLens #${neighbor.userId}`}
                                    </td>

                                    <td className="p-3">
                                      {neighbor.similarity.toFixed(
                                        4
                                      )}
                                    </td>

                                    <td className="p-3">
                                      {neighbor.rating.toFixed(1)}
                                    </td>

                                    <td className="p-3">
                                      {neighbor.deviation.toFixed(
                                        4
                                      )}
                                    </td>

                                    <td className="p-3">
                                      {neighbor.weightedContribution.toFixed(
                                        4
                                      )}
                                    </td>
                                  </tr>
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <p className="flex items-start gap-2 text-xs leading-6 text-[#887E71]">
                <Info className="mt-1 h-3.5 w-3.5 shrink-0" />
                Đây là điểm do mô hình ước tính, không phải
                đánh giá thực tế của người dùng B.
              </p>
            </div>
          )}
        </section>

        <div className="flex items-center justify-center gap-2 pb-4 text-xs text-[#786E62]">
          <RefreshCw className="h-3.5 w-3.5" />
          Thử thay đổi điểm đánh giá hoặc K để quan sát
          kết quả khác nhau.
        </div>
      </main>
    </div>
  );
};
