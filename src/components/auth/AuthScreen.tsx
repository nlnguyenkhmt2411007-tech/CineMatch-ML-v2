import { useState, type FormEvent } from "react";
import { ArrowRight, Clapperboard, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { authApi, type AuthSession } from "../../services/authApi";
import { CinemaPosterReel } from "./CinemaPosterReel";
import "./cinematch-auth-cinema.css";

type Mode = "login" | "register" | "movielens";

interface Props {
  onAuthenticated: (result: AuthSession) => void;
  initialMode?: Mode;
  initialIdentifier?: string;
  onCancel?: () => void;
}

export function AuthScreen({ onAuthenticated, initialMode = "login", initialIdentifier = "", onCancel }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(initialMode === "login" ? initialIdentifier : "");
  const [demoUsername, setDemoUsername] = useState(initialMode === "movielens" ? initialIdentifier : "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const switchMode = (value: Mode) => {
    setMode(value);
    setError("");
    setPassword("");
    setShowPassword(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setError("");
    if (mode === "register" && name.trim().length < 2) {
      setError("Tên hiển thị cần ít nhất 2 ký tự.");
      return;
    }
    if (mode === "movielens" && !/^user([1-9]|[1-9][0-9]|[1-5][0-9]{2}|60[0-9]|610)$/.test(demoUsername.trim().toLowerCase())) {
      setError("Nhập tài khoản MovieLens từ user1 đến user610.");
      return;
    }
    if (password.length < 8) {
      setError("Mật khẩu cần ít nhất 8 ký tự.");
      return;
    }
    setLoading(true);
    try {
      const result = mode === "register"
        ? await authApi.register(name.trim(), email.trim(), password)
        : mode === "movielens"
          ? await authApi.demoLogin(demoUsername.trim().toLowerCase(), password)
          : await authApi.login(email.trim(), password);
      onAuthenticated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xử lý yêu cầu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cm-cinema-auth-root">
      <div className="cm-cinema-auth-layout">
        <section className="cm-cinema-showcase" aria-label="Giới thiệu CineMatch">
          <div className="cm-cinema-showcase-content">
            <div className="cm-cinema-wordmark">
              <span className="cm-cinema-brand-icon"><Clapperboard size={23} strokeWidth={1.8} /></span>
              <span>Cine<span>Match</span></span>
            </div>
            <div className="cm-cinema-hero-copy">
              <p className="cm-cinema-eyebrow">PHIM HAY, ĐÚNG GU</p>
              <h1>Khám phá phim.<br /><em>Theo cách của bạn.</em></h1>
              <p>Hàng nghìn bộ phim đang chờ. Chọn thể loại yêu thích, tìm câu chuyện dành cho riêng mình.</p>
              <div className="cm-cinema-hero-rule" />
              <span className="cm-cinema-movie-note">Poster từ thư viện MovieLens · Hình ảnh TMDb</span>
            </div>
          </div>
          <div className="cm-cinema-showcase-posters"><CinemaPosterReel /></div>
          <div className="cm-cinema-showcase-vignette" aria-hidden="true" />
        </section>

        <section className="cm-cinema-auth-aside" aria-label="Tài khoản CineMatch">
          <div className="cm-cinema-auth-form-area">
            <div className="cm-cinema-mobile-brand"><Clapperboard size={25} /> Cine<span>Match</span></div>
            <div className="cm-cinema-auth-heading">
              <p className="cm-cinema-auth-overline">TÀI KHOẢN CINEMATCH</p>
              <h2>{mode === "login" ? "Chào mừng trở lại." : mode === "register" ? "Bắt đầu với CineMatch." : "Đăng nhập MovieLens."}</h2>
              <p>{mode === "login" ? "Đăng nhập để tiếp tục hành trình điện ảnh của bạn." : mode === "register" ? "Tạo tài khoản để chọn gu phim và nhận gợi ý đầu tiên." : "Hồ sơ thử nghiệm MovieLens, liên kết chính xác với User ID và KNN K = 21."}</p>
            </div>

            <div className="cm-cinema-auth-tabs" role="group" aria-label="Chọn đăng nhập hoặc đăng ký">
              <button type="button" className={mode === "login" ? "active" : ""} aria-pressed={mode === "login"} onClick={() => switchMode("login")}>Đăng nhập</button>
              <button type="button" className={mode === "register" ? "active" : ""} aria-pressed={mode === "register"} onClick={() => switchMode("register")}>Đăng ký</button>
              <button type="button" className={mode === "movielens" ? "active" : ""} aria-pressed={mode === "movielens"} onClick={() => switchMode("movielens")}>MovieLens (610)</button>
            </div>

            <form onSubmit={(e) => void submit(e)} className="cm-cinema-auth-form">
              {mode === "register" && <label>
                <span>Họ và tên</span>
                <span className="cm-cinema-input-wrap"><UserRound size={18} /><input type="text" autoComplete="name" placeholder="Tên hiển thị của bạn" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={80} required /></span>
              </label>}
              {mode === "movielens" ? <label>
                <span>Tên đăng nhập MovieLens</span>
                <span className="cm-cinema-input-wrap"><UserRound size={18}/><input type="text" autoComplete="username" placeholder="Ví dụ: user145" value={demoUsername} onChange={e=>setDemoUsername(e.target.value)} required /></span>
              </label> : <label>
                <span>Địa chỉ email</span>
                <span className="cm-cinema-input-wrap"><Mail size={18} /><input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></span>
              </label>}
              <label>
                <span>Mật khẩu</span>
                <span className="cm-cinema-input-wrap"><LockKeyhole size={18} /><input type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={mode === "login" ? "Nhập mật khẩu" : "Tối thiểu 8 ký tự"} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /><button type="button" className="cm-cinema-password-eye" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span>
              </label>
              {error && <div role="alert" className="cm-cinema-error">{error}</div>}
              <button type="submit" disabled={loading} className="cm-cinema-submit">
                {loading ? "Đang xử lý..." : mode === "register" ? "Tạo tài khoản" : "Đăng nhập"}<ArrowRight size={19} />
              </button>
            </form>

            {mode === "movielens" && <div className="cm-cinema-auth-footnote" style={{padding:"10px 0"}}>610 hồ sơ phục vụ trình diễn. Tên đăng nhập: user1–user610; mật khẩu demo: <strong>12345678</strong>. Đây là hồ sơ demo công khai, chỉ đọc dữ liệu Training. Không nhập thông tin cá nhân.</div>}
            {onCancel && <button type="button" onClick={onCancel} className="cm-cinema-auth-footnote" style={{cursor:"pointer",textDecoration:"underline",marginTop:14}}>← Quay lại tài khoản đang sử dụng</button>}
            <div className="cm-cinema-auth-switch">
              {mode === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
              <button type="button" onClick={() => switchMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Đăng ký ngay" : "Đăng nhập"}</button>
            </div>
            <p className="cm-cinema-auth-footnote">{mode === "register" ? "Sau khi đăng ký, bạn sẽ chọn thể loại để nhận gợi ý ngay cả khi chưa có rating." : mode === "movielens" ? "Yêu cầu backend STEP 12 để xác thực và gắn MovieLens User ID an toàn." : "Tài khoản cá nhân được lưu trên backend CineMatch và phải sử dụng lưu trữ bền vững khi triển khai công khai."}</p>
          </div>
          <div className="cm-cinema-aside-footer"><span>CINEMATCH ML V2</span><span>DISCOVER YOUR NEXT MOVIE</span></div>
        </section>
      </div>
    </div>
  );
}
