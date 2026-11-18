"""Interactive MovieLens Training-only KNN neighbor explorer.

Selecting a neighbor only chooses the candidate movies (rated by that neighbor,
not by the target in Training). Every predicted score is still computed by the
unchanged Colab-aligned K=21 collaborative model across up to K eligible raters.
No Validation or Test ratings are accessed.
"""

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(tags=["User-Based KNN – Neighbor Explorer"])


@router.get("/api/recommend/user/{user_id}/neighbor-explorer")
def explore_neighbors(
    user_id: int,
    neighbor_id: int | None = Query(default=None, ge=1),
    top_n: int = Query(default=10, ge=3, le=10),
):
    # Import inside the function so the router is included without a circular
    # import during backend.main module initialization.
    from backend.main import get_cf_model

    model = get_cf_model()
    uid = int(user_id)
    if uid not in model.user_to_idx:
        raise HTTPException(status_code=404, detail="MovieLens user not found")

    target_index = model.user_to_idx[uid]
    similarity = model.similarity[target_index]
    available = [
        (int(other_id), float(similarity[idx]))
        for other_id, idx in model.user_to_idx.items()
        if int(other_id) != uid and float(similarity[idx]) > 0
    ]
    available.sort(key=lambda pair: (-pair[1], pair[0]))
    top_neighbors = available[:model.k]
    neighbors = [
        {
            "userId": other_id,
            "similarity": sim,
            "trainingCount": len(model.seen_by_user.get(other_id, set())),
        }
        for other_id, sim in top_neighbors
    ]

    selected_id = int(neighbor_id) if neighbor_id is not None else (
        top_neighbors[0][0] if top_neighbors else None
    )
    if selected_id is not None and selected_id not in {n[0] for n in top_neighbors}:
        raise HTTPException(
            status_code=422,
            detail="Selected user is not in the target user's top-K positive neighbors",
        )

    target_seen = model.seen_by_user.get(uid, set())
    candidates = (
        sorted(model.seen_by_user.get(selected_id, set()) - target_seen)
        if selected_id is not None else []
    )
    scored = []
    for movie_id in candidates:
        predicted, used_count, raw, source = model.predict_details(uid, movie_id)
        scored.append((movie_id, predicted, used_count, raw, source))
    # Exactly the same tie-breaking rule as UserBasedCF.recommend / Colab.
    scored.sort(key=lambda r: (-r[1], -r[2], r[0]))

    items = [
        {
            "movieId": int(mid),
            "title": model.movie_titles.get(mid, f"Movie #{mid}"),
            "predicted_rating": round(float(prediction), 6),
            "neighbor_rating": float(model.ratings_by_movie[mid][selected_id]),
            "neighbor_count": int(count),
            "source": source,
        }
        for mid, prediction, count, _raw, source in scored[:top_n]
    ]
    return {
        "method": "user_based_cf_neighbor_explorer",
        "userId": uid,
        "k": model.k,
        "trainingCount": len(target_seen),
        "positiveNeighborCount": len(available),
        "neighbors": neighbors,
        "selectedNeighborId": selected_id,
        "candidateCount": len(candidates),
        "topN": top_n,
        "items": items,
        "note": (
            "The selected neighbor defines a Training-only candidate set; "
            "predictions use up to K positive neighbors who rated each movie."
        ),
    }
