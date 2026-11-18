import { useMemo, useRef, useState } from "react";
import { Camera, Check, Clapperboard, Film, LogIn, Plus, Search, Trash2, UserRound, Users, X } from "lucide-react";
import type { AuthAccount } from "../../services/authApi";
import { accountKey, accountKind, avatarForAccount, type RecentAccount } from "../../services/accountDevice";
import "./account-switcher.css";

type Props = {
  active: AuthAccount;
  recent: RecentAccount[];
  avatarVersion: number;
  onClose: () => void;
  onLoginAccount: (account?: RecentAccount) => void;
  onForget: (account: RecentAccount) => void;
  onUploadAvatar: (file: File) => Promise<void>;
  onRemoveAvatar: () => void;
};

export function AccountSwitcher({ active, recent, avatarVersion, onClose, onLoginAccount, onForget, onUploadAvatar, onRemoveAvatar }: Props) {
  const [tab, setTab] = useState<"all" | "movielens" | "personal">("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeKey = `${accountKind(active)}:${active.accountId}`;
  const currentAvatar = useMemo(() => avatarForAccount({ accountId: active.accountId, accountType: accountKind(active) }), [active.accountId, active.accountType, avatarVersion]);
  const filtered = useMemo(() => recent.filter(item => (tab === "all" || item.accountType === tab) && `${item.name} ${item.email} ${item.movieLensUserId ?? ""}`.toLowerCase().includes(query.toLowerCase())), [recent, tab, query]);
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true); setError("");
    try { await onUploadAvatar(file); }
    catch (e) { setError(e instanceof Error ? e.message : "Không lưu được ảnh."); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  return (
    <div className="cm-as-mask" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="cm-as-modal" role="dialog" aria-modal="true" aria-labelledby="cm-as-title">
        <header className="cm-as-header">
          <div className="cm-as-emblem"><Clapperboard size={26}/></div>
          <div><p className="cm-as-eyebrow">CINEMATCH · HỒ SƠ NGƯỜI XEM</p><h2 id="cm-as-title">Chuyển đổi tài khoản</h2><p>Quản lý các tài khoản đã đăng nhập trên thiết bị này.</p></div>
          <button className="cm-as-icon-button cm-as-close" type="button" onClick={onClose} aria-label="Đóng"><X/></button>
        </header>
        <div className="cm-as-current">
          <div className="cm-as-avatar cm-as-avatar-lg">{currentAvatar ? <img src={currentAvatar} alt="Ảnh đại diện hiện tại"/> : <UserRound size={29}/>}</div>
          <div className="cm-as-current-info"><strong>{active.name}</strong><small>{accountKind(active) === "movielens" ? `MovieLens User ID: ${active.movieLensUserId ?? "—"} · KNN K=21` : "Tài khoản cá nhân · Gợi ý theo sở thích"}</small><span className="cm-as-active"><Check size={14}/> Đang sử dụng</span></div>
          <div className="cm-as-photo-actions"><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="cm-as-sr-only" onChange={e => void upload(e.target.files?.[0])} aria-label="Tải ảnh đại diện từ thiết bị"/><button type="button" className="cm-as-outline" onClick={() => fileRef.current?.click()} disabled={uploading}><Camera size={16}/>{uploading ? "Đang lưu..." : "Đổi ảnh"}</button>{currentAvatar && <button className="cm-as-photo-remove" type="button" onClick={onRemoveAvatar}>Xóa ảnh</button>}</div>
        </div>
        <p className="cm-as-footnote">Ảnh đại diện được lưu riêng trên trình duyệt của thiết bị này, không gửi lên máy chủ.</p>
        {error && <p role="alert" className="cm-as-error">{error}</p>}
        <div className="cm-as-tabs" role="group" aria-label="Lọc tài khoản">
          <button type="button" className={tab === "all" ? "active" : ""} onClick={()=>setTab("all")}>Gần đây</button>
          <button type="button" className={tab === "movielens" ? "active" : ""} onClick={()=>setTab("movielens")}><Users size={16}/> MovieLens</button>
          <button type="button" className={tab === "personal" ? "active" : ""} onClick={()=>setTab("personal")}><UserRound size={16}/> Cá nhân</button>
        </div>
        <label className="cm-as-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm tên tài khoản, email hoặc User ID..."/></label>
        <div className="cm-as-account-list">
          {filtered.length === 0 && <p className="cm-as-empty">Chưa có tài khoản đã đăng nhập trong nhóm này.</p>}
          {filtered.map(item=>{
            const isCurrent = accountKey(item) === activeKey;
            const avatar = avatarForAccount(item);
            return <div key={accountKey(item)} className={`cm-as-account-row ${isCurrent ? "cm-as-account-row-current" : ""}`}>
              <div className="cm-as-avatar">{avatar ? <img src={avatar} alt=""/> : item.accountType === "movielens" ? <Film size={21}/> : <UserRound size={22}/>}</div>
              <div className="cm-as-account-description"><strong>{item.name}</strong><small>{item.accountType === "movielens" ? `MovieLens · User ID ${item.movieLensUserId ?? "—"}` : item.email}</small></div>
              {isCurrent ? <span className="cm-as-current-indicator"><Check size={17}/> Đang dùng</span> : <button type="button" className="cm-as-switch" onClick={()=>onLoginAccount(item)}><LogIn size={15}/> {item.accountType === "movielens" && active.accountType === "movielens" ? "Chuyển nhanh" : "Đăng nhập lại"}</button>}
              {!isCurrent && <button type="button" className="cm-as-forget" title="Xóa khỏi danh sách đã lưu (không xóa tài khoản)" aria-label={`Bỏ tài khoản ${item.name} khỏi thiết bị`} onClick={()=>onForget(item)}><Trash2 size={16}/></button>}
            </div>;
          })}
        </div>
        <footer className="cm-as-footer"><button className="cm-as-primary" type="button" onClick={()=>onLoginAccount()}><Plus size={19}/> Thêm tài khoản</button><span>Hồ sơ demo có thể chuyển nhanh trong phiên hợp lệ; tài khoản cá nhân cần xác thực lại.</span></footer>
      </section>
    </div>
  );
}
