
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error

from user_based_cf import UserBasedCF

ROOT = Path(__file__).resolve().parents[2]
TEST_PATH = ROOT / "data" / "processed" / "ratings_test.csv"
RESULTS_DIR = ROOT / "results"

RESULTS_DIR.mkdir(parents=True, exist_ok=True)

BEST_K = 20

print("=" * 60)
print("CINEMATCH ML - USER-BASED CF TEST EVALUATION")
print("=" * 60)

# Mo hinh chi duoc huan luyen tu Train
model = UserBasedCF(k=BEST_K)

# Tap Test chua duoc dung khi huan luyen
test = pd.read_csv(TEST_PATH)

y_true = test["rating"].to_numpy(dtype=float)

y_pred = np.array([
    model.predict(row.userId, row.movieId)
    for row in test.itertuples(index=False)
])

mae = mean_absolute_error(y_true, y_pred)
rmse = np.sqrt(mean_squared_error(y_true, y_pred))

print(f"So ratings Test : {len(test):,}")
print(f"So lang gieng K: {BEST_K}")
print(f"MAE            : {mae:.4f}")
print(f"RMSE           : {rmse:.4f}")

predictions = test.copy()
predictions["predicted_rating"] = y_pred
predictions["absolute_error"] = np.abs(y_true - y_pred)

predictions.to_csv(
    RESULTS_DIR / "user_cf_test_predictions.csv",
    index=False
)

pd.DataFrame([{
    "model": "User-Based CF",
    "dataset": "Test",
    "k": BEST_K,
    "n_ratings": len(test),
    "MAE": mae,
    "RMSE": rmse
}]).to_csv(
    RESULTS_DIR / "user_cf_test_metrics.csv",
    index=False
)

print("\nDa luu:")
print("- results/user_cf_test_predictions.csv")
print("- results/user_cf_test_metrics.csv")
