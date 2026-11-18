"""Read-only intermediate model data for CineMatch learning walkthrough.

Does not refit, retrain, persist, or modify the existing recommenders.
"""
from functools import lru_cache
from pathlib import Path
from math import isfinite

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/methods", tags=["Method Walkthrough"])
ROOT = Path(__file__).resolve().parents[1]
TRAIN = ROOT / "data" / "processed" / "ratings_train.csv"
GENRES = [
    "Action", "Adventure", "Animation", "Children", "Comedy", "Crime",
    "Documentary", "Drama", "Fantasy", "Film-Noir", "Horror", "IMAX",
    "Musical", "Mystery", "Romance", "Sci-Fi", "Thriller", "War", "Western"
]


@lru_cache(maxsize=1)
def train_ratings():
    if not TRAIN.is_file():
        raise HTTPException(503, detail="Missing ratings_train.csv")
    result = pd.read_csv(TRAIN)
    result["userId"] = result["userId"].astype(int)
    result["movieId"] = result["movieId"].astype(int)
    return result


def numeric(value, digits=4):
    number = float(value)
    return round(number, digits) if isfinite(number) else 0.0


def sample_ratings(rows, titles, count=6):
    ordered = rows.sort_values("rating", ascending=False).head(count)
    return [
        {
            "movieId": int(row.movieId),
            "title": titles.get(int(row.movieId), f"Movie #{int(row.movieId)}"),
            "rating": numeric(row.rating, 1),
        }
        for row in ordered.itertuples(index=False)
    ]


def catalog_names():
    from backend.main import get_movies
    movies = get_movies()[["movieId", "title"]]
    return dict(zip(movies.movieId.astype(int), movies.title.astype(str)))


@router.get("/profile/{user_id}")
def content_profile_steps(user_id: int):
    """Return actual Training ratings and the existing Content-User profile vector."""
    from backend.main import get_content_user_model

    if not 1 <= user_id <= 610:
        raise HTTPException(400, detail="Choose a MovieLens userId from 1 to 610")
    frame = train_ratings()
    rows = frame.loc[frame["userId"] == user_id]
    if rows.empty:
        raise HTTPException(404, detail="User has no Training ratings")
    model = get_content_user_model()
    vector = model.user_profiles.get(user_id)
    if vector is None:
        raise HTTPException(404, detail="User profile not found in trained model")
    try:
        vector_array = np.asarray(vector, dtype=float).reshape(-1)
    except (ValueError, TypeError):
        raise HTTPException(503, detail="Unsupported user profile shape")
    if len(vector_array) != len(GENRES):
        raise HTTPException(503, detail="Unexpected profile dimension")
    titles = catalog_names()
    liked = rows.loc[rows["rating"] >= 4.0]
    return {
        "userId": user_id,
        "trainingCount": len(rows),
        "likedCount": len(liked),
        "fallback": liked.empty,
        "likedSamples": sample_ratings(liked if not liked.empty else rows, titles),
        "vector": [numeric(x, 6) for x in vector_array],
        "genres": GENRES,
        "topGenres": [
            {"genre": GENRES[i], "weight": numeric(vector_array[i], 6)}
            for i in np.argsort(-vector_array)[:5]
        ],
    }


@router.get("/knn/{user_id}")
def knn_steps(user_id: int):
    """Show actual Training ratings, Mean-Centering, cosine neighbors and a small User-Movie matrix."""
    from backend.main import get_cf_model

    model = get_cf_model()
    if user_id not in model.user_to_idx:
        raise HTTPException(404, detail="User not found in MovieLens training model")
    ratings = train_ratings()
    rows = ratings.loc[ratings["userId"] == user_id]
    if rows.empty:
        raise HTTPException(404, detail="User has no Training ratings")

    titles = catalog_names()
    user_mean = float(model.user_means[user_id])
    top_rows = rows.sort_values("rating", ascending=False).head(6)
    centered_sample = [
        {
            "movieId": int(r.movieId),
            "title": titles.get(int(r.movieId), f"Movie #{int(r.movieId)}"),
            "rating": numeric(r.rating, 1),
            "centered": numeric(float(r.rating) - user_mean),
        }
        for r in top_rows.itertuples(index=False)
    ]
    index = model.user_to_idx[user_id]
    neighbors = []
    for other, other_index in model.user_to_idx.items():
        if int(other) == user_id:
            continue
        score = float(model.similarity[index, other_index])
        if score > 0 and isfinite(score):
            neighbors.append({"userId": int(other), "similarity": numeric(score, 6)})
    neighbors.sort(key=lambda item: (-item["similarity"], item["userId"]))
    best_neighbors = neighbors[:6]

    # Visual excerpt only: these are not necessarily the eligible neighbors for a particular movie.
    movie_ids = [int(x) for x in top_rows["movieId"].head(5).tolist()]
    user_ids = [user_id] + [item["userId"] for item in best_neighbors[:3]]
    relevant = ratings.loc[
        ratings["userId"].isin(user_ids) & ratings["movieId"].isin(movie_ids),
        ["userId", "movieId", "rating"]
    ]
    lookup = {
        (int(r.userId), int(r.movieId)): numeric(r.rating, 1)
        for r in relevant.itertuples(index=False)
    }
    return {
        "userId": user_id,
        "k": int(model.k),
        "userMean": numeric(user_mean, 6),
        "trainingCount": len(rows),
        "matrixShape": [len(model.user_to_idx), len(model.movie_to_idx)],
        "centeredSamples": centered_sample,
        "neighbors": best_neighbors,
        "matrixMovies": [
            {"movieId": mid, "title": titles.get(mid, f"#{mid}")}
            for mid in movie_ids
        ],
        "matrixRows": [
            {"userId": uid, "ratings": [lookup.get((uid, mid)) for mid in movie_ids]}
            for uid in user_ids
        ],
        "note": "Các láng giềng trên là tương đồng chung; khi dự đoán mỗi phim, mô hình chỉ lấy người đã đánh giá phim đó.",
    }
