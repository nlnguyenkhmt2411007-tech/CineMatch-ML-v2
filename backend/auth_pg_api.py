"""CineMatch private-account PostgreSQL API (opt-in, separate from MovieLens demo users).

Uses only cinematch_private in Supabase; preserves the original /api/auth
contract and PBKDF2 password hashing. Disabled unless CINEMATCH_AUTH_BACKEND
is explicitly set to postgres. Never initializes or mutates schema at import.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import time
from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path
from typing import Iterator

from psycopg import Connection
from psycopg.errors import UniqueViolation
from backend.auth_db import get_pg_connection

import numpy as np
import pandas as pd
from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/auth", tags=["Accounts"])

ROOT = Path(__file__).resolve().parents[1]
GENRES = (
    "Action", "Adventure", "Animation", "Children", "Comedy", "Crime",
    "Documentary", "Drama", "Fantasy", "Film-Noir", "Horror", "IMAX",
    "Musical", "Mystery", "Romance", "Sci-Fi", "Thriller", "War", "Western",
)

PBKDF2_ITERATIONS = 600_000
TOKEN_TTL_SECONDS = 12 * 60 * 60
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class RegisterBody(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class LoginBody(BaseModel):
    email: str
    password: str


class GenresBody(BaseModel):
    genres: list[str] = Field(max_length=19)


class RatingBody(BaseModel):
    movie_id: int = Field(gt=0)
    rating: float = Field(ge=0.5, le=5.0)


def _now() -> int:
    return int(time.time())


def _email(value: str) -> str:
    normalized = value.strip().lower()
    if len(normalized) > 254 or not EMAIL_RE.fullmatch(normalized):
        raise HTTPException(status_code=422, detail="Email không hợp lệ.")
    return normalized


def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations_text, salt_hex, digest_hex = stored.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        expected = bytes.fromhex(digest_hex)
        result = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex),
            int(iterations_text)
        )
        return hmac.compare_digest(result, expected)
    except (ValueError, TypeError):
        return False


@contextmanager
def _db() -> Iterator[Connection]:
    """Open an explicitly scoped transaction; never create schema objects.

    SET LOCAL lasts for this transaction only, so unqualified SQL is
    resolved to cinematch_private and cannot fall through to public.
    """
    with get_pg_connection() as conn:
        conn.execute("SET LOCAL search_path TO cinematch_private, pg_catalog")
        schema = conn.execute("SELECT current_schema() AS schema").fetchone()["schema"]
        if schema != "cinematch_private":
            raise RuntimeError("CineMatch private PostgreSQL schema not available")
        yield conn

def _account(conn: Connection, account_id: int) -> dict:
    account = conn.execute(
        "SELECT id, name, email, genres_json, onboarding_done FROM accounts WHERE id = %s",
        (account_id,),
    ).fetchone()
    if account is None:
        raise HTTPException(status_code=401, detail="Phiên đăng nhập không hợp lệ.")
    entries = conn.execute(
        "SELECT movie_id, rating FROM ratings WHERE account_id = %s ORDER BY movie_id",
        (account_id,),
    ).fetchall()
    ratings = {str(row["movie_id"]): float(row["rating"]) for row in entries}
    values = list(ratings.values())
    return {
        "accountId": account["id"],
        # Kept distinct from MovieLens training users 1..610.
        "userId": 1_000_000 + account["id"],
        "name": account["name"],
        "email": account["email"],
        "preferredGenres": json.loads(account["genres_json"]),
        "onboardingComplete": bool(account["onboarding_done"]),
        "ratings": ratings,
        "avgRating": round(sum(values) / len(values), 2) if values else 0.0,
    }


def _authenticate(conn: Connection, authorization: str | None) -> int:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Bạn cần đăng nhập.")
    token = authorization[len("Bearer "):].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Phiên đăng nhập không hợp lệ.")
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    row = conn.execute(
        "SELECT account_id FROM sessions WHERE token_hash = %s AND expires_at > %s",
        (token_hash, _now()),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=401, detail="Phiên đăng nhập đã hết hạn hoặc không hợp lệ.")
    return int(row["account_id"])


def _session(conn: Connection, account_id: int) -> dict:
    token = secrets.token_urlsafe(32)
    conn.execute(
        "INSERT INTO sessions(token_hash, account_id, expires_at) VALUES(%s, %s, %s)",
        (hashlib.sha256(token.encode("utf-8")).hexdigest(),
         account_id, _now() + TOKEN_TTL_SECONDS),
    )
    return {"accessToken": token, "tokenType": "bearer", "account": _account(conn, account_id)}


@router.get("/genres")
def get_genres():
    return {"genres": list(GENRES)}


@router.post("/register", status_code=201)
def register(body: RegisterBody):
    email = _email(body.email)
    name = body.name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=422, detail="Tên phải có ít nhất 2 ký tự.")
    with _db() as conn:
        try:
            cursor = conn.execute(
                "INSERT INTO accounts(name, email, password_hash, created_at) VALUES(%s, %s, %s, %s) RETURNING id",
                (name, email, _hash_password(body.password), _now()),
            )
        except UniqueViolation:
            raise HTTPException(status_code=409, detail="Email đã được sử dụng.")
        return _session(conn, int(cursor.fetchone()["id"]))


@router.post("/login")
def login(body: LoginBody):
    email = _email(body.email)
    with _db() as conn:
        account = conn.execute(
            "SELECT id, password_hash FROM accounts WHERE email = %s", (email,)
        ).fetchone()
        if account is None or not _verify_password(body.password, account["password_hash"]):
            raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng.")
        conn.execute("DELETE FROM sessions WHERE expires_at <= %s", (_now(),))
        return _session(conn, int(account["id"]))


@router.get("/me")
def me(authorization: str | None = Header(default=None)):
    with _db() as conn:
        return _account(conn, _authenticate(conn, authorization))


@router.post("/logout")
def logout(authorization: str | None = Header(default=None)):
    with _db() as conn:
        _authenticate(conn, authorization)
        token = authorization[len("Bearer "):].strip()  # validated above
        conn.execute(
            "DELETE FROM sessions WHERE token_hash = %s",
            (hashlib.sha256(token.encode("utf-8")).hexdigest(),),
        )
        return {"status": "ok"}


@router.post("/preferences")
def save_preferences(
    body: GenresBody,
    authorization: str | None = Header(default=None),
):
    genres = list(dict.fromkeys(body.genres))
    if any(genre not in GENRES for genre in genres):
        raise HTTPException(status_code=422, detail="Có thể loại không thuộc bộ dữ liệu MovieLens.")
    with _db() as conn:
        account_id = _authenticate(conn, authorization)
        conn.execute(
            "UPDATE accounts SET genres_json = %s, onboarding_done = TRUE WHERE id = %s",
            (json.dumps(genres), account_id),
        )
        return _account(conn, account_id)


@lru_cache(maxsize=1)
def _movie_catalog():
    path = ROOT / "data" / "processed" / "movies_processed.csv"
    if not path.exists():
        raise HTTPException(status_code=503, detail="Chưa tìm thấy dữ liệu phim đã xử lý.")
    movies = pd.read_csv(path)
    if not set(GENRES).issubset(movies.columns):
        raise HTTPException(status_code=503, detail="Thiếu cột thể loại trong dữ liệu phim.")
    vectors = movies.loc[:, list(GENRES)].fillna(0).to_numpy(dtype=np.float64)
    norms = np.linalg.norm(vectors, axis=1)
    normalized = np.divide(
        vectors, norms[:, None],
        out=np.zeros_like(vectors), where=norms[:, None] != 0
    )
    index = {int(movie_id): pos for pos, movie_id in enumerate(movies["movieId"])}
    stats_path = ROOT / "data" / "processed" / "ratings_train.csv"
    if stats_path.exists():
        train = pd.read_csv(stats_path)
        stats = train.groupby("movieId")["rating"].agg(["mean", "count"])
    else:
        stats = pd.DataFrame(columns=["mean", "count"])
    return movies, normalized, index, stats


@router.post("/ratings")
def save_rating(body: RatingBody, authorization: str | None = Header(default=None)):
    if (body.rating * 2) % 1 != 0:
        raise HTTPException(status_code=422, detail="Rating phải tăng theo bước 0,5 sao.")
    _, _, catalog_ids, _ = _movie_catalog()
    if body.movie_id not in catalog_ids:
        raise HTTPException(status_code=404, detail="Không tìm thấy phim trong MovieLens.")
    with _db() as conn:
        account_id = _authenticate(conn, authorization)
        conn.execute("""
            INSERT INTO ratings(account_id, movie_id, rating, updated_at)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT(account_id, movie_id)
            DO UPDATE SET rating = excluded.rating, updated_at = excluded.updated_at
        """, (account_id, body.movie_id, body.rating, _now()))
        return _account(conn, account_id)


@router.delete("/ratings/{movie_id}")
def delete_rating(movie_id: int, authorization: str | None = Header(default=None)):
    with _db() as conn:
        account_id = _authenticate(conn, authorization)
        conn.execute(
            "DELETE FROM ratings WHERE account_id = %s AND movie_id = %s",
            (account_id, movie_id),
        )
        return _account(conn, account_id)


@router.post("/ratings/reset")
def reset_ratings(authorization: str | None = Header(default=None)):
    with _db() as conn:
        account_id = _authenticate(conn, authorization)
        conn.execute("DELETE FROM ratings WHERE account_id = %s", (account_id,))
        return _account(conn, account_id)


@router.get("/recommendations")
def new_user_recommendations(
    top_n: int = Query(default=10, ge=1, le=50),
    authorization: str | None = Header(default=None),
):
    """Cold-start and live preference scores; not MovieLens KNN predictions.

    Uses liked ratings (>=4 stars) as a weighted profile when available,
    otherwise explicitly selected genres. If neither, ranks by Training popularity.
    """
    with _db() as conn:
        account = _account(conn, _authenticate(conn, authorization))

    movies, movie_vectors, movie_index, stats = _movie_catalog()
    rated_ids = {int(k) for k in account["ratings"]}
    liked_vectors = []
    liked_weights = []
    for movie_id_text, rating in account["ratings"].items():
        idx = movie_index.get(int(movie_id_text))
        if idx is not None and rating >= 4.0:
            liked_vectors.append(movie_vectors[idx])
            liked_weights.append(rating - 3.0)

    profile = np.zeros(len(GENRES), dtype=np.float64)
    source = "popular"
    if liked_vectors:
        profile = np.average(np.asarray(liked_vectors), axis=0, weights=liked_weights)
        source = "rated_movies"
    elif account["preferredGenres"]:
        profile = np.asarray([genre in account["preferredGenres"] for genre in GENRES], dtype=np.float64)
        source = "selected_genres"

    norm = np.linalg.norm(profile)
    if norm > 0:
        scores = movie_vectors @ (profile / norm)
    else:
        scores = np.zeros(len(movies), dtype=np.float64)
        source = "popular"

    results = []
    for pos, row in movies.iterrows():
        movie_id = int(row["movieId"])
        if movie_id in rated_ids:
            continue
        matched_genres = [genre for genre in GENRES if float(row[genre]) == 1.0]
        score = float(scores[pos])
        if source != "popular" and score <= 0:
            continue
        stat = stats.loc[movie_id] if movie_id in stats.index else None
        mean_rating = float(stat["mean"]) if stat is not None else None
        rating_count = int(stat["count"]) if stat is not None else 0
        year = row.get("year")
        results.append({
            "movieId": movie_id,
            "title": str(row["title"]),
            "year": int(year) if pd.notna(year) else None,
            "genres": matched_genres,
            "similarity": round(score, 6),
            "avgRating": round(mean_rating, 2) if mean_rating is not None else None,
            "ratingsCount": rating_count,
        })

    if source == "popular":
        results.sort(key=lambda x: (-(x["avgRating"] or 0), -x["ratingsCount"], x["movieId"]))
    else:
        results.sort(key=lambda x: (-x["similarity"], -x["ratingsCount"], x["movieId"]))
    return {"source": source, "topN": top_n, "items": results[:top_n]}
