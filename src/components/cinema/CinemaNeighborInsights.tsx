import { useEffect, useState } from "react";
import { ChevronDown, Crown, Info, Layers3, Users } from "lucide-react";
import { authApi, type DemoNeighborResult, type LiveKnnStatus } from "../../services/authApi";

type Neighbor = {
  userId: number;
  similarity: number;
  commonRatings?: number;
  trainingCount?: number;
};

type Props = {
  isDemo: boolean;
  accountKey: string;
  accountUserId: number;
  status: LiveKnnStatus | null;
};

/** Explain the actual, authenticated KNN ranking without exposing other accounts' ratings. */
export function CinemaNeighborInsights({ isDemo, accountKey, accountUserId, status }: Props) {
  const [demoResult, setDemoResult] = useState<DemoNeighborResult | null>(null);
  const [busy, setBusy] = useState(isDemo);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isDemo) return;
    let active = true;
    setBusy(true);
    setDemoResult(null);
    setError("");

    void authApi.demoNeighbors(10)
      .then(result => {
        if (!active) return;
        if (result.userId !== accountUserId || result.k !== 21) {
          throw new Error("Thông tin láng giềng không khớp hồ sơ đang xem.");
        }
        setDemoResult(result);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Chưa tải được láng giềng.");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => { active = false; };
  }, [isDemo, accountKey, accountUserId]);

  const neighbors: Neighbor[] = isDemo ? (demoResult?.neighbors ?? []) : (status?.neighbors ?? []);
  const k = isDemo ? (demoResult?.k ?? 21) : (status?.k ?? 21);
  const eligible = isDemo ? demoResult?.positiveNeighborCount : status?.positiveNeighborCount;
  const selected = Math.min(neighbors.length, k);
  const best = neighbors[0];

  function neighborLine(neighbor: Neighbor, index: number) {
    return <li className="cm-modern-neighbor-row" key={neighbor.userId}>
      <span className="cm-modern-neighbor-number">{index + 1}</span>
      <span className="cm-modern-neighbor-id">MovieLens #{neighbor.userId}</span>
      <strong>{neighbor.similarity.toFixed(3)}</strong>
      {typeof neighbor.commonRatings === "number" &&
        <small title="Số phim cả hai hồ sơ cùng đánh giá">{neighbor.commonRatings} chung</small>}
    </li>;
  }

  return <aside className="cm-modern-neighbor-panel" aria-label="Thông tin láng giềng User-Based KNN">
    <header className="cm-modern-neighbor-heading">
      <div className="cm-modern-neighbor-icon"><Users size={21} /></div>
      <div><h2>Người có gu giống bạn</h2><span>Mean-Centered Cosine</span></div>
    </header>

    <div className="cm-modern-knn-metrics">
      <div><Users size={19}/><strong>{eligible ?? "—"}</strong><span>Hồ sơ phù hợp</span></div>
      <div><Layers3 size={19}/><strong>{k}</strong><span>K tối đa</span></div>
      <div><Crown size={19}/><strong>{selected || "—"}</strong><span>Đã chọn</span></div>
    </div>

    {busy && <div className="cm-modern-neighbor-wait" role="status">Đang tải độ tương đồng…</div>}
    {error && <div className="cm-modern-neighbor-error" role="alert">{error}</div>}

    {best && <section className="cm-modern-top-one">
      <div className="cm-modern-top-one-title"><Crown size={17}/> Tương đồng nhất <span>Top 1</span></div>
      <div className="cm-modern-top-one-body">
        <div><strong>MovieLens #{best.userId}</strong>
          {typeof best.commonRatings === "number" && <small>{best.commonRatings} phim cùng đánh giá</small>}
        </div>
        <div className="cm-modern-top-one-score"><b>{best.similarity.toFixed(3)}</b><small>Cosine</small></div>
      </div>
    </section>}

    {neighbors.length > 0 && <>
      <details className="cm-modern-neighbor-details">
        <summary>Top-{Math.min(5, neighbors.length)} láng giềng <ChevronDown size={16}/></summary>
        <ol>{neighbors.slice(0, 5).map(neighborLine)}</ol>
      </details>
      {neighbors.length > 5 && <details className="cm-modern-neighbor-details cm-modern-all-neighbors">
        <summary>Danh sách {selected} láng giềng <ChevronDown size={16}/></summary>
        <ol>{neighbors.slice(0, selected).map(neighborLine)}</ol>
      </details>}
    </>}

    {!busy && !error && !neighbors.length && <p className="cm-modern-neighbor-wait">Chưa có láng giềng phù hợp.</p>}
    <p className="cm-modern-neighbor-hint"><Info size={15}/> Điểm Cosine đo độ giống nhau giữa hồ sơ, không phải tỷ lệ thích phim.</p>
  </aside>;
}
