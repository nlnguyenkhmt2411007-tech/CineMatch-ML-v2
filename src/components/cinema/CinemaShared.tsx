import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Clapperboard, Film, Layers3, Star, Users } from "lucide-react";
import { cineMatchApi } from "../../services/api";
import type { Movie } from "../../types";

export interface RankedMovie {
  movieId: number;
  title: string;
  year?: number | null;
  genres?: string[];
  similarity?: number;
  predicted_rating?: number;
  neighbor_count?: number;
}

interface MovieExtra {
  movieId: number;
  title: string;
  year?: number | null;
  genres?: string[];
  posterUrl?: string | null;
  backdropUrl?: string | null;
  synopsis?: string | null;
  avgRating?: number | null;
  ratingsCount?: number;
  imdbId?: string | null;
  tmdbId?: number | null;
}

export function useCinePosters(items: RankedMovie[], heroId?: number) {
  const [extras, setExtras] = useState<Record<number, MovieExtra>>({});
  const key = items.map(m => m.movieId).join(",") + ";" + (heroId ?? "");

  useEffect(() => {
    let active = true;
    const ids = Array.from(new Set([
      ...items.slice(0, 10).map(item => item.movieId),
      ...(heroId ? [heroId] : []),
    ]));
    // Individual TMDb failures cannot prevent the MovieLens ranking from rendering.
    ids.forEach(id => {
      void cineMatchApi.getEnrichedMovie(id).then(movie => {
        if (active) setExtras(old => ({ ...old, [id]: movie }));
      }).catch(() => undefined);
    });
    return () => { active = false; };
  }, [key]);
  return extras;
}

export function toModalMovie(row: RankedMovie, extra?: MovieExtra, local?: Movie): Movie {
  return {
    movieId: row.movieId,
    title: row.title || extra?.title || local?.title || `Phim #${row.movieId}`,
    year: extra?.year ?? row.year ?? local?.year ?? 0,
    genres: extra?.genres ?? row.genres ?? local?.genres ?? [],
    posterUrl: extra?.posterUrl ?? local?.posterUrl ?? "",
    backdropUrl: extra?.backdropUrl ?? local?.backdropUrl ?? "",
    synopsis: extra?.synopsis ?? local?.synopsis ?? "",
    avgRating: extra?.avgRating ?? local?.avgRating ?? 0,
    ratingsCount: extra?.ratingsCount ?? local?.ratingsCount ?? 0,
    ...(extra?.imdbId ? { imdbId: extra.imdbId } : {}),
    ...(extra?.tmdbId ? { tmdbId: extra.tmdbId } : {}),
  };
}

export function CinemaHero({ eyebrow, title, subtitle, backdrop, icon, children }: {
  eyebrow: string; title: ReactNode; subtitle: string; backdrop?: string | null;
  icon: ReactNode; children?: ReactNode;
}) {
  return <section className="cm-cinema-hero">
    {backdrop && <div className="cm-cinema-hero-backdrop" style={{backgroundImage: `url(${backdrop})`}} aria-hidden="true"/>}
    <div className="cm-cinema-hero-shade" aria-hidden="true"/>
    <div className="cm-cinema-hero-content">
      <div className="cm-cinema-crumb"><Clapperboard size={15}/> {eyebrow}</div>
      <div className="cm-cinema-heading">{icon}<h1>{title}</h1></div>
      <p>{subtitle}</p>
      {children}
    </div>
  </section>;
}

export function CinemaRecommendations({ title, description, movies, extras, loading, error, kind, onSelectMovie, localMovies }: {
  title: string; description: string; movies: RankedMovie[];
  extras: Record<number, MovieExtra>; loading: boolean; error: string;
  kind: "similarity" | "rating"; onSelectMovie: (movie: Movie) => void; localMovies: Movie[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  return <section className="cm-cinema-results">
    <div className="cm-cinema-results-head">
      <div><div className="cm-cinema-kicker"><Film size={17}/> TUYỂN CHỌN CHO BẠN</div><h2>{title}</h2><p>{description}</p></div>
      <div className="cm-cinema-arrows"><button type="button" aria-label="Cuộn về trái" onClick={() => scrollRef.current?.scrollBy({left: -640, behavior: "smooth"})}><ArrowLeft size={19}/></button><button type="button" aria-label="Cuộn về phải" onClick={() => scrollRef.current?.scrollBy({left: 640, behavior: "smooth"})}><ArrowRight size={19}/></button></div>
    </div>
    {loading && <div className="cm-modern-skeleton-grid" role="status" aria-label="Đang tải phim gợi ý">
      {[0,1,2,3,4].map(index => <div className="cm-modern-skeleton-card" key={index} aria-hidden="true"><div className="cm-modern-skeleton-poster"/><div className="cm-modern-skeleton-line"/><div className="cm-modern-skeleton-line short"/></div>)}
      <span className="sr-only">Đang tải phim gợi ý…</span>
    </div>}
    {!loading && error && <div className="cm-cinema-message error" role="alert">Không tải được kết quả: {error}</div>}
    {!loading && !error && movies.length === 0 && <div className="cm-cinema-message">Chưa có phim phù hợp với lựa chọn này.</div>}
    {!loading && !error && movies.length > 0 && <div className="cm-cinema-track" ref={scrollRef}>
      {movies.slice(0, 10).map((row, idx) => {
        const extra = extras[row.movieId];
        const local = localMovies.find(x => x.movieId === row.movieId);
        const poster = extra?.posterUrl || local?.posterUrl;
        const genres = extra?.genres ?? row.genres ?? local?.genres ?? [];
        const value = kind === "similarity" ? row.similarity : row.predicted_rating;
        return <button type="button" className="cm-cinema-movie" key={`${row.movieId}-${idx}`} onClick={() => onSelectMovie(toModalMovie(row, extra, local))} title={`Xem chi tiết ${row.title}`}>
          <div className="cm-cinema-poster">
            {poster ? <img src={poster} loading="lazy" alt={`Poster ${row.title}`}/> : <div className="cm-cinema-poster-missing"><Film size={32}/><span>{row.title}</span></div>}
            <span className="cm-cinema-rank">#{idx+1}</span>
          </div>
          <strong className="cm-cinema-movie-name">{row.title}</strong>
          <span className="cm-cinema-movie-score">{kind === "rating" ? <Star size={15} fill="currentColor"/> : <Layers3 size={15}/>} {kind === "rating" ? "Dự đoán" : "Giống thể loại"}: <b>{typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "—"}{kind === "rating" ? " / 5" : ""}</b></span>
          <span className="cm-cinema-movie-genres">{genres.slice(0,3).join(" · ") || `MovieLens #${row.movieId}`}</span>
          {kind === "rating" && typeof row.neighbor_count === "number" && row.neighbor_count > 0 && <span className="cm-cinema-movie-neighbors"><Users size={12}/> {row.neighbor_count} láng giềng góp điểm</span>}
        </button>;
      })}
    </div>}
  </section>;
}

export function CinemaHowItWorks({ steps, note }: {steps: Array<{title: string; desc: string}>; note: string}) {
  return <details className="cm-cinema-how">
    <summary className="cm-cinema-how-label">Tìm hiểu cách CineMatch gợi ý phim <ArrowRight size={16}/></summary>
    <div className="cm-cinema-how-steps">{steps.map((s,i) => <div key={s.title} className="cm-cinema-how-step"><div className="cm-cinema-how-num">{i+1}</div><div><strong>{s.title}</strong><span>{s.desc}</span></div></div>)}</div>
    <p>{note}</p>
  </details>;
}
