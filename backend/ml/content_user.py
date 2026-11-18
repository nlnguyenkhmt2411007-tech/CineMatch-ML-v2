"""CineMatch personalized Content-Based recommendations, identical Colab profiles.

Uses Training-derived Colab profiles and 19-genre L2 movie vectors (float64).
The score is cosine similarity, never predicted star rating.
"""
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
MOVIES_PATH = ROOT / "data" / "processed" / "movies_processed.csv"
TRAIN_PATH = ROOT / "data" / "processed" / "ratings_train.csv"
ASSET_DIR = ROOT / "data" / "ml_colab"
GENRES = [
    "Action", "Adventure", "Animation", "Children", "Comedy", "Crime",
    "Documentary", "Drama", "Fantasy", "Film-Noir", "Horror", "IMAX",
    "Musical", "Mystery", "Romance", "Sci-Fi", "Thriller", "War", "Western"
]


class ContentUserRecommender:
    def __init__(self):
        self.movies = pd.read_csv(MOVIES_PATH)
        self.train = pd.read_csv(TRAIN_PATH)
        self.features = np.load(ASSET_DIR / "movie_genres_l2.npy", allow_pickle=False)
        profiles = np.load(ASSET_DIR / "user_content_profiles.npy", allow_pickle=False)
        self.user_ids = sorted(int(x) for x in self.train["userId"].unique())
        if self.features.shape != (len(self.movies), len(GENRES)):
            raise ValueError("Colab movie features shape does not match movies_processed")
        if profiles.shape != (len(self.user_ids), len(GENRES)):
            raise ValueError("Colab user profiles shape does not match Training")
        if self.features.dtype != np.float64 or profiles.dtype != np.float64:
            raise ValueError("Colab model assets must be float64")
        self.user_profiles = {uid: profiles[i] for i, uid in enumerate(self.user_ids)}
        self.movie_ids = self.movies["movieId"].to_numpy(dtype=int)
        self.movie_to_idx = {int(mid): i for i, mid in enumerate(self.movie_ids)}
        self.seen_by_user = {
            int(uid): set(block["movieId"].astype(int))
            for uid, block in self.train.groupby("userId")
        }
        self.title_map = dict(zip(self.movies["movieId"], self.movies["title"]))

    def score_movies(self, user_id, candidate_ids):
        profile = self.user_profiles.get(int(user_id))
        if profile is None:
            return {int(mid): 0.0 for mid in candidate_ids}
        movie_ids = [int(mid) for mid in candidate_ids if int(mid) in self.movie_to_idx]
        if not movie_ids:
            return {}
        indices = np.asarray([self.movie_to_idx[mid] for mid in movie_ids], dtype=int)
        scores = self.features[indices] @ profile
        return dict(zip(movie_ids, map(float, scores)))

    def recommend(self, user_id, top_n=10, candidate_ids=None):
        uid = int(user_id)
        if uid not in self.user_profiles:
            raise ValueError(f"Unknown MovieLens userId: {uid}")
        catalog = self.movie_ids if candidate_ids is None else candidate_ids
        candidates = [int(mid) for mid in catalog
                      if int(mid) not in self.seen_by_user.get(uid, set())
                      and int(mid) in self.movie_to_idx]
        scores = self.score_movies(uid, candidates)
        ordered = sorted(scores, key=lambda mid: (-scores[mid], mid))[:int(top_n)]
        return pd.DataFrame([{
            "movieId": mid,
            "title": self.title_map.get(mid, "Unknown"),
            "similarity": round(scores[mid], 6),
        } for mid in ordered])
