import { useEffect, useState } from "react";
import { Clapperboard, Film, ShieldCheck, Sparkles, Star, Users } from "lucide-react";
import { authApi, type AuthAccount } from "../../services/authApi";
import { cineMatchApi } from "../../services/api";
import type { Movie } from "../../types";

type ContentResult = Awaited<ReturnType<typeof authApi.demoContent>>;
type KNNResult = Awaited<ReturnType<typeof authApi.demoKnn>>;

export function MovieLensPersonal({ account, onSelectMovie }: { account: AuthAccount; onSelectMovie: (movie: Movie) => void }) {
  const [content, setContent] = useState<ContentResult | null>(null);
  const [knn, setKnn] = useState<KNNResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [posters, setPosters] = useState<Record<number,string>>({});
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    Promise.all([authApi.demoContent(), authApi.demoKnn()]).then(async ([a, b]) => {
      if (!alive) return;
      if (a.userId !== account.movieLensUserId || b.userId !== account.movieLensUserId || b.k !== 21) {
        throw new Error("Định danh MovieLens hoặc K không khớp phiên đăng nhập. Đã chặn hiển thị gợi ý.");
      }
      setContent(a);
      setKnn(b);
      const ids = Array.from(new Set([...a.items, ...b.items].map(item=>item.movieId)));
      const resolved = await Promise.all(ids.map(async id => {
        try { const movie = await cineMatchApi.getEnrichedMovie(id); return [id, movie.posterUrl || ""] as const; }
        catch { return [id, ""] as const; }
      }));
      if (alive) setPosters(Object.fromEntries(resolved));
    }).catch(e => { if (alive) { setContent(null); setKnn(null); setError(e instanceof Error ? e.message : "Không tải được gợi ý."); } })
      .finally(()=>{if(alive)setLoading(false);});
    return () => { alive = false; };
  }, [account.accountId, account.movieLensUserId]);

  const open = async (movieId: number) => {
    try {
      const data = await cineMatchApi.getEnrichedMovie(movieId);
      onSelectMovie({
        movieId: data.movieId,
        title: data.title,
        year: data.year ?? 0,
        genres: data.genres,
        posterUrl: data.posterUrl ?? "",
        backdropUrl: data.backdropUrl ?? "",
        synopsis: data.synopsis ?? "",
        imdbId: data.imdbId ?? undefined,
        tmdbId: data.tmdbId ?? undefined,
        avgRating: data.avgRating ?? 0,
        ratingsCount: data.ratingsCount,
      });
    }
    catch { /* Metadata not found; keep recommendations visible. */ }
  };
  const cards = (items: Array<{movieId:number;title:string;score:number}>, label: string) => <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
    {items.map((movie,i) => <button type="button" onClick={()=>void open(movie.movieId)} className="overflow-hidden rounded-2xl border border-[#e8bf82]/15 bg-[#171a23] text-left transition hover:-translate-y-1 hover:border-[#e8bf82]/50" key={movie.movieId}>
      <div className="aspect-[2/3] bg-[#2a2531] flex items-center justify-center overflow-hidden">{posters[movie.movieId] ? <img src={posters[movie.movieId]} alt={`Poster ${movie.title}`} className="h-full w-full object-cover" loading="lazy"/> : <Film size={32} className="text-[#e8bf82]/60"/>}</div>
      <div className="p-3"><p className="line-clamp-2 min-h-10 text-sm font-semibold text-white">{i+1}. {movie.title}</p><p className="mt-2 text-xs font-bold text-[#e8bf82]">{label} {movie.score.toFixed(2)}{label === "Dự đoán" ? "/5 sao" : ""}</p></div>
    </button>)}
  </div>;
  return <section className="cm-personal-film-page cm-movielens-personal mx-auto max-w-7xl px-4 pb-16 pt-10 text-white sm:px-8">
    <div className="mb-8 rounded-3xl border border-[#e8bf82]/25 bg-gradient-to-br from-[#282119] to-[#10131a] p-7">
      <p className="flex items-center gap-2 text-xs font-bold tracking-widest text-[#e8bf82]"><ShieldCheck size={17}/> DÀNH RIÊNG CHO BẠN</p>
      <h1 className="mt-3 text-3xl font-extrabold">Bộ phim tiếp theo dành cho bạn.</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-[#aeb2bf]">Tuyển chọn theo gu phim của tài khoản User {account.movieLensUserId}.</p>
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-[#e8bf82]"><span className="rounded-full border border-[#e8bf82]/30 px-3 py-2">User {account.movieLensUserId}</span><span className="rounded-full border border-[#e8bf82]/30 px-3 py-2">{Object.keys(account.ratings).length} phim trong hồ sơ</span></div>
    </div>
    {loading && <p className="flex gap-2 text-sm text-[#e8bf82]"><Clapperboard className="animate-pulse"/> Đang lấy gợi ý từ hai mô hình...</p>}
    {error && <p role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</p>}
    {!loading && content && knn && <div className="space-y-11">
      <section><h2 className="mb-2 flex items-center gap-2 text-xl font-bold"><Sparkles size={22} className="text-[#e8bf82]"/> Theo thể loại bạn thích</h2>{cards(content.items.map(v=>({...v,score:v.similarity})),"Cosine")}</section>
      <section><h2 className="mb-2 flex items-center gap-2 text-xl font-bold"><Users size={22} className="text-[#e8bf82]"/> Người cùng gu cũng xem</h2>{cards(knn.items.map(v=>({...v,score:v.predicted_rating})),"Dự đoán")}</section>
    </div>}
    <details className="cm-film-method-note mt-10 text-xs leading-6 text-[#9299a6]"><summary><Star size={15}/> Tìm hiểu cách xếp hạng</summary><p>Gợi ý theo nội dung dựa trên Cosine Similarity của thể loại. Gợi ý từ người cùng gu dự đoán điểm dựa trên tối đa {knn?.k ?? 21} láng giềng phù hợp từ dữ liệu Training. Dữ liệu thực nghiệm không bị thay đổi.</p></details>
  </section>;
}
