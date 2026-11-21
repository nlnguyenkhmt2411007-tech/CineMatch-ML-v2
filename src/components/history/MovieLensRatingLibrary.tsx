import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Film, Heart, History, Search, ShieldCheck, Star, X } from "lucide-react";
import type { AuthAccount } from "../../services/authApi";
import { cineMatchApi } from "../../services/api";
import type { Movie } from "../../types";

const PAGE_SIZE = 12;
type SortMode = "rating_desc" | "rating_asc" | "title" | "year";
type Props = {
  account: AuthAccount;
  allMovies: Movie[];
  onSelectMovie: (movie: Movie) => void;
  onNavigateRecommendations: () => void;
};

function fallbackMovie(id: number): Movie {
  return { movieId:id, title:`Phim #${id}`, year:0, genres:[], posterUrl:"", backdropUrl:"", synopsis:"Chưa có thông tin mô tả.", avgRating:0, ratingsCount:0 };
}

export function MovieLensRatingLibrary({ account, allMovies, onSelectMovie, onNavigateRecommendations }: Props) {
  const [query, setQuery] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [sort, setSort] = useState<SortMode>("rating_desc");
  const [page, setPage] = useState(1);
  const [loadedMovies, setLoadedMovies] = useState<Record<number, Movie>>({});

  const ratings = useMemo(() => Object.entries(account.ratings)
    .map(([id, value]) => ({ id: Number(id), rating: Number(value) }))
    .filter(row => Number.isSafeInteger(row.id) && Number.isFinite(row.rating) && row.rating >= 0.5 && row.rating <= 5),
    [account.ratings]);

  const knownMovies = useMemo(() => new Map<number, Movie>([...allMovies.map(m=>[m.movieId,m] as const), ...Object.values(loadedMovies).map(m=>[m.movieId,m] as const)]),[allMovies,loadedMovies]);
  const moviesWithYears = ratings.map(r => knownMovies.get(r.id)?.year ?? 0).filter(Boolean);
  const earliest = moviesWithYears.length ? Math.min(...moviesWithYears) : null;
  const latest = moviesWithYears.length ? Math.max(...moviesWithYears) : null;
  const avg = ratings.length ? ratings.reduce((sum,r)=>sum+r.rating,0)/ratings.length : 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return ratings.filter(row => {
      if (ratingFilter !== "all" && row.rating < Number(ratingFilter)) return false;
      if (q && !(knownMovies.get(row.id)?.title ?? String(row.id)).toLocaleLowerCase().includes(q)) return false;
      return true;
    }).sort((a,b) => {
      if (sort === "rating_asc") return a.rating - b.rating || a.id-b.id;
      if (sort === "title") return (knownMovies.get(a.id)?.title ?? "").localeCompare(knownMovies.get(b.id)?.title ?? "", "vi") || a.id-b.id;
      if (sort === "year") return (knownMovies.get(b.id)?.year ?? 0)-(knownMovies.get(a.id)?.year ?? 0) || a.id-b.id;
      return b.rating-a.rating || a.id-b.id;
    });
  }, [query, ratingFilter, sort, ratings, knownMovies]);
  const totalPages = Math.max(1, Math.ceil(filtered.length/PAGE_SIZE));
  const safePage = Math.min(page,totalPages);
  const visible = filtered.slice((safePage-1)*PAGE_SIZE,safePage*PAGE_SIZE);
  const visibleKey = visible.map(x=>x.id).join(",");

  useEffect(() => {setPage(1)},[query,ratingFilter,sort,account.accountId]);
  useEffect(() => {setLoadedMovies({})},[account.accountId]);

  // Only hydrate the current page, not all 9,742 MovieLens items.
  useEffect(() => {
    let live = true;
    const needed = visible.filter(({id}) => {
      const known=knownMovies.get(id);
      return !known || !known.posterUrl || !known.title || known.title.startsWith("Phim #");
    }).slice(0,PAGE_SIZE);
    if (!needed.length) return;
    void Promise.all(needed.map(async ({id}) => {
      try {
        const raw = await cineMatchApi.getEnrichedMovie(id);
        const movie: Movie = {...fallbackMovie(id), ...raw, year:raw.year ?? 0, genres:raw.genres ?? [],avgRating:raw.avgRating ?? 0,posterUrl:raw.posterUrl ?? "",backdropUrl:raw.backdropUrl ?? "",synopsis:raw.synopsis ?? "", imdbId:raw.imdbId ?? undefined, tmdbId:raw.tmdbId ?? undefined};
        return movie;
      } catch { return null; }
    })).then(items=>{
      if(!live) return;
      setLoadedMovies(previous=>{
        const next={...previous};
        for(const item of items) if(item) next[item.movieId]=item;
        return next;
      });
    });
    return ()=>{live=false};
  // Rerun on page/identity changes. Cached lookups are handled by API service.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[account.accountId,visibleKey,allMovies.length]);

  const demo = account.accountType === "movielens";
  return (
    <div className="cmv4-page cmv4-history-page">
      <div className="cmv4-page-head">
        <div className="cmv4-page-eyebrow"><History size={19}/> BỘ SƯU TẬP CỦA BẠN</div>
        <h1>Bộ sưu tập <span>đã đánh giá</span></h1>
        <p>{demo ? `Lịch sử đánh giá Training của MovieLens User ${account.movieLensUserId ?? account.userId} · Dữ liệu thử nghiệm chỉ đọc.` : "Những bộ phim bạn đã đánh giá trong tài khoản CineMatch."}</p>
      </div>

      <div className="cmv4-stats-bar">
        <div className="cmv4-user-chip"><div className="cmv4-user-symbol"><Film size={19}/></div><span>{account.name}</span></div>
        <div className="cmv4-stat"><strong>{ratings.length.toLocaleString("vi-VN")}</strong><span>Phim đã đánh giá</span></div>
        <div className="cmv4-stat"><strong>{avg.toFixed(2)}</strong><span>Điểm trung bình / 5</span></div>
        <div className="cmv4-stat"><strong>{earliest && latest ? `${earliest}–${latest}` : "—"}</strong><span>Khoảng năm phát hành*</span></div>
      </div>
      {demo && <p className="cmv4-fineprint"><ShieldCheck size={15}/> Hồ sơ MovieLens chỉ đọc; dữ liệu gốc không bị sửa. *Khoảng năm chỉ tính các phim đã tải metadata.</p>}

      <div className="cmv4-library-toolbar">
        <label className="cmv4-search"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm trong phim đã đánh giá…" aria-label="Tìm phim đã đánh giá"/>{query && <button type="button" onClick={()=>setQuery("")} aria-label="Xóa tìm kiếm"><X size={17}/></button>}</label>
        <label className="cmv4-select"><span>Lọc điểm</span><select value={ratingFilter} onChange={e=>setRatingFilter(e.target.value)}><option value="all">Tất cả mức điểm</option><option value="4.5">Từ 4.5 sao</option><option value="4">Từ 4 sao</option><option value="3">Từ 3 sao</option></select></label>
        <label className="cmv4-select"><span>Sắp xếp</span><select value={sort} onChange={e=>setSort(e.target.value as SortMode)}><option value="rating_desc">Điểm cao nhất</option><option value="rating_asc">Điểm thấp nhất</option><option value="title">Tên phim A–Z</option><option value="year">Năm phát hành</option></select></label>
      </div>

      <div className="cmv4-section-title"><div><h2>Phim đã đánh giá</h2><p>{filtered.length} kết quả phù hợp</p></div><button className="cmv4-text-link" type="button" onClick={onNavigateRecommendations}>Xem gợi ý của bạn <ArrowRight size={17}/></button></div>
      {filtered.length === 0 ? <div className="cmv4-empty"><Heart size={31}/><strong>Chưa tìm thấy phim phù hợp</strong><span>Thử thay đổi từ khóa hoặc bộ lọc điểm.</span></div> : (
        <div className="cmv4-movie-library">
          {visible.map(({id,rating},index)=>{
            const movie=knownMovies.get(id) ?? fallbackMovie(id);
            return <button className="cmv4-library-row" key={id} type="button" onClick={()=>onSelectMovie(movie)}>
              <span className="cmv4-row-number">{(safePage-1)*PAGE_SIZE+index+1}</span>
              <span className="cmv4-row-poster">{movie.posterUrl ? <img src={movie.posterUrl} alt="" loading="lazy" /> : <Film size={22}/>}</span>
              <span className="cmv4-row-main"><strong>{movie.title}</strong><small>{movie.genres.slice(0,3).join(" · ") || (movie.year ? String(movie.year) : "MovieLens")}</small></span>
              <span className="cmv4-row-year"><CalendarDays size={13}/>{movie.year || "—"}</span>
              <span className="cmv4-rating"><Star size={17} fill="currentColor" /> {rating.toFixed(1)}</span>
            </button>;
          })}
        </div>
      )}
      {totalPages>1 && <div className="cmv4-pagination"><button type="button" disabled={safePage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Trước</button><span>Trang {safePage} / {totalPages}</span><button type="button" disabled={safePage>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Sau</button></div>}
    </div>
  );
}
