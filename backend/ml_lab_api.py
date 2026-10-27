"""
CineMatch ML Lab API.

API thuc nghiem User-Based Collaborative Filtering A/B.
Khong thay doi du lieu Train va thuat toan goc.
"""

from functools import lru_cache
from typing import Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from backend.ml.user_based_cf import UserBasedCF
from backend.ml_lab import (
    calculate_user_similarity,
    predict_topk_for_user_b,
)


router = APIRouter(prefix="/api/ml-lab", tags=["ML Lab"])


class PredictionRequest(BaseModel):
    ratingsA: Dict[int, float] = Field(default_factory=dict)
    ratingsB: Dict[int, float]
    movieId: int = Field(gt=0)
    k: int = Field(default=20, ge=1, le=20)

    @field_validator("ratingsA", "ratingsB")
    @classmethod
    def validate_ratings(cls, ratings):
        if len(ratings) > 100:
            raise ValueError("Moi nguoi duoc nhap toi da 100 rating.")

        for movie_id, rating in ratings.items():
            if movie_id <= 0:
                raise ValueError("movieId phai lon hon 0.")

            if not (0.5 <= rating <= 5.0):
                raise ValueError("Rating phai tu 0.5 den 5.0.")

            if rating * 2 != round(rating * 2):
                raise ValueError("Rating phai theo buoc 0.5.")

        return ratings


@lru_cache(maxsize=1)
def get_lab_model():
    return UserBasedCF(k=20)


@router.post("/predict")
def predict_lab(request: PredictionRequest):
    if not request.ratingsB:
        raise HTTPException(
            status_code=400,
            detail="Nguoi B phai danh gia it nhat mot phim.",
        )

    if request.movieId in request.ratingsB:
        raise HTTPException(
            status_code=400,
            detail="Nguoi B da danh gia phim nay.",
        )

    model = get_lab_model()

    if request.movieId not in model.movie_to_idx:
        raise HTTPException(
            status_code=404,
            detail="Phim khong co trong MovieLens Train.",
        )

    all_movie_ids = (
        set(request.ratingsA) | set(request.ratingsB)
    )

    unknown_movies = sorted(
        all_movie_ids - set(model.movie_to_idx)
    )

    if unknown_movies:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Co phim khong thuoc MovieLens Train.",
                "movieIds": unknown_movies,
            },
        )

    comparison = calculate_user_similarity(
        request.ratingsA,
        request.ratingsB,
    )

    prediction = predict_topk_for_user_b(
        ratings_a=request.ratingsA,
        ratings_b=request.ratingsB,
        movie_id=request.movieId,
        model=model,
        k=request.k,
    )

    return {
        "method": "user_based_cf_lab",
        "movieId": request.movieId,
        "title": model.movie_titles.get(
            request.movieId, "Unknown"
        ),
        "comparison": comparison,
        "prediction": prediction,
    }
