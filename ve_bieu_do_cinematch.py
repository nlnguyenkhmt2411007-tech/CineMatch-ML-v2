from pathlib import Path
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import PercentFormatter

ROOT = Path(__file__).resolve().parent
RESULTS = ROOT / "results"
OUT = RESULTS / "charts" / "presentation"
OUT.mkdir(parents=True, exist_ok=True)

DETAIL = RESULTS / "topk_test_per_user.csv"
METRICS = RESULTS / "topk_test_metrics.csv"

if not DETAIL.exists() or not METRICS.exists():
    raise FileNotFoundError(
        "Chua co ket qua Test. Hay chay backend/ml/evaluate_test.py truoc."
    )

df = pd.read_csv(DETAIL)
summary = pd.read_csv(METRICS)

models = ["Content-Based", "User-Based CF"]
colors = ["#2563EB", "#0D9488"]

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 11,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "figure.facecolor": "white",
    "axes.facecolor": "white",
    "savefig.facecolor": "white",
})

def save(fig, name):
    path = OUT / name
    fig.savefig(path, dpi=240, bbox_inches="tight")
    plt.close(fig)
    print("Da tao:", path)

def add_footer(fig):
    fig.text(
        0.5, 0.015,
        "CineMatch ML V2 | MovieLens | Test set | Top-10 | 100 sampled negatives",
        ha="center", fontsize=9, color="#64748B"
    )

# 01. Precision / Recall
fig, ax = plt.subplots(figsize=(12, 6.5))
x = np.arange(len(models))
w = 0.32

p = [
    float(summary.loc[summary.model == m, "precision_at_10"].iloc[0])
    for m in models
]
r = [
    float(summary.loc[summary.model == m, "recall_at_10"].iloc[0])
    for m in models
]

b1 = ax.bar(x-w/2, p, w, label="Precision@10", color=colors[0])
b2 = ax.bar(x+w/2, r, w, label="Recall@10", color=colors[1])
ax.bar_label(b1, fmt="%.4f", padding=5, fontsize=12, fontweight="bold")
ax.bar_label(b2, fmt="%.4f", padding=5, fontsize=12, fontweight="bold")
ax.set_xticks(x, models)
ax.set_ylim(0, max(p+r)*1.35)
ax.set_ylabel("Score")
ax.set_title("Top-10 Recommendation Performance", fontsize=18, weight="bold", pad=20)
ax.legend(frameon=False)
ax.grid(axis="y", alpha=0.15)
ax.set_axisbelow(True)
add_footer(fig)
save(fig, "01_so_sanh_precision_recall.png")

# 02. Boxplot theo nguoi dung
fig, axes = plt.subplots(1, 2, figsize=(13, 6))
for ax, metric, title in zip(
    axes,
    ["precision_at_10", "recall_at_10"],
    ["Precision@10 Distribution", "Recall@10 Distribution"]
):
    values = [
        df.loc[df.model == m, metric].dropna().to_numpy()
        for m in models
    ]
    bp = ax.boxplot(values, patch_artist=True, widths=0.5)
    for patch, color in zip(bp["boxes"], colors):
        patch.set_facecolor(color)
        patch.set_alpha(0.65)
    ax.set_xticks([1, 2], models)
    ax.set_title(title, fontsize=14, weight="bold")
    ax.set_ylabel("Score")
    ax.grid(axis="y", alpha=0.15)
fig.suptitle("Performance Distribution Across Users", fontsize=18, weight="bold")
fig.tight_layout(rect=[0, 0.05, 1, 0.92])
add_footer(fig)
save(fig, "02_phan_bo_theo_nguoi_dung.png")

# 03. Hits@10
fig, ax = plt.subplots(figsize=(12, 6.5))
max_hits = int(df["hits"].max())
positions = np.arange(max_hits + 1)
w = 0.36

for i, model in enumerate(models):
    counts = (
        df.loc[df.model == model, "hits"]
        .value_counts()
        .reindex(positions, fill_value=0)
    )
    ax.bar(
        positions + (i-0.5)*w,
        counts.values,
        width=w,
        label=model,
        color=colors[i]
    )

ax.set_xticks(positions)
ax.set_xlabel("Number of relevant movies in Top 10")
ax.set_ylabel("Number of users")
ax.set_title("Hits@10 Distribution", fontsize=18, weight="bold", pad=20)
ax.legend(frameon=False)
ax.grid(axis="y", alpha=0.15)
ax.set_axisbelow(True)
add_footer(fig)
save(fig, "03_phan_bo_hits_at_10.png")

# 04. Hit Rate
fig, axes = plt.subplots(1, 2, figsize=(13, 6))

user_counts = [
    df.loc[df.model == m, "userId"].nunique()
    for m in models
]
hit_rates = [
    (df.loc[df.model == m, "hits"] > 0).mean()
    for m in models
]

bars = axes[0].bar(models, user_counts, color=colors, width=0.55)
axes[0].bar_label(bars, padding=5)
axes[0].set_title("Evaluated Users", weight="bold")
axes[0].set_ylabel("Users")

bars = axes[1].bar(models, hit_rates, color=colors, width=0.55)
axes[1].bar_label(
    bars,
    labels=[f"{v:.1%}" for v in hit_rates],
    padding=5
)
axes[1].set_ylim(0, max(0.1, max(hit_rates)*1.3))
axes[1].yaxis.set_major_formatter(PercentFormatter(1))
axes[1].set_title("Users with at Least One Hit", weight="bold")
axes[1].set_ylabel("Hit rate")

fig.suptitle("Recommendation Coverage and Hit Rate", fontsize=18, weight="bold")
fig.tight_layout(rect=[0, 0.05, 1, 0.92])
add_footer(fig)
save(fig, "04_nguoi_dung_va_hit_rate.png")

print("\nHOAN THANH: 4 bieu do da duoc xuat.")
