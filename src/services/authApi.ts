/** CineMatch local account client. This is separate from MovieLens demo users. */
const API_BASE_URL = (import.meta.env.VITE_AUTH_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const TOKEN_KEY = "cinematch_account_session_v1";
let inMemoryToken: string | null = null;

export interface AuthAccount {
  /** Supplied and verified by the backend, never from a browser-selected userId. */
  accountType?: "personal" | "movielens";
  movieLensUserId?: number | null;
  accountId: number;
  userId: number;
  name: string;
  email: string;
  preferredGenres: string[];
  onboardingComplete: boolean;
  ratings: Record<string, number>;
  avgRating: number;
}

export interface LiveKnnNeighbor {
  userId: number;
  similarity: number;
  commonRatings: number;
  trainingCount: number;
}

export interface LiveKnnStatus {
  accountId: number;
  userId: number;
  ratedCount: number;
  totalRatingCount: number;
  ignoredCount: number;
  requiredCount: number;
  remainingCount: number;
  minCommonRatings: number;
  k: number;
  ready: boolean;
  positiveNeighborCount: number;
  neighbors: LiveKnnNeighbor[];
  reason: "rate_more" | "no_neighbor" | "no_variance" | "no_candidates" | "ready";
}

export interface LiveKnnResult extends LiveKnnStatus {
  items: Array<{ movieId: number; title: string; predicted_rating: number; neighbor_count: number; source: string }>;
  selectedNeighborId: number | null;
  candidateCount: number;
  topN: number;
}

export interface DemoNeighborResult {
  method: string; userId: number; k: number; trainingCount: number;
  positiveNeighborCount: number;
  neighbors: Array<{userId: number; similarity: number; trainingCount: number}>;
  selectedNeighborId: number | null; candidateCount: number; topN: number;
  items: Array<{movieId:number; title:string; predicted_rating:number; neighbor_rating:number; neighbor_count:number; source:string}>;
}

export interface AuthSession {
  accessToken: string;
  tokenType: string;
  account: AuthAccount;
}

export interface ColdStartMovie {
  movieId: number;
  title: string;
  year: number | null;
  genres: string[];
  similarity: number;
  avgRating: number | null;
  ratingsCount: number;
}

export interface ColdStartResult {
  source: "selected_genres" | "rated_movies" | "popular";
  topN: number;
  items: ColdStartMovie[];
}

export function getAuthToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? inMemoryToken;
  } catch {
    return inMemoryToken;
  }
}

export function setAuthToken(token: string): void {
  inMemoryToken = token;
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Session stays in memory until reload if browser storage is blocked.
  }
}

export function clearAuthToken(): void {
  inMemoryToken = null;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore blocked storage.
  }
}

/** Use only for this local-development authentication flow. */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getAuthToken();
  // Credentials endpoints do not inherit the previously signed-in account.
  const isLogin = path === "/login" || path === "/register" || path === "/demo-login";
  if (token && !isLogin) headers.set("Authorization", `Bearer ${token}`);
  const demoSession = Boolean(token?.startsWith("cmml_")) && !isLogin;
  const apiPath = demoSession ? `/demo${path}` : path;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/auth${apiPath}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error("Không kết nối được máy chủ CineMatch. Hãy kiểm tra FastAPI đang chạy.");
  }

  if (!response.ok) {
    let detail = `Máy chủ trả về lỗi ${response.status}.`;
    try {
      const payload = (await response.json()) as { detail?: unknown };
      if (typeof payload.detail === "string") detail = payload.detail;
      else if (response.status === 422) detail = "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.";
    } catch {
      // Keep safe, generic error.
    }
    if (path === "/demo-login" && response.status === 404) detail = "Backend chưa cài STEP 12: thiếu API /api/auth/demo-login.";
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export const authApi = {
  register: (name: string, email: string, password: string) =>
    request<AuthSession>("/register", {
      method: "POST", body: JSON.stringify({ name, email, password }),
    }),
  /** Requires STEP12 backend endpoint, which returns a verified movieLensUserId. */
  demoSwitch: (userId: number) =>
    request<AuthSession>("/switch", { method: "POST", body: JSON.stringify({ userId }) }),
  demoLogin: (username: string, password: string) =>
    request<AuthSession>("/demo-login", {
      method: "POST", body: JSON.stringify({ username, password }),
    }),
  login: (email: string, password: string) =>
    request<AuthSession>("/login", {
      method: "POST", body: JSON.stringify({ email, password }),
    }),
  me: () => request<AuthAccount>("/me"),
  logout: () => request<{status: string}>("/logout", { method: "POST" }),
  genres: () => request<{genres: string[]}>("/genres"),
  preferences: (genres: string[]) => request<AuthAccount>("/preferences", {
    method: "POST", body: JSON.stringify({ genres }),
  }),
  rate: (movieId: number, rating: number) => request<AuthAccount>("/ratings", {
    method: "POST", body: JSON.stringify({ movie_id: movieId, rating }),
  }),
  removeRating: (movieId: number) =>
    request<AuthAccount>(`/ratings/${movieId}`, { method: "DELETE" }),
  resetRatings: () => request<AuthAccount>("/ratings/reset", { method: "POST" }),
  recommendations: (topN = 10) =>
    request<ColdStartResult>(`/recommendations?top_n=${topN}`),
  demoContent: (topN = 10) => request<{
    method: string; userId: number;
    items: Array<{ movieId: number; title: string; similarity: number }>;
  }>(`/model/content?top_n=${topN}`),
  knnStatus: () => request<LiveKnnStatus>("/model/knn-status"),
  knnRecommendations: (topN = 10, neighborId: number | null = null) => {
    const params = new URLSearchParams({top_n: String(topN)});
    if (neighborId !== null) params.set("neighbor_id", String(neighborId));
    return request<LiveKnnResult>(`/model/knn-recommendations?${params}`);
  },
  demoNeighbors: (topN = 10, neighborId: number | null = null) => {
    const params = new URLSearchParams({top_n: String(topN)});
    if (neighborId !== null) params.set("neighbor_id", String(neighborId));
    return request<DemoNeighborResult>(`/model/neighbor-explorer?${params}`);
  },
  demoKnn: (topN = 10) => request<{
    method: string; userId: number; k: number;
    items: Array<{ movieId: number; title: string; predicted_rating: number }>;
  }>(`/model/knn?top_n=${topN}`),
};
