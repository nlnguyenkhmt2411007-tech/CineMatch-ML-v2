import { useEffect, useState } from "react";
import {
  BrainCircuit,
  Users,
  Star,
  ChartNoAxesCombined,
  Search,
  Trash2,
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

export const ABLabView = () => {
  const [search, setSearch] = useState("");
  const [movies, setMovies] = useState<ApiMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ratingsA, setRatingsA] = useState<Ratings>({});
  const [ratingsB, setRatingsB] = useState<Ratings>({});
  const [movieTitles, setMovieTitles] = useState<Record<number, string>>({});

  const [targetMovieId, setTargetMovieId] = useState<number | null>(null);
  const [targetSearch, setTargetSearch] = useState("");
  const [targetMovies, setTargetMovies] = useState<ApiMovie[]>([]);
  const [targetLoading, setTargetLoading] = useState(false);
  const [k, setK] = useState(20);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [predictionResult, setPredictionResult] =
    useState<MLLabPredictionResponse | null>(null);

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

        if (!cancelled) {
          setMovies(result.items);
        }
      } catch {
        if (!cancelled) {
          setError("Không thể tải danh sách phim từ FastAPI.");
          setMovies([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
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

        if (!cancelled) {
          setTargetMovies(result.items);
        }
      } catch {
        if (!cancelled) {
          setTargetMovies([]);
        }
      } finally {
        if (!cancelled) {
          setTargetLoading(false);
        }
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

  const invalidatePrediction = () => {
    setPredictionResult(null);
    setPredictionError(null);
  };

  const runPrediction = async () => {
    if (predictionLoading) return;

    if (Object.keys(ratingsB).length === 0) {
      setPredictionError("Người dùng B cần đánh giá ít nhất một phim.");
      return;
    }

    if (targetMovieId === null) {
      setPredictionError("Vui lòng chọn phim cần dự đoán.");
      return;
    }

    if (ratingsB[targetMovieId] !== undefined) {
      setPredictionError("B đã đánh giá phim này. Hãy chọn phim chưa xem.");
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
    } catch (error) {
      setPredictionError(
        error instanceof Error
          ? error.message
          : "Không thể chạy dự đoán ML."
      );
    } finally {
      setPredictionLoading(false);
    }
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

    if (participant === "A") {
      setRatingsA((previous) => ({
        ...previous,
        [movie.movieId]: rating,
      }));
    } else {
      setRatingsB((previous) => ({
        ...previous,
        [movie.movieId]: rating,
      }));
    }
  };

  const removeRating = (
    participant: Participant,
    movieId: number
  ) => {
    invalidatePrediction();

    const setter = participant === "A" ? setRatingsA : setRatingsB;

    setter((previous) => {
      const next = { ...previous };
      delete next[movieId];
      return next;
    });
  };

  const getRatedMovies = (ratings: Ratings): RatedMovie[] =>
    Object.entries(ratings).map(([id, rating]) => ({
      movieId: Number(id),
      title: movieTitles[Number(id)] ?? `Movie #${id}`,
      rating,
    }));

  const renderParticipant = (
    participant: Participant,
    ratings: Ratings
  ) => {
    const isA = participant === "A";
    const ratedMovies = getRatedMovies(ratings);

    return (
      <div
        className={`rounded-2xl border bg-[#0D1728] p-6 ${
          isA ? "border-cyan-400/20" : "border-purple-400/20"
        }`}
      >
        <div className="mb-4 flex items-center gap-3">
          {isA ? (
            <Users className="h-6 w-6 text-cyan-300" />
          ) : (
            <Star className="h-6 w-6 text-purple-300" />
          )}

          <h2 className="text-lg font-bold text-white">
            Người dùng {participant}
          </h2>
        </div>

        <p className="mb-4 text-sm text-slate-400">
          Đã đánh giá {ratedMovies.length} phim.
          Chọn số sao cho từng phim trong kết quả tìm kiếm.
        </p>

        <div className="max-h-[340px] space-y-3 overflow-y-auto pr-1">
          {movies.map((movie) => (
            <div
              key={movie.movieId}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
            >
              <div className="mb-2 text-sm font-medium text-white">
                {movie.title}
                {movie.year ? ` (${movie.year})` : ""}
              </div>

              <select
                aria-label={`Điểm của người dùng ${participant} cho ${movie.title}`}
                value={ratings[movie.movieId] ?? ""}
                onChange={(event) => {
                  const value = Number(event.target.value);

                  if (value === 0) {
                    removeRating(participant, movie.movieId);
                  } else {
                    rateMovie(participant, movie, value);
                  }
                }}
                className="w-full rounded-lg border border-cyan-400/20 bg-[#111A2A] px-3 py-2 text-sm text-white"
              >
                <option value="">Chưa đánh giá</option>
                {Array.from({ length: 10 }, (_, index) => {
                  const rating = (index + 1) * 0.5;

                  return (
                    <option key={rating} value={rating}>
                      {rating.toFixed(1)} / 5 sao
                    </option>
                  );
                })}
              </select>
            </div>
          ))}
        </div>

        <h3 className="mb-3 mt-6 text-sm font-semibold text-cyan-200">
          Danh sách đã đánh giá
        </h3>

        {ratedMovies.length === 0 ? (
          <p className="text-sm text-slate-500">
            Chưa có phim nào được đánh giá.
          </p>
        ) : (
          <div className="space-y-2">
            {ratedMovies.map((movie) => (
              <div
                key={movie.movieId}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">
                    {movie.title}
                  </p>
                  <p className="text-xs text-amber-300">
                    {movie.rating.toFixed(1)} / 5 sao
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => removeRating(participant, movie.movieId)}
                  aria-label={`Xóa đánh giá ${movie.title}`}
                  className="rounded-lg p-2 text-slate-400 hover:bg-red-400/10 hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="min-h-screen bg-[#050A13] px-4 py-12 text-[#F5F7FB] sm:px-6">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-xs font-semibold text-cyan-300">
            <BrainCircuit className="h-4 w-4" />
            USER-BASED COLLABORATIVE FILTERING
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Phòng thực nghiệm{" "}
            <span className="bg-gradient-to-r from-cyan-300 to-purple-400 bg-clip-text text-transparent">
              ML
            </span>
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">
            Đánh giá phim với vai trò người dùng A và B để
            khám phá Cosine Similarity và User-Based CF.
          </p>
        </div>

        <div className="mb-6 rounded-2xl border border-cyan-400/15 bg-[#0D1728] p-6">
          <label
            htmlFor="ab-movie-search"
            className="mb-3 block text-sm font-semibold text-white"
          >
            Tìm kiếm phim MovieLens
          </label>

          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-cyan-300" />

            <input
              id="ab-movie-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nhập tên phim, ví dụ: Toy Story"
              className="w-full rounded-xl border border-cyan-400/20 bg-[#050A13] py-3 pl-11 pr-4 text-sm text-white outline-none focus:border-cyan-300/60"
            />
          </div>

          {loading && (
            <p className="mt-3 text-xs text-cyan-300">
              Đang tìm kiếm phim...
            </p>
          )}

          {error && (
            <p className="mt-3 text-xs text-red-300">
              {error}
            </p>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {renderParticipant("A", ratingsA)}
          {renderParticipant("B", ratingsB)}
        </div>

        <div className="mt-6 rounded-2xl border border-cyan-400/15 bg-[#0D1728] p-6">
          <div className="mb-4 flex items-center gap-3">
            <ChartNoAxesCombined className="h-6 w-6 text-cyan-300" />
            <h2 className="text-lg font-bold text-white">
              Kết quả thực nghiệm
            </h2>
          </div>

          <p className="mb-6 text-sm text-slate-400">
            A đã đánh giá {Object.keys(ratingsA).length} phim;
            B đã đánh giá {Object.keys(ratingsB).length} phim.
          </p>

          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <label
                htmlFor="ab-target-search"
                className="mb-2 block text-sm font-semibold text-white"
              >
                Tìm phim cần dự đoán cho B
              </label>

              <input
                id="ab-target-search"
                value={targetSearch}
                onChange={(event) => {
                  setTargetSearch(event.target.value);
                  setTargetMovieId(null);
                  invalidatePrediction();
                }}
                placeholder="Ví dụ: Shawshank"
                className="mb-3 w-full rounded-xl border border-cyan-400/20 bg-[#050A13] p-3 text-sm text-white outline-none focus:border-cyan-300/60"
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
                className="w-full rounded-xl border border-cyan-400/20 bg-[#111A2A] p-3 text-sm text-white"
              >
                <option value="">
                  {targetLoading ? "Đang tải phim..." : "Chọn phim chưa đánh giá"}
                </option>

                {targetMovies
                  .filter((movie) => ratingsB[movie.movieId] === undefined)
                  .map((movie) => (
                    <option key={movie.movieId} value={movie.movieId}>
                      {movie.title} ({movie.movieId})
                    </option>
                  ))}
              </select>

              {targetMovieId !== null && (
                <p className="mt-2 text-xs text-cyan-300">
                  Movie ID: {targetMovieId}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="ab-neighbor-k"
                className="mb-2 block text-sm font-semibold text-white"
              >
                Số hàng xóm K
              </label>

              <select
                id="ab-neighbor-k"
                value={k}
                onChange={(event) => {
                  setK(Number(event.target.value));
                  invalidatePrediction();
                }}
                className="w-full rounded-xl border border-cyan-400/20 bg-[#111A2A] p-3 text-sm text-white"
              >
                {[1, 3, 5, 10, 15, 20].map((value) => (
                  <option key={value} value={value}>
                    K = {value}
                  </option>
                ))}
              </select>

              <p className="mt-3 text-xs leading-5 text-slate-400">
                Thuật toán chọn tối đa K người dùng có độ tương đồng
                dương và đã đánh giá phim cần dự đoán.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void runPrediction()}
            disabled={predictionLoading}
            className="mt-6 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-50"
          >
            {predictionLoading ? "Đang tính toán..." : "Chạy thực nghiệm ML"}
          </button>

          {predictionError && (
            <p role="alert" className="mt-4 text-sm text-red-300">
              {predictionError}
            </p>
          )}

          {predictionResult && (
            <div className="mt-8 space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-5">
                  <p className="text-xs text-slate-400">
                    Cosine Similarity A–B
                  </p>
                  <p className="mt-2 text-2xl font-bold text-cyan-300">
                    {predictionResult.comparison.similarity.toFixed(4)}
                  </p>
                </div>

                <div className="rounded-xl border border-purple-400/20 bg-purple-400/5 p-5">
                  <p className="text-xs text-slate-400">
                    Điểm dự đoán cho B
                  </p>
                  <p className="mt-2 text-2xl font-bold text-purple-300">
                    {predictionResult.prediction.predictedRating.toFixed(2)} ★
                  </p>
                </div>

                <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-5">
                  <p className="text-xs text-slate-400">
                    Số hàng xóm thực tế
                  </p>
                  <p className="mt-2 text-2xl font-bold text-amber-300">
                    {predictionResult.prediction.neighborCount}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <h3 className="mb-3 text-base font-bold text-white">
                  Giải thích dự đoán
                </h3>

                <p className="text-sm text-slate-300">
                  Phim: {predictionResult.title}
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  Số phim A và B cùng đánh giá:{" "}
                  {predictionResult.comparison.commonCount}
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  Điểm trung bình của B:{" "}
                  {predictionResult.prediction.baseline.toFixed(4)}
                </p>

                <div className="mt-4 rounded-lg bg-[#050A13] p-4 font-mono text-xs leading-7 text-cyan-200">
                  <p>Prediction = Mean(B) + Numerator / Denominator</p>
                  <p>
                    = {predictionResult.prediction.baseline.toFixed(4)}
                    {" + "}
                    {predictionResult.prediction.numerator.toFixed(4)}
                    {" / "}
                    {predictionResult.prediction.denominator.toFixed(4)}
                  </p>
                  <p className="text-slate-400">
                    Kết quả được giới hạn trong thang 0,5–5 sao.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <h3 className="mb-4 text-base font-bold text-white">
                  Top-K hàng xóm đóng góp
                </h3>

                {predictionResult.prediction.neighbors.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    Không có hàng xóm có độ tương đồng dương.
                    Kết quả sử dụng điểm trung bình của B.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-white/10 text-slate-400">
                        <tr>
                          <th className="px-3 py-3">Người dùng</th>
                          <th className="px-3 py-3">Similarity</th>
                          <th className="px-3 py-3">Điểm phim</th>
                          <th className="px-3 py-3">Độ lệch</th>
                          <th className="px-3 py-3">Đóng góp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {predictionResult.prediction.neighbors.map(
                          (neighbor, index) => (
                            <tr
                              key={`${neighbor.source}-${neighbor.userId}-${index}`}
                              className="border-b border-white/5 text-slate-200"
                            >
                              <td className="px-3 py-3">
                                {neighbor.source === "A"
                                  ? "Người dùng A"
                                  : `MovieLens #${neighbor.userId}`}
                              </td>
                              <td className="px-3 py-3">
                                {neighbor.similarity.toFixed(4)}
                              </td>
                              <td className="px-3 py-3">
                                {neighbor.rating.toFixed(1)}
                              </td>
                              <td className="px-3 py-3">
                                {neighbor.deviation.toFixed(4)}
                              </td>
                              <td className="px-3 py-3">
                                {neighbor.weightedContribution.toFixed(4)}
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
      </div>
    </section>
  );
};

