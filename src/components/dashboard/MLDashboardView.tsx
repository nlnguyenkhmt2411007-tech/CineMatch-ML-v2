
import React, { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  Database,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Users,
  Layers,
  TrendingUp,
  Clock,
} from "lucide-react";

import {
  cineMatchApi,
  type EvaluationResponse,
} from "../../services/api";

type ExperimentsResponse = {
  model: string;
  evaluation_set: string;
  selected_k: number;
  experiments: Array<{
    k: number;
    mae: number;
    rmse: number;
  }>;
};

const COLORS = {
  gold: "#E8B65B",
  background: "#090A0E",
  card: "#11141C",
  elevated: "#191D27",
  white: "#F5F2EA",
  muted: "#9EA3AE",
  green: "#34D399",
};

const SPLIT_DATA = [
  { label: "Train", count: 81200, color: COLORS.gold },
  { label: "Validation", count: 9818, color: "#60A5FA" },
  { label: "Test", count: 9818, color: COLORS.green },
];

const TOTAL_SPLIT = SPLIT_DATA.reduce(
  (sum, item) => sum + item.count,
  0
);

function formatMetric(value?: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }

  return value.toFixed(4);
}

function formatInteger(value?: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }

  return new Intl.NumberFormat("vi-VN").format(value);
}

function MetricCard({
  title,
  value,
  description,
  higherIsBetter,
  color = COLORS.gold,
}: {
  title: string;
  value: string;
  description: string;
  higherIsBetter: boolean;
  color?: string;
}) {
  return (
    <div className="rounded-[10px] border border-white/[0.08] bg-[#11141C] p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#F5F2EA]">
          {title}
        </span>

        <span
          className={`text-[10px] font-mono ${
            higherIsBetter ? "text-emerald-400" : "text-amber-400"
          }`}
        >
          {higherIsBetter ? "Cao hơn ↑" : "Thấp hơn ↓"}
        </span>
      </div>

      <div>
        <p
          className="font-display text-3xl font-bold"
          style={{ color }}
        >
          {value}
        </p>
      </div>

      <p className="border-t border-white/[0.06] pt-3 text-xs leading-relaxed text-[#9EA3AE]">
        {description}
      </p>
    </div>
  );
}

function ComparisonRow({
  label,
  contentValue,
  userValue,
}: {
  label: string;
  contentValue?: number;
  userValue?: number;
}) {
  const maxValue = Math.max(
    contentValue ?? 0,
    userValue ?? 0,
    0.01
  );

  const items = [
    {
      label: "Content-Based",
      value: contentValue,
      color: COLORS.gold,
    },
    {
      label: "User-Based CF",
      value: userValue,
      color: "#60A5FA",
    },
  ];

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-[#F5F2EA]">
        {label}
      </h4>

      {items.map((item) => {
        const percentage =
          typeof item.value === "number"
            ? (item.value / maxValue) * 100
            : 0;

        return (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-[#9EA3AE]">
                {item.label}
              </span>

              <span className="font-mono text-[#F5F2EA]">
                {formatMetric(item.value)}
              </span>
            </div>

            <div className="h-4 overflow-hidden rounded bg-[#090A0E] border border-white/[0.06]">
              <div
                className="h-full rounded transition-all duration-500"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const MLDashboardView: React.FC = () => {
  const [evaluation, setEvaluation] =
    useState<EvaluationResponse | null>(null);

  const [experiments, setExperiments] =
    useState<ExperimentsResponse | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [experimentError, setExperimentError] =
    useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExperimentError(null);

    try {
      const data = await cineMatchApi.getEvaluation();
      setEvaluation(data);

      try {
        const experimentData =
          await cineMatchApi.getExperiments();

        setExperiments(experimentData);
      } catch {
        setExperiments(null);
        setExperimentError(
          "Chưa tải được bảng thử nghiệm K từ FastAPI."
        );
      }
    } catch (err) {
      setEvaluation(null);
      setExperiments(null);

      setError(
        err instanceof Error
          ? err.message
          : "Không thể kết nối FastAPI."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const content = evaluation?.ranking.find(
    (item) => item.model === "Content-Based"
  );

  const userCF = evaluation?.ranking.find(
    (item) => item.model === "User-Based CF"
  );

  const ratingCF = evaluation?.rating_prediction.find(
    (item) => item.model === "User-Based CF"
  );

  const selectedK =
    experiments?.selected_k ?? ratingCF?.k;

  const isReady = evaluation !== null && !loading;

  return (
    <div className="mx-auto max-w-[1440px] space-y-10 px-6 py-12 text-[#F5F2EA]">
      {/* HEADER */}
      <section className="space-y-5 border-b border-white/[0.08] pb-7">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[#E8B65B]">
          <BarChart3 className="h-4 w-4" />
          <span>CineMatch ML · Báo cáo Machine Learning</span>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-bold sm:text-4xl">
              Machine Learning Evaluation Dashboard
            </h1>

            <p className="max-w-3xl text-sm leading-relaxed text-[#9EA3AE]">
              Kết quả thực nghiệm trên MovieLens Latest Small.
              So sánh Content-Based Filtering và User-Based
              Collaborative Filtering bằng dữ liệu từ Python FastAPI.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="flex items-center justify-center gap-2 self-start rounded-[8px] border border-[#E8B65B]/40 bg-[#E8B65B]/10 px-4 py-2 text-xs font-semibold text-[#E8B65B] transition-colors hover:bg-[#E8B65B]/20 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loading ? "animate-spin" : ""
              }`}
            />
            Tải lại dữ liệu
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {loading ? (
            <span className="rounded bg-[#191D27] px-3 py-2 text-[#9EA3AE]">
              Đang tải dữ liệu từ FastAPI...
            </span>
          ) : isReady ? (
            <span className="flex items-center gap-2 rounded border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Dữ liệu thực nghiệm · Test
            </span>
          ) : (
            <span className="flex items-center gap-2 rounded border border-red-500/20 bg-red-500/10 px-3 py-2 text-red-300">
              <AlertCircle className="h-4 w-4" />
              Chưa kết nối dữ liệu thực nghiệm
            </span>
          )}

          <span className="rounded bg-[#191D27] px-3 py-2 font-mono text-[#9EA3AE]">
            MovieLens Latest Small
          </span>

          <span className="rounded bg-[#191D27] px-3 py-2 font-mono text-[#9EA3AE]">
            Top N = 10
          </span>

          <span className="rounded bg-[#191D27] px-3 py-2 font-mono text-[#9EA3AE]">
            Rating ≥ 4.0
          </span>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-[8px] border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-300">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">
                Không tải được dữ liệu từ FastAPI
              </p>

              <p className="mt-1 text-xs">{error}</p>

              <p className="mt-2 text-xs">
                Hãy kiểm tra backend tại
                {" "}
                {" "}{import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/api/evaluation
              </p>
            </div>
          </div>
        )}
      </section>

      {/* CORE METRICS */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <TrendingUp className="h-5 w-5 text-[#E8B65B]" />
            Bốn chỉ số đánh giá cốt lõi
          </h2>

          <span className="font-mono text-xs text-[#9EA3AE]">
            Evaluation set: Test
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Precision@10"
            value={formatMetric(
              content?.precision_at_10
            )}
            description="Content-Based. Tỷ lệ phim phù hợp trong danh sách Top 10 trên tập ứng viên lấy mẫu."
            higherIsBetter
          />

          <MetricCard
            title="Recall@10"
            value={formatMetric(
              content?.recall_at_10
            )}
            description="Content-Based. Tỷ lệ phim phù hợp được tìm lại trong tập Test quan sát được."
            higherIsBetter
          />

          <MetricCard
            title="MAE"
            value={formatMetric(ratingCF?.mae)}
            description="User-Based CF. Sai số tuyệt đối trung bình khi dự đoán điểm đánh giá."
            higherIsBetter={false}
            color={COLORS.green}
          />

          <MetricCard
            title="RMSE"
            value={formatMetric(ratingCF?.rmse)}
            description="User-Based CF. Căn bậc hai sai số bình phương trung bình."
            higherIsBetter={false}
            color={COLORS.green}
          />
        </div>
      </section>

      {/* MODEL COMPARISON */}
      <section className="rounded-[10px] border border-white/[0.08] bg-[#11141C] p-6 space-y-7">
        <div className="space-y-2 border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#E8B65B]">
            <BarChart3 className="h-4 w-4" />
            Trực quan hóa đối chứng
          </div>

          <h2 className="font-display text-xl font-bold">
            So sánh Content-Based và User-Based CF
          </h2>

          <p className="text-xs text-[#9EA3AE]">
            Precision@10 và Recall@10 trên Test, dùng cùng
            giao thức lấy mẫu ứng viên.
          </p>
        </div>

        {isReady ? (
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            <ComparisonRow
              label="Precision@10"
              contentValue={content?.precision_at_10}
              userValue={userCF?.precision_at_10}
            />

            <ComparisonRow
              label="Recall@10"
              contentValue={content?.recall_at_10}
              userValue={userCF?.recall_at_10}
            />
          </div>
        ) : (
          <div className="rounded-[8px] bg-[#191D27] px-4 py-12 text-center text-sm text-[#9EA3AE]">
            {loading
              ? "Đang tải biểu đồ..."
              : "Không có dữ liệu biểu đồ từ FastAPI."}
          </div>
        )}

        {isReady && (
          <div className="grid grid-cols-1 gap-4 border-t border-white/[0.08] pt-5 sm:grid-cols-3">
            <div>
              <p className="text-xs text-[#9EA3AE]">
                Người dùng được đánh giá
              </p>
              <p className="mt-1 font-mono text-xl font-bold text-[#F5F2EA]">
                {formatInteger(content?.users)}
              </p>
            </div>

            <div>
              <p className="text-xs text-[#9EA3AE]">
                User-Based CF
              </p>
              <p className="mt-1 font-mono text-xl font-bold text-[#E8B65B]">
                K = {selectedK ?? "--"}
              </p>
            </div>

            <div>
              <p className="text-xs text-[#9EA3AE]">
                Kết quả thực nghiệm
              </p>
              <p className="mt-1 text-sm font-semibold text-[#34D399]">
                {content &&
                userCF &&
                content.precision_at_10 >
                  userCF.precision_at_10 &&
                content.recall_at_10 >
                  userCF.recall_at_10
                  ? "Content-Based cao hơn ở cả hai chỉ số"
                  : "Xem kết quả so sánh bên trên"}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* K EXPERIMENTS */}
      <section className="rounded-[10px] border border-white/[0.08] bg-[#11141C] p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-[#E8B65B]" />
          <h2 className="font-display text-xl font-bold">
            Thực nghiệm siêu tham số K
          </h2>
        </div>

        <p className="text-xs leading-relaxed text-[#9EA3AE]">
          MAE và RMSE của User-Based Collaborative Filtering
          trên tập Validation. K được chọn theo RMSE thấp nhất.
        </p>

        {experiments && experiments.experiments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.10] text-[#9EA3AE]">
                  <th className="px-4 py-3 font-medium">K</th>
                  <th className="px-4 py-3 font-medium">MAE</th>
                  <th className="px-4 py-3 font-medium">RMSE</th>
                  <th className="px-4 py-3 font-medium">
                    Trạng thái
                  </th>
                </tr>
              </thead>

              <tbody>
                {experiments.experiments.map((item) => {
                  const selected =
                    item.k === experiments.selected_k;

                  return (
                    <tr
                      key={item.k}
                      className={`border-b border-white/[0.06] ${
                        selected
                          ? "bg-[#E8B65B]/10"
                          : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-[#F5F2EA]">
                        {item.k}
                      </td>

                      <td className="px-4 py-3 font-mono text-[#F5F2EA]">
                        {formatMetric(item.mae)}
                      </td>

                      <td className="px-4 py-3 font-mono text-[#F5F2EA]">
                        {formatMetric(item.rmse)}
                      </td>

                      <td className="px-4 py-3">
                        {selected ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#E8B65B]">
                            <CheckCircle2 className="h-4 w-4" />
                            K được chọn
                          </span>
                        ) : (
                          <span className="text-xs text-[#9EA3AE]">
                            Thử nghiệm
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-[8px] bg-[#191D27] p-5 text-sm text-[#9EA3AE]">
            {loading
              ? "Đang tải kết quả thực nghiệm..."
              : experimentError ??
                "Chưa có dữ liệu thử nghiệm K."}
          </div>
        )}
      </section>

      {/* DATASET SUMMARY */}
      <section className="space-y-5">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <Database className="h-5 w-5 text-[#E8B65B]" />
          Thông tin bộ dữ liệu MovieLens
        </h2>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="rounded-[10px] border border-white/[0.08] bg-[#11141C] p-5">
            <Database className="mb-3 h-5 w-5 text-[#E8B65B]" />
            <p className="text-xs text-[#9EA3AE]">
              Tổng số phim
            </p>
            <p className="mt-2 font-display text-2xl font-bold">
              {formatInteger(
                evaluation?.dataset_summary.total_movies
              )}
            </p>
          </div>

          <div className="rounded-[10px] border border-white/[0.08] bg-[#11141C] p-5">
            <Users className="mb-3 h-5 w-5 text-[#E8B65B]" />
            <p className="text-xs text-[#9EA3AE]">
              Tổng số người dùng
            </p>
            <p className="mt-2 font-display text-2xl font-bold">
              {formatInteger(
                evaluation?.dataset_summary.total_users
              )}
            </p>
          </div>

          <div className="rounded-[10px] border border-white/[0.08] bg-[#11141C] p-5">
            <BarChart3 className="mb-3 h-5 w-5 text-[#E8B65B]" />
            <p className="text-xs text-[#9EA3AE]">
              Tổng lượt đánh giá
            </p>
            <p className="mt-2 font-display text-2xl font-bold">
              {formatInteger(
                evaluation?.dataset_summary.total_ratings
              )}
            </p>
          </div>
        </div>
      </section>

      {/* SPLIT INFORMATION */}
      <section className="rounded-[10px] border border-white/[0.08] bg-[#11141C] p-6 space-y-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />

          <div>
            <h2 className="font-display text-xl font-bold">
              Phân chia dữ liệu theo thời gian
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-[#9EA3AE]">
              Dữ liệu được sắp xếp theo timestamp của từng
              người dùng, sau đó chia Train / Validation / Test.
              Những đánh giá mới hơn của cùng người dùng
              được giữ cho các tập đánh giá.
            </p>
          </div>
        </div>

        <div className="flex h-4 overflow-hidden rounded bg-[#090A0E]">
          {SPLIT_DATA.map((item) => (
            <div
              key={item.label}
              title={`${item.label}: ${formatInteger(item.count)}`}
              style={{
                width: `${(item.count / TOTAL_SPLIT) * 100}%`,
                backgroundColor: item.color,
              }}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {SPLIT_DATA.map((item) => (
            <div
              key={item.label}
              className="rounded-[8px] border border-white/[0.06] bg-[#191D27] p-4"
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />

                <p className="text-xs text-[#9EA3AE]">
                  {item.label}
                </p>
              </div>

              <p className="font-mono text-xl font-bold text-[#F5F2EA]">
                {formatInteger(item.count)}
              </p>

              <p className="mt-1 text-xs text-[#9EA3AE]">
                {((item.count / TOTAL_SPLIT) * 100).toFixed(2)}%
              </p>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2 border-t border-white/[0.08] pt-4">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#9EA3AE]" />

          <p className="text-xs leading-relaxed text-[#9EA3AE]">
            Phương pháp chia theo thời gian trong từng người
            dùng, không dùng một cutoff timestamp chung cho
            toàn bộ hệ thống. Trung bình đánh giá của người
            dùng và độ tương đồng User-Based được tính từ Train.
            Tập Validation dùng để chọn K = 20; tập Test dùng
            để báo cáo kết quả cuối cùng.
          </p>
        </div>
      </section>

      {/* EVALUATION NOTES */}
      <section className="rounded-[10px] border border-[#E8B65B]/20 bg-[#E8B65B]/[0.04] p-6 space-y-3">
        <div className="flex items-center gap-2 text-[#E8B65B]">
          <AlertCircle className="h-5 w-5" />
          <h2 className="font-display text-lg font-semibold">
            Lưu ý về phương pháp đánh giá
          </h2>
        </div>

        <p className="text-sm leading-relaxed text-[#9EA3AE]">
          Precision@10 và Recall@10 được tính trên tập ứng
          viên lấy mẫu, gồm các phim có đánh giá trong tập
          Test và tối đa 100 phim chưa được quan sát cho
          mỗi người dùng. Đây không phải đánh giá trên toàn
          bộ danh mục phim.
        </p>

        <p className="text-sm leading-relaxed text-[#9EA3AE]">
          Phim chưa được đánh giá không đồng nghĩa với phim
          người dùng không thích. MAE và RMSE chỉ được tính
          cho User-Based CF vì mô hình Content-Based hiện tại
          trả về độ tương đồng thể loại thay vì điểm rating.
        </p>

        {evaluation?.ranking_protocol?.note && (
          <p className="font-mono text-xs text-[#E8B65B]">
            {evaluation.ranking_protocol.note}
          </p>
        )}
      </section>
    </div>
  );
};
