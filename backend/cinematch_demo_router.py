"""CineMatch STEP 12 PUBLIC: explicitly enabled, read-only MovieLens demo accounts.

- 610 stable identities mapped 1:1 to MovieLens Training userId.
- Passwords are never stored in plaintext; the shared demo password is hashed.
- The current session, not a browser-supplied userId, determines model access.
- This router does NOT modify MovieLens ratings, ML algorithms, or existing accounts.
- Public demo mode may be enabled only for these anonymous, shared, read-only profiles.
- Individual CineMatch accounts remain separate; no personal data is exposed.
"""
from __future__ import annotations

import csv
from contextlib import contextmanager
from threading import Lock
from collections import deque
from functools import lru_cache
import hashlib
import hmac
import os
from pathlib import Path
import re
import secrets
import sqlite3
import time
from collections import defaultdict
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "processed"
DB_PATH = Path(os.environ.get("CINEMATCH_DEMO_DB_PATH", str(ROOT / "data" / "accounts" / "movielens_demo.sqlite3")))
RATINGS_PATH = Path(os.environ.get("CINEMATCH_RATINGS_TRAIN", str(DATA_DIR / "ratings_train.csv")))
MOVIES_PATH = Path(os.environ.get("CINEMATCH_MOVIES_PROCESSED", str(DATA_DIR / "movies_processed.csv")))
PREFIX = "/api/auth/demo"
TOKEN_PREFIX = "cmml_"
SESSION_TTL = 8 * 3600
USERNAME = re.compile(r"^user([1-9][0-9]{0,2})$", re.ASCII)
router = APIRouter(tags=["MovieLens demo accounts"])

class DemoLogin(BaseModel):
    username: str = Field(min_length=5, max_length=7)
    password: str = Field(min_length=8, max_length=128)


class DemoSwitch(BaseModel):
    userId: int = Field(ge=1, le=610)


# Demo account names and this shared password are intentionally public; they are
# NOT user credentials and grant no access to private account data or writes.
# The operator must explicitly enable demo mode in server environment variables.
def _demo_allowed(request: Request):
    mode = os.environ.get("CINEMATCH_DEMO_MODE", "disabled").lower().strip()
    if mode == "public_readonly":
        return
    if mode == "local":
        host = request.client.host if request.client else ""
        if host in ("127.0.0.1", "::1", "localhost", "testclient"):
            return
    raise HTTPException(403, "Chế độ tài khoản MovieLens chưa được bật trên máy chủ.")


# Basic best-effort protection. On the public Internet, add edge-level rate
# limits too: this memory limit is per Python process and not a WAF.
_ATTEMPTS: dict[str, deque[float]] = {}
_ATTEMPT_LOCK = Lock()


def _limit_login(request: Request):
    host = request.client.host if request.client else "unknown"
    current = time.monotonic()
    with _ATTEMPT_LOCK:
        if len(_ATTEMPTS) > 1000:
            for key in list(_ATTEMPTS):
                entries = _ATTEMPTS[key]
                while entries and current - entries[0] > 60:
                    entries.popleft()
                if not entries:
                    del _ATTEMPTS[key]
        attempts = _ATTEMPTS.setdefault(host, deque())
        while attempts and current - attempts[0] > 60:
            attempts.popleft()
        if len(attempts) >= 60:
            raise HTTPException(429, "Thao tác quá nhanh. Vui lòng thử lại sau.")
        attempts.append(current)


@contextmanager
def _db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(str(DB_PATH), timeout=20)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA busy_timeout=20000")
    db.execute("PRAGMA foreign_keys=ON")
    try:
        yield db
        db.commit()
    except BaseException:
        db.rollback()
        raise
    finally:
        db.close()


def _hash_password(password: str, salt: bytes) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 210_000).hex()


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

@lru_cache(maxsize=1)
def _training_ratings():
    if not RATINGS_PATH.is_file():
        raise HTTPException(503, f"Thiếu dữ liệu Training: {RATINGS_PATH}")
    ratings = defaultdict(dict)
    with RATINGS_PATH.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            uid = int(row["userId"])
            ratings[uid][int(row["movieId"])] = float(row["rating"])
    if set(ratings) != set(range(1, 611)):
        raise HTTPException(503, "Dữ liệu Training không có đầy đủ 610 userId từ 1 đến 610.")
    return dict(ratings)

@lru_cache(maxsize=1)
def _movies():
    result = {}
    if not MOVIES_PATH.is_file():
        raise HTTPException(503, f"Thiếu dữ liệu phim: {MOVIES_PATH}")
    with MOVIES_PATH.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            movie_id = int(row["movieId"])
            genres = [g for g in str(row.get("genres", "")).split("|") if g and g != "(no genres listed)"]
            if not genres:
                direct_genres = ("Action", "Adventure", "Animation", "Children", "Comedy", "Crime", "Documentary", "Drama", "Fantasy", "Film-Noir", "Horror", "IMAX", "Musical", "Mystery", "Romance", "Sci-Fi", "Thriller", "War", "Western")
                genres = [key[6:] for key, value in row.items() if key.startswith("genre_") and str(value) in ("1", "1.0", "True")]
                if not genres:
                    genres = [g for g in direct_genres if str(row.get(g, "0")) in ("1", "1.0", "True")]
            result[movie_id] = {
                "title": str(row.get("title", f"Movie {movie_id}")),
                "genres": genres,
            }
    return result


def initialize_demo_accounts():
    """Idempotent seed: verify full data BEFORE writing any account rows."""
    _training_ratings()
    _movies()
    with _db() as db:
        db.execute("CREATE TABLE IF NOT EXISTS demo_accounts (user_id INTEGER PRIMARY KEY CHECK(user_id BETWEEN 1 AND 610), username TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL)")
        db.execute("CREATE TABLE IF NOT EXISTS demo_sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES demo_accounts(user_id), expires_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0)")
        present = {int(row[0]) for row in db.execute("SELECT user_id FROM demo_accounts")}
        if not present:
            pwd = os.environ.get("CINEMATCH_DEMO_PASSWORD", "12345678")
            if pwd != "12345678":
                raise RuntimeError("Theo cấu hình đã chốt, mật khẩu demo phải là 12345678")
            salt = secrets.token_bytes(16)
            digest = _hash_password(pwd, salt)
            db.executemany("INSERT INTO demo_accounts (user_id, username, salt, password_hash) VALUES (?,?,?,?)", ((uid, f"user{uid}", salt.hex(), digest) for uid in range(1,611)))
        elif present != set(range(1,611)):
            raise RuntimeError("Demo database contains incomplete/nonconforming MovieLens identities; refusing to silently modify it.")
        return db.execute("SELECT COUNT(*) FROM demo_accounts").fetchone()[0]


def _account(uid: int) -> dict[str, Any]:
    values = _training_ratings()[uid]
    movies = _movies()
    genre_counts = defaultdict(int)
    preferred_ratings = [(movie_id, rating) for movie_id, rating in values.items() if rating >= 4.0]
    for movie_id, _ in preferred_ratings or list(values.items()):
        for genre in movies.get(movie_id, {}).get("genres", []):
            genre_counts[genre] += 1
    return {
        "accountId": 10_000_000 + uid,
        "userId": uid,
        "accountType": "movielens",
        "movieLensUserId": uid,
        "name": f"MovieLens User {uid}",
        "email": f"user{uid}@demo.cinematch.invalid",
        "preferredGenres": [k for k, _ in sorted(genre_counts.items(), key=lambda kv: (-kv[1],kv[0]))[:5]],
        "onboardingComplete": True,
        "ratings": {str(mid): rating for mid, rating in values.items()},
        "avgRating": sum(values.values()) / len(values) if values else 0.0,
    }


def _session_uid(request: Request) -> int:
    authorization = request.headers.get("authorization", "")
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Cần đăng nhập tài khoản MovieLens.")
    token = authorization.split(" ", 1)[1].strip()
    if not token.startswith(TOKEN_PREFIX):
        raise HTTPException(401, "Phiên MovieLens không hợp lệ.")
    with _db() as db:
        row = db.execute("SELECT user_id, expires_at, revoked FROM demo_sessions WHERE token_hash=?", (_hash_token(token),)).fetchone()
    if row is None or row["revoked"] or int(row["expires_at"]) <= int(time.time()):
        raise HTTPException(401, "Phiên MovieLens đã hết hạn hoặc bị thu hồi.")
    return int(row["user_id"])


@router.post("/api/auth/demo-login")
def demo_login(payload: DemoLogin, request: Request):
    _demo_allowed(request)
    _limit_login(request)
    match = USERNAME.fullmatch(payload.username.strip().lower())
    uid = int(match.group(1)) if match else -1
    if not (1 <= uid <= 610):
        raise HTTPException(401, "Tên đăng nhập hoặc mật khẩu không đúng.")
    initialize_demo_accounts()
    with _db() as db:
        db.execute("DELETE FROM demo_sessions WHERE expires_at <= ?", (int(time.time()),))
        row = db.execute("SELECT user_id, salt, password_hash FROM demo_accounts WHERE user_id=? AND username=?", (uid, f"user{uid}")).fetchone()
        if row is None or not hmac.compare_digest(_hash_password(payload.password, bytes.fromhex(row["salt"])), row["password_hash"]):
            raise HTTPException(401, "Tên đăng nhập hoặc mật khẩu không đúng.")
        token = TOKEN_PREFIX + secrets.token_urlsafe(32)
        db.execute("INSERT INTO demo_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)", (_hash_token(token), uid, int(time.time()) + SESSION_TTL))
    return {"accessToken": token, "tokenType": "bearer", "account": _account(uid)}

@router.post(PREFIX + "/switch")
def demo_switch(payload: DemoSwitch, request: Request):
    """One-click switch between intentionally public READ-ONLY demo profiles.

    Requires a valid demo bearer token and revokes the old token. Personal-account
    bearer tokens NEVER have permission to call this endpoint.
    """
    _demo_allowed(request)
    _limit_login(request)
    _session_uid(request)
    initialize_demo_accounts()
    previous_token = request.headers["authorization"].split(" ", 1)[1].strip()
    next_uid = int(payload.userId)
    with _db() as db:
        db.execute("UPDATE demo_sessions SET revoked=1 WHERE token_hash=?", (_hash_token(previous_token),))
        new_token = TOKEN_PREFIX + secrets.token_urlsafe(32)
        db.execute("INSERT INTO demo_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)", (
            _hash_token(new_token), next_uid, int(time.time()) + SESSION_TTL
        ))
    return {"accessToken": new_token, "tokenType": "bearer", "account": _account(next_uid)}


@router.get(PREFIX + "/me")
def demo_me(request: Request):
    _demo_allowed(request)
    return _account(_session_uid(request))

@router.post(PREFIX + "/logout")
def demo_logout(request: Request):
    _demo_allowed(request)
    _session_uid(request)
    token = request.headers["authorization"].split(" ",1)[1]
    with _db() as db:
        db.execute("UPDATE demo_sessions SET revoked=1 WHERE token_hash=?", (_hash_token(token),))
    return {"status": "ok"}

@router.post(PREFIX + "/ratings")
def demo_rate_read_only(request: Request):
    _demo_allowed(request); _session_uid(request)
    raise HTTPException(403, "Hồ sơ Training của MovieLens là dữ liệu thực nghiệm chỉ đọc. Không sửa rating gốc.")

@router.delete(PREFIX + "/ratings/{movie_id}")
def demo_remove_read_only(movie_id: int, request: Request):
    _demo_allowed(request); _session_uid(request)
    raise HTTPException(403, "Không xóa rating Training của MovieLens.")

@router.post(PREFIX + "/ratings/reset")
def demo_reset_read_only(request: Request):
    _demo_allowed(request); _session_uid(request)
    raise HTTPException(403, "Không đặt lại rating Training của MovieLens.")


async def _model_call(request: Request, path: str):
    """Internal ASGI-only request. The path is assembled with the verified session uid."""
    import httpx
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=request.app), base_url="http://cinematch.internal", timeout=90) as client:
        response = await client.get(path)
    if response.status_code != 200:
        raise HTTPException(response.status_code, response.text[:350])
    return response.json()


@router.get(PREFIX + "/model/content")
async def demo_content(request: Request, top_n: int = 10):
    _demo_allowed(request)
    uid = _session_uid(request)
    top_n = max(1, min(20, top_n))
    return await _model_call(request, f"/api/recommend/content-user/{uid}?top_n={top_n}")

@router.get(PREFIX + "/model/knn")
async def demo_knn(request: Request, top_n: int = 10):
    _demo_allowed(request)
    uid = _session_uid(request)
    top_n = max(1, min(20, top_n))
    return await _model_call(request, f"/api/recommend/user/{uid}?top_n={top_n}")

@router.get(PREFIX + "/model/neighbor-explorer")
async def demo_neighbor_explorer(request: Request, top_n: int = 10, neighbor_id: int | None = None):
    _demo_allowed(request)
    uid = _session_uid(request)
    top_n = max(1, min(20, top_n))
    neighbor = f"&neighbor_id={neighbor_id}" if neighbor_id is not None else ""
    return await _model_call(request, f"/api/recommend/user/{uid}/neighbor-explorer?top_n={top_n}{neighbor}")
