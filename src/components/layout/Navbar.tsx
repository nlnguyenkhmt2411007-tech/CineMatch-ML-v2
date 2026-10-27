import React, { useState } from "react";
import {
  Clapperboard,
  Search,
  Menu,
  X,
  Terminal,
  ChevronDown,
  Sparkles,
  BrainCircuit,
  Users,
  Check,
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

const mainItems: { id: NavTab; label: string }[] = [
  { id: "home", label: "Trang chủ" },
  { id: "explore", label: "Khám phá" },
  { id: "rate", label: "Đánh giá" },
  { id: "dashboard", label: "ML Lab" },
  { id: "ab-lab", label: "Thực nghiệm A/B" },
];

const recommendationItems: {
  id: NavTab;
  label: string;
  description: string;
  icon: typeof BrainCircuit;
}[] = [
  {
    id: "content-based",
    label: "Theo nội dung",
    description: "Gợi ý dựa trên thể loại yêu thích",
    icon: BrainCircuit,
  },
  {
    id: "collaborative",
    label: "Theo người tương đồng",
    description: "Gợi ý dựa trên người dùng giống bạn",
    icon: Users,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [recommendationMenuOpen, setRecommendationMenuOpen] =
    useState(false);

  const recommendationActive =
    currentTab === "content-based" ||
    currentTab === "collaborative";

  const handleNavigate = (tab: NavTab) => {
    onTabChange(tab);
    setMobileMenuOpen(false);
    setRecommendationMenuOpen(false);
  };

  const handleSelectUser = (id: number) => {
    const user = availableUsers.find(
      (item) => item.userId === id
    );

    if (user) {
      onSelectUser(user);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-cyan-400/15 bg-[#060B15]/95 shadow-[0_8px_35px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6">
        {/* LOGO */}
        <button
          type="button"
          onClick={() => handleNavigate("home")}
          className="group flex shrink-0 items-center gap-3 text-left"
          aria-label="CineMatch ML - Trang chủ"
        >
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/30 bg-gradient-to-br from-[#164C68] via-[#1C2454] to-[#51295C] shadow-[0_0_24px_rgba(34,211,238,0.12)] transition-transform group-hover:scale-105">
            <Clapperboard className="h-5 w-5 text-cyan-200" />
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#060B15] bg-[#F5BD66]" />
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="whitespace-nowrap font-display text-base font-extrabold tracking-tight text-white sm:text-lg">
              CineMatch{" "}
              <span className="bg-gradient-to-r from-cyan-300 to-sky-400 bg-clip-text text-transparent">
                ML
              </span>
            </span>
            <span className="hidden whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-300/65 sm:block">
              Neon Glass Cinema
            </span>
          </div>
        </button>

        {/* DESKTOP NAVIGATION */}
        <nav
          aria-label="Điều hướng chính"
          className="hidden items-center gap-1 lg:flex"
        >
          {mainItems.slice(0, 2).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
              className={`rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${
                currentTab === item.id
                  ? "bg-cyan-400/10 text-cyan-200"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}

          {/* RECOMMENDATION DROPDOWN */}
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setRecommendationMenuOpen((value) => !value)
              }
              aria-expanded={recommendationMenuOpen}
              aria-haspopup="menu"
              className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${
                recommendationActive
                  ? "bg-cyan-400/10 text-cyan-200"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Sparkles className="h-4 w-4" />
              Gợi ý
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${
                  recommendationMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {recommendationMenuOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full z-50 mt-3 w-[290px] rounded-2xl border border-cyan-300/15 bg-[#0D1728] p-2 shadow-2xl shadow-black/50"
              >
                <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  Chọn phương pháp gợi ý
                </p>

                {recommendationItems.map((item) => {
                  const Icon = item.icon;
                  const active = currentTab === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      onClick={() => handleNavigate(item.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                        active
                          ? "bg-cyan-400/10"
                          : "hover:bg-white/5"
                      }`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-200">
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white">
                          {item.label}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {item.description}
                        </p>
                      </div>

                      {active && (
                        <Check className="h-4 w-4 text-cyan-300" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {mainItems.slice(2).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
              className={`rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors ${
                currentTab === item.id
                  ? "bg-cyan-400/10 text-cyan-200"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* ACTIONS */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onSearchClick}
            title="Tìm kiếm phim"
            aria-label="Tìm kiếm phim"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/15 bg-white/[0.04] text-slate-300 transition-colors hover:border-cyan-300/40 hover:text-cyan-200"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* USER SELECTOR */}
          <div className="relative hidden xl:flex xl:items-center">
            <div className="pointer-events-none absolute left-3 flex h-7 w-7 items-center justify-center rounded-full border border-cyan-300/20 bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
              <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
            </div>

            <select
              value={currentUser.userId}
              onChange={(event) =>
                handleSelectUser(Number(event.target.value))
              }
              aria-label="Chọn người dùng thử nghiệm"
              title="Chọn người dùng thử nghiệm"
              className="max-w-[155px] cursor-pointer appearance-none rounded-xl border border-cyan-300/15 bg-[#111A2A] py-3 pl-11 pr-7 text-[11px] font-semibold text-white outline-none transition-colors hover:border-cyan-300/30 focus:border-cyan-300/50"
            >
              {availableUsers.map((user) => (
                <option key={user.userId} value={user.userId}>
                  User #{user.userId}
                </option>
              ))}
            </select>

            <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400" />
          </div>

          {/* FASTAPI STATUS */}
          <button
            type="button"
            onClick={onOpenFastApiModal}
            title="Trạng thái kết nối FastAPI"
            aria-label="Kiểm tra kết nối FastAPI"
            className={`flex h-10 items-center gap-2 rounded-xl border px-3 font-mono text-[11px] transition-all ${
              isFastApiConnected
                ? "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-300"
                : "border-amber-400/20 bg-amber-400/[0.05] text-amber-300"
            }`}
          >
            <Terminal className="h-4 w-4" />

            <span className="hidden 2xl:inline">
              FastAPI: {isFastApiConnected ? "Live" : "Offline"}
            </span>

            <span
              className={`h-2 w-2 rounded-full ${
                isFastApiConnected
                  ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]"
                  : "bg-amber-400"
              }`}
            />
          </button>

          {/* MOBILE / TABLET MENU */}
          <button
            type="button"
            onClick={() =>
              setMobileMenuOpen((value) => !value)
            }
            aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={mobileMenuOpen}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/15 bg-white/[0.04] text-slate-300 lg:hidden"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* MOBILE NAVIGATION */}
      {mobileMenuOpen && (
        <div className="border-t border-cyan-300/10 bg-[#08111E] px-4 py-5 lg:hidden">
          <nav className="mx-auto grid max-w-[1440px] grid-cols-2 gap-2 sm:grid-cols-3">
            {mainItems.slice(0, 2).map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`rounded-xl border px-4 py-3 text-left text-sm font-medium ${
                  currentTab === item.id
                    ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-200"
                    : "border-white/[0.06] bg-white/[0.03] text-slate-300"
                }`}
              >
                {item.label}
              </button>
            ))}

            {recommendationItems.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`rounded-xl border px-4 py-3 text-left text-sm font-medium ${
                  currentTab === item.id
                    ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-200"
                    : "border-white/[0.06] bg-white/[0.03] text-slate-300"
                }`}
              >
                {item.label}
              </button>
            ))}

            {mainItems.slice(2).map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`rounded-xl border px-4 py-3 text-left text-sm font-medium ${
                  currentTab === item.id
                    ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-200"
                    : "border-white/[0.06] bg-white/[0.03] text-slate-300"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mx-auto mt-4 max-w-[1440px] border-t border-white/[0.06] pt-4 xl:hidden">
            <label
              htmlFor="mobile-user-select"
              className="mb-2 block text-xs text-slate-400"
            >
              Người dùng thử nghiệm
            </label>

            <select
              id="mobile-user-select"
              value={currentUser.userId}
              onChange={(event) =>
                handleSelectUser(Number(event.target.value))
              }
              className="w-full rounded-xl border border-cyan-300/15 bg-[#111A2A] p-3 text-sm text-white"
            >
              {availableUsers.map((user) => (
                <option key={user.userId} value={user.userId}>
                  User #{user.userId} — {user.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </header>
  );
};
