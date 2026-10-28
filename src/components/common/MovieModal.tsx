import React, { useEffect, useState } from 'react';
import { X, Star, Sparkles, ExternalLink, Sliders, CheckCircle2, Bookmark, Film, Play, Loader2 } from 'lucide-react';
import { Movie } from '../../types';
import { ALL_GENRES } from '../../data/mockMovies';
import { getMovieGenreVector, getSimilarMoviesByContent } from '../../services/recommender';

interface MovieModalProps {
  movie: Movie | null;
  onClose: () => void;
  onSelectMovie: (movie: Movie) => void;
  allMovies: Movie[];
  userRating?: number;
  onRateMovie: (movieId: number, rating: number) => void;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
}

export const MovieModal: React.FC<MovieModalProps> = ({
  movie,
  onClose,
  onSelectMovie,
  allMovies,
  userRating,
  onRateMovie,
  isBookmarked,
  onToggleBookmark
}) => {


  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [ratedToast, setRatedToast] = useState(false);

  const [trailerData, setTrailerData] = useState<{
    available: boolean;
    videoKey: string | null;
    title?: string;
    message?: string;
  } | null>(null);

  const [trailerLoading, setTrailerLoading] = useState(false);
  const [trailerError, setTrailerError] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);

  useEffect(() => {
    setTrailerData(null);
    setTrailerError(false);
    setShowTrailer(false);

    if (!movie) {
      setTrailerLoading(false);
      return;
    }

    let cancelled = false;
    setTrailerLoading(true);

    async function loadTrailer() {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/api/movies/${movie!.movieId}/trailer`
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!cancelled) {
          setTrailerData(data);
          setTrailerError(false);
        }
      } catch {
        if (!cancelled) {
          setTrailerError(true);
        }
      } finally {
        if (!cancelled) {
          setTrailerLoading(false);
        }
      }
    }

    void loadTrailer();

    return () => {
      cancelled = true;
    };
  }, [movie?.movieId]);

  // Item-to-Item Content-Based similar movies
  const similarMovies = movie
    ? getSimilarMoviesByContent(movie, allMovies, 4)
    : [];

  const [enrichedMovies, setEnrichedMovies] = useState<Map<number, Movie>>(
    new Map()
  );

  useEffect(() => {
    if (!movie) {
      setEnrichedMovies(new Map());
      return;
    }

    let cancelled = false;

    async function loadPosters() {
      const results = await Promise.all(
        similarMovies.map(async (item) => {
          try {
            const response = await fetch(
              `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/api/movies/enriched/${item.movie.movieId}`
            );

            if (!response.ok) return null;

            const enriched = (await response.json()) as Movie;

            return [item.movie.movieId, enriched] as const;
          } catch {
            return null;
          }
        })
      );

      if (!cancelled) {
        setEnrichedMovies(
          new Map(
            results.filter(
              (entry): entry is readonly [number, Movie] =>
                entry !== null
            )
          )
        );
      }
    }

    void loadPosters();

    return () => {
      cancelled = true;
    };
  }, [movie?.movieId, allMovies]);

  if (!movie) return null;
  const genreVector = movie ? getMovieGenreVector(movie) : [];

  const handleRatingSubmit = (score: number) => {
    onRateMovie(movie.movieId, score);
    setRatedToast(true);
    setTimeout(() => setRatedToast(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-[#090A0E]/85 backdrop-blur-md transition-opacity" 
      />

      {/* Modal Dialog Card (rounded 10px dashboard card per spec) */}
      <div className="relative w-full max-w-4xl bg-[#11141C] border border-white/[0.08] rounded-[10px] shadow-2xl overflow-hidden z-10 max-h-[90vh] flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-[8px] bg-[#090A0E]/80 border border-white/10 text-[#9EA3AE] hover:text-[#F5F2EA] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header / Backdrop Hero Area */}
        <div className="relative h-64 sm:h-72 w-full shrink-0 overflow-hidden bg-[#090A0E]">
          <img
            src={movie.backdropUrl || movie.posterUrl}
            alt={movie.title}
            className="w-full h-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#11141C] via-[#11141C]/60 to-transparent" />

          {/* Floating Movie Header Info */}
          <div className="absolute bottom-6 left-6 right-6 flex items-end gap-6">
            <div className="hidden sm:block w-28 aspect-[2/3] shrink-0 rounded-[8px] overflow-hidden border border-white/15 shadow-lg bg-[#090A0E]">
              <img
                src={movie.posterUrl}
                alt={movie.title}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 text-xs text-[#9EA3AE]">
                <span>Mã phim (MovieLens ID): #{movie.movieId}</span>
                <span aria-hidden="true">·</span>
                <span>Năm {movie.year}</span>
                <span aria-hidden="true">·</span>
                <span className="text-[#E8B65B] flex items-center gap-1 font-medium">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  {movie.avgRating.toFixed(2)}/5.0 ({movie.ratingsCount} lượt đánh giá)
                </span>
              </div>

              <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#F5F2EA] leading-tight">
                {movie.title}
              </h2>

              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                {movie.genres.map((g) => (
                  <span
                    key={g}
                    className="px-2.5 py-1 rounded-[6px] bg-[#191D27] border border-white/[0.08] text-[#F5F2EA] font-medium"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-[#9EA3AE]">
          {/* Main synopsis */}
          <div className="space-y-2">
            <h4 className="font-display font-semibold text-xs uppercase tracking-wider text-[#F5F2EA]">
              Tóm tắt nội dung
            </h4>
            <p className="text-sm leading-relaxed text-[#F5F2EA]/90 font-light">
              {movie.synopsis}
            </p>
          </div>

          {/* Official YouTube Trailer */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="font-display font-semibold text-xs uppercase tracking-wider text-[#F5F2EA] flex items-center gap-2">
                  <Play className="w-4 h-4 text-[#E8B65B]" />
                  Trailer phim
                </h4>
                <p className="text-xs text-[#9EA3AE] mt-1">
                  Xem trailer YouTube ngay trong CineMatch.
                </p>
              </div>

              {trailerData?.available && trailerData.videoKey && (
                <button
                  type="button"
                  onClick={() => setShowTrailer((current) => !current)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[8px] bg-[#E8B65B] text-[#11141C] font-semibold text-xs hover:bg-[#F5C779] transition-colors"
                >
                  {showTrailer ? (
                    <X className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                  {showTrailer ? 'Đóng trailer' : 'Xem trailer'}
                </button>
              )}
            </div>

            {trailerLoading && (
              <div className="flex items-center gap-2 rounded-[8px] border border-white/10 bg-[#191D27] p-4 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-[#E8B65B]" />
                Đang tìm trailer chính thức...
              </div>
            )}

            {!trailerLoading && trailerError && (
              <div className="rounded-[8px] border border-white/10 bg-[#191D27] p-4 text-xs">
                Chưa thể tải trailer. Vui lòng thử lại sau.
              </div>
            )}

            {!trailerLoading && !trailerError && trailerData && !trailerData.available && (
              <div className="rounded-[8px] border border-white/10 bg-[#191D27] p-4 text-xs">
                {trailerData.message || 'Phim này hiện chưa có trailer YouTube.'}
              </div>
            )}

            {showTrailer && trailerData?.available && trailerData.videoKey && (
              <div className="overflow-hidden rounded-[10px] border border-[#E8B65B]/30 bg-black shadow-xl">
                <div className="aspect-video w-full">
                  <iframe
                    key={`${movie.movieId}-${trailerData.videoKey}`}
                    src={`https://www.youtube-nocookie.com/embed/${trailerData.videoKey}?autoplay=1&rel=0`}
                    title={`Trailer ${movie.title}`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
                <div className="px-3 py-2 text-[11px] text-[#9EA3AE]">
                  {trailerData.title || 'Trailer phim'} · Nguồn: TMDb / YouTube
                </div>
              </div>
            )}
          </div>
          {/* Interactive Rating Studio Section */}
          <div className="p-4 rounded-[8px] bg-[#191D27] border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-semibold text-[#F5F2EA] uppercase tracking-wider flex items-center gap-2">
                <Star className="w-4 h-4 text-[#E8B65B]" />
                Đánh giá của bạn cho phim này
              </h4>
              <p className="text-xs text-[#9EA3AE] mt-0.5">
                Thang điểm từ 0.5 đến 5.0 (bước 0.5) chuẩn MovieLens. Giúp cá nhân hóa danh sách đề xuất.
              </p>
            </div>

            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((starVal) => {
                const isFilled = (hoverRating !== null ? hoverRating : (userRating || 0)) >= starVal;
                return (
                  <button
                    key={starVal}
                    onMouseEnter={() => setHoverRating(starVal)}
                    onMouseLeave={() => setHoverRating(null)}
                    onClick={() => handleRatingSubmit(starVal)}
                    className="p-1 text-lg transition-transform hover:scale-125 focus:outline-none"
                    title={`Chấm ${starVal} sao`}
                  >
                    <Star
                      className={`w-6 h-6 ${
                        isFilled
                          ? 'text-[#E8B65B] fill-[#E8B65B]'
                          : 'text-[#9EA3AE]/30'
                      }`}
                    />
                  </button>
                );
              })}
              {userRating && (
                <span className="ml-2 font-mono text-xs text-[#E8B65B] font-semibold">
                  {userRating.toFixed(1)}★
                </span>
              )}
            </div>
          </div>

          {ratedToast && (
            <div className="flex items-center gap-2 p-3 rounded-[8px] bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>Đã lưu điểm đánh giá! Hồ sơ người dùng và đề xuất tương tác đã được cập nhật lại theo thời gian thực.</span>
            </div>
          )}

          {/* Multi-Hot Vector Encoding Inspector (Machine Learning Explanatory View) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="font-display font-semibold text-xs uppercase tracking-wider text-[#F5F2EA] flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-[#E8B65B]" />
                Vector nhị phân thể loại (Multi-Hot Feature Vector $x_i$)
              </h4>
              <span className="text-[11px] font-mono text-[#9EA3AE]">
                18 chiều · Chuẩn mã hóa trong đồ án CTUT
              </span>
            </div>
            <div className="p-3 bg-[#090A0E] rounded-[8px] border border-white/[0.08] overflow-x-auto">
              <div className="flex flex-wrap gap-1.5">
                {ALL_GENRES.map((genre, idx) => {
                  const isActive = genreVector[idx] === 1;
                  return (
                    <div
                      key={genre}
                      className={`px-2 py-1 rounded-[4px] text-[11px] font-mono border flex items-center gap-1.5 transition-colors ${
                        isActive
                          ? 'bg-[#E8B65B]/15 border-[#E8B65B]/40 text-[#E8B65B] font-semibold'
                          : 'bg-[#11141C] border-white/[0.04] text-[#9EA3AE]/50'
                      }`}
                    >
                      <span>{genre}</span>
                      <span className={`text-[10px] px-1 rounded ${isActive ? 'bg-[#E8B65B] text-[#090A0E]' : 'bg-white/5'}`}>
                        {genreVector[idx]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Content-Based Similar Movies Section (Item-to-Item Cosine Similarity) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="font-display font-semibold text-xs uppercase tracking-wider text-[#F5F2EA] flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#E8B65B]" />
                Phim có độ tương đồng thể loại cao nhất (Item-to-Item Cosine Similarity)
              </h4>
              <span className="text-[11px] font-mono text-[#E8B65B]">
                [Demo Engine]
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {similarMovies.map((simItem) => (
                <div
                  key={simItem.movie.movieId}
                  onClick={() => onSelectMovie(enrichedMovies.get(simItem.movie.movieId) ?? simItem.movie)}
                  className="group/item p-2 rounded-[8px] bg-[#191D27] border border-white/[0.08] hover:border-[#E8B65B]/40 cursor-pointer transition-all flex flex-col justify-between"
                >
                  <div className="aspect-[2/3] w-full rounded-[6px] overflow-hidden bg-[#090A0E] mb-2 relative">
                    {(
                      enrichedMovies.get(simItem.movie.movieId)?.posterUrl ??
                      simItem.movie.posterUrl
                    ) ? (
                      <img
                        src={
                          enrichedMovies.get(simItem.movie.movieId)?.posterUrl ??
                          simItem.movie.posterUrl
                        }
                        alt={simItem.movie.title}
                        className="w-full h-full object-cover group-hover/item:scale-105 transition-transform"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Film className="h-8 w-8 text-[#E8B65B]/50" />
                      </div>
                    )}
                    <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-[3px] bg-[#090A0E]/90 text-[10px] font-mono text-[#E8B65B] border border-[#E8B65B]/30">
                      {Math.round(simItem.similarityScore * 100)}%
                    </div>
                  </div>
                  <div>
                    <h5 className="font-display font-medium text-xs text-[#F5F2EA] line-clamp-1 group-hover/item:text-[#E8B65B]">
                      {simItem.movie.title}
                    </h5>
                    <p className="text-[10px] text-[#9EA3AE] mt-0.5">
                      {simItem.movie.year} · {simItem.movie.genres[0]}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* External links */}
          <div className="pt-2 flex items-center justify-between text-xs text-[#9EA3AE] border-t border-white/[0.06]">
            <div className="flex items-center gap-4">
              {movie.imdbId && (
                <a
                  href={`https://www.imdb.com/title/tt${movie.imdbId}/`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 hover:text-[#E8B65B] transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Tra cứu trên IMDb (tt{movie.imdbId})</span>
                </a>
              )}
              {movie.tmdbId && (
                <a
                  href={`https://www.themoviedb.org/movie/${movie.tmdbId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 hover:text-[#E8B65B] transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>TMDb #{movie.tmdbId}</span>
                </a>
              )}
            </div>

            {movie.tags && movie.tags.length > 0 && (
              <div className="hidden sm:flex items-center gap-1 text-[11px]">
                <span className="text-[#9EA3AE]/60">Tags:</span>
                <span className="text-[#9EA3AE]">{movie.tags.slice(0, 3).join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

