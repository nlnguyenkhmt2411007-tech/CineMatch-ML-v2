/** Non-secret, device-local account list. Never persist passwords or bearer tokens here. */
import type { AuthAccount } from "./authApi";

export interface RecentAccount {
  accountId: number;
  accountType: "personal" | "movielens";
  movieLensUserId: number | null;
  name: string;
  email: string;
  lastUsed: number;
}

const RECENT_KEY = "cinematch_recent_accounts_v2";
const AVATAR_PREFIX = "cinematch_device_avatar_v2_";

export function accountKind(account: AuthAccount): "personal" | "movielens" {
  return account.accountType === "movielens" ? "movielens" : "personal";
}

export function accountKey(account: Pick<RecentAccount, "accountId" | "accountType">): string {
  return `${account.accountType}:${account.accountId}`;
}

export function readRecentAccounts(): RecentAccount[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter((item): item is RecentAccount => {
      if (!item || typeof item !== "object") return false;
      const value = item as Partial<RecentAccount>;
      return Number.isInteger(value.accountId) && Number(value.accountId) > 0 &&
        (value.accountType === "personal" || value.accountType === "movielens") &&
        typeof value.name === "string" && typeof value.email === "string" &&
        typeof value.lastUsed === "number";
    }).slice(0, 30).sort((a, b) => b.lastUsed - a.lastUsed);
  } catch { return []; }
}

export function rememberAccount(account: AuthAccount): RecentAccount[] {
  const record: RecentAccount = {
    accountId: account.accountId,
    accountType: accountKind(account),
    movieLensUserId: account.movieLensUserId ?? null,
    name: account.name,
    email: account.email,
    lastUsed: Date.now(),
  };
  const updated = [record, ...readRecentAccounts().filter(item => accountKey(item) !== accountKey(record))].slice(0, 30);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(updated)); } catch { /* Storage disabled */ }
  return updated;
}

export function forgetRecentAccount(account: RecentAccount): RecentAccount[] {
  const updated = readRecentAccounts().filter(item => accountKey(item) !== accountKey(account));
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(updated)); } catch { /* Storage disabled */ }
  return updated;
}

export function avatarForAccount(account: Pick<RecentAccount, "accountId" | "accountType">): string | null {
  try { return localStorage.getItem(AVATAR_PREFIX + accountKey(account)); }
  catch { return null; }
}

export function removeAvatar(account: Pick<RecentAccount, "accountId" | "accountType">): void {
  try { localStorage.removeItem(AVATAR_PREFIX + accountKey(account)); }
  catch { /* Browser storage unavailable */ }
}

/** Make a small device-local square avatar; no original image upload or network request. */
export async function saveDeviceAvatar(account: Pick<RecentAccount, "accountId" | "accountType">, file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Chỉ hỗ trợ JPG, PNG hoặc WebP.");
  }
  if (file.size > 5 * 1024 * 1024) throw new Error("Ảnh phải nhỏ hơn 5 MB.");
  const objectUrl = URL.createObjectURL(file);
  try {
    const picture = new Image();
    picture.src = objectUrl;
    await picture.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
    const side = Math.min(picture.naturalWidth, picture.naturalHeight);
    if (!side) throw new Error("Không đọc được kích thước ảnh.");
    const left = (picture.naturalWidth - side) / 2;
    const top = (picture.naturalHeight - side) / 2;
    ctx.drawImage(picture, left, top, side, side, 0, 0, 256, 256);
    const encoded = canvas.toDataURL("image/jpeg", 0.8);
    try { localStorage.setItem(AVATAR_PREFIX + accountKey(account), encoded); }
    catch { throw new Error("Không đủ bộ nhớ trình duyệt để lưu ảnh. Hãy thử ảnh nhỏ hơn."); }
    return encoded;
  } finally { URL.revokeObjectURL(objectUrl); }
}
