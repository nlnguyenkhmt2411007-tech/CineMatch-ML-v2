"""CineMatch User-Based KNN, synchronized with the verified Colab experiment.

Data: Training only. Numeric similarity: frozen Colab user_similarity.npy.
Prediction: max K positive-similarity users who rated the target in Training.
Ranking: -clipped rating, -actual number of neighbors, ascending movieId.
No Validation/Testing data are loaded to fit or predict.
"""
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
TRAIN_PATH = ROOT / "data" / "processed" / "ratings_train.csv"
MOVIES_PATH = ROOT / "data" / "processed" / "movies_processed.csv"
ASSET_PATH = ROOT / "data" / "ml_colab" / "user_similarity.npy"


class UserBasedCF:
    def __init__(self, k=21):
        self.k = int(k)
        if self.k < 1:
            raise ValueError("K must be >= 1")

        self.ratings = pd.read_csv(TRAIN_PATH)
        self.movies = pd.read_csv(MOVIES_PATH)
        self.user_means = self.ratings.groupby("userId")["rating"].mean()
        self.global_mean = float(self.ratings["rating"].mean())
        self.user_ids = sorted(int(x) for x in self.ratings["userId"].unique())
        self.movie_ids = sorted(int(x) for x in self.ratings["movieId"].unique())
        self.user_to_idx = {uid: i for i, uid in enumerate(self.user_ids)}
        self.movie_to_idx = {mid: i for i, mid in enumerate(self.movie_ids)}
        self._user_ids_array = np.asarray(self.user_ids, dtype=int)

        # Load Colab similarity with the same ascending userId index.
        self.similarity = np.load(ASSET_PATH, allow_pickle=False)
        expected = (len(self.user_ids), len(self.user_ids))
        if self.similarity.shape != expected or not np.all(np.isfinite(self.similarity)):
            raise ValueError("Colab user similarity has incompatible shape or values")
        if self.similarity.dtype != np.float64:
            raise ValueError("Colab similarity must use float64")
        if not np.allclose(np.diag(self.similarity), 0.0, atol=1e-12):
            raise ValueError("Colab similarity diagonal must be zero")

        self.ratings_by_movie = {
            int(mid): {int(uid): float(score) for uid, score in
                       zip(group["userId"], group["rating"])}
            for mid, group in self.ratings.groupby("movieId")
        }
        self.seen_by_user = {
            int(uid): set(group["movieId"].astype(int))
            for uid, group in self.ratings.groupby("userId")
        }
        self.movie_titles = dict(zip(
            self.movies["movieId"].astype(int),
            self.movies["title"].astype(str)
        ))
        self._movie_neighbors = {}
        for mid, raters in self.ratings_by_movie.items():
            idx = np.asarray([self.user_to_idx[uid] for uid in raters], dtype=int)
            deviations = np.asarray([
                rating - float(self.user_means.loc[uid])
                for uid, rating in raters.items()
            ], dtype=np.float64)
            self._movie_neighbors[mid] = idx, deviations

    def _valid_neighbors(self, user_id, movie_id):
        """Eligible rater indices and centered ratings in reproducible order."""
        pair = self._movie_neighbors.get(int(movie_id))
        if pair is None:
            return np.empty(0, dtype=int), np.empty(0, dtype=float)
        idx, deviation = pair
        u = self.user_to_idx[int(user_id)]
        scores = self.similarity[u, idx]
        eligible = np.flatnonzero(scores > 0)
        if len(eligible) == 0:
            return np.empty(0, dtype=int), np.empty(0, dtype=float)
        idx = idx[eligible]
        deviation = deviation[eligible]
        sim = self.similarity[u, idx]
        order = np.lexsort((self._user_ids_array[idx], -sim))
        return idx[order], deviation[order]

    def predict_details(self, user_id, movie_id, k=None):
        """(clipped_rating, used_neighbor_count, raw_rating, source)."""
        uid, mid = int(user_id), int(movie_id)
        if uid not in self.user_to_idx:
            return (self.global_mean, 0, self.global_mean, "global_mean")
        baseline = float(self.user_means.loc[uid])
        idx, deviations = self._valid_neighbors(uid, mid)
        if len(idx) == 0:
            return (float(np.clip(baseline, .5, 5.0)), 0, baseline, "user_mean")
        n = min(self.k if k is None else int(k), len(idx))
        if n <= 0:
            raise ValueError("K must be >= 1")
        u = self.user_to_idx[uid]
        weights = self.similarity[u, idx[:n]]
        raw = float(baseline + np.dot(weights, deviations[:n]) / np.sum(np.abs(weights)))
        return (float(np.clip(raw, .5, 5.0)), n, raw, "knn")

    def predict(self, user_id, movie_id):
        return self.predict_details(user_id, movie_id)[0]

    def recommend(self, user_id, top_n=10):
        uid = int(user_id)
        if uid not in self.user_to_idx:
            raise ValueError(f"Unknown MovieLens userId: {uid}")
        unseen = (mid for mid in self.movie_ids
                  if mid not in self.seen_by_user.get(uid, set()))
        rows = []
        for mid in unseen:
            score, count, raw, source = self.predict_details(uid, mid)
            rows.append((mid, score, count, raw, source))
        rows.sort(key=lambda item: (-item[1], -item[2], item[0]))
        top = rows[:int(top_n)]
        return pd.DataFrame([{
            "movieId": mid,
            "title": self.movie_titles.get(mid, "Unknown"),
            "predicted_rating": round(score, 6),
            "neighbor_count": count,
            "raw_prediction": raw,
            "source": source,
        } for mid, score, count, raw, source in top])


if __name__ == "__main__":
    model = UserBasedCF(k=21)
    print("K:", model.k, "| Users:", len(model.user_ids), "| Train films:", len(model.movie_ids))
    print(model.recommend(1, 10).to_string(index=False))
