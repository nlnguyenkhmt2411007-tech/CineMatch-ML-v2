
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request

from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException, Query


# ============================================================
# 1. CAU HINH TMDB
# ============================================================

ROOT = Path(__file__).resolve().parents[1]

PROCESSED_DIR = ROOT / "data" / "processed"
CACHE_DIR = ROOT / "data" / "cache" / "tmdb"

CACHE_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter(
    prefix="/api",
    tags=["TMDb Movies"]
)

TMDB_API_URL = "https://api.themoviedb.org/3"
TMDB_IMAGE_URL = "https://image.tmdb.org/t/p"

CACHE_SECONDS = 30 * 24 * 60 * 60

# Day la movieId cua MovieLens, KHONG phai TMDb ID.
FEATURED_MOVIE_IDS = [
    79132,    # Inception
    109487,   # Interstellar
    58559,    # The Dark Knight
    318,      # The Shawshank Redemption
    296,      # Pulp Fiction
    2571,     # The Matrix
    260,      # Star Wars
    356,      # Forrest Gump
    2959,     # Fight Club
    4993,     # The Lord of the Rings
    527,      # Schindler's List
    50,       # The Usual Suspects
]

GENRES = [
    "Action",
    "Adventure",
    "Animation",
    "Children",
    "Comedy",
    "Crime",
    "Documentary",
    "Drama",
    "Fantasy",
    "Film-Noir",
    "Horror",
    "IMAX",
    "Musical",
    "Mystery",
    "Romance",
    "Sci-Fi",
    "Thriller",
    "War",
    "Western",
]


# ============================================================
# 2. DOC TOKEN TU .ENV
# ============================================================

def get_tmdb_token() -> str:
    token = os.environ.get(
        "TMDB_READ_ACCESS_TOKEN",
        ""
    ).strip()

    if token:
        return token

    env_path = ROOT / ".env"

    if not env_path.is_file():
        return ""

    for raw_line in env_path.read_text(
        encoding="utf-8-sig"
    ).splitlines():
        line = raw_line.strip()

        if not line or line.startswith("#"):
            continue

        key, separator, value = line.partition("=")

        if (
            separator
            and key.strip() == "TMDB_READ_ACCESS_TOKEN"
        ):
            return value.strip().strip('"').strip("'")

    return ""


# ============================================================
# 3. DOC MOVIELENS VA BANG TMDB ID
# ============================================================

@lru_cache(maxsize=1)
def get_movie_catalog() -> pd.DataFrame:
    movies = pd.read_csv(
        PROCESSED_DIR / "movies_processed.csv"
    )

    links = pd.read_csv(
        PROCESSED_DIR / "links_clean.csv"
    )

    movies["movieId"] = movies["movieId"].astype(int)
    links["movieId"] = links["movieId"].astype(int)

    links = links[
        ["movieId", "tmdbId", "imdbId"]
    ].drop_duplicates(subset=["movieId"])

    catalog = movies.merge(
        links,
        on="movieId",
        how="left"
    )

    return catalog.set_index(
        "movieId",
        drop=False
    )


# ============================================================
# 4. DOC THONG KE RATING TU TRAIN
# ============================================================

@lru_cache(maxsize=1)
def get_train_rating_stats() -> pd.DataFrame:
    ratings = pd.read_csv(
        PROCESSED_DIR / "ratings_train.csv",
        usecols=["movieId", "rating"]
    )

    stats = (
        ratings.groupby("movieId")["rating"]
        .agg(["mean", "count"])
    )

    return stats


# ============================================================
# 5. GOI TMDB API
# ============================================================

def call_tmdb(tmdb_id: int) -> dict:
    token = get_tmdb_token()

    if not token:
        raise RuntimeError(
            "Chua cau hinh TMDB_READ_ACCESS_TOKEN "
            "trong file .env"
        )

    url = (
        f"{TMDB_API_URL}/movie/{tmdb_id}"
        "?language=en-US"
    )

    request = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "User-Agent": "CineMatchMLV2/1.0",
        },
    )

    with urllib.request.urlopen(
        request,
        timeout=8
    ) as response:
        data = json.loads(
            response.read().decode("utf-8")
        )

    return data


# ============================================================
# 6. LUU CACHE TMDB
# ============================================================

def get_tmdb_metadata(tmdb_id: int) -> dict:
    cache_file = CACHE_DIR / f"{tmdb_id}.json"

    if cache_file.is_file():
        age = (
            time.time()
            - cache_file.stat().st_mtime
        )

        if age < CACHE_SECONDS:
            try:
                return json.loads(
                    cache_file.read_text(
                        encoding="utf-8"
                    )
                )
            except (
                OSError,
                json.JSONDecodeError
            ):
                pass

    try:
        metadata = call_tmdb(tmdb_id)

        cache_file.write_text(
            json.dumps(
                metadata,
                ensure_ascii=False
            ),
            encoding="utf-8"
        )

        return metadata

    except (
        urllib.error.URLError,
        TimeoutError,
        OSError,
        RuntimeError,
        ValueError
    ) as exc:
        print(
            f"[TMDb] Loi metadata phim {tmdb_id}: "
            f"{type(exc).__name__}"
        )

        # Neu TMDb tam thoi khong truy cap duoc,
        # su dung cache cu neu co.
        if cache_file.is_file():
            try:
                return json.loads(
                    cache_file.read_text(
                        encoding="utf-8"
                    )
                )
            except (
                OSError,
                json.JSONDecodeError
            ):
                pass

        return {}


# ============================================================
# 7. TAO URL POSTER VA BACKDROP
# ============================================================

def tmdb_image_url(
    image_path: str | None,
    size: str
) -> str:
    if not image_path:
        return ""

    return f"{TMDB_IMAGE_URL}/{size}{image_path}"


# ============================================================
# 8. TAO DU LIEU PHIM CHO FRONTEND
# ============================================================

def build_movie_record(
    movie_id: int,
    with_images: bool = True
) -> dict | None:
    catalog = get_movie_catalog()

    if movie_id not in catalog.index:
        return None

    row = catalog.loc[movie_id]
    stats = get_train_rating_stats()

    year = row.get("year")
    tmdb_id = row.get("tmdbId")
    imdb_id = row.get("imdbId")

    genres = [
        genre
        for genre in GENRES
        if (
            genre in row.index
            and pd.notna(row[genre])
            and float(row[genre]) == 1.0
        )
    ]

    if movie_id in stats.index:
        rating_stats = stats.loc[movie_id]

        avg_rating = round(
            float(rating_stats["mean"]),
            2
        )

        ratings_count = int(
            rating_stats["count"]
        )
    else:
        avg_rating = 0.0
        ratings_count = 0

    record = {
        "movieId": int(movie_id),
        "title": str(row["title"]),
        "year": (
            int(year)
            if pd.notna(year)
            else 0
        ),
        "genres": genres,
        "posterUrl": "",
        "backdropUrl": "",
        "synopsis": "",
        "imdbId": (
            str(int(imdb_id))
            if pd.notna(imdb_id)
            else ""
        ),
        "tmdbId": (
            int(tmdb_id)
            if pd.notna(tmdb_id)
            else None
        ),
        "tags": [],
        "avgRating": avg_rating,
        "ratingsCount": ratings_count,
    }

    if with_images and pd.notna(tmdb_id):
        metadata = get_tmdb_metadata(
            int(tmdb_id)
        )

        record["posterUrl"] = tmdb_image_url(
            metadata.get("poster_path"),
            "w342"
        )

        record["backdropUrl"] = tmdb_image_url(
            metadata.get("backdrop_path"),
            "w1280"
        )

        record["synopsis"] = (
            metadata.get("overview") or ""
        )

    return record


# ============================================================
# 9. API DANH SACH 12 PHIM NOI BAT
# ============================================================

@router.get("/movies/featured")
def featured_movies(
    limit: int = Query(
        default=12,
        ge=1,
        le=12
    )
):
    movie_ids = FEATURED_MOVIE_IDS[:limit]

    # Goi toi da 4 TMDb requests dong thoi.
    with ThreadPoolExecutor(
        max_workers=4
    ) as executor:
        records = list(
            executor.map(
                build_movie_record,
                movie_ids
            )
        )

    items = [
        record
        for record in records
        if record is not None
    ]

    return {
        "total": len(items),
        "items": items,
        "source": "MovieLens + TMDb",
        "rating_source": "train",
    }


# ============================================================
# 10. API CHI TIET PHIM CO POSTER
# ============================================================

@router.get("/movies/enriched/{movie_id}")
def enriched_movie(movie_id: int):
    result = build_movie_record(
        movie_id,
        with_images=True
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Movie not found"
        )

    return result

# ============================================================
# 11. API TRAILER YOUTUBE THEO MOVIELENS MOVIE ID
# ============================================================

@router.get("/movies/{movie_id}/trailer")
def movie_trailer(movie_id: int):
    catalog = get_movie_catalog()

    if movie_id not in catalog.index:
        raise HTTPException(
            status_code=404,
            detail="Movie not found"
        )

    row = catalog.loc[movie_id]
    tmdb_id = row.get("tmdbId")

    if pd.isna(tmdb_id):
        return {
            "movieId": movie_id,
            "available": False,
            "videoKey": None,
            "message": "Phim này chưa có liên kết TMDb."
        }

    token = get_tmdb_token()

    if not token:
        raise HTTPException(
            status_code=503,
            detail="TMDb token is not configured"
        )

    url = (
        f"{TMDB_API_URL}/movie/{int(tmdb_id)}/videos"
        "?language=en-US"
    )

    request = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "User-Agent": "CineMatchMLV2/1.0",
        },
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=8
        ) as response:
            data = json.loads(
                response.read().decode("utf-8")
            )
    except (
        urllib.error.URLError,
        TimeoutError,
        OSError,
        ValueError
    ):
        raise HTTPException(
            status_code=502,
            detail="Unable to load trailer from TMDb"
        )

    videos = [
        item
        for item in data.get("results", [])
        if item.get("site") == "YouTube"
        and item.get("type") == "Trailer"
        and item.get("key")
    ]

    videos.sort(
        key=lambda item: (
            not item.get("official", False),
            item.get("name", "")
        )
    )

    if not videos:
        return {
            "movieId": movie_id,
            "tmdbId": int(tmdb_id),
            "available": False,
            "videoKey": None,
            "message": "Chưa có trailer YouTube cho phim này."
        }

    selected = videos[0]

    return {
        "movieId": movie_id,
        "tmdbId": int(tmdb_id),
        "available": True,
        "videoKey": selected["key"],
        "title": selected.get("name", ""),
        "official": selected.get("official", False),
        "source": "TMDb / YouTube"
    }
