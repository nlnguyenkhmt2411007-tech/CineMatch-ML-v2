
from pathlib import Path
from functools import lru_cache
import sys

import os
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from backend.explore_api import router as explore_router
from backend.ml_lab_api import router as ml_lab_router

from backend.tmdb_api import router as tmdb_router


# ============================================================
# 1. CAU HINH DU AN
# ============================================================

ROOT = Path(__file__).resolve().parents[1]

ML_DIR = ROOT / "backend" / "ml"
sys.path.insert(0, str(ML_DIR))

from content_based import ContentBasedRecommender
from content_user import ContentUserRecommender
from user_based_cf import UserBasedCF

DATA_DIR = ROOT / "data" / "processed"
RAW_DIR = ROOT / "data" / "raw"
RESULTS_DIR = ROOT / "results"

GENRES = [
    "Action", "Adventure", "Animation", "Children",
    "Comedy", "Crime", "Documentary", "Drama",
    "Fantasy", "Film-Noir", "Horror", "IMAX",
    "Musical", "Mystery", "Romance", "Sci-Fi",
    "Thriller", "War", "Western"
]

BEST_K = 20


# ============================================================
# 2. KHOI TAO FASTAPI
# ============================================================

app = FastAPI(
    title="CineMatch ML API",
    description=(
        "Movie recommendation system using "
        "Content-Based Filtering and User-Based CF"
    ),
    version="1.2.0"
)

# Allow localhost and the deployed Vercel frontend.
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3003",
    "http://127.0.0.1:3003",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

frontend_url = os.environ.get("FRONTEND_URL", "").strip().rstrip("/")

if frontend_url and frontend_url not in allowed_origins:
    allowed_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# API TMDb:
# /api/movies/featured
# /api/movies/enriched/{movie_id}
app.include_router(tmdb_router)
app.include_router(explore_router)
app.include_router(ml_lab_router)


# ============================================================
# 3. DOC VA CACHE DU LIEU
# ============================================================

@lru_cache(maxsize=1)
def get_movies():
    path = DATA_DIR / "movies_processed.csv"

    movies = pd.read_csv(path)
    movies["movieId"] = movies["movieId"].astype(int)

    return movies


@lru_cache(maxsize=1)
def get_movie_statistics():
    """
    Tinh rating trung binh va so luot rating
    CHI TU DU LIEU TRAIN.
    """
    path = DATA_DIR / "ratings_train.csv"

    ratings = pd.read_csv(path)

    stats = (
        ratings.groupby("movieId")["rating"]
        .agg(["mean", "count"])
        .reset_index()
        .rename(columns={
            "mean": "avgRating",
            "count": "ratingsCount"
        })
    )

    return stats


@lru_cache(maxsize=1)
def get_ratings_summary():
    ratings = pd.read_csv(
        RAW_DIR / "ratings.csv"
    )

    return {
        "total_ratings": int(len(ratings)),
        "total_users": int(ratings["userId"].nunique()),
        "rated_movies": int(ratings["movieId"].nunique()),
    }


@lru_cache(maxsize=1)
def get_movie_catalog():
    """
    Ghep danh sach phim va thong ke Train
    de khong phai merge lai moi lan goi API.
    """
    movies = get_movies().copy()
    stats = get_movie_statistics()

    catalog = movies.merge(
        stats,
        on="movieId",
        how="left"
    )

    catalog["ratingsCount"] = (
        catalog["ratingsCount"]
        .fillna(0)
        .astype(int)
    )

    return catalog


# ============================================================
# 4. CACHE CAC MO HINH MACHINE LEARNING
# ============================================================

@lru_cache(maxsize=1)
def get_content_model():
    return ContentBasedRecommender()


@lru_cache(maxsize=1)
def get_content_user_model():
    return ContentUserRecommender()


@lru_cache(maxsize=1)
def get_cf_model():
    return UserBasedCF(k=BEST_K)


# ============================================================
# 5. CHUYEN DU LIEU PHIM SANG JSON
# ============================================================

def movie_record(row):
    """
    Tra ve thong tin phim.
    avgRating = null neu phim chua co rating Train.
    """
    year = row.get("year")
    avg_rating = row.get("avgRating")
    ratings_count = row.get("ratingsCount")

    genres = [
        genre
        for genre in GENRES
        if genre in row.index
        and pd.notna(row[genre])
        and float(row[genre]) == 1.0
    ]

    count = (
        int(ratings_count)
        if pd.notna(ratings_count)
        else 0
    )

    avg = (
        round(float(avg_rating), 2)
        if pd.notna(avg_rating) and count > 0
        else None
    )

    return {
        "movieId": int(row["movieId"]),
        "title": str(row["title"]),
        "year": (
            int(year)
            if pd.notna(year)
            else None
        ),
        "genres": genres,
        "avgRating": avg,
        "ratingsCount": count,
    }


# ============================================================
# 6. HEALTH CHECK
# ============================================================

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "project": "CineMatch ML V2",
        "models": [
            "Content-Based",
            "User-Based CF"
        ],
        "model_k": BEST_K,
    }


# ============================================================
# 7. DANH SACH PHIM
# ============================================================

@app.get("/api/movies")
def list_movies(
    search: str = "",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    catalog = get_movie_catalog()

    if search.strip():
        catalog = catalog[
            catalog["title"].str.contains(
                search.strip(),
                case=False,
                regex=False,
                na=False
            )
        ]

    total = len(catalog)

    start = (page - 1) * page_size
    end = start + page_size

    subset = catalog.iloc[start:end]

    items = [
        movie_record(row)
        for _, row in subset.iterrows()
    ]

    return {
        "total": int(total),
        "page": page,
        "page_size": page_size,
        "items": items,
    }


# ============================================================
# 8. CHI TIET PHIM
# ============================================================

@app.get("/api/movies/{movie_id}")
def movie_detail(movie_id: int):
    catalog = get_movie_catalog()

    matched = catalog[
        catalog["movieId"] == movie_id
    ]

    if matched.empty:
        raise HTTPException(
            status_code=404,
            detail="Movie not found"
        )

    row = matched.iloc[0]

    return movie_record(row)


# ============================================================
# 9. CONTENT-BASED: PHIM TUONG TU
# ============================================================

@app.get("/api/recommend/content/{movie_id}")
def recommend_similar(
    movie_id: int,
    top_n: int = Query(default=10, ge=1, le=50),
):
    model = get_content_model()

    try:
        recommendations = model.recommend_similar(
            movie_id,
            top_n
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc)
        )

    items = []

    for row in recommendations.to_dict(
        orient="records"
    ):
        items.append({
            "movieId": int(row["movieId"]),
            "title": str(row["title"]),
            "year": (
                int(row["year"])
                if pd.notna(row["year"])
                else None
            ),
            "similarity": round(
                float(row["similarity"]),
                4
            ),
        })

    return {
        "method": "content_based",
        "movieId": movie_id,
        "items": items,
    }


# ============================================================
# 10. CONTENT-BASED: GOI Y THEO NGUOI DUNG
# ============================================================

@app.get("/api/recommend/content-user/{user_id}")
def recommend_content_user(
    user_id: int,
    top_n: int = Query(default=10, ge=1, le=50),
):
    model = get_content_user_model()

    if user_id not in model.user_profiles:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    recommendations = model.recommend(
        user_id,
        top_n
    )

    items = [
        {
            "movieId": int(row["movieId"]),
            "title": str(row["title"]),
            "similarity": float(row["similarity"]),
        }
        for row in recommendations.to_dict(
            orient="records"
        )
    ]

    return {
        "method": "content_user",
        "userId": user_id,
        "items": items,
    }


# ============================================================
# 11. USER-BASED COLLABORATIVE FILTERING
# ============================================================

@app.get("/api/recommend/user/{user_id}")
def recommend_user_cf(
    user_id: int,
    top_n: int = Query(default=10, ge=1, le=30),
):
    model = get_cf_model()

    if user_id not in model.user_to_idx:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    recommendations = model.recommend(
        user_id,
        top_n
    )

    items = [
        {
            "movieId": int(row["movieId"]),
            "title": str(row["title"]),
            "predicted_rating": float(
                row["predicted_rating"]
            ),
        }
        for row in recommendations.to_dict(
            orient="records"
        )
    ]

    return {
        "method": "user_based_cf",
        "userId": user_id,
        "k": BEST_K,
        "items": items,
    }


# ============================================================
@app.get("/api/recommend/user/{user_id}/explain/{movie_id}")
def explain_user_cf(user_id: int, movie_id: int):
    model = get_cf_model()

    if user_id not in model.user_to_idx:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    if movie_id not in model.movie_to_idx:
        raise HTTPException(
            status_code=404,
            detail="Movie not found in training data"
        )

    baseline = float(
        model.user_means.get(user_id, model.global_mean)
    )

    raters = model.ratings_by_movie.get(movie_id, {})
    neighbors = []

    for neighbor_id, rating in raters.items():
        if neighbor_id == user_id:
            continue

        similarity = float(
            model.similarity[
                model.user_to_idx[user_id],
                model.user_to_idx[neighbor_id]
            ]
        )

        if similarity <= 0:
            continue

        neighbor_mean = float(model.user_means[neighbor_id])
        deviation = float(rating - neighbor_mean)

        neighbors.append({
            "userId": int(neighbor_id),
            "similarity": similarity,
            "rating": float(rating),
            "userMean": neighbor_mean,
            "deviation": deviation,
            "weightedContribution": similarity * deviation,
        })

    neighbors.sort(
        key=lambda item: item["similarity"],
        reverse=True
    )

    neighbors = neighbors[:model.k]

    numerator = sum(
        item["weightedContribution"]
        for item in neighbors
    )

    denominator = sum(
        abs(item["similarity"])
        for item in neighbors
    )

    raw_prediction = (
        baseline + numerator / denominator
        if denominator != 0
        else baseline
    )

    predicted_rating = float(
        model.predict(user_id, movie_id)
    )

    return {
        "method": "user_based_cf",
        "userId": user_id,
        "movieId": movie_id,
        "title": model.movie_titles.get(movie_id, "Unknown"),
        "k": model.k,
        "baseline": round(baseline, 4),
        "neighborCount": len(neighbors),
        "numerator": round(numerator, 6),
        "denominator": round(denominator, 6),
        "rawPrediction": round(raw_prediction, 4),
        "predictedRating": round(predicted_rating, 4),
        "neighbors": [
            {
                **item,
                "similarity": round(item["similarity"], 6),
                "rating": round(item["rating"], 2),
                "userMean": round(item["userMean"], 4),
                "deviation": round(item["deviation"], 4),
                "weightedContribution": round(
                    item["weightedContribution"], 6
                ),
            }
            for item in neighbors
        ],
    }

# 12. DANH GIA MACHINE LEARNING
# ============================================================

@app.get("/api/evaluation")
def evaluation():
    topk_path = (
        RESULTS_DIR / "topk_test_metrics.csv"
    )

    rating_path = (
        RESULTS_DIR / "user_cf_test_metrics.csv"
    )

    if not topk_path.exists() or not rating_path.exists():
        raise HTTPException(
            status_code=404,
            detail=(
                "Evaluation files not found. "
                "Run test evaluation first."
            )
        )

    topk = pd.read_csv(topk_path)
    rating = pd.read_csv(rating_path)

    ranking = [
        {
            "model": str(row["model"]),
            "users": int(row["users"]),
            "precision_at_10": float(
                row["precision_at_10"]
            ),
            "recall_at_10": float(
                row["recall_at_10"]
            ),
        }
        for row in topk.to_dict(orient="records")
    ]

    rating_metrics = [
        {
            "model": str(row["model"]),
            "k": int(row["k"]),
            "mae": float(row["MAE"]),
            "rmse": float(row["RMSE"]),
        }
        for row in rating.to_dict(orient="records")
    ]

    return {
        "dataset": "MovieLens Latest Small",
        "split": "time_based_per_user",
        "evaluation_set": "test",
        "ranking_protocol": {
            "top_n": 10,
            "relevance_threshold": 4.0,
            "sampled_unobserved_candidates": 100,
            "note": (
                "Sampled candidate evaluation, "
                "not full catalog."
            ),
        },
        "dataset_summary": {
            "total_movies": int(len(get_movies())),
            **get_ratings_summary(),
        },
        "ranking": ranking,
        "rating_prediction": rating_metrics,
    }


# ============================================================
# 13. THUC NGHIEM TOI UU K
# ============================================================

@app.get("/api/experiments")
def experiments():
    path = RESULTS_DIR / "tune_k_results.csv"

    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail="K tuning results not found"
        )

    df = pd.read_csv(path)

    return {
        "model": "User-Based CF",
        "evaluation_set": "validation",
        "selected_k": BEST_K,
        "experiments": [
            {
                "k": int(row["K"]),
                "mae": float(row["MAE"]),
                "rmse": float(row["RMSE"]),
            }
            for row in df.to_dict(orient="records")
        ],
    }


