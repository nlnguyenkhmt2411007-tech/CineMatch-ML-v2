import { useState } from "react";
import {
  BarChart3, ChevronDown, CircleHelp, Clapperboard, Film,
  FlaskConical, Heart, History, LogOut, Menu, Search, Settings2,
  SlidersHorizontal, Sparkles, UserCircle2, Users, X,
} from "lucide-react";
import type { UserProfile } from "../../types";

export type NavTab =
  | "home" | "personal" | "methods" | "explore"
  | "content-based" | "collaborative" | "rate"
  | "dashboard" | "ab-lab" | "history" | "profile";

interface NavbarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  currentUser: UserProfile;
  availableUsers: UserProfile[];
  onSelectUser: (user: UserProfile) => void;
  onOpenFastApiModal: () => void;
  onSearchClick: () => void;
  isFastApiConnected: boolean;
  accountName?: string;
  avatarUrl?: string | null;
  onOpenAccountSwitcher?: () => void;
  onLogout?: () => void;
  onEditGenres?: () => void;
}

const mainLinks: Array<{ id: NavTab; label: string }> = [
  { id: "home", label: "Trang chủ" },
  { id: "explore", label: "Khám phá" },
  { id: "personal", label: "Dành cho bạn" },
  { id: "content-based", label: "Theo sở thích" },
  { id: "collaborative", label: "Người cùng gu" },
  { id: "rate", label: "Đánh giá" },
];

const extraLinks: Array<{ id: NavTab; label: string; icon: typeof Film }> = [
  { id: "history", label: "Lịch sử đánh giá", icon: History },
  { id: "methods", label: "Cách hoạt động", icon: CircleHelp },
  { id: "dashboard", label: "Góc phân tích", icon: BarChart3 },
  { id: "ab-lab", label: "So sánh A/B", icon: FlaskConical },
  { id: "profile", label: "Hồ sơ cá nhân", icon: UserCircle2 },
];

export function Navbar({
  currentTab, onTabChange, currentUser, availableUsers, onSelectUser,
  onOpenFastApiModal, onSearchClick, isFastApiConnected,
  accountName, avatarUrl, onOpenAccountSwitcher, onLogout, onEditGenres,
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const navigate = (tab: NavTab) => {
    onTabChange(tab);
    setMobileOpen(false);
    setMoreOpen(false);
  };

  const navButton = (link: { id: NavTab; label: string }, compact = false) => (
    <button
      type="button"
      key={link.id}
      onClick={() => navigate(link.id)}
      className={`cmv4-nav-link ${currentTab === link.id ? "is-active" : ""} ${compact ? "is-mobile" : ""}`}
      aria-current={currentTab === link.id ? "page" : undefined}
    >
      {link.label}
    </button>
  );

  return (
    <header className="cmv4-navbar sticky top-0 z-40 w-full">
      <div className="cmv4-nav-inner">
        <button type="button" className="cmv4-brand" onClick={() => navigate("home")} aria-label="CineMatch - Về trang chủ">
          <img src="/branding/cinematch-lockup.svg" alt="CineMatch" />
        </button>

        <nav className="cmv4-nav-desktop" aria-label="Điều hướng chính">
          {mainLinks.map(link => navButton(link))}
          <div className="cmv4-more-wrap">
            <button type="button" className={`cmv4-nav-link cmv4-more ${extraLinks.some(x => x.id === currentTab) ? "is-active" : ""}`} onClick={() => setMoreOpen(!moreOpen)} aria-expanded={moreOpen}>
              Thêm <ChevronDown size={13} />
            </button>
            {moreOpen && (
              <div className="cmv4-dropdown" role="menu">
                {extraLinks.map(({ id, label, icon: Icon }) => (
                  <button key={id} type="button" role="menuitem" onClick={() => navigate(id)}><Icon size={17} />{label}</button>
                ))}
                <div className="cmv4-dropdown-separator" />
                <button type="button" role="menuitem" onClick={() => {setMoreOpen(false);onOpenFastApiModal();}}><CircleHelp size={17} />Trạng thái kết nối</button>
              </div>
            )}
          </div>
        </nav>

        <div className="cmv4-nav-actions">
          <button type="button" className="cmv4-icon-btn" onClick={onSearchClick} aria-label="Tìm kiếm phim" title="Tìm kiếm phim"><Search size={20}/></button>
          <button type="button" className="cmv4-status" onClick={onOpenFastApiModal} title={isFastApiConnected ? "Backend đang kết nối" : "Kiểm tra kết nối backend"} aria-label="Trạng thái kết nối">
            <span className={isFastApiConnected ? "online" : "offline"}/>
          </button>
          {accountName ? (
            <div className="cmv4-avatar-group">
              <button type="button" className="cmv4-avatar-button" onClick={() => navigate("profile")} aria-label="Mở hồ sơ cá nhân" title="Hồ sơ cá nhân">
                {avatarUrl ? <img src={avatarUrl} alt=""/> : <UserCircle2 size={23}/>}
              </button>
              <button type="button" className="cmv4-account-caret" onClick={onOpenAccountSwitcher} aria-label="Chuyển tài khoản" title={accountName}><ChevronDown size={14}/></button>
            </div>
          ) : availableUsers.length ? (
            <select className="cmv4-legacy-user" value={currentUser.userId} onChange={e => {const u = availableUsers.find(x=>x.userId===Number(e.target.value));if(u)onSelectUser(u)}} aria-label="Chọn hồ sơ">
              {availableUsers.map(u=><option key={u.userId} value={u.userId}>{u.name}</option>)}
            </select>
          ) : null}
          <button type="button" className="cmv4-menu-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? "Đóng menu" : "Mở menu"} aria-expanded={mobileOpen}>
            {mobileOpen ? <X size={22}/> : <Menu size={22}/>}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="cmv4-mobile-drawer" aria-label="Điều hướng di động">
          <div className="cmv4-mobile-grid">
            {mainLinks.map(link => navButton(link, true))}
            {extraLinks.map(link => navButton(link, true))}
          </div>
          <div className="cmv4-mobile-bottom">
            {onOpenAccountSwitcher && <button type="button" onClick={()=>{setMobileOpen(false);onOpenAccountSwitcher()}}><Users size={16}/>Chuyển tài khoản</button>}
            {onEditGenres && <button type="button" onClick={()=>{setMobileOpen(false);onEditGenres()}}><SlidersHorizontal size={16}/>Sở thích</button>}
            <button type="button" onClick={()=>{setMobileOpen(false);onOpenFastApiModal()}}><Settings2 size={16}/>Kết nối</button>
            {onLogout && <button type="button" onClick={()=>{setMobileOpen(false);onLogout()}}><LogOut size={16}/>Đăng xuất</button>}
          </div>
        </nav>
      )}
    </header>
  );
}
