import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, Calculator, CheckCircle2, Clapperboard, Database,
  Film, Layers3, LoaderCircle, Play, Search, Sparkles, Star, Users,
} from "lucide-react";
import { methodGuideApi, type GuideMovie, type ProfileDetail, type KNNDetail, type RatingExplanation } from "../../services/methodGuideApi";
import "./method-walkthrough.css";

type Mode = "similar" | "profile" | "knn";
type MovieEntry = { movieId: number; title: string; genres: string[]; year: number | null };
const GENRES = [
  "Action", "Adventure", "Animation", "Children", "Comedy", "Crime", "Documentary",
  "Drama", "Fantasy", "Film-Noir", "Horror", "IMAX", "Musical", "Mystery",
  "Romance", "Sci-Fi", "Thriller", "War", "Western",
];
const FLOW: Record<Mode, Array<{ name: string; detail: string }>> = {
  similar: [
    { name: "Chọn phim", detail: "Mã phim và đặc trưng thể loại" },
    { name: "Mã hóa vector", detail: "19 giá trị nhị phân 0/1" },
    { name: "Tính Cosine", detail: "So sánh vector hai phim" },
    { name: "Top-10 tương tự", detail: "Sắp xếp theo độ tương đồng" },
  ],
  profile: [
    { name: "Lịch sử đánh giá", detail: "Các phim được đánh giá cao" },
    { name: "Hồ sơ sở thích", detail: "Vector thể loại tổng hợp" },
    { name: "Tính Cosine", detail: "Hồ sơ người dùng so với phim" },
    { name: "Top-10 hợp gu", detail: "Loại phim đã đánh giá" },
  ],
  knn: [
    { name: "Ma trận User–Movie", detail: "Rating từ tập Training" },
    { name: "Mean-Centering", detail: "Trừ điểm trung bình từng người" },
    { name: "Cosine + KNN", detail: "Tìm người dùng tương đồng" },
    { name: "Dự đoán rating", detail: "Tổng có trọng số từ láng giềng" },
    { name: "Top-10 đề xuất", detail: "Xếp hạng theo rating dự đoán" },
  ],
};

const integer = (n: number) => n.toLocaleString("vi-VN");
const score = (n: number, p = 3) => Number.isFinite(n) ? n.toFixed(p) : "—";

function DataPanel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return <div className="cm-method-panel"><div className="cm-method-panel-title"><span>{title}</span>{subtitle && <small>{subtitle}</small>}</div><div className="cm-method-panel-body">{children}</div></div>;
}

function FlowTag({ children }: { children: ReactNode }) {
  return <span className="cm-method-chip">{children}</span>;
}

function Poster({ id, title, image }: { id: number; title: string; image?: string }) {
  return <div className="cm-method-poster">{image ? <img src={image} loading="lazy" alt={`Poster ${title}`} /> : <span><Film size={29}/><small>MovieLens #{id}</small></span>}</div>;
}

export function MethodLabView() {
  const [mode, setMode] = useState<Mode>("similar");
  const [step, setStep] = useState(0);
  const [movieInput, setMovieInput] = useState(1);
  const [userInput, setUserInput] = useState(1);
  const [selection, setSelection] = useState({ movieId: 1, userId: 1, revision: 0 });
  const [searchTerm, setSearchTerm] = useState("");
  const [movieOptions, setMovieOptions] = useState<MovieEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [movie, setMovie] = useState<MovieEntry | null>(null);
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [knn, setKnn] = useState<KNNDetail | null>(null);
  const [items, setItems] = useState<GuideMovie[]>([]);
  const [posters, setPosters] = useState<Record<number, string>>({});
  const [explainMovieId, setExplainMovieId] = useState<number | null>(null);
  const [explain, setExplain] = useState<RatingExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const steps = FLOW[mode];
  const userId = selection.userId;
  const movieId = selection.movieId;

  useEffect(() => {
    let live = true;
    setLoading(true); setError(""); setItems([]); setProfile(null); setKnn(null); setMovie(null); setExplain(null); setExplainMovieId(null);
    (async () => {
      if (mode === "similar") {
        const [details, rec] = await Promise.all([methodGuideApi.movie(movieId), methodGuideApi.similar(movieId)]);
        if (!live) return;
        setMovie({ movieId: details.movieId, title: details.title, genres: details.genres, year: details.year });
        setItems(rec.items);
      } else if (mode === "profile") {
        const [details, rec] = await Promise.all([methodGuideApi.profile(userId), methodGuideApi.personal(userId)]);
        if (!live) return;
        setProfile(details); setItems(rec.items);
      } else {
        const [details, rec] = await Promise.all([methodGuideApi.knn(userId), methodGuideApi.collab(userId)]);
        if (!live) return;
        setKnn(details); setItems(rec.items);
        if (rec.items.length) setExplainMovieId(rec.items[0].movieId);
      }
    })().catch((err: unknown) => {
      if (live) setError(err instanceof Error ? err.message : "Không tải được dữ liệu mô hình.");
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [mode, userId, movieId, selection.revision]);

  useEffect(() => {
    if (mode !== "knn" || explainMovieId === null) return;
    let live = true;
    setExplain(null);
    void methodGuideApi.explain(userId, explainMovieId).then(result => {
      if (live) setExplain(result);
    }).catch(() => { if (live) setExplain(null); });
    return () => { live = false; };
  }, [mode, userId, explainMovieId]);

  useEffect(() => {
    if (!items.length) return;
    let live = true;
    void Promise.allSettled(items.slice(0, 10).map(async item => {
      const poster = await methodGuideApi.poster(item.movieId);
      if (live && poster) setPosters(prev => ({ ...prev, [item.movieId]: poster }));
    }));
    return () => { live = false; };
  }, [items]);

  useEffect(() => {
    if (!movie) return;
    let live = true;
    void methodGuideApi.poster(movie.movieId).then(url => {
      if (live && url) setPosters(prev => ({ ...prev, [movie.movieId]: url }));
    });
    return () => { live = false; };
  }, [movie]);

  const profileVector = useMemo(() => {
    if (mode === "similar") return GENRES.map(g => movie?.genres.includes(g) ? 1 : 0);
    return profile?.vector ?? [];
  }, [mode, movie, profile]);

  const applyInput = () => {
    if (mode === "similar" ? !(movieInput > 0) : !(userInput >= 1 && userInput <= 610)) {
      setError(mode === "similar" ? "Vui lòng nhập movieId hợp lệ." : "MovieLens userId phải nằm trong khoảng 1–610.");
      return;
    }
    setStep(0);
    setSelection(prev => ({ movieId: movieInput, userId: userInput, revision: prev.revision + 1 }));
  };

  const searchMovies = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    try {
      const data = await methodGuideApi.movieSearch(searchTerm.trim());
      setMovieOptions(data.items.map(row => ({ movieId: row.movieId, title: row.title, genres: row.genres, year: row.year })));
    } catch { setMovieOptions([]); }
    finally { setSearching(false); }
  };

  const resultTitle = mode === "similar" ? "Top-10 phim tương tự" : mode === "profile" ? "Top-10 phù hợp sở thích" : "Top-10 theo rating dự đoán";
  const visible = items.slice(0, 10);

  return (
    <div className={`cm-method-root cm-film-method-lab ${mode === "knn" ? "cm-method-root-purple" : ""}`}>
      <div className="cm-method-hero">
        <div className="cm-method-hero-inner">
          <div className="cm-method-eyebrow"><Clapperboard size={16}/> KHÁM PHÁ CÁCH CINE MATCH CHỌN PHIM</div>
          <h1>CineMatch <em>chọn phim cho bạn</em> thế nào?</h1>
          <p>Khám phá từng bước bằng ví dụ trực quan. Chạm vào một phương pháp để bắt đầu.</p>
          <div className="cm-method-mode-tabs" role="tablist" aria-label="Chọn phương pháp">
            <button type="button" role="tab" aria-selected={mode === "similar"} className={mode === "similar" ? "active" : ""} onClick={() => { setMode("similar"); setStep(0); }}><Film size={17}/> Tìm phim tương tự</button>
            <button type="button" role="tab" aria-selected={mode === "profile"} className={mode === "profile" ? "active" : ""} onClick={() => { setMode("profile"); setStep(0); }}><Layers3 size={17}/> Gợi ý theo gu phim</button>
            <button type="button" role="tab" aria-selected={mode === "knn"} className={mode === "knn" ? "active" : ""} onClick={() => { setMode("knn"); setStep(0); }}><Users size={17}/> Người có gu giống nhau</button>
          </div>
        </div>
      </div>

      <div className="cm-method-content">
        <div className="cm-method-input-layout">
          <div className="cm-method-panel cm-method-input-card">
            <div className="cm-method-section-label"><Database size={17}/> ĐẦU VÀO THỰC NGHIỆM</div>
            {mode === "similar" ? <>
              <label htmlFor="cm-film-id">Mã phim (movieId)</label>
              <div className="cm-method-input-row"><input id="cm-film-id" type="number" min={1} value={movieInput} onChange={e => setMovieInput(Number(e.target.value))} /><button type="button" onClick={applyInput}>Chạy mô phỏng <Play size={15}/></button></div>
              <label htmlFor="cm-movie-search">Tìm phim theo tên</label>
              <div className="cm-method-input-row cm-method-search"><input id="cm-movie-search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void searchMovies(); }} placeholder="Ví dụ: Toy Story, Inception..." /><button type="button" onClick={() => void searchMovies()} disabled={searching}><Search size={17}/></button></div>
              {!!movieOptions.length && <div className="cm-method-search-results">{movieOptions.slice(0, 6).map(entry => <button key={entry.movieId} type="button" onClick={() => { setMovieInput(entry.movieId); setMovieOptions([]); setStep(0); setSelection(prev => ({ ...prev, movieId: entry.movieId, revision: prev.revision + 1 })); }}><span>{entry.title}</span><small>#{entry.movieId}</small></button>)}</div>}
            </> : <>
              <label htmlFor="cm-user-id">Người dùng MovieLens (userId 1–610)</label>
              <div className="cm-method-input-row"><input id="cm-user-id" type="number" min={1} max={610} value={userInput} onChange={e => setUserInput(Number(e.target.value))} /><button type="button" onClick={applyInput}>Chạy mô phỏng <Play size={15}/></button></div>
              <div className="cm-method-suggested">Thử nhanh: {[1, 10, 50, 100].map(id => <button type="button" key={id} onClick={() => { setUserInput(id); setStep(0); setSelection(prev => ({ ...prev, userId: id, revision: prev.revision + 1 })); }}>User {id}</button>)}</div>
            </>}
            <div className="cm-method-input-foot"><Sparkles size={15}/> {mode === "similar" ? "Mã phim và 19 đặc trưng thể loại" : "Chỉ sử dụng lịch sử rating trong tập Training"}</div>
          </div>
          <div className="cm-method-panel cm-method-why">
            <div className="cm-method-section-label"><Calculator size={17}/> Ý TƯỞNG CỐT LÕI</div>
            <h2>{mode === "similar" ? "Phim giống phim" : mode === "profile" ? "Phim hợp gu người xem" : "Người giống người"}</h2>
            <p>{mode === "similar" ? "Hai phim càng có vector thể loại giống nhau, điểm Cosine Similarity càng cao." : mode === "profile" ? "Từ những phim đánh giá cao, mô hình xây dựng vector sở thích rồi tìm các phim phù hợp." : "Hai người có xu hướng đánh giá giống nhau có thể giúp dự đoán điểm cho phim người kia chưa xem."}</p>
            <div className="cm-method-stat-strip"><span><strong>{mode === "similar" ? "19" : mode === "profile" ? "≥ 4★" : `K = ${knn?.k ?? "…"}`}</strong><small>{mode === "similar" ? "thể loại" : mode === "profile" ? "ngưỡng yêu thích" : "cấu hình backend"}</small></span><span><strong>10</strong><small>phim đề xuất</small></span><span><strong>{mode === "knn" ? "Rating" : "Cosine"}</strong><small>điểm xếp hạng</small></span></div>
          </div>
        </div>

        <div className="cm-method-flowbar"><div><h2>Quy trình xử lý</h2><p>Chọn một bước để tìm hiểu.</p></div><span className="cm-method-step-count">{step + 1} / {steps.length}</span></div>
        <div className="cm-method-stepper" aria-label="Các bước mô phỏng">
          {steps.map((s, index) => <button key={s.name} className={`${index === step ? "active" : ""} ${index < step ? "finished" : ""}`} type="button" onClick={() => setStep(index)}><span>{index < step ? <CheckCircle2 size={17} /> : index + 1}</span><strong>{s.name}</strong><small>{s.detail}</small></button>)}
        </div>
        {loading ? <div className="cm-method-loading"><LoaderCircle size={24} className="animate-spin"/> Đang lấy dữ liệu từ mô hình CineMatch...</div> : error ? <div className="cm-method-error" role="alert">{error}<button type="button" onClick={applyInput}>Thử lại</button></div> : (
          <div className="cm-method-stage" key={`${mode}-${step}`}>
            <div className="cm-method-stage-top"><span>BƯỚC {step + 1}</span><h2>{steps[step].name}</h2><p>{steps[step].detail}</p></div>
            {mode === "similar" && <>
              {step === 0 && <DataPanel title="Phim được chọn" subtitle="Thông tin từ MovieLens">
                {movie ? <div className="cm-method-feature-film"><Poster id={movie.movieId} title={movie.title} image={posters[movie.movieId]}/><div><h3>{movie.title}</h3><p>movieId: {movie.movieId} · {movie.year ?? "Không rõ năm"}</p><div className="cm-method-chips">{movie.genres.map(g => <FlowTag key={g}>{g}</FlowTag>)}</div></div></div> : "Không tìm thấy phim."}
              </DataPanel>}
              {step === 1 && <DataPanel title="Vector đặc trưng của phim" subtitle="Multi-hot, mỗi thể loại nhận 0 hoặc 1"><div className="cm-method-vector">{GENRES.map((g, i) => <div key={g} className={profileVector[i] ? "selected" : ""}><small>{g}</small><strong>{profileVector[i]}</strong></div>)}</div><p className="cm-method-math">x<sub>i</sub> ∈ {`{0, 1}`}<sup>19</sup> → chuẩn hóa L2 trước khi tính Cosine.</p></DataPanel>}
              {step === 2 && <DataPanel title="Tính độ tương đồng Cosine" subtitle="Dữ liệu điểm trả về từ Content-Based Similarity Model"><div className="cm-method-formula">cos(x, y) = (x · y) / (‖x‖ × ‖y‖)</div><p className="cm-method-muted">Phim có tổ hợp thể loại tương tự sẽ được xếp hạng cao; hai phim cùng thể loại chưa chắc giống nhau về cốt truyện.</p><div className="cm-method-score-list">{items.slice(0, 5).map((r,i) => <div key={r.movieId}><span>#{i+1} {r.title}</span><div><b style={{width:`${Math.max(0,Math.min(100,(r.similarity ?? 0)*100))}%`}} /></div><strong>{score(r.similarity ?? 0,4)}</strong></div>)}</div></DataPanel>}
            </>}
            {mode === "profile" && <>
              {step === 0 && <DataPanel title={`Lịch sử đánh giá User ${userId}`} subtitle="Chỉ dùng dữ liệu Training; phim yêu thích có rating ≥ 4.0"><div className="cm-method-metrics"><span><b>{integer(profile?.trainingCount ?? 0)}</b> rating Training</span><span><b>{integer(profile?.likedCount ?? 0)}</b> phim yêu thích</span></div>{profile?.fallback && <p className="cm-method-muted">Không có phim ≥ 4 sao: mô hình dùng cơ chế dự phòng từ lịch sử rating.</p>}<div className="cm-method-rating-list">{profile?.likedSamples.map(r=><div key={r.movieId}><span>{r.title}</span><b><Star size={14} fill="currentColor" /> {score(r.rating,1)}</b></div>)}</div></DataPanel>}
              {step === 1 && <DataPanel title="Vector sở thích tổng hợp" subtitle="19 trọng số thể loại của Content-Based Similarity Model"><p className="cm-method-muted">Kết hợp đặc trưng các phim đánh giá cao (trọng số rating − 3) và chuẩn hóa vector.</p><div className="cm-method-vector">{(profile?.genres ?? GENRES).map((g, i) => <div key={g} className={(profile?.vector[i] ?? 0) > 0 ? "selected" : ""}><small>{g}</small><strong>{score(profile?.vector[i] ?? 0, 3)}</strong></div>)}</div><h4>5 thể loại có trọng số cao nhất</h4><div className="cm-method-score-list">{profile?.topGenres.map(row=><div key={row.genre}><span>{row.genre}</span><div><b style={{ width:`${Math.max(0,Math.min(100,row.weight*100))}%` }} /></div><strong>{score(row.weight,3)}</strong></div>)}</div></DataPanel>}
              {step === 2 && <DataPanel title="Tính Cosine với hồ sơ người dùng" subtitle="Độ tương đồng được lấy từ mô hình hiện có"><div className="cm-method-formula">sim(u, i) = p<sub>u</sub> · x<sub>i</sub></div><p className="cm-method-muted">Hồ sơ sở thích và vector phim được chuẩn hóa; mô hình so sánh vector tổng hợp với các phim chưa đánh giá.</p><div className="cm-method-score-list">{items.slice(0,5).map((r,i)=><div key={r.movieId}><span>#{i+1} {r.title}</span><div><b style={{width:`${Math.max(0,Math.min(100,(r.similarity ?? 0)*100))}%`}} /></div><strong>{score(r.similarity ?? 0,4)}</strong></div>)}</div></DataPanel>}
            </>}
            {mode === "knn" && <>
              {step === 0 && <DataPanel title="Ma trận User–Movie (trích 4 hàng × 5 cột)" subtitle={`Ma trận đầy đủ: ${knn?.matrixShape[0] ?? "—"} × ${knn?.matrixShape[1] ?? "—"}; dấu — là chưa đánh giá`}><div className="cm-method-table-wrap"><table><thead><tr><th>Người dùng</th>{knn?.matrixMovies.map(m=><th key={m.movieId} title={m.title}>#{m.movieId}</th>)}</tr></thead><tbody>{knn?.matrixRows.map(row=><tr key={row.userId}><th>User {row.userId}</th>{row.ratings.map((rating,i)=><td key={i} className={rating===null ? "empty" : ""}>{rating===null ? "—" : score(rating,1)}</td>)}</tr>)}</tbody></table></div><p className="cm-method-muted">Hệ thống sử dụng các lượt đánh giá thực trong Training, không coi ô trống là rating 0.</p></DataPanel>}
              {step === 1 && <DataPanel title="Mean-Centering" subtitle={`Điểm trung bình User ${userId}: ${score(knn?.userMean ?? 0, 4)}`}><div className="cm-method-formula">r′<sub>u,i</sub> = r<sub>u,i</sub> − r̄<sub>u</sub></div><div className="cm-method-table-wrap"><table><thead><tr><th>Phim</th><th>Rating gốc</th><th>Điểm trung bình</th><th>Rating sau chuẩn hóa</th></tr></thead><tbody>{knn?.centeredSamples.map(r=><tr key={r.movieId}><td>{r.title}</td><td>{score(r.rating,1)}</td><td>{score(knn?.userMean ?? 0,3)}</td><td className={r.centered>=0 ? "good" : ""}>{r.centered>0?"+":""}{score(r.centered,3)}</td></tr>)}</tbody></table></div><p className="cm-method-muted">Mean-Centering giúp so sánh xu hướng thích/không thích tương đối của từng người, thay vì so sánh rating gốc.</p></DataPanel>}
              {step === 2 && <DataPanel title="Cosine Similarity và chọn láng giềng" subtitle="Tương đồng người–người từ ma trận đã Mean-Centering"><div className="cm-method-formula">sim(u, v) = (r′<sub>u</sub> · r′<sub>v</sub>) / (‖r′<sub>u</sub>‖ ‖r′<sub>v</sub>‖)</div><div className="cm-method-score-list">{knn?.neighbors.map(n=><div key={n.userId}><span>User {n.userId}</span><div><b style={{width:`${Math.max(0,Math.min(100,n.similarity*100))}%`}} /></div><strong>{score(n.similarity,6)}</strong></div>)}</div><p className="cm-method-muted">K tối đa hiện trong backend: <strong>{knn?.k ?? "—"}</strong>. Danh sách này là láng giềng tương đồng chung; khi dự đoán một phim, chỉ tính những người đã đánh giá phim đó.</p></DataPanel>}
              {step === 3 && <DataPanel title="Dự đoán rating cho một phim chưa đánh giá" subtitle="Bấm phim khác ở kết quả để xem cách láng giềng đóng góp"><div className="cm-method-select-line"><label htmlFor="cm-explain-movie">Phim cần giải thích</label><select id="cm-explain-movie" value={explainMovieId ?? ""} onChange={e => setExplainMovieId(Number(e.target.value))}>{items.map(x=><option key={x.movieId} value={x.movieId}>{x.title}</option>)}</select></div><div className="cm-method-formula">r̂<sub>u,i</sub> = r̄<sub>u</sub> + Σ sim(u,v)(r<sub>v,i</sub>−r̄<sub>v</sub>) / Σ |sim(u,v)|</div>{explain ? <><div className="cm-method-metrics"><span><b>{score(explain.baseline,3)}</b> điểm nền</span><span><b>{explain.neighborCount}/{explain.k}</b> láng giềng</span><span><b>{score(explain.predictedRating,3)}</b> rating dự đoán</span></div><div className="cm-method-table-wrap"><table><thead><tr><th>Người</th><th>Cosine</th><th>Rating</th><th>Độ lệch</th><th>Đóng góp</th></tr></thead><tbody>{explain.neighbors.slice(0,8).map(n=><tr key={n.userId}><td>User {n.userId}</td><td>{score(n.similarity,4)}</td><td>{score(n.rating,1)}</td><td>{score(n.deviation,3)}</td><td>{score(n.weightedContribution,4)}</td></tr>)}</tbody></table></div><p className="cm-method-muted">Điểm thô: {score(explain.rawPrediction,4)}; rating đầu ra được giới hạn trong khoảng 0,5–5,0.</p></> : <p className="cm-method-muted">Đang tải chi tiết phép dự đoán từ backend...</p>}</DataPanel>}
            </>}
            {(mode === "knn" ? step === 4 : step === 3) && <DataPanel title={resultTitle} subtitle={mode === "knn" ? "Thứ hạng theo rating dự đoán (0,5–5,0)" : "Thứ hạng theo Cosine Similarity (không phải rating dự đoán)"}><div className="cm-method-recommendations">{visible.map((row,index)=><button type="button" key={row.movieId} onClick={()=> { if(mode === "knn") { setExplainMovieId(row.movieId); setStep(3); } }} title={mode === "knn" ? "Nhấn để xem công thức dự đoán" : row.title}><Poster id={row.movieId} title={row.title} image={posters[row.movieId]}/><span className="cm-method-result-index">#{index+1}</span><h4>{row.title}</h4><p>{mode === "knn" ? "Rating dự đoán" : "Cosine Similarity"}</p><strong>{score(mode === "knn" ? row.predicted_rating ?? 0 : row.similarity ?? 0, mode === "knn" ? 2 : 4)}{mode === "knn" ? " ★" : ""}</strong></button>)}</div><p className="cm-method-muted">Danh sách được tính từ API mô hình hiện có; poster được bổ sung qua MovieLens/TMDb. {mode === "knn" ? "Nhấn vào phim bất kỳ để xem đóng góp của các láng giềng." : "Độ tương đồng cao không có nghĩa là phim có điểm rating cao."}</p></DataPanel>}
            <div className="cm-method-stage-actions"><button type="button" disabled={step===0} onClick={()=>setStep(s=>Math.max(0,s-1))}><ArrowLeft size={16}/> Trước</button><button type="button" className="primary" onClick={()=>setStep(s=>s===steps.length-1?0:s+1)}>{step === steps.length-1 ? "Xem lại quy trình" : "Bước tiếp theo"}<ArrowRight size={16}/></button></div>
          </div>
        )}
        <div className="cm-method-disclaimer"><Database size={15} /><span>Phòng mô phỏng dùng dữ liệu MovieLens Training và kết quả API của CineMatch. Không trộn tài khoản đăng nhập mới với 610 userId MovieLens; cấu hình K hiển thị theo backend đang chạy, không phải giá trị giả lập.</span></div>
      </div>
    </div>
  );
}
