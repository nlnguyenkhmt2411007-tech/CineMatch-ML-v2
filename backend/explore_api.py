
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, Query

from backend.tmdb_api import get_tmdb_metadata


# ============================================================
# 1. CAU HINH
# ============================================================

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "processed"

router = APIRouter(
    prefix="/api",
    tags=["Explore"]
)

IMAGE_BASE = "https://image.tmdb.org/t/p"

GENRES = [
    "Action", "Adventure", "Animation", "Children",
    "Comedy", "Crime", "Documentary", "Drama",
    "Fantasy", "Film-Noir", "Horror", "IMAX",
    "Musical", "Mystery", "Romance", "Sci-Fi",
    "Thriller", "War", "Western"
]


# ============================================================
# 2. DOC CATALOG MOT LAN
# ============================================================

@lru_cache(maxsize=1)
def load_catalog() -> pd.DataFrame:
    movies = pd.read_csv(
        DATA_DIR / "movies_processed.csv"
    )

    ratings = pd.read_csv(
        DATA_DIR / "ratings_train.csv",
        usecols=["movieId", "rating"]
    )

    links = pd.read_csv(
        DATA_DIR / "links_clean.csv",
        usecols=["movieId", "tmdbId"]
    )

    stats = (
        ratings.groupby("movieId")["rating"]
        .agg(["mean", "count"])
        .reset_index()
        .rename(columns={
            "mean": "avgRating",
            "count": "ratingsCount"
        })
    )

    links = links.drop_duplicates(
        subset=["movieId"]
    )

    catalog = (
        movies
        .merge(stats, on="movieId", how="left")
        .merge(links, on="movieId", how="left")
    )

    catalog["avgRating"] = (
        catalog["avgRating"].fillna(0)
    )

    catalog["ratingsCount"] = (
        catalog["ratingsCount"]
        .fillna(0)
        .astype(int)
    )

    # Bayesian rating:
    # tranh phim chi co 1 rating 5 sao len dau.
    count = catalog["ratingsCount"]
    average = catalog["avgRating"]

    catalog["weightedScore"] = (
        (count * average + 50 * 3.5) /
        (count + 50)
    )

    return catalog


# ============================================================
# 3. LAY ANH DUNG THEO TMDB ID
# ============================================================

def get_images(tmdb_id):
    if pd.isna(tmdb_id):
        return {
            "posterUrl": "",
            "backdropUrl": "",
            "synopsis": ""
        }

    # Ham nay da co cache 30 ngay
    # trong backend/tmdb_api.py.
    metadata = get_tmdb_metadata(int(tmdb_id))

    poster_path = metadata.get("poster_path")
    backdrop_path = metadata.get("backdrop_path")

    return {
        "posterUrl": (
            f"{IMAGE_BASE}/w342{poster_path}"
            if poster_path else ""
        ),
        "backdropUrl": (
            f"{IMAGE_BASE}/w1280{backdrop_path}"
            if backdrop_path else ""
        ),
        "synopsis": (
            metadata.get("overview") or ""
        ),
    }


# ============================================================
# 4. CHUYEN PHIM SANG JSON
# ============================================================

def to_movie(row, images):
    genres = [
        genre
        for genre in GENRES
        if (
            genre in row.index
            and pd.notna(row[genre])
            and float(row[genre]) == 1.0
        )
    ]

    year = row.get("year")
    count = int(row["ratingsCount"])

    return {
        "movieId": int(row["movieId"]),
        "title": str(row["title"]),
        "year": (
            int(year)
            if pd.notna(year)
            else None
        ),
        "genres": genres,
        "avgRating": (
            round(float(row["avgRating"]), 2)
            if count > 0
            else None
        ),
        "ratingsCount": count,
        "posterUrl": images["posterUrl"],
        "backdropUrl": images["backdropUrl"],
        "synopsis": images["synopsis"],
        "tmdbId": (
            int(row["tmdbId"])
            if pd.notna(row["tmdbId"])
            else None
        ),
        "tags": [],
        "imdbId": "",
    }


# ============================================================
# 5. API KHAM PHA CO PHAN TRANG + POSTER TMDB
# ============================================================

@router.get("/explore")
def explore_movies(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=24, ge=1, le=48),
    search: str = Query(default="", max_length=150),
    genre: str = Query(default="All"),
    min_rating: float = Query(default=0, ge=0, le=5),
    sort: str = Query(default="popular"),
):
    df = load_catalog()

    # TIM KIEM
    keyword = search.strip()

    if keyword:
        df = df[
            df["title"].str.contains(
                keyword,
                case=False,
                regex=False,
                na=False
            )
        ]

    # LOC THE LOAI
    if genre in GENRES:
        df = df[df[genre] == 1]

    # LOC DIEM
    if min_rating > 0:
        df = df[
            (df["avgRating"] >= min_rating)
            & (df["ratingsCount"] > 0)
        ]

    # SAP XEP
    if sort == "rating":
        df = df.sort_values(
            ["weightedScore", "ratingsCount"],
            ascending=[False, False]
        )

    elif sort == "newest":
        df = df.sort_values(
            ["year", "ratingsCount"],
            ascending=[False, False],
            na_position="last"
        )

    elif sort == "title":
        df = df.sort_values(
            "title",
            ascending=True
        )

    else:
        df = df.sort_values(
            ["ratingsCount", "weightedScore"],
            ascending=[False, False]
        )

    total = int(len(df))

    start = (page - 1) * page_size
    end = start + page_size

    subset = df.iloc[start:end]

    # CHI TAI ANH CUA TOI DA 24 PHIM TREN TRANG.
    # Goi dong thoi toi da 6 request TMDb.
    rows = [
        row for _, row in subset.iterrows()
    ]

    with ThreadPoolExecutor(
        max_workers=6
    ) as executor:
        images = list(
            executor.map(
                lambda row: get_images(row.get("tmdbId")),
                rows
            )
        )

    items = [
        to_movie(row, image)
        for row, image in zip(rows, images)
    ]

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (
            (total + page_size - 1) // page_size
        ),
        "items": items,
    }
