import { useEffect, useState, type ComponentProps } from "react";
import { Heart, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { CollaborativeView as LegacyCollaborativeView } from "../collaborative/CollaborativeView";
import { authApi, type LiveKnnStatus } from "../../services/authApi";
import { useCineMatchAccount } from "../auth/AuthGate";
import { KnnUnlockProgress } from "../auth/KnnUnlockProgress";
import {
  CinemaHero,
  CinemaRecommendations,
  CinemaHowItWorks,
  useCinePosters,
  type RankedMovie,
} from "./CinemaShared";
import "./cinema-methods.css";
import "./cinema-knn-explorer.css";
import "../auth/account-ml.css";

type Props = ComponentProps<typeof LegacyCollaborativeView> & {
  onRate?: () => void;
};

type ScopedStatus = {
  key: string;
  value: LiveKnnStatus;
};

type ScopedRanking = {
  key: string;
  items: RankedMovie[];
};

type ScopedError = {
  key: string;
  message: string;
};

const EMPTY_RECOMMENDATIONS: RankedMovie[] = [];

/**
 * Consumer-facing User-Based KNN screen.
 * Only the currently authenticated account can be used as the target.
 * Neighbor IDs and their individual ratings are intentionally not fetched
 * or presented in this view.
 */
export function CinemaKnnView(props: Props) {
  const { account } = useCineMatchAccount();
  const isDemo = account.accountType === "movielens";
  const ratingsFingerprint = JSON.stringify(account.ratings);

  // Scope asynchronous results to both the account and the current ratings.
  // This also prevents the previous account's posters flashing after a switch.
  const accountKey = JSON.stringify([
    account.accountType,
    account.accountId,
    account.userId,
    ratingsFingerprint,
  ]);

  const [topN, setTopN] = useState(10);
  const [statusResult, setStatusResult] = useState<ScopedStatus | null>(null);
  const [statusError, setStatusError] = useState<ScopedError | null>(null);
  const [rankingResult, setRankingResult] = useState<ScopedRanking | null>(null);
  const [rankingError, setRankingError] = useState<ScopedError | null>(null);
  const [busyRanking, setBusyRanking] = useState(false);

  const status = statusResult?.key === accountKey ? statusResult.value : null;
  const currentStatusError =
    statusError?.key === accountKey ? statusError.message : "";
  const statusLoading = !isDemo && !status && !currentStatusError;
  const canRecommend = isDemo || (status?.ready === true && status.k === 21);

  useEffect(() => {
    if (isDemo) return;
    let active = true;

    void authApi
      .knnStatus()
      .then((data) => {
        if (!active) return;
        if (data.accountId !== account.accountId || data.k !== 21) {
          throw new Error("Thông tin gợi ý không khớp tài khoản đang đăng nhập.");
        }
        setStatusResult({ key: accountKey, value: data });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setStatusError({
          key: accountKey,
          message:
            err instanceof Error
              ? err.message
              : "Không thể kiểm tra trạng thái gợi ý.",
        });
      });

    return () => {
      active = false;
    };
  }, [account.accountId, accountKey, isDemo]);

  const requestKey = JSON.stringify([accountKey, topN]);

  useEffect(() => {
    if (!canRecommend) {
      setBusyRanking(false);
      return;
    }

    let active = true;
    setBusyRanking(true);
    setRankingError(null);

    // Do not request neighbor lists or filter by another account.
    // Only the signed-in account's complete Top-N recommendations are used.
    const request = isDemo
      ? authApi.demoKnn(topN)
      : authApi.knnRecommendations(topN);

    void request
      .then((data) => {
        if (!active) return;
        if (data.userId !== account.userId || data.k !== 21) {
          throw new Error("Kết quả gợi ý không khớp tài khoản đang đăng nhập.");
        }
        setRankingResult({ key: requestKey, items: data.items });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setRankingError({
          key: requestKey,
          message:
            err instanceof Error ? err.message : "Không thể tải phim phù hợp.",
        });
      })
      .finally(() => {
        if (active) setBusyRanking(false);
      });

    return () => {
      active = false;
    };
  }, [account.userId, canRecommend, isDemo, requestKey, topN]);

  const visible =
    canRecommend && rankingResult?.key === requestKey
      ? rankingResult.items
      : EMPTY_RECOMMENDATIONS;
  const error =
    rankingError?.key === requestKey ? rankingError.message : "";
  const loading =
    canRecommend &&
    (busyRanking || (rankingResult?.key !== requestKey && !error));

  const extras = useCinePosters(visible, visible[0]?.movieId);
  const lead = visible[0] ? extras[visible[0].movieId] : undefined;

  return (
    <div className="cm-cinema-page cm-cinema-knn cm-knn-explorer cm-account-view">
      <CinemaHero
        eyebrow="CINEMATCH PICKS"
        title={
          <>
            Những bộ phim <em>đúng gu của bạn</em>
          </>
        }
        subtitle="Danh sách phim được chọn lọc theo sở thích và những đánh giá của chính bạn."
        icon={<Heart size={37} />}
        backdrop={lead?.backdropUrl}
      >
        {null}
      </CinemaHero>

      <div className="cm-cinema-container">
        <div className="cm-account-pinned">
          <ShieldCheck size={22} />
          <div>
            <b>{account.name || "Tài khoản của bạn"}</b>
            <small>Đề xuất dành riêng cho tài khoản đang đăng nhập</small>
          </div>
        </div>

        {!isDemo && (
          <>
            <KnnUnlockProgress
              account={account}
              onRate={props.onRate ?? (() => {})}
              compact
            />
            {statusLoading && (
              <p className="cm-cinema-message">
                Đang kiểm tra dữ liệu sở thích của bạn...
              </p>
            )}
            {currentStatusError && (
              <p className="cm-cinema-message error" role="alert">
                {currentStatusError}
              </p>
            )}
          </>
        )}

        {canRecommend ? (
          <>
            <section className="my-6 flex flex-col gap-5 rounded-2xl border border-[#D7AA61]/20 bg-[#151820] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#D7AA61]/25 bg-[#D7AA61]/10 text-[#E8BF82]">
                  <Sparkles size={22} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[#F6F0E7] sm:text-lg">
                    Dành riêng cho bạn
                  </h2>
                  <p className="mt-1 max-w-xl text-xs leading-6 text-[#AFA497] sm:text-sm">
                    Chọn số lượng phim muốn khám phá. CineMatch sẽ xếp hạng
                    những phim bạn chưa đánh giá theo mức độ phù hợp dự đoán.
                  </p>
                </div>
              </div>

              <div className="w-full shrink-0 rounded-xl border border-white/10 bg-[#1B1D25] p-4 sm:w-[235px]">
                <label
                  htmlFor="cm-knn-top-n"
                  className="flex items-center justify-between gap-3 text-xs text-[#C8BBA9]"
                >
                  <span>Số phim muốn xem</span>
                  <strong className="text-base text-[#E8BF82]">{topN}</strong>
                </label>
                <input
                  id="cm-knn-top-n"
                  type="range"
                  min={3}
                  max={10}
                  value={topN}
                  onChange={(event) => setTopN(Number(event.target.value))}
                  className="mt-3 w-full accent-[#E8BF82]"
                />
                <div className="mt-1 flex justify-between text-[11px] text-[#887E71]">
                  <span>3 phim</span>
                  <span>10 phim</span>
                </div>
              </div>
            </section>

            <div className="w-full min-w-0">
              <CinemaRecommendations
                title={`Top-${topN} dành riêng cho bạn`}
                description="Phim bạn chưa đánh giá, được xếp theo mức độ phù hợp dự đoán."
                movies={visible}
                extras={extras}
                loading={loading}
                error={error}
                kind="rating"
                onSelectMovie={props.onSelectMovie}
                localMovies={props.allMovies}
              />
            </div>

            <CinemaHowItWorks
              steps={[
                {
                  title: "Nhận diện sở thích",
                  desc: "CineMatch sử dụng lịch sử đánh giá của chính tài khoản đang đăng nhập.",
                },
                {
                  title: "Tìm xu hướng tương đồng",
                  desc: "Mô hình so sánh các mẫu đánh giá để tìm tín hiệu phù hợp, không công khai hoạt động của tài khoản khác.",
                },
                {
                  title: "Xếp hạng phim",
                  desc: "Hệ thống dự đoán điểm yêu thích và chọn những phim phù hợp nhất cho bạn.",
                },
              ]}
              note={
                isDemo
                  ? "Chế độ MovieLens sử dụng User-Based KNN với K = 21 trên dữ liệu Training. Điểm sao là dự đoán của mô hình."
                  : "Tài khoản mới sử dụng KNN trực tuyến. Bạn có thể đánh giá thêm phim để cải thiện kết quả; mô hình nghiên cứu gốc không bị thay đổi."
              }
            />
          </>
        ) : (
          <div className="cm-account-pinned" style={{ marginTop: 12 }}>
            <LockKeyhole size={21} />
            <div>
              <b>
                {currentStatusError
                  ? "Chưa thể kiểm tra gợi ý cá nhân hóa"
                  : "Hãy khám phá và đánh giá thêm phim"}
              </b>
              <small>
                {status?.reason === "no_neighbor"
                  ? "Thử đánh giá thêm một vài phim phổ biến để hệ thống tìm đủ dữ liệu phù hợp."
                  : "Gợi ý dành riêng cho bạn sẽ xuất hiện khi hệ thống có đủ dữ liệu đánh giá."}
              </small>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
