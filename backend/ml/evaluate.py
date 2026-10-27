
from pathlib import Path
import sys
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from user_based_cf import UserBasedCF

VAL_PATH = ROOT / "data" / "processed" / "ratings_val.csv"
RESULTS_DIR = ROOT / "results"

RESULTS_DIR.mkdir(parents=True, exist_ok=True)

print("=" * 55)
print("CINEMATCH ML - EVALUATE USER-BASED CF")
print("=" * 55)

# Chi huan luyen tren Train
model = UserBasedCF(k=30)

# Validation chua duoc dua vao model
val = pd.read_csv(VAL_PATH)

y_true = val["rating"].to_numpy(dtype=float)
y_pred = np.array([
    model.predict(row.userId, row.movieId)
    for row in val.itertuples(index=False)
])

mae = mean_absolute_error(y_true, y_pred)
rmse = np.sqrt(mean_squared_error(y_true, y_pred))

print(f"So rating Validation: {len(val):,}")
print(f"MAE : {mae:.4f}")
print(f"RMSE: {rmse:.4f}")

# Luu ket qua
predictions = val.copy()
predictions["predicted_rating"] = y_pred
predictions["absolute_error"] = np.abs(y_true - y_pred)

predictions.to_csv(
    RESULTS_DIR / "user_cf_validation_predictions.csv",
    index=False
)

pd.DataFrame([{
    "model": "User-Based CF",
    "dataset": "Validation",
    "k": 30,
    "MAE": mae,
    "RMSE": rmse
}]).to_csv(
    RESULTS_DIR / "user_cf_validation_metrics.csv",
    index=False
)

print("\nDa luu ket qua vao results/")
