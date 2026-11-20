"""
CineMatch ML V2 - PostgreSQL connection module.

- Credentials come from environment variables.
- No passwords are hardcoded.
- Read-only connections are supported for verification.
- No database mutations occur during import.
"""

import os

import psycopg
from psycopg.rows import dict_row


SCHEMA = "cinematch_private"


def get_pg_connection(*, read_only=False):
    """Open a PostgreSQL connection using environment variables."""

    required = (
        "CINEMATCH_PG_HOST",
        "CINEMATCH_PG_USER",
        "CINEMATCH_PG_PASSWORD",
    )

    missing = [
        key for key in required
        if not os.environ.get(key)
    ]

    if missing:
        raise RuntimeError(
            "Missing PostgreSQL configuration: "
            + ", ".join(missing)
        )

    config = {
        "host": os.environ["CINEMATCH_PG_HOST"],
        "port": int(
            os.environ.get("CINEMATCH_PG_PORT", "5432")
        ),
        "dbname": os.environ.get(
            "CINEMATCH_PG_DATABASE", "postgres"
        ),
        "user": os.environ["CINEMATCH_PG_USER"],
        "password": os.environ["CINEMATCH_PG_PASSWORD"],
        "sslmode": "require",
        "connect_timeout": 15,
        "row_factory": dict_row,
    }

    conn = psycopg.connect(**config)

    if read_only:
        conn.read_only = True

    return conn
