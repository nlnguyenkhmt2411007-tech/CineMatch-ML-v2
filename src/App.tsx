
import { useEffect, useState } from "react";
import "./styles/cinematch-film-ui.css";
import "./styles/cinematch-v4.css";

import { cineMatchApi } from "./services/api";
import { adaptApiMovie } from "./services/movieAdapter";
import { fetchFeaturedMovies } from "./services/featuredApi";

import { Camera } from "lucide-react";
import { Navbar } from "./components/layout/Navbar";
import { MovieLensRatingLibrary } from "./components/history/MovieLensRatingLibrary";
import { MovieLensPracticeRatingView } from "./components/rating/MovieLensPracticeRatingView";
import { CinemaProfileView } from "./components/profile/CinemaProfileView";
import { MethodLabView } from "./components/methods/MethodLabView";
import { AuthGate, useCineMatchAccount } from "./components/auth/AuthGate";
import { PersonalRecommendations } from "./components/auth/PersonalRecommendations";
import { MovieLensPersonal } from "./components/auth/MovieLensPersonal";
import { KnnUnlockProgress } from "./components/auth/KnnUnlockProgress";
import type { NavTab } from "./components/layout/Navbar";
import { Footer } from "./components/layout/Footer";
import { CinematicIntro } from "./components/intro/CinematicIntro";

import { HomeView } from "./components/home/HomeView";
import { ExploreView } from "./components/explore/ExploreView";
import { CinemaContentView as ContentBasedView } from "./components/cinema/CinemaContentView";
import { CinemaKnnView as CollaborativeView } from "./components/cinema/CinemaKnnView";
import { RateMoviesView } from "./components/rating/RateMoviesView";
import { MLDashboardView } from "./components/dashboard/MLDashboardView";
import { ABLabView } from "./components/mlLab/ABLabView";

import { MovieModal } from "./components/common/MovieModal";
import { FastApiModal } from "./components/fastapi/FastApiModal";

import { MOCK_MOVIES } from "./data/mockMovies";


import type { Movie, UserProfile } from "./types";

function CineMatchApp() {
  const [showCinematicIntro, setShowCinematicIntro] = useState(
    () => {
      try {
        return sessionStorage.getItem("cinematch_intro_seen") !== "1";
      } catch {
        return true;
      }
    }
  );

  const completeCinematicIntro = () => {
    try {
      sessionStorage.setItem("cinematch_intro_seen", "1");
    } catch {
      // Storage may be unavailable.
    }
    setShowCinematicIntro(false);
  };
  // ========================================================
  // 1. TRANG VA DU LIEU
  // ========================================================

  const [currentTab, setCurrentTab] =
    useState<NavTab>("personal");

  const [allMovies, setAllMovies] =
    useState<Movie[]>(MOCK_MOVIES);

  const [featuredMovies, setFeaturedMovies] =
    useState<Movie[]>([]);

  const [moviesLoading, setMoviesLoading] =
    useState(false);

  const [moviesError, setMoviesError] =
    useState<string | null>(null);

  const [moviesLoadedFromApi, setMoviesLoadedFromApi] =
    useState(false);

  const [catalogRequested, setCatalogRequested] =
    useState(false);

  // ========================================================
  // 2. USER
  // ========================================================

  const { account, avatarUrl, openAccountSwitcher, rateMovie, removeRating, resetRatings, logout, editGenres } =
    useCineMatchAccount();

  const [accountActionError, setAccountActionError] = useState<string | null>(null);

  const currentUser: UserProfile = {
    userId: account.userId,
    name: account.name,
    avatar: avatarUrl || "",
    bio: account.accountType === "movielens" ? `MovieLens User ${account.movieLensUserId}` : "Tài khoản CineMatch",
    preferredGenres: account.preferredGenres,
    ratings: account.ratings,
    avgRating: account.avgRating,
  };

  // ========================================================
  // 3. MODAL VA FASTAPI
  // ========================================================

  const [selectedMovie, setSelectedMovie] =
    useState<Movie | null>(null);

  const [isFastApiModalOpen, setIsFastApiModalOpen] =
    useState(false);

  const [isFastApiConnected, setIsFastApiConnected] =
    useState(false);

  // ========================================================
  // 4. BOOKMARK
  // ========================================================

  const bookmarkKey = `cinematch_bookmarks_v2_${account.accountType === "movielens" ? "ml" : "personal"}_${account.accountId}`;
  const [bookmarkedMovieIds, setBookmarkedMovieIds] = useState<Set<number>>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(bookmarkKey) || "[]");
      return new Set(Array.isArray(saved) ? saved.filter((v): v is number => Number.isSafeInteger(v)) : []);
    } catch { return new Set<number>(); }
  });
  useEffect(() => {
    try { localStorage.setItem(bookmarkKey, JSON.stringify([...bookmarkedMovieIds])); }
    catch { /* Browser storage may be unavailable. */ }
  }, [bookmarkKey, bookmarkedMovieIds]);

  // ========================================================
  // 5. FASTAPI HEALTH CHECK
  // ========================================================

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        const result = await cineMatchApi.health();

        if (!cancelled) {
          setIsFastApiConnected(result.status === "ok");
        }
      } catch {
        if (!cancelled) {
          setIsFastApiConnected(false);
        }
      }
    }

    void checkHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  // ========================================================
  // 6. TAI 12 PHIM TMDB KHI MO TRANG CHU
  // ========================================================

  useEffect(() => {
    let cancelled = false;

    async function loadFeatured() {
      try {
        const movies = await fetchFeaturedMovies(12);

        if (cancelled) return;

        setFeaturedMovies(movies);
        setIsFastApiConnected(true);

        // Chi hien thi 12 phim that luc ban dau.
        // Neu danh muc day du chua duoc tai,
        // khong yeu cau them 98 trang MovieLens.
        setAllMovies((previous) => {
          const map = new Map<number, Movie>();

          for (const movie of movies) {
            map.set(movie.movieId, movie);
          }

          for (const movie of previous) {
            if (!map.has(movie.movieId)) {
              map.set(movie.movieId, movie);
            }
          }

          return [...map.values()];
        });
      } catch (error) {
        console.error(
          "Cannot load TMDb featured movies:",
          error
        );
      }
    }

    void loadFeatured();

    return () => {
      cancelled = true;
    };
  }, []);

  // ========================================================
  // 7. CHI TAI TOAN BO MOVIELENS KHI CAN
  // ========================================================

  useEffect(() => {
    // Home va Explore deu tai phim theo API rieng.
    // Khong tai toan bo 9742 phim o hai trang nay.
    if (
      currentTab === "home" ||
      currentTab === "personal" ||
      currentTab === "methods" ||
      currentTab === "explore" ||
      currentTab === "dashboard"
    ) {
      return;
    }

    if (catalogRequested) return;

    setCatalogRequested(true);
  }, [currentTab, catalogRequested]);

  useEffect(() => {
    if (!catalogRequested) return;

    let cancelled = false;

    async function loadCatalog() {
      try {
        setMoviesLoading(true);
        setMoviesError(null);

        const pageSize = 100;

        const firstResponse =
          await cineMatchApi.getMovies(1, pageSize);

        const totalPages = Math.ceil(
          firstResponse.total / pageSize
        );

        const collected = [
          ...firstResponse.items
        ];

        const batchSize = 5;

        for (
          let startPage = 2;
          startPage <= totalPages;
          startPage += batchSize
        ) {
          if (cancelled) return;

          const pages: number[] = [];

          for (
            let page = startPage;
            page <= Math.min(
              startPage + batchSize - 1,
              totalPages
            );
            page++
          ) {
            pages.push(page);
          }

          const responses = await Promise.all(
            pages.map((page) =>
              cineMatchApi.getMovies(page, pageSize)
            )
          );

          if (cancelled) return;

          for (const response of responses) {
            collected.push(...response.items);
          }
        }

        if (cancelled) return;

        const converted = collected.map(adaptApiMovie);

        // Uu tien metadata anh TMDb cho 12 phim
        // da duoc tai tu API featured.
        const featuredMap = new Map(
          featuredMovies.map((movie) => [
            movie.movieId,
            movie,
          ])
        );

        const mergedMovies = converted.map(
          (movie) => {
            const featured =
              featuredMap.get(movie.movieId);

            return featured
              ? { ...movie, ...featured }
              : movie;
          }
        );

        setAllMovies(mergedMovies);
        setMoviesLoadedFromApi(true);
        setIsFastApiConnected(true);
      } catch (error) {
        console.error(
          "Cannot load full MovieLens catalog:",
          error
        );

        if (!cancelled) {
          setMoviesError(
            "Không tải được toàn bộ MovieLens. Một số phim có thể chưa xuất hiện."
          );
        }
      } finally {
        if (!cancelled) {
          setMoviesLoading(false);
        }
      }
    }

    void loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [catalogRequested, featuredMovies]);

  // ========================================================
  // 8. CHUYEN TRANG
  // ========================================================

  const navigateToTab = (tab: NavTab) => {
    setCurrentTab(tab);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ========================================================
  // 10-12. RATING THUC - LUU TREN BACKEND TAI KHOAN
  // ========================================================

  const handleRateMovie = (movieId: number, rating: number) => {
    void rateMovie(movieId, rating)
      .then(() => setAccountActionError(null))
      .catch((error: unknown) => setAccountActionError(
        error instanceof Error ? error.message : "Không lưu được đánh giá."
      ));
  };

  const handleRemoveRating = (movieId: number) => {
    void removeRating(movieId)
      .then(() => setAccountActionError(null))
      .catch((error: unknown) => setAccountActionError(
        error instanceof Error ? error.message : "Không xóa được đánh giá."
      ));
  };

  const handleResetRatings = () => {
    void resetRatings()
      .then(() => setAccountActionError(null))
      .catch((error: unknown) => setAccountActionError(
        error instanceof Error ? error.message : "Không đặt lại được đánh giá."
      ));
  };

  // Rating Studio awaits these requests to show an accurate save state.
  // The original non-blocking handlers above remain for other views.
  const handleRateMovieConfirmed = async (movieId: number, rating: number): Promise<void> => {
    try {
      await rateMovie(movieId, rating);
      setAccountActionError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không lưu được đánh giá.";
      setAccountActionError(message);
      throw new Error(message);
    }
  };

  const handleRemoveRatingConfirmed = async (movieId: number): Promise<void> => {
    try {
      await removeRating(movieId);
      setAccountActionError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không xóa được đánh giá.";
      setAccountActionError(message);
      throw new Error(message);
    }
  };

  const handleResetRatingsConfirmed = async (): Promise<void> => {
    try {
      await resetRatings();
      setAccountActionError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không đặt lại được đánh giá.";
      setAccountActionError(message);
      throw new Error(message);
    }
  };

  // ========================================================
  // 13. BOOKMARK
  // ========================================================

  const handleToggleBookmark = (movieId: number) => {
    setBookmarkedMovieIds((previous) => {
      const next = new Set(previous);

      if (next.has(movieId)) {
        next.delete(movieId);
      } else {
        next.add(movieId);
      }

      return next;
    });
  };

  // ========================================================
  // 14. CHON PHIM CO POSTER
  // ========================================================

  const handleSelectMovie = (movie: Movie) => {
    const enriched =
      featuredMovies.find(
        (item) => item.movieId === movie.movieId
      ) || movie;

    setSelectedMovie(enriched);
  };

  // ========================================================
  // 15. GIAO DIEN
  // ========================================================

  return (
    <div className="cm-film-app cmv4-film flex min-h-screen flex-col bg-[#090A0E] font-sans text-[#F5F2EA] selection:bg-[#E8BF82]/20 selection:text-white">
      {showCinematicIntro && (
        <CinematicIntro onComplete={completeCinematicIntro} />
      )}

      <Navbar
        currentTab={currentTab}
        onTabChange={navigateToTab}
        currentUser={currentUser}
        availableUsers={[currentUser]}
        onSelectUser={() => openAccountSwitcher()}
        accountName={account.name}
        avatarUrl={avatarUrl}
        onOpenAccountSwitcher={openAccountSwitcher}
        onLogout={() => void logout()}
        onEditGenres={editGenres}
        onOpenFastApiModal={() =>
          setIsFastApiModalOpen(true)
        }
        onSearchClick={() =>
          navigateToTab("explore")
        }
        isFastApiConnected={isFastApiConnected}
      />

      {accountActionError && (
        <div role="alert" className="border-b border-rose-400/20 bg-rose-400/10 px-6 py-3 text-center text-sm text-rose-200">
          {accountActionError}
        </div>
      )}

      {moviesLoading && (
        <div className="border-b border-cyan-400/15 bg-cyan-400/5 px-6 py-2 text-center text-xs text-cyan-200">
          Đang tải thư viện MovieLens cho trang này...
        </div>
      )}

      {moviesError && (
        <div className="border-b border-amber-400/20 bg-amber-400/5 px-6 py-3 text-center text-xs text-amber-300">
          {moviesError}
        </div>
      )}



      <main className="flex-1">
        {currentTab === "methods" && <MethodLabView />}
        {currentTab === "personal" && (
          account.accountType === "movielens" ?
            <MovieLensPersonal account={account} onSelectMovie={handleSelectMovie} /> :
            <>
              <PersonalRecommendations
                account={account}
                onSelectMovie={handleSelectMovie}
                onExplore={() => navigateToTab("explore")}
                onRate={() => navigateToTab("rate")}
                onEditGenres={editGenres}
              />
              <div className="mx-auto max-w-[1320px] px-5 pb-10 sm:px-9"><KnnUnlockProgress account={account} onRate={() => navigateToTab("rate")}/></div>
            </>
        )}


        {currentTab === "home" && (
          <HomeView
            currentUser={currentUser}
            allUsers={[currentUser]}
            allMovies={allMovies}
            onSelectMovie={handleSelectMovie}
            onNavigateTab={navigateToTab}
            onOpenFastApiModal={() =>
              setIsFastApiModalOpen(true)
            }
            bookmarkedMovieIds={bookmarkedMovieIds}
            onToggleBookmark={handleToggleBookmark}
          />
        )}

        {currentTab === "explore" && (
          <ExploreView
            allMovies={allMovies}
            onSelectMovie={handleSelectMovie}
            bookmarkedMovieIds={bookmarkedMovieIds}
            onToggleBookmark={handleToggleBookmark}
            userRatings={currentUser.ratings}
          />
        )}

        {currentTab === "content-based" && (
          <ContentBasedView
            currentUser={currentUser}
            availableUsers={[currentUser]}
            onSelectUser={() => openAccountSwitcher()}
            allMovies={allMovies}
            onSelectMovie={handleSelectMovie}
            bookmarkedMovieIds={bookmarkedMovieIds}
            onToggleBookmark={handleToggleBookmark}
          />
        )}

        {currentTab === "collaborative" && (
          <CollaborativeView
            onRate={() => navigateToTab("rate")}
            currentUser={currentUser}
            availableUsers={[currentUser]}
            onSelectUser={() => openAccountSwitcher()}
            allMovies={allMovies}
            onSelectMovie={handleSelectMovie}
            bookmarkedMovieIds={bookmarkedMovieIds}
            onToggleBookmark={handleToggleBookmark}
          />
        )}

        {currentTab === "history" && (
          <MovieLensRatingLibrary
            account={account}
            allMovies={allMovies}
            onSelectMovie={handleSelectMovie}
            onNavigateRecommendations={() => navigateToTab("personal")}
          />
        )}

        {currentTab === "profile" && (
          <>
            <div className="mx-auto flex w-full max-w-[1320px] justify-end px-5 pt-6 sm:px-9">
              <button
                type="button"
                onClick={openAccountSwitcher}
                aria-label="Đổi ảnh đại diện"
                className="inline-flex items-center gap-2 rounded-xl border border-[#E8BF82]/40 bg-[#E8BF82]/10 px-4 py-2.5 text-sm font-semibold text-[#E8BF82] transition hover:border-[#E8BF82]/70 hover:bg-[#E8BF82]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8BF82]"
              >
                <Camera size={18} aria-hidden="true" />
                Đổi ảnh đại diện
              </button>
            </div>
            <CinemaProfileView
              account={account}
              avatarUrl={avatarUrl}
              onNavigate={navigateToTab}
              onOpenAccountSwitcher={openAccountSwitcher}
              onEditGenres={editGenres}
              onLogout={() => void logout()}
            />
          </>
        )}

        {currentTab === "rate" && account.accountType === "movielens" && (
          <MovieLensPracticeRatingView
            currentUser={currentUser}
            allMovies={allMovies}
            onSelectMovie={handleSelectMovie}
            onViewHistory={() => navigateToTab("history")}
          />
        )}
        {currentTab === "rate" && account.accountType !== "movielens" && (
          <>
          <div className="mx-auto max-w-[1320px] px-5 pt-6 sm:px-9"><KnnUnlockProgress account={account} onRate={() => {document.querySelector<HTMLElement>("#cm-rating-studio")?.scrollIntoView({behavior:"smooth"});}} compact/></div>
          <RateMoviesView
            currentUser={currentUser}
            allMovies={allMovies}
            onRateMovie={handleRateMovieConfirmed}
            onRemoveRating={handleRemoveRatingConfirmed}
            onResetRatings={handleResetRatingsConfirmed}
            onSelectMovie={handleSelectMovie}
          />
          </>
        )}

        {currentTab === "dashboard" && (
          <MLDashboardView />
        )}

        {currentTab === "ab-lab" && (
          <ABLabView />
        )}
      </main>

      <Footer
        onOpenFastApiModal={() =>
          setIsFastApiModalOpen(true)
        }
        onNavigateTab={navigateToTab}
      />

      <MovieModal
        movie={selectedMovie}
        onClose={() => setSelectedMovie(null)}
        onSelectMovie={handleSelectMovie}
        allMovies={allMovies}
        userRating={
          selectedMovie
            ? currentUser.ratings[selectedMovie.movieId]
            : undefined
        }
        onRateMovie={(movieId, rating) => {
          if (account.accountType === "movielens") {
            setAccountActionError(
              "Hồ sơ MovieLens chỉ đọc. Hãy chấm thử tại trang Đánh giá hoặc chuyển sang tài khoản CineMatch riêng."
            );
            return;
          }
          handleRateMovie(movieId, rating);
        }}
        isBookmarked={
          selectedMovie
            ? bookmarkedMovieIds.has(
                selectedMovie.movieId
              )
            : false
        }
        onToggleBookmark={() => {
          if (selectedMovie) {
            handleToggleBookmark(selectedMovie.movieId);
          }
        }}
      />

      <FastApiModal
        isOpen={isFastApiModalOpen}
        onClose={() =>
          setIsFastApiModalOpen(false)
        }
        onConnectionChange={setIsFastApiConnected}
      />
    </div>
  );
}


// A separate authenticated gate keeps credentials out of MovieLens demo state.
export default function App() {
  return <AuthGate><CineMatchApp /></AuthGate>;
}
