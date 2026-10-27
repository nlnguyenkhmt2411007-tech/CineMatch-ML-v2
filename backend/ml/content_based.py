
from pathlib import Path
import pandas as pd
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import normalize

ROOT = Path(__file__).resolve().parents[2]
MOVIES_PATH = ROOT / "data" / "processed" / "movies_processed.csv"

# 19 the loai trong MovieLens
GENRES = [
    "Action", "Adventure", "Animation", "Children",
    "Comedy", "Crime", "Documentary", "Drama",
    "Fantasy", "Film-Noir", "Horror", "IMAX",
    "Musical", "Mystery", "Romance", "Sci-Fi",
    "Thriller", "War", "Western"
]


class ContentBasedRecommender:
    def __init__(self):
        self.movies = pd.read_csv(MOVIES_PATH)

        features = self.movies[GENRES].fillna(0).to_numpy(
            dtype=np.float32
        )

        # Chuan hoa vector de tinh cosine similarity
        self.features = normalize(features)

        self.movie_to_idx = {
            int(movie_id): idx
            for idx, movie_id in enumerate(self.movies["movieId"])
        }

    def recommend_similar(self, movie_id, top_n=10):
        """Goi y cac phim co the loai giong phim duoc chon."""

        movie_id = int(movie_id)

        if movie_id not in self.movie_to_idx:
            raise ValueError(f"Khong tim thay movieId={movie_id}")

        idx = self.movie_to_idx[movie_id]

        # Chi tinh do tuong dong voi 1 phim
        scores = cosine_similarity(
            self.features[idx:idx + 1],
            self.features
        ).ravel()

        # Khong goi y lai chinh phim dang xem
        scores[idx] = -1

        top_indices = np.argsort(-scores, kind="stable")[:top_n]

        result = self.movies.iloc[top_indices][
            ["movieId", "title", "year"]
        ].copy()

        result["similarity"] = scores[top_indices]

        return result.reset_index(drop=True)


if __name__ == "__main__":
    recommender = ContentBasedRecommender()

    print("=" * 55)
    print("CINEMATCH ML - CONTENT-BASED FILTERING")
    print("=" * 55)
    print("So phim:", len(recommender.movies))
    print("So dac trung:", len(GENRES))

    # MovieLens movieId = 1: Toy Story (1995)
    print("\nGoi y 10 phim tuong tu Toy Story (1995):")
    recommendations = recommender.recommend_similar(
        movie_id=1,
        top_n=10
    )

    print(recommendations.to_string(index=False))
