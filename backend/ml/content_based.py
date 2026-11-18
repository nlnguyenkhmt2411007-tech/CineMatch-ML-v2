"""CineMatch Content-Based movie-to-movie similarity, matching Colab float64.

Movie features are the 19-genre normalized vectors exported by Colab.
This model is content-based, not a rating prediction model.
"""
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
MOVIES_PATH = ROOT / "data" / "processed" / "movies_processed.csv"
FEATURES_PATH = ROOT / "data" / "ml_colab" / "movie_genres_l2.npy"
GENRES = [
    "Action", "Adventure", "Animation", "Children", "Comedy", "Crime",
    "Documentary", "Drama", "Fantasy", "Film-Noir", "Horror", "IMAX",
    "Musical", "Mystery", "Romance", "Sci-Fi", "Thriller", "War", "Western"
]


class ContentBasedRecommender:
    def __init__(self):
        self.movies = pd.read_csv(MOVIES_PATH)
        self.features = np.load(FEATURES_PATH, allow_pickle=False)
        if self.features.shape != (len(self.movies), len(GENRES)):
            raise ValueError("Colab genre matrix and movie catalog do not match")
        if self.features.dtype != np.float64 or not np.all(np.isfinite(self.features)):
            raise ValueError("Colab genre matrix must be finite float64")
        self.movie_ids = self.movies["movieId"].to_numpy(dtype=int)
        self.movie_to_idx = {int(mid): i for i, mid in enumerate(self.movie_ids)}

    def recommend_similar(self, movie_id, top_n=10):
        mid = int(movie_id)
        if mid not in self.movie_to_idx:
            raise ValueError(f"Unknown movieId={mid}")
        idx = self.movie_to_idx[mid]
        scores = self.features @ self.features[idx]
        scores[idx] = -1
        # Colab: descending similarity, ascending movieId for exact-score ties.
        order = np.lexsort((self.movie_ids, -scores))[:int(top_n)]
        result = self.movies.iloc[order][["movieId", "title", "year"]].copy()
        result["similarity"] = scores[order]
        return result.reset_index(drop=True)
