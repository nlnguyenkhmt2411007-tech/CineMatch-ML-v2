
from pathlib import Path
import numpy as np
import pandas as pd

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from content_user import ContentUserRecommender
from user_based_cf import UserBasedCF


# ============================================================
# 1. CAU HINH DUONG DAN
# ============================================================

ROOT = Path(__file__).resolve().parents[2]

DATA_DIR = ROOT / "data" / "processed"
RESULTS_DIR = ROOT / "results"
CHARTS_DIR = RESULTS_DIR / "charts"

CHARTS_DIR.mkdir(parents=True, exist_ok=True)

TRAIN_PATH = DATA_DIR / "ratings_train.csv"
TEST_PATH = DATA_DIR / "ratings_test.csv"

TOP_N = 10
SEED = 42
N_NEGATIVES = 100
RELEVANCE_THRESHOLD = 4.0
BEST_K = 20


print("=" * 60)
print("CINEMATCH ML - DANH GIA CUOI CUNG TREN TEST")
print("PRECISION@10 / RECALL@10")
print("=" * 60)


# ============================================================
# 2. DOC DU LIEU
# ============================================================

train = pd.read_csv(TRAIN_PATH)
test = pd.read_csv(TEST_PATH)

print(f"\nSo ratings Train: {len(train):,}")
print(f"So ratings Test : {len(test):,}")
print(f"So user Test    : {test['userId'].nunique()}")


# ============================================================
# 3. KHOI TAO HAI MODEL
# CHI SU DUNG TRAIN DE TAO MO HINH
# ============================================================

print("\nDang khoi tao Content-Based...")
content_model = ContentUserRecommender()

print("Dang khoi tao User-Based CF...")
cf_model = UserBasedCF(k=BEST_K)

print(f"User-Based CF K = {BEST_K}")


# ============================================================
# 4. XAY DUNG TAP PHIM UNG VIEN CHUNG
# ============================================================

catalog = sorted(
    set(cf_model.movie_ids)
    & set(content_model.movie_to_idx.keys())
)

catalog_set = set(catalog)

print(f"So phim ung vien trong catalog: {len(catalog):,}")

train_seen = {
    int(uid): set(group["movieId"].astype(int))
    for uid, group in train.groupby("userId")
}

rng = np.random.default_rng(SEED)

records = []
evaluated_users = 0


# ============================================================
# 5. DANH GIA TUNG NGUOI DUNG TREN TEST
# ============================================================

print("\nDang danh gia Precision@10 va Recall@10...")

for user_id, user_test in test.groupby("userId"):

    user_id = int(user_id)
    seen = train_seen.get(user_id, set())

    # Chi lay phim Test nam trong catalog chung
    observed_test = user_test[
        user_test["movieId"].isin(catalog_set)
    ]

    test_ids = set(
        observed_test["movieId"].astype(int)
    )

    # Phim relevant: rating >= 4.0
    relevant = set(
        observed_test.loc[
            observed_test["rating"] >= RELEVANCE_THRESHOLD,
            "movieId"
        ].astype(int)
    ) - seen

    # Bo qua user khong co phim relevant trong Test
    if not relevant:
        continue

    # Lay mau phim chua duoc quan sat trong Train/Test
    unknown_pool = sorted(
        catalog_set - seen - test_ids
    )

    sample_size = min(
        N_NEGATIVES,
        len(unknown_pool)
    )

    if sample_size > 0:
        sampled = rng.choice(
            unknown_pool,
            size=sample_size,
            replace=False
        ).tolist()
    else:
        sampled = []

    # Hai model dung cung tap ung vien
    candidates = sorted(
        (test_ids | set(sampled)) - seen
    )

    if len(candidates) < TOP_N:
        continue

    # --------------------------------------------------------
    # 5.1. CONTENT-BASED
    # --------------------------------------------------------

    cb_scores = content_model.score_movies(
        user_id,
        candidates
    )

    cb_top = sorted(
        candidates,
        key=lambda mid: (
            -cb_scores.get(mid, 0.0),
            mid
        )
    )[:TOP_N]

    # --------------------------------------------------------
    # 5.2. USER-BASED COLLABORATIVE FILTERING
    # --------------------------------------------------------

    cf_scores = {
        mid: cf_model.predict(user_id, mid)
        for mid in candidates
    }

    cf_top = sorted(
        candidates,
        key=lambda mid: (
            -cf_scores[mid],
            mid
        )
    )[:TOP_N]

    # --------------------------------------------------------
    # 5.3. TINH PRECISION VA RECALL
    # --------------------------------------------------------

    for model_name, top_ids in [
        ("Content-Based", cb_top),
        ("User-Based CF", cf_top)
    ]:

        hits = len(
            set(top_ids) & relevant
        )

        precision = hits / TOP_N
        recall = hits / len(relevant)

        records.append({
            "userId": user_id,
            "model": model_name,
            "hits": hits,
            "relevant_count": len(relevant),
            "precision_at_10": precision,
            "recall_at_10": recall,
            "candidate_count": len(candidates)
        })

    evaluated_users += 1


# ============================================================
# 6. TONG HOP KET QUA
# ============================================================

df = pd.DataFrame(records)

if df.empty:
    raise RuntimeError(
        "Khong co nguoi dung hop le de danh gia Test."
    )

summary = (
    df.groupby("model", as_index=False)
    .agg(
        users=("userId", "nunique"),
        precision_at_10=("precision_at_10", "mean"),
        recall_at_10=("recall_at_10", "mean")
    )
)

print("\n" + "=" * 60)
print("KET QUA DANH GIA TREN TEST")
print("=" * 60)

print(
    summary.to_string(
        index=False,
        float_format=lambda x: f"{x:.4f}"
    )
)

print(f"\nSo nguoi dung duoc danh gia: {evaluated_users}")
print(f"Top N: {TOP_N}")
print(f"Relevant threshold: {RELEVANCE_THRESHOLD}")
print(f"So phim lay mau: {N_NEGATIVES}")
print(f"User-Based CF K: {BEST_K}")

print(
    "\nLuu y: Day la danh gia tren tap ung vien lay mau, "
    "khong phai toan bo catalog."
)


# ============================================================
# 7. LUU KET QUA TEST VAO CSV
# ============================================================

per_user_path = (
    RESULTS_DIR / "topk_test_per_user.csv"
)

metrics_path = (
    RESULTS_DIR / "topk_test_metrics.csv"
)

df.to_csv(
    per_user_path,
    index=False
)

summary.to_csv(
    metrics_path,
    index=False
)


# ============================================================
# 8. VE BIEU DO SO SANH
# ============================================================

x = np.arange(len(summary))
width = 0.34

fig, ax = plt.subplots(figsize=(9, 5))

precision_bars = ax.bar(
    x - width / 2,
    summary["precision_at_10"],
    width,
    label="Precision@10"
)

recall_bars = ax.bar(
    x + width / 2,
    summary["recall_at_10"],
    width,
    label="Recall@10"
)

ax.set_xticks(x)
ax.set_xticklabels(summary["model"])

ax.set_ylabel("Gia tri (0-1)")

ax.set_title(
    "CineMatch ML - So sanh hai mo hinh tren Test"
)

ax.legend(loc="upper right")

ax.bar_label(
    precision_bars,
    fmt="%.4f",
    padding=3
)

ax.bar_label(
    recall_bars,
    fmt="%.4f",
    padding=3
)

max_score = float(
    summary[
        ["precision_at_10", "recall_at_10"]
    ].max().max()
)

ax.set_ylim(
    0,
    max(0.10, max_score * 1.25)
)

plt.tight_layout()

chart_path = (
    CHARTS_DIR / "compare_precision_recall_test.png"
)

plt.savefig(
    chart_path,
    dpi=160
)

plt.close()


# ============================================================
# 9. HOAN THANH
# ============================================================

print("\n" + "=" * 60)
print("DANH GIA TEST HOAN THANH")
print("=" * 60)

print("\nDa luu cac file:")

print("- results/topk_test_per_user.csv")
print("- results/topk_test_metrics.csv")
print("- results/charts/compare_precision_recall_test.png")
