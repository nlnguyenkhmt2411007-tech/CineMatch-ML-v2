import { useEffect, useState } from "react";
import { Film } from "lucide-react";
import { fetchFeaturedMovies } from "../../services/featuredApi";
import { cineMatchApi } from "../../services/api";

type RealPoster = { movieId: number; title: string; posterUrl: string; year?: number | null };

// These are genuine MovieLens movie IDs, queried through the existing enrichment API.
// They are NOT rendered with made-up artwork or synthetic titles.
const MOVIELENS_FALLBACK_IDS = [79132, 2571, 1, 318, 296, 260, 356, 2959, 593, 589, 4993, 110];
let posterCache: RealPoster[] | null = null;
let pendingPosters: Promise<RealPoster[]> | null = null;

function collectRealPosters(rows: Array<{ movieId: number; title: string; posterUrl?: string | null; year?: number | null }>): RealPoster[] {
  const unique = new Map<number, RealPoster>();
  for (const row of rows) {
    if (row.movieId && row.title && row.posterUrl?.startsWith("http")) {
      unique.set(row.movieId, {
        movieId: row.movieId,
        title: row.title,
        posterUrl: row.posterUrl,
        year: row.year,
      });
    }
  }
  return [...unique.values()];
}

async function loadPosterCatalog(): Promise<RealPoster[]> {
  if (posterCache?.length) return posterCache;
  if (!pendingPosters) {
    pendingPosters = (async () => {
      let featured: RealPoster[] = [];
      try {
        // Reuse the same MovieLens + TMDb featured data already used by App.tsx.
        featured = collectRealPosters(await fetchFeaturedMovies(16));
      } catch {
        // Missing featured posters must never prevent logging in.
      }
      if (featured.length >= 8) return featured;
      const missingIds = MOVIELENS_FALLBACK_IDS.filter((id) => !featured.some((p) => p.movieId === id));
      const results = await Promise.allSettled(missingIds.slice(0, 12).map((id) => cineMatchApi.getEnrichedMovie(id)));
      const additional = results.flatMap((r) => r.status === "fulfilled" ? [r.value] : []);
      return collectRealPosters([...featured, ...additional]);
    })().then((rows) => {
      posterCache = rows;
      return rows;
    }).finally(() => { pendingPosters = null; });
  }
  return pendingPosters;
}

function PosterCard({ movie }: { movie: RealPoster }) {
  return (
    <div className="cm-cinema-poster" title={movie.title}>
      <img src={movie.posterUrl} alt={`Poster phim ${movie.title}`} loading="lazy" decoding="async" />
      <span className="cm-cinema-poster-caption">{movie.title}</span>
    </div>
  );
}

/** A gentle, looped mosaic of authentic MovieLens posters, enriched by TMDb. */
export function CinemaPosterReel({ small = false }: { small?: boolean }) {
  const [posters, setPosters] = useState<RealPoster[]>(posterCache ?? []);
  useEffect(() => {
    let active = true;
    void loadPosterCatalog().then((rows) => {
      if (active) setPosters(rows);
    }).catch(() => { /* Movie pictures are optional decoration. */ });
    return () => { active = false; };
  }, []);

  if (posters.length === 0) {
    return (
      <div className="cm-cinema-reel cm-cinema-reel--empty" aria-label="Không tải được poster phim">
        <div className="cm-cinema-empty"><Film size={44} strokeWidth={1.2} /><span>MovieLens × TMDb</span></div>
      </div>
    );
  }

  const columns = small ? 2 : 3;
  return (
    <div className={`cm-cinema-reel ${small ? "cm-cinema-reel--small" : ""}`} aria-label="Poster các bộ phim thực từ MovieLens">
      <div className="cm-cinema-reel-grid">
        {Array.from({ length: columns }, (_, index) => {
          // Repeat each real poster in two identical sets for the infinite loop.
          const films = posters.filter((_, i) => i % columns === index);
          const safeFilms = films.length ? films : posters.slice(0, 4);
          return (
            <div key={index} className={`cm-cinema-column cm-cinema-column--${index + 1}`}>
              <div className="cm-cinema-track">
                <div className="cm-cinema-track-set">{safeFilms.map((p) => <PosterCard key={p.movieId} movie={p} />)}</div>
                <div className="cm-cinema-track-set" aria-hidden="true">{safeFilms.map((p) => <PosterCard key={`repeat-${p.movieId}`} movie={p} />)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
