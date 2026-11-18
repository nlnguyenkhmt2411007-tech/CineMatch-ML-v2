import { useEffect, useState } from "react";
import { ArrowRight, Clapperboard, Film, Heart, RefreshCcw, Sparkles, Star } from "lucide-react";
import { authApi, type AuthAccount, type ColdStartMovie, type ColdStartResult } from "../../services/authApi";
import { cineMatchApi } from "../../services/api";
import type { Movie } from "../../types";

interface Props {
  account: AuthAccount;
  onSelectMovie: (movie: Movie) => void;
  onExplore: () => void;
  onRate: () => void;
  onEditGenres: () => void;
}

function toMovie(row: ColdStartMovie, more?: Partial<Movie>): Movie {
  return {
    movieId: row.movieId,
    title: row.title,
    year: row.year ?? 0,
    genres: row.genres,
    posterUrl: more?.posterUrl ?? "",
    backdropUrl: more?.backdropUrl ?? "",
    synopsis: more?.synopsis ?? "",
    avgRating: row.avgRating ?? 0,
    ratingsCount: row.ratingsCount,
    ...(more ?? {}),
  };
}

export function PersonalRecommendations({ account, onSelectMovie, onExplore, onRate, onEditGenres }: Props) {
  const [result, setResult] = useState<ColdStartResult | null>(null);
  const [posters, setPosters] = useState<Record<number, Partial<Movie>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const ratingsFingerprint = JSON.stringify(account.ratings);
  const genresFingerprint = account.preferredGenres.join("|");

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    authApi.recommendations(10).then((value) => {
      if (!live) return;
      setResult(value);
      setLoading(false);
      for (const movie of value.items) {
        cineMatchApi.getEnrichedMovie(movie.movieId).then((enriched) => {
          if (!live) return;
          setPosters((current) => ({ ...current, [movie.movieId]: {
            posterUrl: enriched.posterUrl ?? "",
            backdropUrl: enriched.backdropUrl ?? "",
            synopsis: enriched.synopsis ?? "",
            tmdbId: enriched.tmdbId ?? undefined,
            imdbId: enriched.imdbId ?? undefined,
          } }));
        }).catch(() => { /* Poster is optional; metadata from MovieLens remains visible. */ });
      }
    }).catch((err: unknown) => {
      if (!live) return;
      setError(err instanceof Error ? err.message : "Không tải được gợi ý phim.");
      setLoading(false);
    });
    return () => { live = false; };
  }, [ratingsFingerprint, genresFingerprint, refresh]);

  const description = result?.source === "rated_movies"
    ? "Từ những bộ phim bạn yêu thích."
    : result?.source === "selected_genres"
      ? "Dựa trên những thể loại bạn đã chọn."
      : "Những bộ phim đáng để khám phá.";

  return (
    <div className="cm-personal-film-page min-h-[70vh] bg-[#090A0E] text-white">
      <div className="cm-personal-film-hero relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#201C19] via-[#11151D] to-[#0B0E15]">
        <div className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full bg-[#E8BF82]/10 blur-[80px]" />
        <div className="relative mx-auto max-w-[1320px] px-5 py-12 sm:px-9 sm:py-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E8BF82]/30 bg-[#E8BF82]/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-[#f1cd97]"><Sparkles size={15} /> DÀNH RIÊNG CHO BẠN</div>
          <h1 className="mt-5 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-5xl">Chọn phim hợp <span className="text-[#E8BF82]">gu của bạn.</span></h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">{description}</p>
          <div className="mt-6 flex flex-wrap gap-2">{account.preferredGenres.map((genre) => <span key={genre} className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-slate-200">{genre}</span>)}<button onClick={onEditGenres} className="rounded-full border border-[#E8BF82]/30 px-3 py-1.5 text-xs font-semibold text-[#E8BF82] hover:bg-[#E8BF82]/10">Chỉnh sửa thể loại</button></div>
          <div className="mt-7 flex flex-wrap items-center gap-3"><button onClick={onExplore} className="flex items-center gap-2 rounded-xl bg-[#E8BF82] px-5 py-3 text-sm font-bold text-[#1f160b] hover:brightness-110">Khám phá phim <ArrowRight size={17}/></button><button onClick={onRate} className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm text-white hover:bg-white/10"><Star size={16}/> Đánh giá phim</button></div>
          <p className="mt-5 text-xs text-slate-400">{Object.keys(account.ratings).length} phim bạn đã đánh giá</p>
        </div>
      </div>
      <section className="mx-auto max-w-[1320px] px-5 py-11 sm:px-9">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4"><div><h2 className="flex items-center gap-2 text-xl font-extrabold sm:text-2xl"><Heart className="text-[#E8BF82]" /> Phim dành cho bạn</h2></div><button onClick={() => setRefresh((n) => n + 1)} className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/10"><RefreshCcw size={15} /> Tải lại</button></div>
        {loading && <div className="flex min-h-52 items-center justify-center gap-3 rounded-2xl border border-white/10 text-slate-400"><Clapperboard className="animate-pulse text-[#E8BF82]" /> Đang tìm phim phù hợp...</div>}
        {error && <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-5 text-sm text-rose-200" role="alert">{error}</div>}
        {!loading && !error && result?.items.length === 0 && <p className="rounded-xl border border-white/10 p-6 text-slate-400">Chưa có phim phù hợp. Hãy thử thay đổi thể loại yêu thích.</p>}
        {!loading && result && <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:gap-6">{result.items.map((movie, i) => {
          const enriched = posters[movie.movieId];
          const posterUrl = enriched?.posterUrl;
          return <button key={movie.movieId} onClick={() => onSelectMovie(toMovie(movie, enriched))} className="group overflow-hidden rounded-2xl border border-white/10 bg-[#111827] text-left transition hover:-translate-y-1 hover:border-[#E8BF82]/50 hover:shadow-lg hover:shadow-black/40"><div className="relative aspect-[2/3] overflow-hidden bg-gradient-to-br from-[#243b64] via-[#293055] to-[#5e345c]">{posterUrl ? <img src={posterUrl} alt={`Poster ${movie.title}`} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" /> : <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-3 text-center text-slate-300"><Film size={34} /><span className="line-clamp-3 text-sm font-bold">{movie.title}</span></div>}<span className="absolute left-3 top-3 rounded-lg bg-[#080d1c]/90 px-2.5 py-1 text-xs font-bold text-[#E8BF82]">#{i + 1}</span></div><div className="p-3.5"><h3 className="line-clamp-2 min-h-10 text-sm font-bold text-slate-100">{movie.title}</h3><p className="mt-1 text-xs text-slate-400">{movie.year ?? "—"} · {movie.genres.slice(0,2).join(", ")}</p><p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#E8BF82]"><Sparkles size={13} /> Độ tương đồng {movie.similarity.toFixed(2)}</p></div></button>;
        })}</div>}
        <details className="cm-film-method-note mt-8 rounded-xl border border-white/10 bg-white/[.03] p-4 text-xs leading-6 text-slate-400"><summary>Phim được chọn cho bạn như thế nào?</summary><p>Đề xuất sử dụng độ tương đồng nội dung giữa các thể loại bạn thích và từng bộ phim. Đây không phải xác suất bạn sẽ thích hay điểm dự đoán từ mô hình gợi ý cộng tác.</p></details>
      </section>
    </div>
  );
}
