"""
CineMatch ML Lab
Thuc nghiem User-Based Collaborative Filtering A/B.

Module rieng, khong thay doi thuat toan UserBasedCF goc.
"""

from typing import Dict, List

import numpy as np


def calculate_user_similarity(
    ratings_a: Dict[int, float],
    ratings_b: Dict[int, float],
) -> dict:
    """
    Cosine similarity theo UserBasedCF goc.

    Vector tren hop cac phim da danh gia.
    Rating duoc tru trung binh tung user.
    Phim chua danh gia co gia tri 0.
    """
    if not ratings_a or not ratings_b:
        return {
            "similarity": 0.0,
            "commonMovies": [],
            "commonCount": 0,
        }

    mean_a = float(np.mean(list(ratings_a.values())))
    mean_b = float(np.mean(list(ratings_b.values())))

    common_movies = sorted(set(ratings_a) & set(ratings_b))
    all_movies = sorted(set(ratings_a) | set(ratings_b))

    vector_a = np.array(
        [
            ratings_a[mid] - mean_a
            if mid in ratings_a else 0.0
            for mid in all_movies
        ],
        dtype=float,
    )

    vector_b = np.array(
        [
            ratings_b[mid] - mean_b
            if mid in ratings_b else 0.0
            for mid in all_movies
        ],
        dtype=float,
    )

    norm_a = float(np.linalg.norm(vector_a))
    norm_b = float(np.linalg.norm(vector_b))

    similarity = (
        float(np.dot(vector_a, vector_b) / (norm_a * norm_b))
        if norm_a > 0 and norm_b > 0
        else 0.0
    )

    return {
        "similarity": round(similarity, 6),
        "commonMovies": common_movies,
        "commonCount": len(common_movies),
        "meanA": round(mean_a, 4),
        "meanB": round(mean_b, 4),
    }

def predict_from_user_a(
    ratings_a: Dict[int, float],
    ratings_b: Dict[int, float],
    movie_id: int,
) -> dict:
    """
    Du doan rating cua B tu mot hang xom A.

    Su dung cong thuc mean-centered User-Based CF.
    Day la thuc nghiem hai nguoi, khong phai Top-K day du.
    """
    if not ratings_a or not ratings_b:
        raise ValueError("A va B phai co rating.")

    if movie_id not in ratings_a:
        raise ValueError("A chua danh gia phim nay.")

    if movie_id in ratings_b:
        raise ValueError("B da danh gia phim nay.")

    comparison = calculate_user_similarity(
        ratings_a,
        ratings_b,
    )

    similarity = comparison["similarity"]
    baseline = float(np.mean(list(ratings_b.values())))
    mean_a = float(np.mean(list(ratings_a.values())))

    if similarity <= 0:
        return {
            "movieId": movie_id,
            "similarity": similarity,
            "predictedRating": round(baseline, 4),
            "baseline": round(baseline, 4),
            "neighborCount": 0,
            "reason": "Khong co hang xom co similarity duong.",
        }

    deviation = ratings_a[movie_id] - mean_a

    prediction = baseline + (
        similarity * deviation / abs(similarity)
    )

    prediction = float(np.clip(prediction, 0.5, 5.0))

    return {
        "movieId": movie_id,
        "similarity": similarity,
        "predictedRating": round(prediction, 4),
        "baseline": round(baseline, 4),
        "neighborCount": 1,
        "neighborRating": ratings_a[movie_id],
        "neighborMean": round(mean_a, 4),
        "reason": "Du doan tu hang xom A.",
    }


def predict_topk_for_user_b(
    ratings_a: Dict[int, float],
    ratings_b: Dict[int, float],
    movie_id: int,
    model,
    k: int = 20,
) -> dict:
    """
    Du doan rating cho B bang A + nguoi dung MovieLens.

    Khong sua model goc, khong ghi vao Train.
    """
    if not ratings_b:
        raise ValueError("B phai danh gia it nhat mot phim.")

    if movie_id in ratings_b:
        raise ValueError("B da danh gia phim nay.")

    if k < 1:
        raise ValueError("K phai lon hon 0.")

    baseline = float(np.mean(list(ratings_b.values())))
    neighbors = []

    # Nguoi A la hang xom thu nghiem
    if ratings_a and movie_id in ratings_a:
        comparison = calculate_user_similarity(
            ratings_b, ratings_a
        )
        similarity = comparison["similarity"]

        if similarity > 0:
            mean_a = float(np.mean(list(ratings_a.values())))
            rating_a = float(ratings_a[movie_id])
            deviation = rating_a - mean_a

            neighbors.append({
                "source": "A",
                "userId": "A",
                "similarity": similarity,
                "rating": rating_a,
                "userMean": mean_a,
                "deviation": deviation,
                "weightedContribution": similarity * deviation,
            })

    # Tinh similarity cua B voi tung nguoi MovieLens
    for uid in model.user_ids:
        uid = int(uid)

        user_ratings = model.ratings.loc[
            model.ratings["userId"] == uid,
            ["movieId", "rating"],
        ]

        ratings_u = dict(
            zip(
                user_ratings["movieId"].astype(int),
                user_ratings["rating"].astype(float),
            )
        )

        # Chi xet user da danh gia phim can du doan
        if movie_id not in ratings_u:
            continue

        comparison = calculate_user_similarity(
            ratings_b, ratings_u
        )
        similarity = comparison["similarity"]

        if similarity <= 0:
            continue

        mean_u = float(model.user_means[uid])
        rating_u = float(ratings_u[movie_id])
        deviation = rating_u - mean_u

        neighbors.append({
            "source": "MovieLens",
            "userId": uid,
            "similarity": similarity,
            "rating": rating_u,
            "userMean": mean_u,
            "deviation": deviation,
            "weightedContribution": similarity * deviation,
        })

    neighbors.sort(
        key=lambda item: item["similarity"],
        reverse=True,
    )
    neighbors = neighbors[:k]

    numerator = sum(
        item["weightedContribution"] for item in neighbors
    )
    denominator = sum(
        abs(item["similarity"]) for item in neighbors
    )

    if denominator > 0:
        prediction = baseline + numerator / denominator
    else:
        prediction = baseline

    prediction = float(np.clip(prediction, 0.5, 5.0))

    return {
        "movieId": int(movie_id),
        "baseline": round(baseline, 4),
        "predictedRating": round(prediction, 4),
        "neighborCount": len(neighbors),
        "k": k,
        "numerator": round(numerator, 6),
        "denominator": round(denominator, 6),
        "neighbors": [
            {
                **item,
                "similarity": round(item["similarity"], 6),
                "userMean": round(item["userMean"], 4),
                "deviation": round(item["deviation"], 4),
                "weightedContribution": round(
                    item["weightedContribution"], 6
                ),
            }
            for item in neighbors
        ],
    }
