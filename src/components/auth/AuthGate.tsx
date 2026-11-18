import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Clapperboard } from "lucide-react";
import { authApi, clearAuthToken, getAuthToken, setAuthToken, type AuthAccount, type AuthSession } from "../../services/authApi";
import { accountKind, avatarForAccount, forgetRecentAccount, readRecentAccounts, rememberAccount, removeAvatar, saveDeviceAvatar, type RecentAccount } from "../../services/accountDevice";
import { AccountSwitcher } from "./AccountSwitcher";
import { AuthScreen } from "./AuthScreen";
import { GenreOnboarding } from "./GenreOnboarding";

type AuthContextValue = {
  account: AuthAccount;
  avatarUrl: string | null;
  openAccountSwitcher: () => void;
  setAccount: (account: AuthAccount) => void;
  rateMovie: (movieId: number, rating: number) => Promise<void>;
  removeRating: (movieId: number) => Promise<void>;
  resetRatings: () => Promise<void>;
  logout: () => Promise<void>;
  editGenres: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useCineMatchAccount(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("CineMatch account context is missing.");
  return context;
}

/** Only account metadata and small device-local avatars are remembered. Passwords/tokens are not. */
export function AuthGate({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AuthAccount | null>(null);
  const [checking, setChecking] = useState(Boolean(getAuthToken()));
  const [editMode, setEditMode] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [loginTarget, setLoginTarget] = useState<{ mode: "login" | "movielens"; identifier: string } | null>(null);
  const [recent, setRecent] = useState<RecentAccount[]>(readRecentAccounts);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const sessionRevision = useRef(0);

  useEffect(() => {
    let live = true;
    if (!getAuthToken()) { setChecking(false); return; }
    authApi.me().then(value => {
      if (live) { setAccount(value); setRecent(rememberAccount(value)); }
    }).catch(() => {
      if (live) { clearAuthToken(); setAccount(null); }
    }).finally(() => { if (live) setChecking(false); });
    return () => { live = false; };
  }, []);

  const authenticated = (session: AuthSession) => {
    if (session.account.accountType === "movielens") {
      const mlId = session.account.movieLensUserId;
      if (!Number.isInteger(mlId) || !mlId || mlId < 1 || mlId > 610) {
        throw new Error("Backend không trả về MovieLens User ID hợp lệ. Không chuyển tài khoản.");
      }
    }
    sessionRevision.current += 1;
    setAuthToken(session.accessToken);
    setAccount(session.account);
    setRecent(rememberAccount(session.account));
    setChecking(false);
    setEditMode(false);
    setSwitcherOpen(false);
    setLoginTarget(null);
  };

  const logout = async () => {
    sessionRevision.current += 1;
    try { await authApi.logout(); }
    catch { /* Local logout must still work if server unreachable. */ }
    finally { clearAuthToken(); setAccount(null); setEditMode(false); setSwitcherOpen(false); setLoginTarget(null); }
  };

  const guardUpdate = async (call: () => Promise<AuthAccount>): Promise<void> => {
    const startingSession = sessionRevision.current;
    const updated = await call();
    if (sessionRevision.current !== startingSession) throw new Error("Phiên đăng nhập đã thay đổi. Không áp dụng kết quả cũ.");
    setAccount(updated);
  };

  if (checking) return <div className="flex min-h-screen items-center justify-center gap-3 bg-[#070b16] text-slate-200"><Clapperboard className="animate-pulse text-[#E8BF82]" /> Đang kiểm tra phiên đăng nhập...</div>;
  if (!account) return <AuthScreen onAuthenticated={authenticated} />;

  if (loginTarget) return (
    <AuthScreen
      key={`${loginTarget.mode}:${loginTarget.identifier}`}
      initialMode={loginTarget.mode}
      initialIdentifier={loginTarget.identifier}
      onAuthenticated={authenticated}
      onCancel={() => setLoginTarget(null)}
    />
  );

  if ((!account.onboardingComplete && accountKind(account) !== "movielens") || editMode) return (
    <GenreOnboarding
      account={account}
      onSaved={updated => { setAccount(updated); setEditMode(false); }}
      onCancel={account.onboardingComplete ? () => setEditMode(false) : undefined}
      onLogout={() => void logout()}
    />
  );

  const currentAccount = { accountId: account.accountId, accountType: accountKind(account) };
  const value: AuthContextValue = {
    account,
    avatarUrl: avatarForAccount(currentAccount),
    openAccountSwitcher: () => { setRecent(readRecentAccounts()); setSwitcherOpen(true); },
    setAccount,
    rateMovie: (movieId, rating) => guardUpdate(() => authApi.rate(movieId, rating)),
    removeRating: movieId => guardUpdate(() => authApi.removeRating(movieId)),
    resetRatings: () => guardUpdate(() => authApi.resetRatings()),
    logout,
    editGenres: () => { if (accountKind(account) !== "movielens") setEditMode(true); },
  };

  return <AuthContext.Provider value={value}>
    {/* Key ensures account-scoped movie state, cached results and recommendations do not leak across switches. */}
    <div key={`${currentAccount.accountType}:${currentAccount.accountId}`} className="min-h-screen">{children}</div>
    {switcherOpen && <AccountSwitcher
      active={account}
      recent={recent}
      avatarVersion={avatarVersion}
      onClose={() => setSwitcherOpen(false)}
      onLoginAccount={target => {
        // Quick switch is limited to previously authenticated, public read-only
        // demo profiles while a valid demo session is active. Personal accounts
        // always require their own credentials to protect private data.
        if (target?.accountType === "movielens" && accountKind(account) === "movielens" && target.movieLensUserId) {
          void authApi.demoSwitch(target.movieLensUserId)
            .then(authenticated)
            .catch(() => {
              setSwitcherOpen(false);
              setLoginTarget({ mode: "movielens", identifier: `user${target.movieLensUserId}` });
            });
          return;
        }
        setSwitcherOpen(false);
        setLoginTarget(target ? {
          mode: target.accountType === "movielens" ? "movielens" : "login",
          identifier: target.accountType === "movielens" ? `user${target.movieLensUserId ?? ""}` : target.email,
        } : { mode: "login", identifier: "" });
      }}
      onForget={target => setRecent(forgetRecentAccount(target))}
      onUploadAvatar={async file => { await saveDeviceAvatar(currentAccount, file); setAvatarVersion(n => n+1); }}
      onRemoveAvatar={() => { removeAvatar(currentAccount); setAvatarVersion(n => n+1); }}
    />}
  </AuthContext.Provider>;
}
