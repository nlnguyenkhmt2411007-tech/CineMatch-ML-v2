import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Clapperboard } from "lucide-react";
import { authApi, type AuthAccount } from "../../services/authApi";
import { CinemaPosterReel } from "./CinemaPosterReel";
import "./cinematch-auth-cinema.css";

interface Props {
  account: AuthAccount;
  onSaved: (account: AuthAccount) => void;
  onCancel?: () => void;
  onLogout?: () => void;
}

const GENRE_LABELS: Record<string, string> = {
  Action: "Hành động", Adventure: "Phiêu lưu", Animation: "Hoạt hình", Children: "Thiếu nhi",
  Comedy: "Hài hước", Crime: "Tội phạm", Documentary: "Tài liệu", Drama: "Chính kịch",
  Fantasy: "Kỳ ảo", "Film-Noir": "Phim đen", Horror: "Kinh dị", IMAX: "IMAX",
  Musical: "Nhạc kịch", Mystery: "Bí ẩn", Romance: "Lãng mạn", "Sci-Fi": "Khoa học viễn tưởng",
  Thriller: "Giật gân", War: "Chiến tranh", Western: "Miền Tây",
};

export function GenreOnboarding({ account, onSaved, onCancel, onLogout }: Props) {
  const [genres, setGenres] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>(account.preferredGenres);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    authApi.genres().then((response) => {
      if (active) setGenres(response.genres);
    }).catch((err: unknown) => {
      if (active) setError(err instanceof Error ? err.message : "Không tải được thể loại phim.");
    });
    return () => { active = false; };
  }, []);

  const toggle = (genre: string) => {
    setSelected((previous) => previous.includes(genre)
      ? previous.filter((value) => value !== genre)
      : [...previous, genre]);
    setError("");
  };

  const save = async () => {
    if (selected.length === 0) {
      setError("Hãy chọn ít nhất một thể loại để nhận gợi ý khởi đầu.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      onSaved(await authApi.preferences(selected));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chưa lưu được sở thích.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cm-genre-page">
      <div className="cm-genre-shell">
        <header className="cm-genre-navbar">
          <div className="cm-cinema-wordmark"><span className="cm-cinema-brand-icon"><Clapperboard size={21} /></span><span>Cine<span>Match</span></span></div>
          <div className="cm-genre-nav-actions">
            <span className="cm-genre-page-tag">{onCancel ? "CHỈNH SỬA SỞ THÍCH" : "THIẾT LẬP TÀI KHOẢN · 1/1"}</span>
            {onCancel && <button onClick={onCancel} type="button">Quay lại</button>}
            {onLogout && <button onClick={onLogout} type="button">Đăng xuất</button>}
          </div>
        </header>

        <section className="cm-genre-headline">
          <div className="cm-genre-headline-copy">
            <p className="cm-cinema-eyebrow">GU PHIM CỦA BẠN</p>
            <h1>Bạn thích thể loại <em>nào?</em></h1>
            <p>Chọn những thể loại bạn muốn xem. CineMatch sẽ gợi ý phim phù hợp ngay cả khi bạn chưa từng đánh giá phim nào.</p>
            <div className="cm-genre-selected-count"><span className="cm-genre-dot" /> {selected.length} thể loại đã chọn</div>
          </div>
          <div className="cm-genre-poster-window" aria-hidden="true"><CinemaPosterReel small /></div>
        </section>

        <section className="cm-genre-selection" aria-label="Chọn thể loại yêu thích">
          <div className="cm-genre-selection-title"><h2>Chọn thể loại yêu thích</h2><span>CHỌN ÍT NHẤT 1 THỂ LOẠI</span></div>
          {genres.length === 0 && !error && <p className="cm-genre-info">Đang tải thể loại từ CineMatch...</p>}
          <div className="cm-genre-grid">
            {genres.map((genre) => {
              const active = selected.includes(genre);
              return (
                <button key={genre} type="button" aria-pressed={active} onClick={() => toggle(genre)} className={`cm-genre-choice ${active ? "cm-genre-choice--active" : ""}`}>
                  <span><strong>{GENRE_LABELS[genre] ?? genre}</strong><small>{genre}</small></span>
                  <span className="cm-genre-checkbox" aria-hidden="true">{active && <Check size={14} strokeWidth={2.8} />}</span>
                </button>
              );
            })}
          </div>
          {error && <div className="cm-cinema-error cm-genre-error" role="alert">{error}</div>}
          <div className="cm-genre-actions">
            <p>Thể loại có thể thay đổi sau khi tạo tài khoản.</p>
            <div>
              {onCancel && <button type="button" className="cm-genre-cancel" onClick={onCancel}><ArrowLeft size={16} /> Hủy</button>}
              <button type="button" className="cm-cinema-submit cm-genre-continue" onClick={() => void save()} disabled={loading || genres.length === 0}>
                {loading ? "Đang lưu..." : "Khám phá phim"}<ArrowRight size={19} />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
