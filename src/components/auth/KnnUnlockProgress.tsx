import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronDown, Film, Info, Star, Users } from "lucide-react";
import { authApi, type AuthAccount, type LiveKnnStatus } from "../../services/authApi";
import "./account-ml.css";

/** Profile eligibility comes exclusively from the authenticated backend session. */
export function KnnUnlockProgress({ account, onRate, compact = false }: {
  account: AuthAccount;
  onRate: () => void;
  compact?: boolean;
}) {
  const [status, setStatus] = useState<LiveKnnStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const fingerprint = JSON.stringify(account.ratings);

  useEffect(() => {
    if (account.accountType === "movielens") return;
    let active = true;
    setStatus(null);
    setLoading(true);
    setError("");
    void authApi.knnStatus()
      .then(data => {
        if (!active) return;
        if (data.accountId !== account.accountId || data.k !== 21) {
          throw new Error("Thông tin gợi ý không khớp tài khoản hiện tại.");
        }
        setStatus(data);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Không tải được tiến độ đánh giá.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [account.accountId, account.accountType, fingerprint]);

  if (account.accountType === "movielens") return null;
  const count = status?.ratedCount ?? 0;
  const required = status?.requiredCount ?? 10;
  const progress = Math.min(100, Math.round(count / Math.max(1, required) * 100));
  const ready = status?.ready === true;
  const left = Math.max(0, required - count);
  const similar = status?.positiveNeighborCount ?? 0;
  const reason = status?.reason;
  const subline = loading ? "Đang cập nhật tiến độ…" : ready
    ? `CineMatch đã tìm thấy ${similar} người có gu phim tương tự bạn.`
    : left > 0
      ? `Đánh giá thêm ${left} phim để CineMatch hiểu sở thích của bạn hơn.`
      : reason === "no_variance"
        ? "Hãy thử chấm nhiều mức sao khác nhau để cải thiện gợi ý."
        : reason === "no_neighbor"
          ? "Hãy đánh giá thêm một số phim phổ biến để tìm người có gu giống bạn."
          : reason === "no_candidates"
            ? "Hãy đánh giá thêm phim để tìm đề xuất mới."
            : "CineMatch đang kiểm tra những người có gu phim tương tự.";

  return <section className={`cm-account-progress cm-rating-journey ${compact ? "compact" : ""}`} aria-label="Tiến độ gợi ý phim cá nhân">
    <div className="cm-account-progress-head">
      <span className="cm-account-progress-icon">{ready ? <CheckCircle2 size={22}/> : <Star size={22}/>}</span>
      <div className="cm-progress-heading-copy">
        <h3>{ready ? "Gợi ý theo gu phim đã sẵn sàng" : "Giúp CineMatch hiểu gu phim của bạn"}</h3>
        <p>{subline}</p>
      </div>
      <span className={`cm-account-state ${ready ? "ready" : ""}`}>
        {ready ? "Đã có gợi ý" : `${count}/${required} phim`}
      </span>
    </div>
    {error && <p className="cm-account-error" role="alert">{error}</p>}
    {!loading && !error && status && <>
      <div className="cm-account-meter-line"><b>{ready ? `${count} phim đã đánh giá` : `${count}/${required} phim cần thiết`}</b><span>{progress}%</span></div>
      <div className="cm-account-meter" role="progressbar" aria-valuenow={Math.min(count,required)} aria-valuemin={0} aria-valuemax={required} aria-label="Tiến độ đánh giá phim"><i style={{width:`${progress}%`}}/></div>
      {!ready && <button type="button" className="cm-account-button" onClick={onRate}><Star size={16}/> Đánh giá phim <ArrowRight size={16}/></button>}
      <details className="cm-progress-details">
        <summary><Info size={15}/> Tìm hiểu cách hệ thống chọn phim <ChevronDown size={14}/></summary>
        <div className="cm-progress-details-body">
          <p>CineMatch cần tối thiểu {required} phim đã đánh giá hợp lệ, sau đó kiểm tra mức độ tương đồng với những hồ sơ phim đã có. Đủ {required} phim không có nghĩa là chắc chắn tìm được gợi ý.</p>
          <p>{similar} người có xu hướng đánh giá tương đồng · Sử dụng tối đa 21 người phù hợp cho một dự đoán (K = 21).</p>
          {status.ignoredCount > 0 && <p>{status.ignoredCount} trong {status.totalRatingCount} đánh giá chưa đối chiếu được với tập phim dùng để tính gợi ý.</p>}
          <p>Thông tin kỹ thuật: hệ thống so sánh các phim đánh giá chung bằng Mean-Centered Cosine; không sử dụng rating từ tài khoản khác làm của bạn.</p>
        </div>
      </details>
    </>}
  </section>;
}
