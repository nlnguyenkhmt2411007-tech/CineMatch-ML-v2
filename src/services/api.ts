
const API_BASE_URL =
    import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export interface Movie {
    movieId: number;
    title: string;
    year: number | null;
    genres: string[];
    avgRating: number | null;
    ratingsCount: number;
}

export interface MovieListResponse {
    total: number;
    page: number;
    page_size: number;
    items: Movie[];
}

export interface ContentRecommendation extends Movie {
    similarity: number;
}

export interface UserRecommendation {
    movieId: number;
    title: string;
    predicted_rating: number;
}

export interface RankingMetric {
    model: string;
    users: number;
    precision_at_10: number;
    recall_at_10: number;
}

export interface RatingMetric {
    model: string;
    k: number;
    mae: number;
    rmse: number;
}

export interface EvaluationResponse {
    dataset: string;
    split: string;
    evaluation_set: string;
    ranking_protocol: {
        top_n: number;
        relevance_threshold: number;
        sampled_unobserved_candidates: number;
        note: string;
    };
    dataset_summary: {
        total_movies: number;
        total_ratings: number;
        total_users: number;
        rated_movies: number;
    };
    ranking: RankingMetric[];
    rating_prediction: RatingMetric[];
}

async function request<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`);

    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }

    return response.json() as Promise<T>;
}

export const cineMatchApi = {
    health: () => request<{
        status: string;
        project: string;
        models: string[];
        model_k: number;
    }>("/api/health"),

    getMovies: (page = 1, pageSize = 20, search = "") =>
        request<MovieListResponse>(
            `/api/movies?page=${page}&page_size=${pageSize}&search=${encodeURIComponent(search)}`
        ),

    getMovie: (movieId: number) =>
        request<Movie>(`/api/movies/${movieId}`),

    getSimilarMovies: (movieId: number, topN = 10) =>
        request<{
            method: string;
            movieId: number;
            items: ContentRecommendation[];
        }>(`/api/recommend/content/${movieId}?top_n=${topN}`),

    getContentUserRecommendations: (userId: number, topN = 10) =>
        request<{
            method: string;
            userId: number;
            items: Array<{
                movieId: number;
                title: string;
                similarity: number;
            }>;
        }>(`/api/recommend/content-user/${userId}?top_n=${topN}`),

    getUserRecommendations: (userId: number, topN = 10) =>
        request<{
            method: string;
            userId: number;
            k: number;
            items: UserRecommendation[];
        }>(`/api/recommend/user/${userId}?top_n=${topN}`),

    getEvaluation: () =>
        request<EvaluationResponse>("/api/evaluation"),

    getExperiments: () =>
        request<{
            model: string;
            evaluation_set: string;
            selected_k: number;
            experiments: Array<{
                k: number;
                mae: number;
                rmse: number;
            }>;
        }>("/api/experiments"),
};
