
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.preprocessing import normalize

ROOT = Path(__file__).resolve().parents[2]

MOVIES_PATH = ROOT / "data" / "processed" / "movies_processed.csv"
TRAIN_PATH = ROOT / "data" / "processed" / "ratings_train.csv"

GENRES = [
    "Action", "Adventure", "Animation", "Children",
    "Comedy", "Crime", "Documentary", "Drama",
    "Fantasy", "Film-Noir", "Horror", "IMAX",
    "Musical", "Mystery", "Romance", "Sci-Fi",
    "Thriller", "War", "Western"
]


class ContentUserRecommender:
    def __init__(self):
        # 1. Chi doc lich su danh gia tu Train
        self.movies = pd.read_csv(MOVIES_PATH)
        self.train = pd.read_csv(TRAIN_PATH)

        # 2. Ma hoa va chuan hoa vector the loai
        features = self.movies[GENRES].fillna(0).to_numpy(
            dtype=np.float32
        )
        self.features = normalize(features)

        self.movie_to_idx = {
            int(mid): i
            for i, mid in enumerate(self.movies["movieId"])
        }

        self.seen_by_user = {
            int(uid): set(group["movieId"].astype(int))
            for uid, group in self.train.groupby("userId")
        }

        # 3. Xay dung ho so so thich tu TRAIN
        # Phim rating >= 4.0 duoc xem la phim yeu thich
        self.user_profiles = {}

        for user_id, group in self.train.groupby("userId"):
            user_id = int(user_id)

            liked = group[group["rating"] >= 4.0]

            # Neu khong co rating >= 4, su dung lich su
            # va gan trong so duong theo muc do yeu thich
            if liked.empty:
                liked = group.copy()
                weights = liked["rating"].to_numpy(
                    dtype=np.float32
                )
            else:
                weights = (
                    liked["rating"].to_numpy(dtype=np.float32)
                    - 3.0
                )

            indices = [
                self.movie_to_idx[int(mid)]
                for mid in liked["movieId"]
                if int(mid) in self.movie_to_idx
            ]

            valid_weights = [
                float(weight)
                for mid, weight in zip(liked["movieId"], weights)
                if int(mid) in self.movie_to_idx
            ]

            if not indices:
                continue

            profile = np.average(
                self.features[indices],
                axis=0,
                weights=np.asarray(valid_weights)
            )

            norm = np.linalg.norm(profile)

            if norm > 0:
                self.user_profiles[user_id] = (
                    profile / norm
                ).astype(np.float32)

        print("Da tao ho so cho", len(self.user_profiles), "nguoi dung")

    def score_movies(self, user_id, candidate_ids):
        """Cham diem cac phim ung vien theo cosine similarity."""
        user_id = int(user_id)

        profile = self.user_profiles.get(user_id)

        if profile is None:
            return {
                int(mid): 0.0
                for mid in candidate_ids
            }

        scores = {}

        for movie_id in candidate_ids:
            movie_id = int(movie_id)
            idx = self.movie_to_idx.get(movie_id)

            if idx is None:
                continue

            scores[movie_id] = float(
                self.features[idx] @ profile
            )

        return scores

    def recommend(self, user_id, top_n=10, candidate_ids=None):
        user_id = int(user_id)
        seen = self.seen_by_user.get(user_id, set())

        if candidate_ids is None:
            candidate_ids = self.movies["movieId"].tolist()

        candidates = [
            int(mid)
            for mid in candidate_ids
            if int(mid) not in seen
            and int(mid) in self.movie_to_idx
        ]

        scores = self.score_movies(user_id, candidates)

        ranked = sorted(
            scores.items(),
            key=lambda item: (-item[1], item[0])
        )[:top_n]

        title_map = dict(
            zip(self.movies["movieId"], self.movies["title"])
        )

        return pd.DataFrame([
            {
                "movieId": movie_id,
                "title": title_map.get(movie_id, "Unknown"),
                "similarity": round(score, 4)
            }
            for movie_id, score in ranked
        ])


if __name__ == "__main__":
    model = ContentUserRecommender()

    print("=" * 55)
    print("CINEMATCH ML - CONTENT-BASED USER PROFILE")
    print("=" * 55)

    print("So phim:", len(model.movies))
    print("So dac trung:", len(GENRES))

    print("\nTOP 10 PHIM GOI Y CHO USER 1:")
    result = model.recommend(user_id=1, top_n=10)
    print(result.to_string(index=False))
