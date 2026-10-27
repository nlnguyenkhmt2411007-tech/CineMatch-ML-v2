
from pathlib import Path
import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix
from sklearn.metrics.pairwise import cosine_similarity

ROOT = Path(__file__).resolve().parents[2]
TRAIN_PATH = ROOT / "data" / "processed" / "ratings_train.csv"
MOVIES_PATH = ROOT / "data" / "processed" / "movies_processed.csv"


class UserBasedCF:
    def __init__(self, k=30):
        self.k = k
        self.ratings = pd.read_csv(TRAIN_PATH)
        self.movies = pd.read_csv(MOVIES_PATH)

        # Diem trung binh chi duoc tinh tu Train
        self.user_means = self.ratings.groupby("userId")["rating"].mean()
        self.global_mean = float(self.ratings["rating"].mean())

        self.user_ids = sorted(self.ratings["userId"].unique())
        self.movie_ids = sorted(self.ratings["movieId"].unique())

        self.user_to_idx = {
            uid: i for i, uid in enumerate(self.user_ids)
        }
        self.movie_to_idx = {
            mid: i for i, mid in enumerate(self.movie_ids)
        }

        # Diem da khu do lech (train only)
        centered = (
            self.ratings["rating"]
            - self.ratings["userId"].map(self.user_means)
        )

        row_idx = self.ratings["userId"].map(self.user_to_idx).to_numpy()
        col_idx = self.ratings["movieId"].map(self.movie_to_idx).to_numpy()

        matrix = csr_matrix(
            (centered.to_numpy(), (row_idx, col_idx)),
            shape=(len(self.user_ids), len(self.movie_ids))
        )

        # 610 x 610: similarity giua cac user
        self.similarity = cosine_similarity(matrix)

        np.fill_diagonal(self.similarity, 0)

        self.ratings_by_movie = {
            mid: group.set_index("userId")["rating"].to_dict()
            for mid, group in self.ratings.groupby("movieId")
        }

        self.seen_by_user = {
            uid: set(group["movieId"])
            for uid, group in self.ratings.groupby("userId")
        }

        self.movie_titles = dict(
            zip(self.movies["movieId"], self.movies["title"])
        )

    def predict(self, user_id, movie_id):
        user_id = int(user_id)
        movie_id = int(movie_id)

        baseline = float(
            self.user_means.get(user_id, self.global_mean)
        )

        if user_id not in self.user_to_idx:
            return baseline

        raters = self.ratings_by_movie.get(movie_id)
        if not raters:
            return baseline

        neighbors = []

        for neighbor_id, rating in raters.items():
            if neighbor_id == user_id:
                continue

            similarity = self.similarity[
                self.user_to_idx[user_id],
                self.user_to_idx[neighbor_id]
            ]

            if similarity > 0:
                deviation = rating - self.user_means[neighbor_id]
                neighbors.append((similarity, deviation))

        if not neighbors:
            return baseline

        neighbors.sort(key=lambda x: x[0], reverse=True)
        neighbors = neighbors[:self.k]

        numerator = sum(s * dev for s, dev in neighbors)
        denominator = sum(abs(s) for s, _ in neighbors)

        if denominator == 0:
            return baseline

        prediction = baseline + numerator / denominator
        return float(np.clip(prediction, 0.5, 5.0))

    def recommend(self, user_id, top_n=10):
        user_id = int(user_id)

        seen = self.seen_by_user.get(user_id, set())
        candidates = [
            mid for mid in self.movie_ids if mid not in seen
        ]

        recommendations = [
            (mid, self.predict(user_id, mid))
            for mid in candidates
        ]

        recommendations.sort(
            key=lambda item: (-item[1], item[0])
        )

        top = recommendations[:top_n]

        return pd.DataFrame([
            {
                "movieId": mid,
                "title": self.movie_titles.get(mid, "Unknown"),
                "predicted_rating": round(score, 3)
            }
            for mid, score in top
        ])


if __name__ == "__main__":
    model = UserBasedCF(k=30)

    print("=" * 55)
    print("CINEMATCH ML - USER-BASED COLLABORATIVE FILTERING")
    print("=" * 55)
    print("So nguoi dung:", len(model.user_ids))
    print("So phim trong Train:", len(model.movie_ids))
    print("K neighbors:", model.k)

    print("\nDu doan rating - User 1, Movie 1:")
    print(round(model.predict(1, 1), 3))

    print("\nTop 10 phim goi y cho User 1:")
    print(model.recommend(1, top_n=10).to_string(index=False))
