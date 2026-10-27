export interface Movie {
  movieId: number;
  title: string;
  year: number;
  genres: string[];
  posterUrl: string;
  backdropUrl: string;
  synopsis: string;
  imdbId?: string;
  tmdbId?: number;
  tags?: string[];
  avgRating: number;
  ratingsCount: number;
}

export interface UserRating {
  userId: number;
  movieId: number;
  rating: number; // 0.5 to 5.0
  timestamp: number;
}

export interface UserProfile {
  userId: number;
  name: string;
  avatar: string;
  bio: string;
  preferredGenres: string[];
  ratings: Record<number, number>; // movieId -> rating
  avgRating: number;
}

export interface GenreProfileVector {
  genre: string;
  weight: number; // normalized between 0 and 1
}

export interface ContentRecommendation {
  movie: Movie;
  similarityScore: number; // 0 to 1
  matchedGenres: string[];
  explanation: string;
}

export interface NeighborUser {
  userId: number;
  name: string;
  similarity: number; // Cosine similarity on co-rated items (-1 to 1 or 0 to 1)
  coRatedCount: number;
  coRatedSamples: { title: string; targetRating: number; neighborRating: number }[];
}

export interface CollaborativeRecommendation {
  movie: Movie;
  predictedRating: number; // e.g. 4.6 / 5.0
  contributingNeighborsCount: number;
  confidence: number;
  explanation: string;
}

export interface MLReportMetrics {
  kNeighbors: number;
  ratingThreshold: number; // theta e.g. 4.0
  topN: number; // e.g. 10
  userBased: {
    precision: number;
    recall: number;
    mae: number;
    rmse: number;
    evaluatedUsers: number;
  };
  contentBased: {
    precision: number;
    recall: number;
    evaluatedUsers: number;
  };
}
