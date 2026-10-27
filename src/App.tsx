
import { useEffect, useState } from "react";

import { cineMatchApi } from "./services/api";
import { adaptApiMovie } from "./services/movieAdapter";
import { fetchFeaturedMovies } from "./services/featuredApi";

import { Navbar } from "./components/layout/Navbar";
import type { NavTab } from "./components/layout/Navbar";
import { Footer } from "./components/layout/Footer";

import { HomeView } from "./components/home/HomeView";
import { ExploreView } from "./components/explore/ExploreView";
import { ContentBasedView } from "./components/contentBased/ContentBasedView";
import { CollaborativeView } from "./components/collaborative/CollaborativeView";
import { RateMoviesView } from "./components/rating/RateMoviesView";
import { MLDashboardView } from "./components/dashboard/MLDashboardView";
import { ABLabView } from "./components/mlLab/ABLabView";

import { MovieModal } from "./components/common/MovieModal";
import { FastApiModal } from "./components/fastapi/FastApiModal";

import { MOCK_MOVIES } from "./data/mockMovies";
import {
  MOCK_USERS,
  CURRENT_LOCAL_USER,
} from "./data/mockUsers";

import type { Movie, UserProfile } from "./types";

export default function App() {
  // ========================================================
  // 1. TRANG VA DU LIEU
  // ========================================================

  const [currentTab, setCurrentTab] =
    useState<NavTab>("home");

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

  const [availableUsers, setAvailableUsers] =
    useState<UserProfile[]>([
      CURRENT_LOCAL_USER,
      ...MOCK_USERS,
    ]);

  const [currentUser, setCurrentUser] =
    useState<UserProfile>(CURRENT_LOCAL_USER);

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

  const [bookmarkedMovieIds, setBookmarkedMovieIds] =
    useState<Set<number>>(
      new Set([79132, 2571])
    );

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
  // 9. CHON USER
  // ========================================================

  const handleSelectUser = (user: UserProfile) => {
    setCurrentUser(user);
  };

  // ========================================================
  // 10. DANH GIA PHIM
  // ========================================================

  const handleRateMovie = (
    movieId: number,
    rating: number
  ) => {
    const updatedRatings = {
      ...currentUser.ratings,
      [movieId]: rating,
    };

    const values = Object.values(updatedRatings);

    const average =
      values.length > 0
        ? values.reduce((sum, value) => sum + value, 0) /
          values.length
        : 0;

    const updatedUser: UserProfile = {
      ...currentUser,
      ratings: updatedRatings,
      avgRating: Math.round(average * 100) / 100,
    };

    setCurrentUser(updatedUser);

    setAvailableUsers((previous) =>
      previous.map((user) =>
        user.userId === updatedUser.userId
          ? updatedUser
          : user
      )
    );
  };

  // ========================================================
  // 11. XOA DANH GIA
  // ========================================================

  const handleRemoveRating = (movieId: number) => {
    const updatedRatings = {
      ...currentUser.ratings,
    };

    delete updatedRatings[movieId];

    const values = Object.values(updatedRatings);

    const average =
      values.length > 0
        ? values.reduce((sum, value) => sum + value, 0) /
          values.length
        : 3.5;

    const updatedUser: UserProfile = {
      ...currentUser,
      ratings: updatedRatings,
      avgRating: Math.round(average * 100) / 100,
    };

    setCurrentUser(updatedUser);

    setAvailableUsers((previous) =>
      previous.map((user) =>
        user.userId === updatedUser.userId
          ? updatedUser
          : user
      )
    );
  };

  // ========================================================
  // 12. RESET DANH GIA
  // ========================================================

  const handleResetRatings = () => {
    const original =
      MOCK_USERS.find(
        (user) => user.userId === currentUser.userId
      ) || CURRENT_LOCAL_USER;

    const resetUser: UserProfile = {
      ...original,
      ratings: { ...original.ratings },
    };

    setCurrentUser(resetUser);

    setAvailableUsers((previous) =>
      previous.map((user) =>
        user.userId === resetUser.userId
          ? resetUser
          : user
      )
    );
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
    <div className="flex min-h-screen flex-col bg-[#050A13] font-sans text-[#F5F7FB] selection:bg-cyan-400/20 selection:text-cyan-100">
      <Navbar
        currentTab={currentTab}
        onTabChange={navigateToTab}
        currentUser={currentUser}
        availableUsers={availableUsers}
        onSelectUser={handleSelectUser}
        onOpenFastApiModal={() =>
          setIsFastApiModalOpen(true)
        }
        onSearchClick={() =>
          navigateToTab("explore")
        }
        isFastApiConnected={isFastApiConnected}
      />

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

      {moviesLoadedFromApi &&
        !moviesLoading &&
        currentTab !== "home" && (
          <div className="border-b border-emerald-400/10 bg-emerald-400/5 px-6 py-2 text-center text-xs text-emerald-300">
            Đã tải{" "}
            {allMovies.length.toLocaleString("vi-VN")}{" "}
            phim MovieLens.
          </div>
        )}

      <main className="flex-1">
        {currentTab === "home" && (
          <HomeView
            currentUser={currentUser}
            allUsers={availableUsers}
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
            availableUsers={availableUsers}
            onSelectUser={handleSelectUser}
            allMovies={allMovies}
            onSelectMovie={handleSelectMovie}
            bookmarkedMovieIds={bookmarkedMovieIds}
            onToggleBookmark={handleToggleBookmark}
          />
        )}

        {currentTab === "collaborative" && (
          <CollaborativeView
            currentUser={currentUser}
            availableUsers={availableUsers}
            onSelectUser={handleSelectUser}
            allMovies={allMovies}
            onSelectMovie={handleSelectMovie}
            bookmarkedMovieIds={bookmarkedMovieIds}
            onToggleBookmark={handleToggleBookmark}
          />
        )}

        {currentTab === "rate" && (
          <RateMoviesView
            currentUser={currentUser}
            allMovies={allMovies}
            onRateMovie={handleRateMovie}
            onRemoveRating={handleRemoveRating}
            onResetRatings={handleResetRatings}
            onSelectMovie={handleSelectMovie}
          />
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
        onRateMovie={handleRateMovie}
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
