const BASE = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export interface KNNNeighbor {
  userId: number;
  similarity: number;
  trainingCount: number;
}

export interface KNNNeighborMovie {
  movieId: number;
  title: string;
  predicted_rating: number;
  neighbor_rating: number;
  neighbor_count: number;
  source: string;
}

export interface KNNNeighborExplore {
  method: string;
  userId: number;
  k: number;
  trainingCount: number;
  positiveNeighborCount: number;
  neighbors: KNNNeighbor[];
  selectedNeighborId: number | null;
  candidateCount: number;
  topN: number;
  items: KNNNeighborMovie[];
}

export async function getKNNNeighborExplore(
  userId: number,
  selectedNeighborId: number | null,
  topN: number,
): Promise<KNNNeighborExplore> {
  const params = new URLSearchParams({ top_n: String(topN) });
  if (selectedNeighborId !== null) {
    params.set("neighbor_id", String(selectedNeighborId));
  }
  const response = await fetch(
    `${BASE}/api/recommend/user/${userId}/neighbor-explorer?${params.toString()}`,
  );
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { detail?: string } | null;
    if (response.status === 404) {
      throw new Error("API khám phá láng giềng chưa có. Hãy khởi động lại FastAPI sau khi cài Step 10.");
    }
    throw new Error(data?.detail || `API trả về HTTP ${response.status}`);
  }
  return (await response.json()) as KNNNeighborExplore;
}
