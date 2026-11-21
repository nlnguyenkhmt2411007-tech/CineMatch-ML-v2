import { useEffect, useMemo, useState } from "react";
import { History, ShieldCheck, Star } from "lucide-react";
import type { Movie, UserProfile } from "../../types";
import { RateMoviesView } from "./RateMoviesView";

type Props = {
  currentUser: UserProfile;
  allMovies: Movie[];
  onSelectMovie: (movie: Movie) => void;
  onViewHistory: () => void;
};

function readPracticeRatings(key: string): Record<number, number> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: Record<number, number> = {};
    for (const [rawId, rawRating] of Object.entries(parsed)) {
      const id = Number(rawId);
      const rating = Number(rawRating);
      if (Number.isSafeInteger(id) && id > 0 && Number.isFinite(rating) &&
          rating >= 0.5 && rating <= 5 && Number.isInteger(rating * 2)) {
        result[id] = rating;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function MovieLensPracticeRatingView({
  currentUser, allMovies, onSelectMovie, onViewHistory,
}: Props) {
  const storageKey = `cinematch_v4_demo_practice_${currentUser.userId}`;
  const [practiceRatings, setPracticeRatings] = useState<Record<number, number>>(
    () => readPracticeRatings(storageKey)
  );
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    setPracticeRatings(readPracticeRatings(storageKey));
    setStorageError(false);
  }, [storageKey]);

  const practiceUser = useMemo<UserProfile>(() => {
    const values = Object.values(practiceRatings);
    const avgRating = values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    return {
      ...currentUser,
      name: `${currentUser.name} · Chấm thử`,
      ratings: practiceRatings,
      avgRating,
    };
  }, [currentUser, practiceRatings]);

  function persist(next: Record<number, number>): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
    setPracticeRatings(next);
  }

  async function ratePractice(movieId: number, rating: number): Promise<void> {
    if (!Number.isSafeInteger(movieId) || !Number.isInteger(rating * 2) ||
        rating < 0.5 || rating > 5) {
      throw new Error("Điểm đánh giá không hợp lệ.");
    }
    persist({ ...practiceRatings, [movieId]: rating });
  }

  async function removePractice(movieId: number): Promise<void> {
    const next = { ...practiceRatings };
    delete next[movieId];
    persist(next);
  }

  async function resetPractice(): Promise<void> {
    persist({});
  }

  return (
    <div>
      <section className="mx-auto max-w-[1320px] px-5 pt-8 sm:px-9">
        <div className="rounded-2xl border border-[#E8BF82]/25 bg-gradient-to-r from-[#241E17] via-[#17191D] to-[#11141C] px-6 py-7 sm:px-8">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#E8BF82]">
            <Star size={16} /> CineMatch · Đánh giá thử
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">Chấm điểm phim bạn yêu thích</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#C9C0B5]">
            Đây là khu vực đánh giá thử dành cho hồ sơ MovieLens. Điểm bạn chấm
            chỉ được lưu riêng trên trình duyệt này, không thay đổi lịch sử Training
            hoặc kết quả User-Based KNN (K = 21).
          </p>
          <button
            type="button"
            onClick={onViewHistory}
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[#E8BF82]/40 bg-[#E8BF82]/10 px-4 py-2.5 text-sm font-semibold text-[#F3CB91] hover:bg-[#E8BF82]/20"
          >
            <History size={17} /> Xem lịch sử đánh giá MovieLens
          </button>
          <p className="mt-4 flex items-start gap-2 text-xs text-[#AFA99F]">
            <ShieldCheck size={15} className="mt-0.5 shrink-0" />
            Điểm chấm thử không đồng bộ giữa các thiết bị và không dùng để huấn luyện mô hình.
          </p>
          {storageError && (
            <p role="alert" className="mt-3 text-sm text-amber-300">
              Không lưu được vào bộ nhớ trình duyệt; điểm thử chỉ tồn tại trong phiên này.
            </p>
          )}
        </div>
      </section>
      <RateMoviesView
        practiceMode
        currentUser={practiceUser}
        allMovies={allMovies}
        onRateMovie={ratePractice}
        onRemoveRating={removePractice}
        onResetRatings={resetPractice}
        onSelectMovie={onSelectMovie}
      />
    </div>
  );
}
