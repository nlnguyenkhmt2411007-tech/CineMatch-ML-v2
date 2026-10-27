
from pathlib import Path
import pandas as pd

# Thu muc goc du an
ROOT = Path(__file__).resolve().parents[2]

INPUT_FILE = ROOT / "data" / "raw" / "ratings.csv"
OUTPUT_DIR = ROOT / "data" / "processed"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# 1. Doc du lieu goc
ratings = pd.read_csv(INPUT_FILE)

required = {"userId", "movieId", "rating", "timestamp"}
assert required.issubset(ratings.columns), "Thieu cot du lieu!"

print("=" * 55)
print("CINEMATCH ML - CHIA DU LIEU THEO THOI GIAN")
print("=" * 55)
print(f"Tong so ratings: {len(ratings):,}")
print(f"So nguoi dung: {ratings['userId'].nunique()}")
print(f"So phim: {ratings['movieId'].nunique()}")

# 2. Sap xep theo thoi gian trong tung nguoi dung
ratings = ratings.sort_values(
    ["userId", "timestamp", "movieId"]
).reset_index(drop=True)

# 3. Chia theo tung user: 80% train, 10% val, 10% test
# Moi user co >= 3 ratings se co it nhat 1 val va 1 test.
def split_user(group):
    n = len(group)

    if n < 3:
        return group.assign(split="train")

    n_test = max(1, int(n * 0.10))
    n_val = max(1, int(n * 0.10))
    n_train = n - n_val - n_test

    result = group.copy()
    result["split"] = (
        ["train"] * n_train
        + ["val"] * n_val
        + ["test"] * n_test
    )
    return result

split_df = pd.concat(
    [split_user(group) for _, group in ratings.groupby("userId", sort=False)],
    ignore_index=True,
)

train = split_df[split_df["split"] == "train"].drop(columns="split")
val = split_df[split_df["split"] == "val"].drop(columns="split")
test = split_df[split_df["split"] == "test"].drop(columns="split")

# 4. Luu du lieu
train.to_csv(OUTPUT_DIR / "ratings_train.csv", index=False)
val.to_csv(OUTPUT_DIR / "ratings_val.csv", index=False)
test.to_csv(OUTPUT_DIR / "ratings_test.csv", index=False)

# 5. Kiem tra khong co trung lap va khong bi loi thoi gian
assert len(train) + len(val) + len(test) == len(ratings)

for user_id, group in split_df.groupby("userId"):
    tr = group[group["split"] == "train"]
    va = group[group["split"] == "val"]
    te = group[group["split"] == "test"]

    if not tr.empty and not va.empty:
        assert tr["timestamp"].max() <= va["timestamp"].min()
    if not va.empty and not te.empty:
        assert va["timestamp"].max() <= te["timestamp"].min()

print("\nKET QUA CHIA DU LIEU")
print(f"Train      : {len(train):,} ({len(train)/len(ratings):.2%})")
print(f"Validation : {len(val):,} ({len(val)/len(ratings):.2%})")
print(f"Test       : {len(test):,} ({len(test)/len(ratings):.2%})")
print("\nDa luu 3 file CSV vao data/processed/")
print("TIME-BASED SPLIT: OK")
