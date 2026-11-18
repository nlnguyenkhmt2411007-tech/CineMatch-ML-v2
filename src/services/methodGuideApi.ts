import { cineMatchApi } from "./api";

const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export interface GuideMovie {
  movieId: number;
  title: string;
  year?: number | null;
  similarity?: number;
  predicted_rating?: number;
}

export interface ProfileDetail {
  userId: number;
  trainingCount: number;
  likedCount: number;
  fallback: boolean;
  likedSamples: Array<{movieId: number; title: string; rating: number}>;
  vector: number[];
  genres: string[];
  topGenres: Array<{genre: string; weight: number}>;
}

export interface KNNDetail {
  userId: number;
  k: number;
  userMean: number;
  trainingCount: number;
  matrixShape: number[];
  centeredSamples: Array<{movieId: number; title: string; rating: number; centered: number}>;
  neighbors: Array<{userId: number; similarity: number}>;
  matrixMovies: Array<{movieId: number; title: string}>;
  matrixRows: Array<{userId: number; ratings: Array<number | null>}>;
  note: string;
}

export interface RatingExplanation {
  k: number;
  baseline: number;
  neighborCount: number;
  numerator: number;
  denominator: number;
  rawPrediction: number;
  predictedRating: number;
  title: string;
  neighbors: Array<{
    userId: number; similarity: number; rating: number; userMean: number;
    deviation: number; weightedContribution: number;
  }>;
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`);
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as {detail?: string} | null;
    throw new Error(detail?.detail || `API trả về ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const methodGuideApi = {
  movie: cineMatchApi.getMovie,
  movieSearch: (term: string) => cineMatchApi.getMovies(1, 15, term),
  similar: (id: number) => cineMatchApi.getSimilarMovies(id, 10),
  personal: (id: number) => cineMatchApi.getContentUserRecommendations(id, 10),
  collab: (id: number) => cineMatchApi.getUserRecommendations(id, 10),
  profile: (id: number) => get<ProfileDetail>(`/api/methods/profile/${id}`),
  knn: (id: number) => get<KNNDetail>(`/api/methods/knn/${id}`),
  explain: (userId: number, movieId: number) =>
    get<RatingExplanation>(`/api/recommend/user/${userId}/explain/${movieId}`),
  poster: async (id: number): Promise<string | null> => {
    try {
      const row = await cineMatchApi.getEnrichedMovie(id);
      return row.posterUrl || null;
    } catch {
      return null;
    }
  },
};
