
from pathlib import Path
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.metrics import mean_absolute_error, mean_squared_error

from user_based_cf import UserBasedCF

ROOT = Path(__file__).resolve().parents[2]
VAL_PATH = ROOT / "data" / "processed" / "ratings_val.csv"
RESULTS_DIR = ROOT / "results"
CHARTS_DIR = RESULTS_DIR / "charts"

CHARTS_DIR.mkdir(parents=True, exist_ok=True)

val = pd.read_csv(VAL_PATH)
y_true = val["rating"].to_numpy()

results = []

print("=" * 55)
print("CINEMATCH ML - THUC NGHIEM THAM SO K")
print("=" * 55)

for k in [10, 20, 30, 40, 50]:
    model = UserBasedCF(k=k)

    y_pred = np.array([
        model.predict(row.userId, row.movieId)
        for row in val.itertuples(index=False)
    ])

    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))

    results.append({
        "K": k,
        "MAE": round(mae, 4),
        "RMSE": round(rmse, 4)
    })

    print(f"K={k:2d} | MAE={mae:.4f} | RMSE={rmse:.4f}")

df = pd.DataFrame(results)
df.to_csv(RESULTS_DIR / "tune_k_results.csv", index=False)

# Ve bieu do
fig, ax = plt.subplots(figsize=(9, 5))

x = np.arange(len(df))
width = 0.35

ax.bar(x - width / 2, df["MAE"], width, label="MAE")
ax.bar(x + width / 2, df["RMSE"], width, label="RMSE")

ax.set_xticks(x)
ax.set_xticklabels(df["K"])
ax.set_xlabel("K - So lang gieng")
ax.set_ylabel("Sai so")
ax.set_title("User-Based CF - MAE va RMSE theo K")
ax.legend(loc="upper right")
ax.set_ylim(0, 1.05)

for i, row in df.iterrows():
    ax.text(i - width / 2, row["MAE"] + 0.01,
            f'{row["MAE"]:.3f}', ha="center", fontsize=8)
    ax.text(i + width / 2, row["RMSE"] + 0.01,
            f'{row["RMSE"]:.3f}', ha="center", fontsize=8)

plt.tight_layout()
plt.savefig(CHARTS_DIR / "tune_k_mae_rmse.png", dpi=160)
plt.close()

best = df.loc[df["RMSE"].idxmin()]
print("\nK TOT NHAT THEO RMSE:", int(best["K"]))
print("\nDa luu:")
print("- results/tune_k_results.csv")
print("- results/charts/tune_k_mae_rmse.png")
