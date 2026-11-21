import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Film, LoaderCircle, Search } from "lucide-react";
import { cineMatchApi } from "../../services/api";
import type { Movie } from "../../types";

export interface SearchableMovie {
  movieId: number;
  title: string;
  year?: number | null;
  genres: string[];
}

type SearchResult = SearchableMovie & { posterUrl?: string | null };

interface Props {
  onPick: (movie: SearchableMovie) => void;
  onEditingChange: (editing: boolean) => void;
  localMovies: Movie[];
}

/** Tìm theo tên trên API MovieLens; mã phim chỉ được dùng nội bộ khi chọn kết quả. */
export function CinemaMovieSearch({ onPick, onEditingChange, localMovies }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [searchError, setSearchError] = useState("");
  const [picked, setPicked] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const onOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (picked || !open || term.length < 2) {
      setBusy(false);
      setResults([]);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setBusy(true);
      setSearchError("");
      try {
        const response = await cineMatchApi.getMovies(1, 8, term);
        if (!active) return;
        const initial: SearchResult[] = response.items.map(movie => ({
          movieId: movie.movieId,
          title: movie.title,
          year: movie.year,
          genres: movie.genres,
          posterUrl: localMovies.find(item => item.movieId === movie.movieId)?.posterUrl || null,
        }));
        setResults(initial);
        setHighlighted(0);

        // Poster là thông tin bổ sung: lỗi TMDb không ảnh hưởng tìm kiếm hoặc việc chọn phim.
        for (const movie of initial.slice(0, 6)) {
          void cineMatchApi.getEnrichedMovie(movie.movieId)
            .then(extra => {
              if (!active) return;
              setResults(previous => previous.map(item => item.movieId === movie.movieId
                ? { ...item, posterUrl: extra.posterUrl || item.posterUrl }
                : item));
            })
            .catch(() => undefined);
        }
      } catch {
        if (!active) return;
        // Chỉ dùng danh mục đã tải để dự phòng; không đoán kết quả hoặc tên phim.
        const localMatches = localMovies
          .filter(movie => movie.title.toLocaleLowerCase().includes(term.toLocaleLowerCase()))
          .slice(0, 8)
          .map(movie => ({
            movieId: movie.movieId,
            title: movie.title,
            year: movie.year,
            genres: movie.genres,
            posterUrl: movie.posterUrl,
          }));
        setResults(localMatches);
        if (localMatches.length === 0) setSearchError("Không kết nối được danh mục phim. Hãy kiểm tra FastAPI.");
      } finally {
        if (active) setBusy(false);
      }
    }, 280);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, picked, open, localMovies]);

  const pick = (movie: SearchableMovie) => {
    setPicked(true);
    setQuery(movie.title);
    setOpen(false);
    setResults([]);
    setSearchError("");
    onEditingChange(false);
    onPick(movie);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" && results.length > 0) {
      event.preventDefault();
      setHighlighted(index => Math.min(results.length - 1, index + 1));
      setOpen(true);
    } else if (event.key === "ArrowUp" && results.length > 0) {
      event.preventDefault();
      setHighlighted(index => Math.max(0, index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (open && results.length > 0) pick(results[highlighted] ?? results[0]);
    }
  };

  return <div ref={rootRef} className="cm-cinema-autocomplete">
    <div className="cm-cinema-autocomplete-input">
      <Search size={19} aria-hidden="true" />
      <input
        id="cm-content-movie-search"
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && !picked && query.trim().length >= 2}
        aria-controls={listId}
        aria-activedescendant={open && results.length > 0 ? `${listId}-${highlighted}` : undefined}
        autoComplete="off"
        value={query}
        onChange={event => {
          const text = event.target.value;
          setQuery(text);
          setPicked(false);
          setOpen(true);
          setResults([]);
          setSearchError("");
          setHighlighted(0);
          onEditingChange(text.trim().length > 0);
        }}
        onFocus={() => { if (!picked && query.trim().length >= 2) setOpen(true); }}
        onKeyDown={onKeyDown}
        placeholder="Nhập tên phim: Toy Story, Inception..."
      />
      {busy && <LoaderCircle size={17} className="cm-cinema-spin" aria-label="Đang tìm phim" />}
    </div>
    {open && !picked && query.trim().length >= 2 && <div className="cm-cinema-suggestion-panel" id={listId} role="listbox" aria-label="Các phim tìm thấy">
      {results.map((movie, index) => <button
        type="button"
        role="option"
        aria-selected={highlighted === index}
        id={`${listId}-${index}`}
        className={`cm-cinema-suggestion${highlighted === index ? " active" : ""}`}
        key={movie.movieId}
        onMouseDown={event => event.preventDefault()}
        onMouseEnter={() => setHighlighted(index)}
        onClick={() => pick(movie)}
      >
        <span className="cm-cinema-suggestion-poster">
          {movie.posterUrl ? <img src={movie.posterUrl} alt="" loading="lazy" /> : <Film size={18} aria-hidden="true" />}
        </span>
        <span className="cm-cinema-suggestion-info">
          <strong>{movie.title}</strong>
          <small>{movie.genres.slice(0, 3).join(" · ") || "Phim MovieLens"}</small>
        </span>
      </button>)}
      {!busy && results.length === 0 && <div className="cm-cinema-suggestion-empty">{searchError || "Chưa tìm thấy phim phù hợp."}</div>}
      {busy && results.length === 0 && <div className="cm-cinema-suggestion-empty">Đang tìm phim trong MovieLens...</div>}
    </div>}
    <p className="cm-cinema-search-hint">Gõ tên phim rồi chọn từ danh sách.</p>
  </div>;
}
