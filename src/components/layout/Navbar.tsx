
import React, { useState } from "react";
import {
  Clapperboard,
  Search,
  Menu,
  X,
  ChevronDown,
  Sparkles,
  Users,
  Film,
  ChartNoAxesCombined,
  FlaskConical,
  Check,
  CircleHelp,
} from "lucide-react";

import type { UserProfile } from "../../types";

export type NavTab =
  | "home"
  | "explore"
  | "content-based"
  | "collaborative"
  | "rate"
  | "dashboard"
  | "ab-lab";

interface NavbarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  currentUser: UserProfile;
  availableUsers: UserProfile[];
  onSelectUser: (user: UserProfile) => void;
  onOpenFastApiModal: () => void;
  onSearchClick: () => void;
  isFastApiConnected: boolean;
}

type Dropdown = "recommendations" | "more" | null;

const recommendations: {
  id: NavTab;
  label: string;
  description: string;
  icon: typeof Film;
}[] = [
  {
    id: "content-based",
    label: "Theo gu phim",
    description: "Phim hợp với sở thích của bạn",
    icon: Film,
  },
  {
    id: "collaborative",
    label: "Được yêu thích",
    description: "Khám phá từ người xem giống bạn",
    icon: Users,
  },
];

const moreItems: {
  id: NavTab;
  label: string;
  icon: typeof Film;
}[] = [
  {
    id: "dashboard",
    label: "Góc phân tích",
    icon: ChartNoAxesCombined,
  },
  {
    id: "ab-lab",
    label: "So sánh gợi ý",
    icon: FlaskConical,
  },
];

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  currentUser,
  availableUsers,
  onSelectUser,
  onOpenFastApiModal,
  onSearchClick,
  isFastApiConnected,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] =
    useState<Dropdown>(null);

  const recommendationActive =
    currentTab === "content-based" ||
    currentTab === "collaborative";

  const moreActive =
    currentTab === "dashboard" || currentTab === "ab-lab";

  const navigate = (tab: NavTab) => {
    onTabChange(tab);
    setMobileOpen(false);
    setOpenDropdown(null);
  };

  const selectUser = (id: number) => {
    const user = availableUsers.find(
      (item) => item.userId === id
    );

    if (user) onSelectUser(user);
  };

  const navClass = (active: boolean) =>
    `rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${
      active
        ? "bg-[#E8BF82]/12 text-[#E8BF82]"
        : "text-[#B8B0A6] hover:bg-white/5 hover:text-white"
    }`;

  const toggleDropdown = (dropdown: Dropdown) => {
    setOpenDropdown((current) =>
      current === dropdown ? null : dropdown
    );
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#090909]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-8">
        {/* BRAND */}
        <button
          type="button"
          onClick={() => navigate("home")}
          aria-label="CineMatch - Trang chủ"
          className="group flex shrink-0 items-center gap-2.5"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E8BF82]/25 bg-[#201A14] text-[#E8BF82] transition group-hover:border-[#E8BF82]">
            <Clapperboard className="h-5 w-5" />
          </span>

          <span className="whitespace-nowrap text-lg font-extrabold tracking-tight text-white">
            Cine<span className="text-[#E8BF82]">Match</span>
          </span>
        </button>

        {/* DESKTOP NAV */}
        <nav
          aria-label="Điều hướng chính"
          className="hidden items-center gap-1 lg:flex"
        >
          <button
            type="button"
            onClick={() => navigate("home")}
            className={navClass(currentTab === "home")}
          >
            Trang chủ
          </button>

          <button
            type="button"
            onClick={() => navigate("explore")}
            className={navClass(currentTab === "explore")}
          >
            Khám phá
          </button>

          {/* RECOMMENDATIONS */}
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                toggleDropdown("recommendations")
              }
              aria-expanded={
                openDropdown === "recommendations"
              }
              aria-haspopup="menu"
              className={`${navClass(
                recommendationActive
              )} flex items-center gap-1.5`}
            >
              Dành cho bạn
              <ChevronDown className="h-3.5 w-3.5" />
            </button>

            {openDropdown === "recommendations" && (
              <div
                role="menu"
                className="absolute left-0 top-full z-50 mt-3 w-[290px] rounded-2xl border border-white/10 bg-[#171512] p-2 shadow-2xl shadow-black/60"
              >
                {recommendations.map((item) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      onClick={() => navigate(item.id)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-white/5"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E8BF82]/10 text-[#E8BF82]">
                        <Icon className="h-4 w-4" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-white">
                          {item.label}
                        </span>

                        <span className="mt-1 block text-xs text-[#9F9588]">
                          {item.description}
                        </span>
                      </span>

                      {currentTab === item.id && (
                        <Check className="h-4 w-4 text-[#E8BF82]" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate("rate")}
            className={navClass(currentTab === "rate")}
          >
            Đánh giá
          </button>

          {/* MORE */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleDropdown("more")}
              aria-expanded={openDropdown === "more"}
              aria-haspopup="menu"
              className={`${navClass(
                moreActive
              )} flex items-center gap-1.5`}
            >
              Thêm
              <ChevronDown className="h-3.5 w-3.5" />
            </button>

            {openDropdown === "more" && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-3 w-[230px] rounded-2xl border border-white/10 bg-[#171512] p-2 shadow-2xl shadow-black/60"
              >
                {moreItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      onClick={() => navigate(item.id)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-[#EAE3DA] transition hover:bg-white/5"
                    >
                      <Icon className="h-4 w-4 text-[#E8BF82]" />
                      {item.label}
                    </button>
                  );
                })}

                <div className="my-2 border-t border-white/10" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpenDropdown(null);
                    onOpenFastApiModal();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-[#EAE3DA] transition hover:bg-white/5"
                >
                  <CircleHelp className="h-4 w-4 text-[#E8BF82]" />
                  Trợ giúp kết nối
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* ACTIONS */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onSearchClick}
            title="Tìm kiếm phim"
            aria-label="Tìm kiếm phim"
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#D5CDC2] transition hover:bg-white/10 hover:text-white"
          >
            <Search className="h-5 w-5" />
          </button>

          {/* USER SELECTOR */}
          <div className="relative hidden xl:block">
            <Sparkles className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#E8BF82]" />

            <select
              value={currentUser.userId}
              onChange={(event) =>
                selectUser(Number(event.target.value))
              }
              aria-label="Chọn hồ sơ xem phim"
              className="max-w-[155px] cursor-pointer appearance-none rounded-full border border-white/10 bg-[#1B1815] py-2.5 pl-9 pr-8 text-xs font-medium text-white outline-none hover:border-[#E8BF82]/40"
            >
              {availableUsers.map((user) => (
                <option key={user.userId} value={user.userId}>
                  Hồ sơ #{user.userId}
                </option>
              ))}
            </select>

            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#B8B0A6]" />
          </div>

          {/* CONNECTION INDICATOR */}
          <button
            type="button"
            onClick={onOpenFastApiModal}
            aria-label={
              isFastApiConnected
                ? "Kết nối đang hoạt động"
                : "Kiểm tra kết nối"
            }
            title={
              isFastApiConnected
                ? "Đã kết nối"
                : "Chưa kết nối"
            }
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isFastApiConnected
                  ? "bg-emerald-400"
                  : "bg-amber-400"
              }`}
            />
          </button>

          {/* MOBILE MENU */}
          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            aria-label={mobileOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={mobileOpen}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white lg:hidden"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* MOBILE NAV */}
      {mobileOpen && (
        <div className="border-t border-white/10 bg-[#101010] px-4 py-5 lg:hidden">
          <nav className="mx-auto grid max-w-[1440px] grid-cols-2 gap-2">
            {[
              { id: "home" as NavTab, label: "Trang chủ" },
              { id: "explore" as NavTab, label: "Khám phá" },
              ...recommendations.map((item) => ({
                id: item.id,
                label: item.label,
              })),
              { id: "rate" as NavTab, label: "Đánh giá" },
              ...moreItems.map((item) => ({
                id: item.id,
                label: item.label,
              })),
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                  currentTab === item.id
                    ? "border-[#E8BF82]/40 bg-[#E8BF82]/10 text-[#E8BF82]"
                    : "border-white/10 bg-white/[0.03] text-[#D5CDC2]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mx-auto mt-4 max-w-[1440px] border-t border-white/10 pt-4 xl:hidden">
            <label
              htmlFor="mobile-user-select"
              className="mb-2 block text-xs text-[#A99E90]"
            >
              Chọn hồ sơ
            </label>

            <select
              id="mobile-user-select"
              value={currentUser.userId}
              onChange={(event) =>
                selectUser(Number(event.target.value))
              }
              className="w-full rounded-xl border border-white/10 bg-[#201C18] p-3 text-sm text-white"
            >
              {availableUsers.map((user) => (
                <option key={user.userId} value={user.userId}>
                  Hồ sơ #{user.userId}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </header>
  );
};
