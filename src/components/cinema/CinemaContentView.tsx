import { useEffect, useState, type ComponentProps } from "react";
import { ArrowRight, Film, Layers3, ShieldCheck, Sparkles, Users } from "lucide-react";
import { ContentBasedView as LegacyContentBasedView } from "../contentBased/ContentBasedView";
import { cineMatchApi } from "../../services/api";
import { authApi } from "../../services/authApi";
import { useCineMatchAccount } from "../auth/AuthGate";
import { CinemaHero, CinemaRecommendations, CinemaHowItWorks, useCinePosters, type RankedMovie } from "./CinemaShared";
import { CinemaMovieSearch, type SearchableMovie } from "./CinemaMovieSearch";
import "./cinema-methods.css";
import "../auth/account-ml.css";

type Props = ComponentProps<typeof LegacyContentBasedView>;
type Mode = "similar" | "profile";

export function CinemaContentView(props: Props) {
  const { account } = useCineMatchAccount();
  const [mode, setMode] = useState<Mode>("profile");
  const [movieId, setMovieId] = useState(1);
  const [movieSearchDirty, setMovieSearchDirty] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedFilm, setSelectedFilm] = useState<{ movieId: number; title: string; genres: string[] } | null>(null);
  const [items, setItems] = useState<RankedMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const extras = useCinePosters(items, mode === "similar" ? movieId : undefined);
  const isDemo = account.accountType === "movielens";
  const verifiedUserId = isDemo ? account.movieLensUserId : null;
  const ratedCount = Object.keys(account.ratings).length;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setItems([]);
    setError("");
    void (async () => {
      if (mode === "similar") {
        const [detail, response] = await Promise.all([
          cineMatchApi.getMovie(movieId),
          cineMatchApi.getSimilarMovies(movieId, 10),
        ]);
        if (active) {
          setSelectedFilm({ movieId: detail.movieId, title: detail.title, genres: detail.genres });
          setItems(response.items);
        }
        return;
      }
      if (isDemo) {
        const response = await authApi.demoContent(10);
        if (response.userId !== verifiedUserId) {
          throw new Error("API trả về sai MovieLens User ID. Đã chặn hiển thị gợi ý.");
        }
        if (active) setItems(response.items);
      } else {
        const response = await authApi.recommendations(10);
        if (active) setItems(response.items);
      }
    })().catch((err: unknown) => {
      if (active) setError(err instanceof Error ? err.message : "Không tải được dữ liệu mô hình.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mode, movieId, revision, account.accountId, account.accountType, verifiedUserId, JSON.stringify(account.ratings), account.preferredGenres.join("|")]);

  const pickMovie = (movie: SearchableMovie) => {
    setMovieId(movie.movieId);
    setMovieSearchDirty(false);
    setSearchError("");
    setRevision(i => i + 1);
  };
  const localSelected = props.allMovies.find(row => row.movieId === movieId);
  const extra = extras[movieId];

  return <div className="cm-cinema-page cm-account-view cm-modern-cbf">
    <CinemaHero
      eyebrow="PHIM DÀNH CHO BẠN"
      title={<>Phim hợp <em>gu của bạn</em></>}
      subtitle="Phim phù hợp với thể loại và đánh giá của bạn."
      icon={<Layers3 size={36}/>} backdrop={extra?.backdropUrl || localSelected?.backdropUrl}
    >

    </CinemaHero>
    <div className="cm-cinema-container">
      <div className="cm-account-pinned" role="status">
        <ShieldCheck size={23}/>
        <div><b>{isDemo ? `MovieLens User ${verifiedUserId}` : account.name}</b><small>{isDemo ? "Đang xem gợi ý cho tài khoản MovieLens này" : `${ratedCount} phim đã đánh giá · Gợi ý từ sở thích của bạn`}</small></div>
      </div>
      <div className="cm-cinema-mode-switch" role="tablist" aria-label="Chế độ Content-Based">
        <button type="button" role="tab" aria-selected={mode === "profile"} className={mode === "profile" ? "active" : ""} onClick={() => setMode("profile")}><Users size={18}/> Phim hợp gu</button>
        <button type="button" role="tab" aria-selected={mode === "similar"} className={mode === "similar" ? "active" : ""} onClick={() => setMode("similar")}><Film size={18}/> Phim tương tự</button>
      </div>
      <div className="cm-cinema-columns">
        <aside className="cm-cinema-side">
          {mode === "similar" ? <>
            <div className="cm-cinema-side-title"><Film size={21}/><h2>Chọn bộ phim để so sánh</h2></div>
            <label htmlFor="cm-content-movie-search">Tìm phim theo tên</label>
            <CinemaMovieSearch onPick={pickMovie} onEditingChange={setMovieSearchDirty} localMovies={props.allMovies}/>
            {searchError && <p role="alert" className="cm-cinema-error">{searchError}</p>}
            {selectedFilm && <div className="cm-cinema-current-film"><div className="cm-cinema-current-poster">{extra?.posterUrl || localSelected?.posterUrl ? <img src={extra?.posterUrl || localSelected?.posterUrl} alt={`Poster ${selectedFilm.title}`}/> : <Film size={26}/>}</div><div><strong>{selectedFilm.title}</strong><span>Phim được chọn</span><div className="cm-cinema-tags">{selectedFilm.genres.map(g => <b key={g}>{g}</b>)}</div></div></div>}
            <button type="button" className="cm-cinema-wide-cta" onClick={() => {if (movieSearchDirty) setSearchError("Hãy chọn phim trong kết quả tìm kiếm trước.");else {setSearchError("");setRevision(i=>i+1);}}} disabled={loading || movieSearchDirty}>Tìm phim tương tự <ArrowRight size={18}/></button>
          </> : <>
            <div className="cm-cinema-side-title"><ShieldCheck size={21}/><h2>Gu phim của bạn</h2></div>
            <p className="cm-cinema-side-copy">{ratedCount ? "Dựa trên sở thích và các phim bạn đã đánh giá." : "Bắt đầu từ những thể loại bạn thích."}</p>
            <div className="cm-cinema-profile"><h3>{isDemo ? `MovieLens User ${verifiedUserId}` : account.name}</h3><p>{ratedCount} phim đã đánh giá</p><div className="cm-cinema-divider"/><p>Thể loại bạn thích</p>{account.preferredGenres.length ? account.preferredGenres.map(g => <span className="cm-account-genre-tag" key={g}>{g}</span>) : <p>Chưa chọn thể loại. Hãy cập nhật sở thích để cá nhân hóa tốt hơn.</p>}</div>
          </>}
        </aside>
        <CinemaRecommendations
          title={mode === "similar" ? `Giống ${selectedFilm?.title ?? "phim bạn chọn"}` : "Top-10 phim hợp gu"}
          description={mode === "similar" ? "Khám phá phim có thể loại tương tự." : "Những bộ phim được chọn từ sở thích của bạn."}
          movies={items} extras={extras} loading={loading} error={error} kind="similarity" onSelectMovie={props.onSelectMovie} localMovies={props.allMovies}
        />
      </div>
      <CinemaHowItWorks
        steps={mode === "similar" ? [
          {title:"Chọn một phim",desc:"Đọc 19 thể loại MovieLens của bộ phim."},
          {title:"Đo sự tương đồng",desc:"So sánh vector nội dung với các phim còn lại."},
          {title:"Gợi ý Top-10",desc:"Hiển thị phim tương tự, không thay đổi tài khoản."},
        ] : [
          {title:"Xác định tài khoản",desc:"Lấy danh tính từ phiên đăng nhập đã xác thực."},
          {title:"Xây dựng hồ sơ",desc:isDemo ? "Sử dụng rating Training của đúng MovieLens User ID." : "Ưu tiên phim chấm từ 4 sao, nếu chưa có dùng thể loại đã chọn."},
          {title:"Gợi ý cá nhân",desc:"Loại bỏ phim đã đánh giá và sắp xếp theo độ tương đồng nội dung."},
        ]}
        note="Cosine Similarity không phải điểm rating dự đoán. Để đổi người dùng MovieLens, hãy đăng nhập hoặc chuyển tài khoản ở góc phải."
      />

    </div>
  </div>;
}
