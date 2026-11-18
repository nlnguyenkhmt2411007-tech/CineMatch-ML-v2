"""Account-scoped live KNN for new CineMatch accounts.

This never retrains or modifies the MovieLens K=21 model, its Training ratings,
Colab similarity matrix, or any Validation/Test data. It reuses the same
mean-centered cosine idea to compare an *external* account with Training users.
Only authenticated, owner-scoped ratings in auth_api are used as input.
"""
from __future__ import annotations

from collections import defaultdict
from functools import lru_cache
from typing import Any

import numpy as np
from fastapi import APIRouter, Header, HTTPException, Query

from backend import auth_api

router = APIRouter(prefix="/api/auth", tags=["Account-scoped ML"])
MIN_RATINGS = 10
MIN_OVERLAP = 3
K = 21


def _current_account(authorization: str | None) -> dict[str, Any]:
    with auth_api._db() as db:
        # Session token determines account_id. A supplied userId is never trusted.
        return auth_api._account(db, auth_api._authenticate(db, authorization))


@lru_cache(maxsize=1)
def _training():
    # Import lazily to avoid a circular import while main.py registers routers.
    from backend.main import get_cf_model
    model = get_cf_model()
    if model.k != K:
        raise HTTPException(503, "Cấu hình KNN hiện hành không phải K=21.")

    per_user: dict[int, dict[int, float]] = defaultdict(dict)
    for row in model.ratings.itertuples(index=False):
        per_user[int(row.userId)][int(row.movieId)] = float(row.rating)
    profile: dict[int, tuple[dict[int, float], float, int]] = {}
    for user_id in model.user_ids:
        centered = {mid: (rating - float(model.user_means.loc[user_id]))
                    for mid, rating in per_user[user_id].items()}
        norm = float(np.sqrt(sum(val * val for val in centered.values())))
        profile[user_id] = (centered, norm, len(centered))
    return model, profile


def _build_status(account: dict[str, Any], include_candidates: bool = False):
    rated: dict[int, float] = {}
    for key, score in account["ratings"].items():
        if 0.5 <= float(score) <= 5.0:
            rated[int(key)] = float(score)

    # The account database validates movieIds against the MovieLens catalog.
    model, profiles = _training()
    matching = {mid: score for mid, score in rated.items() if mid in model.movie_to_idx}
    count = len(matching)
    base = {
        "accountId": account["accountId"],
        "userId": account["userId"],
        "ratedCount": count,
        "totalRatingCount": len(rated),
        "ignoredCount": len(rated) - count,
        "requiredCount": MIN_RATINGS,
        "remainingCount": max(0, MIN_RATINGS - count),
        "minCommonRatings": MIN_OVERLAP,
        "k": K,
        "ready": False,
        "neighbors": [],
        "positiveNeighborCount": 0,
        "reason": "rate_more" if count < MIN_RATINGS else "no_neighbor",
    }
    if count < MIN_RATINGS:
        return base, [], matching, model

    target_mean = sum(matching.values()) / count
    center = {mid: rating - target_mean for mid, rating in matching.items()}
    norm_target = float(np.sqrt(sum(val * val for val in center.values())))
    if norm_target <= 1e-12:
        base["reason"] = "no_variance"
        return base, [], matching, model

    neighbors = []
    for uid, (train_center, train_norm, train_count) in profiles.items():
        if train_norm <= 1e-12:
            continue
        overlapping = center.keys() & train_center.keys()
        if len(overlapping) < MIN_OVERLAP:
            continue
        dot = sum(center[mid] * train_center[mid] for mid in overlapping)
        similarity = float(dot / (norm_target * train_norm))
        if not np.isfinite(similarity) or similarity <= 0:
            continue
        neighbors.append({
            "userId": uid,
            "similarity": similarity,
            "commonRatings": len(overlapping),
            "trainingCount": train_count,
        })
    neighbors.sort(key=lambda row: (-row["similarity"], row["userId"]))
    base["positiveNeighborCount"] = len(neighbors)
    top = neighbors[:K]
    base["neighbors"] = [{**n, "similarity": round(n["similarity"], 6)} for n in top]
    base["ready"] = bool(top)
    base["reason"] = "ready" if top else "no_neighbor"
    if include_candidates and top:
        # A positive neighbor with no unseen movies is not a usable recommender.
        unseen = any(mid not in matching for n in top for mid in profiles[n["userId"]][0])
        if not unseen:
            base["ready"] = False
            base["reason"] = "no_candidates"
    return base, top, matching, model


@router.get("/model/knn-status")
def account_knn_status(authorization: str | None = Header(default=None)):
    account = _current_account(authorization)
    status, _, _, _ = _build_status(account, include_candidates=True)
    return status


@router.get("/model/knn-recommendations")
def account_knn_recommendations(
    top_n: int = Query(default=10, ge=1, le=20),
    neighbor_id: int | None = Query(default=None, ge=1, le=610),
    authorization: str | None = Header(default=None),
):
    account = _current_account(authorization)
    status, neighbors, rated, model = _build_status(account, include_candidates=True)
    if not status["ready"]:
        return {**status, "items": [], "selectedNeighborId": None, "candidateCount": 0}
    allowed = {n["userId"] for n in neighbors}
    if neighbor_id is not None and neighbor_id not in allowed:
        raise HTTPException(422, "Chỉ được chọn một trong các láng giềng tương đồng của tài khoản hiện hành.")

    target_ids = [neighbor_id] if neighbor_id is not None else [n["userId"] for n in neighbors]
    candidate_ids = set()
    for uid in target_ids:
        candidate_ids.update(model.seen_by_user[uid])
    candidate_ids.difference_update(rated)

    base = sum(rated.values()) / len(rated)
    rows = []
    for mid in candidate_ids:
        rater_scores = model.ratings_by_movie.get(mid, {})
        weights, deviations = [], []
        for neighbor in neighbors:
            uid = neighbor["userId"]
            score = rater_scores.get(uid)
            if score is not None:
                weights.append(neighbor["similarity"])
                deviations.append(score - float(model.user_means.loc[uid]))
        if not weights:
            continue
        raw = base + float(np.dot(weights, deviations) / sum(weights))
        rows.append({
            "movieId": mid,
            "title": model.movie_titles.get(mid, f"Movie {mid}"),
            "predicted_rating": round(float(np.clip(raw, 0.5, 5.0)), 6),
            "neighbor_count": len(weights),
            "source": "knn_live_account",
        })
    rows.sort(key=lambda m: (-m["predicted_rating"], -m["neighbor_count"], m["movieId"]))
    return {
        **status,
        "method": "user_based_cf_live_account",
        "selectedNeighborId": neighbor_id,
        "candidateCount": len(rows),
        "topN": top_n,
        "items": rows[:top_n],
    }
