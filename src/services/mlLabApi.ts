const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export interface MLLabPredictionRequest {
  ratingsA: Record<number, number>;
  ratingsB: Record<number, number>;
  movieId: number;
  k: number;
}

export interface MLLabComparison {
  similarity: number;
  commonMovies: number[];
  commonCount: number;
  meanA: number;
  meanB: number;
}

export interface MLLabNeighbor {
  source: string;
  userId: number | string | null;
  similarity: number;
  rating: number;
  userMean: number;
  deviation: number;
  weightedContribution: number;
}

export interface MLLabPrediction {
  movieId: number;
  predictedRating: number;
  baseline: number;
  neighborCount: number;
  k: number;
  numerator: number;
  denominator: number;
  neighbors: MLLabNeighbor[];
}

export interface MLLabPredictionResponse {
  method: string;
  movieId: number;
  title: string;
  comparison: MLLabComparison;
  prediction: MLLabPrediction;
}

export async function predictMLLab(
  request: MLLabPredictionRequest
): Promise<MLLabPredictionResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/ml-lab/predict`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    let detail = `API error: ${response.status}`;

    try {
      const errorData = await response.json();

      if (typeof errorData.detail === "string") {
        detail = errorData.detail;
      }
    } catch {
      // Giữ thông báo HTTP nếu phản hồi không phải JSON.
    }

    throw new Error(detail);
  }

  return (await response.json()) as MLLabPredictionResponse;
}

