
import type { Movie } from "../types";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

interface FeaturedResponse {
  total: number;
  items: Movie[];
  source: string;
  rating_source?: string;
}

export async function fetchFeaturedMovies(
  limit = 12
): Promise<Movie[]> {
  const safeLimit = Math.max(
    1,
    Math.min(12, limit)
  );

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 30000);

  try {
    const response = await fetch(
      `${API_BASE}/api/movies/featured?limit=${safeLimit}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw new Error(
        `Featured API failed: HTTP ${response.status}`
      );
    }

    const result =
      (await response.json()) as FeaturedResponse;

    if (!Array.isArray(result.items)) {
      throw new Error(
        "Invalid featured movies response"
      );
    }

    return result.items;
  } finally {
    clearTimeout(timeout);
  }
}