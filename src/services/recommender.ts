import { Movie, UserProfile, ContentRecommendation, CollaborativeRecommendation, NeighborUser } from '../types';
import { ALL_GENRES, MOCK_MOVIES } from '../data/mockMovies';
import { MOCK_USERS } from '../data/mockUsers';

/**
 * Global mean rating from MovieLens 100k Train Split (80%): 3.5085
 * Used for cold-start imputation in the CTUT Project Report.
 */
export const GLOBAL_TRAIN_MEAN_RATING = 3.5085;

/**
 * 1. Multi-Hot Encoding for Movie Genres:
 * Converts movie.genres array into a binary vector of length 18.
 */
export function getMovieGenreVector(movie: Movie): number[] {
  return ALL_GENRES.map(genre => (movie.genres.includes(genre) ? 1 : 0));
}

/**
 * Cosine Similarity between two numeric vectors:
 * sim(A, B) = (A . B) / (||A|| * ||B||)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

/**
 * Content-Based: Compute user preference profile vector Pu
 * Pu = (1 / |L(u)|) * sum(x_i) for movies with rating >= threshold (e.g. 4.0)
 */
export function buildUserProfileVector(
  user: UserProfile,
  allMovies: Movie[],
  ratingThreshold: number = 4.0
): { vector: number[]; activeCount: number; preferredList: { genre: string; weight: number }[] } {
  const profileVector = new Array(ALL_GENRES.length).fill(0);
  let qualifiedCount = 0;

  // Find all movies rated by user >= ratingThreshold
  for (const [movieIdStr, rating] of Object.entries(user.ratings)) {
    if (rating >= ratingThreshold) {
      const movie = allMovies.find(m => m.movieId === Number(movieIdStr));
      if (movie) {
        qualifiedCount++;
        const gVec = getMovieGenreVector(movie);
        for (let i = 0; i < gVec.length; i++) {
          profileVector[i] += gVec[i];
        }
      }
    }
  }

  // Average if at least one qualified movie
  if (qualifiedCount > 0) {
    for (let i = 0; i < profileVector.length; i++) {
      profileVector[i] = profileVector[i] / qualifiedCount;
    }
  } else {
    // Fallback: use user's explicit preferredGenres if no ratings meet threshold
    if (user.preferredGenres && user.preferredGenres.length > 0) {
      user.preferredGenres.forEach(g => {
        const idx = ALL_GENRES.indexOf(g);
        if (idx !== -1) profileVector[idx] = 1.0;
      });
      qualifiedCount = user.preferredGenres.length;
    }
  }

  const preferredList = ALL_GENRES.map((genre, idx) => ({
    genre,
    weight: Math.round(profileVector[idx] * 100) / 100
  })).filter(item => item.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  return { vector: profileVector, activeCount: qualifiedCount, preferredList };
}

/**
 * Content-Based Recommendation Generator:
 * Evaluates candidate movies (excluding already rated ones) against Pu via Cosine Similarity.
 */
export function getContentBasedRecommendations(
  user: UserProfile,
  candidateMovies: Movie[],
  topN: number = 6,
  ratingThreshold: number = 4.0
): ContentRecommendation[] {
  const { vector: pu, preferredList } = buildUserProfileVector(user, candidateMovies, ratingThreshold);
  const ratedMovieIds = new Set(Object.keys(user.ratings).map(Number));

  const unratedCandidates = candidateMovies.filter(m => !ratedMovieIds.has(m.movieId));

  const scored = unratedCandidates.map(movie => {
    const movieVector = getMovieGenreVector(movie);
    const sim = cosineSimilarity(pu, movieVector);

    // Identify matched genres between movie and user's high-weight genres
    const topUserGenres = new Set(preferredList.slice(0, 4).map(p => p.genre));
    const matched = movie.genres.filter(g => topUserGenres.has(g));

    let explanation = `Trùng khớp ${Math.round(sim * 100)}% với hồ sơ sở thích thể loại`;
    if (matched.length > 0) {
      explanation += ` (${matched.join(', ')})`;
    }

    return {
      movie,
      similarityScore: Math.round(sim * 1000) / 1000,
      matchedGenres: matched,
      explanation
    };
  });

  return scored
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, topN);
}

/**
 * Item-to-Item Content-Based Similarity:
 * Given a target movie, return Top-N most similar movies based on Cosine Similarity of genre vectors.
 */
export function getSimilarMoviesByContent(
  targetMovie: Movie,
  allMovies: Movie[],
  topN: number = 5
): ContentRecommendation[] {
  const targetVec = getMovieGenreVector(targetMovie);

  return allMovies
    .filter(m => m.movieId !== targetMovie.movieId)
    .map(candidate => {
      const candVec = getMovieGenreVector(candidate);
      const sim = cosineSimilarity(targetVec, candVec);
      const sharedGenres = candidate.genres.filter(g => targetMovie.genres.includes(g));

      return {
        movie: candidate,
        similarityScore: Math.round(sim * 1000) / 1000,
        matchedGenres: sharedGenres,
        explanation: `Đồng thể loại: ${sharedGenres.join(', ')}`
      };
    })
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, topN);
}

/**
 * Calculate user mean rating:
 * r_bar_u = (1 / |I_u|) * sum(r_ui)
 */
export function calculateUserMean(user: UserProfile): number {
  const ratings = Object.values(user.ratings);
  if (ratings.length === 0) return GLOBAL_TRAIN_MEAN_RATING;
  const sum = ratings.reduce((acc, curr) => acc + curr, 0);
  return sum / ratings.length;
}

/**
 * User-Based Collaborative:
 * Compute Cosine Similarity between user U and user V using Mean-Centered ratings on co-rated items:
 * r'_ui = r_ui - r_bar_u
 */
export function computeUserSimilarity(
  userA: UserProfile,
  userB: UserProfile,
  allMovies: Movie[]
): { similarity: number; coRatedCount: number; samples: { title: string; targetRating: number; neighborRating: number }[] } {
  const meanA = calculateUserMean(userA);
  const meanB = calculateUserMean(userB);

  const ratedA = userA.ratings;
  const ratedB = userB.ratings;

  const coRatedMovieIds = Object.keys(ratedA).filter(id => id in ratedB).map(Number);
  if (coRatedMovieIds.length === 0) {
    return { similarity: 0, coRatedCount: 0, samples: [] };
  }

  let numerator = 0;
  let denomA = 0;
  let denomB = 0;

  const samples: { title: string; targetRating: number; neighborRating: number }[] = [];

  for (const movieId of coRatedMovieIds) {
    const diffA = ratedA[movieId] - meanA;
    const diffB = ratedB[movieId] - meanB;

    numerator += diffA * diffB;
    denomA += diffA * diffA;
    denomB += diffB * diffB;

    const movieObj = allMovies.find(m => m.movieId === movieId);
    if (movieObj && samples.length < 3) {
      samples.push({
        title: movieObj.title,
        targetRating: ratedA[movieId],
        neighborRating: ratedB[movieId]
      });
    }
  }

  const denominator = Math.sqrt(denomA) * Math.sqrt(denomB);
  let similarity = denominator === 0 ? 0 : numerator / denominator;

  // Map to [0, 1] range for intuitive display or keep clamped [-1, 1]
  similarity = Math.max(-1, Math.min(1, similarity));

  return {
    similarity: Math.round(similarity * 1000) / 1000,
    coRatedCount: coRatedMovieIds.length,
    samples
  };
}

/**
 * Get K-Nearest Neighbors for a target user
 */
export function getKNearestNeighbors(
  targetUser: UserProfile,
  allUsers: UserProfile[],
  allMovies: Movie[],
  k: number = 5
): NeighborUser[] {
  const otherUsers = allUsers.filter(u => u.userId !== targetUser.userId);

  const neighbors = otherUsers.map(neighbor => {
    const { similarity, coRatedCount, samples } = computeUserSimilarity(targetUser, neighbor, allMovies);
    return {
      userId: neighbor.userId,
      name: neighbor.name,
      similarity,
      coRatedCount,
      coRatedSamples: samples
    };
  });

  return neighbors
    .filter(n => n.coRatedCount > 0 && n.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}

/**
 * User-Based Collaborative Filtering Recommendation:
 * Predicts rating r_hat(u, i) using weighted average over K-NN neighbors:
 * r_hat(u, i) = r_bar_u + [ sum(sim(u, v) * (r_vi - r_bar_v)) / sum(|sim(u, v)|) ]
 */
export function getCollaborativeRecommendations(
  targetUser: UserProfile,
  allUsers: UserProfile[],
  candidateMovies: Movie[],
  kNeighbors: number = 5,
  topN: number = 6
): { recommendations: CollaborativeRecommendation[]; neighbors: NeighborUser[]; targetMean: number } {
  const targetMean = calculateUserMean(targetUser);
  const ratedByTarget = new Set(Object.keys(targetUser.ratings).map(Number));

  // Find Top-K neighbors
  const neighbors = getKNearestNeighbors(targetUser, allUsers, candidateMovies, kNeighbors);

  const unratedCandidates = candidateMovies.filter(m => !ratedByTarget.has(m.movieId));

  const scored: CollaborativeRecommendation[] = [];

  for (const movie of unratedCandidates) {
    let weightedDeviationSum = 0;
    let weightSum = 0;
    let contributingCount = 0;

    for (const neighborItem of neighbors) {
      const neighborProfile = allUsers.find(u => u.userId === neighborItem.userId);
      if (!neighborProfile) continue;

      if (movie.movieId in neighborProfile.ratings) {
        const neighborRating = neighborProfile.ratings[movie.movieId];
        const neighborMean = calculateUserMean(neighborProfile);
        const sim = neighborItem.similarity;

        if (sim > 0) {
          weightedDeviationSum += sim * (neighborRating - neighborMean);
          weightSum += Math.abs(sim);
          contributingCount++;
        }
      }
    }

    if (weightSum > 0 && contributingCount > 0) {
      let predicted = targetMean + weightedDeviationSum / weightSum;
      // Clamp between 0.5 and 5.0
      predicted = Math.max(0.5, Math.min(5.0, predicted));
      const roundedPred = Math.round(predicted * 10) / 10;

      scored.push({
        movie,
        predictedRating: roundedPred,
        contributingNeighborsCount: contributingCount,
        confidence: Math.round((contributingCount / Math.max(1, neighbors.length)) * 100),
        explanation: `Dự đoán dựa trên đánh giá của ${contributingCount} láng giềng tương đồng cao (K=${neighbors.length})`
      });
    }
  }

  // Sort by predicted rating descending
  const recommendations = scored
    .sort((a, b) => b.predictedRating - a.predictedRating)
    .slice(0, topN);

  return { recommendations, neighbors, targetMean: Math.round(targetMean * 100) / 100 };
}
