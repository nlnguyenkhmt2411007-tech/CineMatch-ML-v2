
import React from "react";
import { Clapperboard, ArrowUpRight } from "lucide-react";

interface FooterProps {
  onOpenFastApiModal: () => void;
  onNavigateTab: (tab: any) => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenFastApiModal,
  onNavigateTab,
}) => {
  return (
    <footer className="w-full border-t border-white/10 bg-[#090909] text-[#AFA69C]">
      <div className="mx-auto max-w-[1440px] px-6 py-9 sm:px-8">
        <div className="flex flex-col items-start justify-between gap-7 md:flex-row md:items-center">
          {/* BRAND */}
          <button
            type="button"
            onClick={() => onNavigateTab("home")}
            className="group flex items-center gap-3 text-left"
            aria-label="Về trang chủ CineMatch"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#DDB574]/30 bg-[#201A14] text-[#E8BF82] transition group-hover:border-[#E8BF82]">
              <Clapperboard className="h-5 w-5" />
            </span>

            <span className="flex flex-col gap-0.5">
              <span className="text-lg font-bold tracking-tight text-[#F5F0E8]">
                CineMatch
              </span>

              <span className="text-[11px] text-[#9F9588]">
                Phim hay dành cho bạn
              </span>
            </span>
          </button>

          {/* MAIN LINKS */}
          <nav
            aria-label="Điều hướng cuối trang"
            className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm"
          >
            <button
              type="button"
              onClick={() => onNavigateTab("home")}
              className="transition hover:text-[#E8BF82]"
            >
              Trang chủ
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab("explore")}
              className="transition hover:text-[#E8BF82]"
            >
              Khám phá
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab("content-based")}
              className="transition hover:text-[#E8BF82]"
            >
              Gợi ý phim
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab("rate")}
              className="transition hover:text-[#E8BF82]"
            >
              Đánh giá
            </button>
          </nav>
        </div>

        {/* BOTTOM BAR */}
        <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[#81786F]">
            © 2026 CineMatch. Khám phá bộ phim dành cho bạn.
          </p>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <button
              type="button"
              onClick={() => onNavigateTab("dashboard")}
              className="transition hover:text-[#E8BF82]"
            >
              Thông tin dự án
            </button>

            <button
              type="button"
              onClick={onOpenFastApiModal}
              className="inline-flex items-center gap-1 transition hover:text-[#E8BF82]"
            >
              Hỗ trợ kết nối
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
