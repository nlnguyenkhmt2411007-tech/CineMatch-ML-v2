
from pathlib import Path
import numpy as np
import pandas as pd

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from content_user import ContentUserRecommender
from user_based_cf import UserBasedCF

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data" / "processed"
RESULTS_DIR = ROOT / "results"
CHARTS_DIR = RESULTS_DIR / "charts"

CHARTS_DIR.mkdir(parents=True, exist_ok=True)

TOP_N = 10
SEED = 42
N_NEGATIVES = 100
RELEVANCE_THRESHOLD = 4.0

print("=" * 60)
print("CINEMATCH ML - PRECISION@10 / RECALL@10")
print("=" * 60)

train = pd.read_csv(DATA_DIR / "ratings_train.csv")
val = pd.read_csv(DATA_DIR / "ratings_val.csv")

content_model = ContentUserRecommender()
cf_model = UserBasedCF(k=20)

# Chi danh gia tren phim co trong Train va co dac trung
catalog = sorted(
    set(cf_model.movie_ids) &
    set(content_model.movie_to_idx.keys())
)
catalog_set = set(catalog)

train_seen = {
    int(uid): set(group["movieId"].astype(int))
    for uid, group in train.groupby("userId")
}

rng = np.random.default_rng(SEED)

records = []

for user_id, user_val in val.groupby("userId"):
    user_id = int(user_id)

    seen = train_seen.get(user_id, set())

    observed_val = user_val[
        user_val["movieId"].isin(catalog_set)
    ]

    val_ids = set(observed_val["movieId"].astype(int))

    # Phim relevant theo rating thuc te o Validation
    relevant = set(
        observed_val.loc[
            observed_val["rating"] >= RELEVANCE_THRESHOLD,
            "movieId"
        ].astype(int)
    ) - seen

    if not relevant:
        continue

    # Lay mau phim chua duoc quan sat tren Train/Validation
    unknown_pool = list(catalog_set - seen - val_ids)
    unknown_pool.sort()

    sample_size = min(N_NEGATIVES, len(unknown_pool))

    sampled = rng.choice(
        unknown_pool,
        size=sample_size,
        replace=False
    ).tolist() if sample_size else []

    # Cung tap ung vien cho 2 model
    candidates = sorted((val_ids | set(sampled)) - seen)

    if len(candidates) < TOP_N:
        continue

    # CONTENT-BASED
    cb_scores = content_model.score_movies(user_id, candidates)

    cb_top = sorted(
        candidates,
        key=lambda mid: (-cb_scores.get(mid, 0.0), mid)
    )[:TOP_N]

    # USER-BASED COLLABORATIVE FILTERING
    cf_scores = {
        mid: cf_model.predict(user_id, mid)
        for mid in candidates
    }

    cf_top = sorted(
        candidates,
        key=lambda mid: (-cf_scores[mid], mid)
    )[:TOP_N]

    for model_name, top_ids in [
        ("Content-Based", cb_top),
        ("User-Based CF", cf_top)
    ]:
        hits = len(set(top_ids) & relevant)

        records.append({
            "userId": user_id,
            "model": model_name,
            "hits": hits,
            "relevant_count": len(relevant),
            "precision_at_10": hits / TOP_N,
            "recall_at_10": hits / len(relevant),
            "candidate_count": len(candidates)
        })

df = pd.DataFrame(records)

if df.empty:
    raise RuntimeError("Khong co user hop le de danh gia.")

summary = (
    df.groupby("model", as_index=False)
    .agg(
        users=("userId", "nunique"),
        precision_at_10=("precision_at_10", "mean"),
        recall_at_10=("recall_at_10", "mean")
    )
)

df.to_csv(
    RESULTS_DIR / "topk_validation_per_user.csv",
    index=False
)

summary.to_csv(
    RESULTS_DIR / "topk_validation_metrics.csv",
    index=False
)

print("\nKET QUA TREN VALIDATION")
print(summary.to_string(index=False, float_format=lambda x: f"{x:.4f}"))
print("\nDanh gia tren tap ung vien lay mau, khong phai full catalog.")

# Bieu do
x = np.arange(len(summary))
width = 0.34

fig, ax = plt.subplots(figsize=(9, 5))

p = ax.bar(
    x - width / 2,
    summary["precision_at_10"],
    width,
    label="Precision@10"
)
r = ax.bar(
    x + width / 2,
    summary["recall_at_10"],
    width,
    label="Recall@10"
)

ax.set_xticks(x)
ax.set_xticklabels(summary["model"])
ax.set_ylabel("Gia tri (0-1)")
ax.set_title("CineMatch ML - So sanh goi y tren Validation")
ax.legend(loc="upper right")

ax.bar_label(p, fmt="%.4f", padding=3)
ax.bar_label(r, fmt="%.4f", padding=3)

ax.set_ylim(
    0,
    max(
        0.10,
        float(summary[["precision_at_10", "recall_at_10"]].max().max()) * 1.25
    )
)

plt.tight_layout()
plt.savefig(
    CHARTS_DIR / "compare_precision_recall.png",
    dpi=160
)
plt.close()

print("\nDA LUU:")
print("- results/topk_validation_per_user.csv")
print("- results/topk_validation_metrics.csv")
print("- results/charts/compare_precision_recall.png")
