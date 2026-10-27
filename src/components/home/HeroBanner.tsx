import React from 'react';
import { Star, Info, Sparkles, ArrowRight } from 'lucide-react';
import { Movie } from '../../types';

interface HeroBannerProps {
  movie: Movie;
  onOpenDetails: (movie: Movie) => void;
  onFindSimilar: (movie: Movie) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  movie,
  onOpenDetails,
  onFindSimilar
}) => {
  return (
    <section className="relative w-full bg-[#090A0E] border-b border-white/[0.08] overflow-hidden">
      {/* Full-bleed Cinematic Backdrop with Layered Dark Gradients */}
      <div className="absolute inset-0 z-0">
        <img
          src={movie.backdropUrl}
          alt={movie.title}
          className="w-full h-full object-cover object-center scale-105 filter brightness-[0.38] contrast-125"
        />
        {/* Multidirectional deep dark gradients to guarantee text legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#090A0E] via-[#090A0E]/90 to-[#090A0E]/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090A0E] via-[#090A0E]/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#090A0E]/60 via-transparent to-[#090A0E]" />
      </div>

      {/* Main Container (Max 1440px, 80px Spacing) */}
      <div className="relative z-10 max-w-[1440px] mx-auto px-6 py-20 lg:py-24">
        <div className="grid grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Text Column: Spans 12 on mobile, 7 on desktop */}
          <div className="col-span-12 lg:col-span-7 space-y-6">
            {/* Editorial Kicker */}
            <div className="flex items-center gap-2 text-xs tracking-wider uppercase text-[#E8B65B] font-medium">
              <span className="w-2 h-2 rounded-full bg-[#E8B65B]" />
              <span className="font-mono">CineMatch ML · Recommender Engine</span>
            </div>

            {/* Main Heading H1 (Exact requested text in Manrope 700/800) */}
            <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-[56px] text-[#F5F2EA] leading-[1.1] tracking-tight">
              Khám phá những bộ phim{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E8B65B] to-[#F5D48B]">
                dành riêng cho bạn
              </span>
            </h1>

            {/* Description (Exact requested text in Inter 300) */}
            <p className="text-base sm:text-lg text-[#9EA3AE] font-light leading-relaxed max-w-xl">
              Hệ thống đề xuất thông minh dựa trên sở thích và lịch sử đánh giá của người dùng.
            </p>

            {/* Quick Feature Film Attribution */}
            <div className="pt-2 flex items-center gap-3 text-xs text-[#9EA3AE]">
              <span className="text-[#F5F2EA] font-medium">Phim tiêu điểm:</span>
              <span>{movie.title}</span>
              <span aria-hidden="true" className="opacity-40">·</span>
              <span className="text-[#E8B65B] flex items-center gap-1 font-mono">
                <Star className="w-3.5 h-3.5 fill-current" />
                {movie.avgRating.toFixed(1)}/5.0
              </span>
            </div>
          </div>

          {/* Right Featured Movie Section: Spans 12 on mobile, 5 on desktop */}
          <div className="col-span-12 lg:col-span-5">
            <div className="p-6 rounded-[10px] bg-[#11141C]/90 border border-white/[0.08] backdrop-blur-md space-y-5">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#E8B65B]">
                  Featured Movie
                </span>
                <span className="text-xs text-[#9EA3AE] font-mono">
                  Mã phim #{movie.movieId}
                </span>
              </div>

              {/* Poster + Info horizontal layout */}
              <div className="flex gap-4">
                {/* 2:3 Aspect ratio poster */}
                <div className="w-28 sm:w-32 aspect-[2/3] shrink-0 rounded-[8px] overflow-hidden border border-white/[0.08] bg-[#090A0E]">
                  <img
                    src={movie.posterUrl}
                    alt={movie.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex flex-col justify-between py-0.5 space-y-2">
                  <div>
                    <h3 className="font-display font-bold text-lg sm:text-xl text-[#F5F2EA] leading-snug">
                      {movie.title}
                    </h3>
                    <p className="text-xs text-[#9EA3AE] mt-1">
                      Năm phát hành: <span className="text-[#F5F2EA] font-medium">{movie.year}</span>
                    </p>
                    <p className="text-xs text-[#9EA3AE]">
                      Thể loại: <span className="text-[#F5F2EA] font-medium">{movie.genres.join(', ')}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1 text-xs">
                    <span className="flex items-center gap-1 text-[#E8B65B] font-mono font-semibold">
                      <Star className="w-4 h-4 fill-current" />
                      {movie.avgRating.toFixed(2)} / 5.0
                    </span>
                    <span className="text-[#9EA3AE]">
                      ({movie.ratingsCount} lượt đánh giá)
                    </span>
                  </div>
                </div>
              </div>

              {/* Synopsis excerpt */}
              <p className="text-xs text-[#9EA3AE] leading-relaxed line-clamp-3 font-light">
                {movie.synopsis}
              </p>

              {/* Two Requested CTAs: "Xem chi tiết" and "Tìm phim tương tự" with 8px radius */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={() => onOpenDetails(movie)}
                  className="py-3 px-4 rounded-[8px] bg-[#E8B65B] hover:bg-[#F0C475] text-[#090A0E] font-display font-bold text-xs uppercase tracking-wider text-center transition-colors cursor-pointer shadow-sm"
                >
                  Xem chi tiết
                </button>

                <button
                  onClick={() => onFindSimilar(movie)}
                  className="py-3 px-4 rounded-[8px] bg-transparent hover:bg-white/[0.04] border border-white/[0.14] hover:border-[#E8B65B]/50 text-[#F5F2EA] font-display font-medium text-xs uppercase tracking-wider text-center transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Tìm phim tương tự</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#E8B65B]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
