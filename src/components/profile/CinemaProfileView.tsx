import { useMemo } from "react";
import { ArrowRight, Clapperboard, Film, Heart, History, LogOut, Settings2, ShieldCheck, SlidersHorizontal, Star, UserRound, Users } from "lucide-react";
import type { AuthAccount } from "../../services/authApi";
import type { NavTab } from "../layout/Navbar";

interface Props {
  account: AuthAccount;
  avatarUrl?: string | null;
  onNavigate: (tab: NavTab) => void;
  onOpenAccountSwitcher: () => void;
  onEditGenres: () => void;
  onLogout: () => void;
}

export function CinemaProfileView({ account, avatarUrl, onNavigate, onOpenAccountSwitcher, onEditGenres, onLogout }: Props) {
  const isDemo = account.accountType === "movielens";
  const ratings = useMemo(()=>Object.values(account.ratings).map(Number).filter(x=>Number.isFinite(x)&&x>=0.5&&x<=5),[account.ratings]);
  const mean = ratings.length ? ratings.reduce((a,b)=>a+b,0)/ratings.length : 0;
  const actions = [
    {icon:History, label:"Lịch sử đánh giá", action:()=>onNavigate("history")},
    {icon:Heart,label:"Gợi ý dành cho bạn",action:()=>onNavigate("personal")},
    {icon:Film,label:"Khám phá phim",action:()=>onNavigate("explore")},
    {icon:Users,label:"Chuyển tài khoản",action:onOpenAccountSwitcher},
  ];
  return <div className="cmv4-page cmv4-profile-page">
    <div className="cmv4-page-head"><div className="cmv4-page-eyebrow"><UserRound size={19}/> KHÔNG GIAN CÁ NHÂN</div><h1>Hồ sơ <span>của bạn</span></h1><p>Tài khoản, sở thích và phim đã đánh giá.</p></div>
    <div className="cmv4-profile-grid">
      <aside className="cmv4-profile-sidebar">
        <div className="cmv4-profile-avatar">{avatarUrl ? <img src={avatarUrl} alt="Ảnh đại diện"/> : <UserRound size={49}/>}</div>
        <h2>{account.name}</h2><p>{isDemo ? `MovieLens User ${account.movieLensUserId}` : "Tài khoản CineMatch cá nhân"}</p>
        <span className="cmv4-identity-badge"><ShieldCheck size={14}/>{isDemo ? "Hồ sơ mẫu · Chỉ đọc" : "Tài khoản cá nhân"}</span>
        <div className="cmv4-sidebar-links">
          {actions.map(({icon:Icon,label,action})=><button key={label} type="button" onClick={action}><Icon size={17}/>{label}<ArrowRight size={15}/></button>)}
          {!isDemo && <button type="button" onClick={onEditGenres}><SlidersHorizontal size={17}/>Chỉnh sửa sở thích<ArrowRight size={15}/></button>}
          <button className="cmv4-logout" type="button" onClick={onLogout}><LogOut size={17}/>Đăng xuất</button>
        </div>
      </aside>
      <section className="cmv4-profile-main">
        <div className="cmv4-profile-section-title"><Clapperboard size={21}/>Tổng quan</div>
        <div className="cmv4-profile-stats">
          <div><strong>{ratings.length.toLocaleString("vi-VN")}</strong><span>Phim đã đánh giá</span></div>
          <div><strong>{mean.toFixed(2)}</strong><span>Điểm trung bình</span></div>
          <div><strong>21</strong><span>KNN · K tối đa</span></div>
        </div>
        <div className="cmv4-profile-section-title"><Heart size={21}/>Thể loại yêu thích</div>
        <div className="cmv4-genre-chips">
          {account.preferredGenres.length ? account.preferredGenres.map(genre=><span key={genre}>{genre}</span>) : <p>Chưa có thể loại yêu thích. Hãy khám phá và đánh giá thêm phim.</p>}
        </div>
        <div className="cmv4-profile-note"><Star size={20}/><div><strong>{isDemo ? "Dữ liệu MovieLens được bảo toàn" : "Gợi ý cải thiện theo đánh giá của bạn"}</strong><p>{isDemo ? "Điểm MovieLens chỉ đọc. KNN dùng K = 21." : "Đánh giá thêm phim để mở gợi ý KNN khi đủ dữ liệu tương đồng."}</p></div></div>
        <div className="cmv4-profile-actions"><button type="button" onClick={()=>onNavigate("personal")}>Xem phim dành cho bạn <ArrowRight size={17}/></button><button type="button" onClick={()=>onNavigate("history")}>Lịch sử đánh giá</button></div>
      </section>
    </div>
  </div>;
}
