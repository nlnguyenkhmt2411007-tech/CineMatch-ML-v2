"""Choose exactly one personal-account backend at process startup.

By default all routes continue to use the existing SQLite implementation.
PostgreSQL is opt-in via CINEMATCH_AUTH_BACKEND=postgres.
This is unrelated to MovieLens demo accounts in cinematch_demo_router.
"""
import os

mode = os.environ.get("CINEMATCH_AUTH_BACKEND", "sqlite").strip().lower()
if mode == "sqlite":
    from backend.auth_api import router, _db, _account, _authenticate
elif mode == "postgres":
    from backend.auth_pg_api import router, _db, _account, _authenticate
else:
    raise RuntimeError("CINEMATCH_AUTH_BACKEND must be sqlite or postgres")
