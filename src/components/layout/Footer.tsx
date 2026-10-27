import React from 'react';
import { Film, Github, Database, Cpu, BookOpen, Layers } from 'lucide-react';

interface FooterProps {
  onOpenFastApiModal: () => void;
  onNavigateTab: (tab: any) => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenFastApiModal, onNavigateTab }) => {
  return (
    <footer className="w-full bg-[#090A0E] border-t border-white/[0.08] pt-16 pb-12 mt-20 text-[#9EA3AE]">
      <div className="max-w-[1440px] mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 pb-12 border-b border-white/[0.08]">
          {/* Column 1: Brand & Project */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[8px] bg-[#11141C] border border-[#E8B65B]/30 flex items-center justify-center text-[#E8B65B]">
                <Film className="w-4 h-4" />
              </div>
              <span className="font-display font-bold text-base tracking-wider text-[#F5F2EA]">
                CINEMATCH ML V2
              </span>
            </div>
            <p className="text-xs leading-relaxed text-[#9EA3AE]">
              Nền tảng nghiên cứu và triển khai hệ thống gợi ý phim điện ảnh ứng dụng Machine Learning. Phát triển trên cơ sở bộ dữ liệu MovieLens Latest Small (100.836 đánh giá).
            </p>
            <div className="pt-2 text-[11px] text-[#9EA3AE]/80 space-y-1">
              <p>Trường ĐH Kỹ thuật – Công nghệ Cần Thơ (CTUT)</p>
              <p>Khoa Công nghệ Thông tin · Ngành Khoa học Máy tính</p>
              <p>Học phần: Máy học (Machine Learning)</p>
            </div>
          </div>

          {/* Column 2: Thuật toán & Phương pháp */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold tracking-wider uppercase text-[#F5F2EA] flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-[#E8B65B]" />
              Thuật toán Recommender
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onNavigateTab('content-based')}
                  className="hover:text-[#E8B65B] transition-colors text-left"
                >
                  Content-Based Filtering (Cosine Similarity)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigateTab('content-based')}
                  className="hover:text-[#E8B65B] transition-colors text-left"
                >
                  Mã hóa Multi-Hot Vector thể loại
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigateTab('collaborative')}
                  className="hover:text-[#E8B65B] transition-colors text-left"
                >
                  User-Based Collaborative Filtering (KNN)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigateTab('collaborative')}
                  className="hover:text-[#E8B65B] transition-colors text-left"
                >
                  Khử độ lệch đánh giá (Mean-Centering)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigateTab('dashboard')}
                  className="hover:text-[#E8B65B] transition-colors text-left"
                >
                  Đánh giá Precision@N, Recall@N, MAE & RMSE
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Dữ liệu & Kiểm thử */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold tracking-wider uppercase text-[#F5F2EA] flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-[#E8B65B]" />
              Dữ liệu & Kiểm thử
            </h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center justify-between">
                <span>Bộ dữ liệu:</span>
                <span className="text-[#F5F2EA] font-mono">MovieLens Small</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Số lượt đánh giá:</span>
                <span className="text-[#F5F2EA] font-mono">100.836 ratings</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Số lượng người dùng:</span>
                <span className="text-[#F5F2EA] font-mono">610 users</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Số lượng phim:</span>
                <span className="text-[#F5F2EA] font-mono">9.742 movies</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Phân chia thời gian:</span>
                <span className="text-[#E8B65B] font-mono">80% Train / 20% Test</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Kiểm soát rò rỉ:</span>
                <span className="text-emerald-400 font-mono">Timestamp Filter</span>
              </li>
            </ul>
          </div>

          {/* Column 4: Tích hợp FastAPI & Mã nguồn */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold tracking-wider uppercase text-[#F5F2EA] flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-[#E8B65B]" />
              Kiến trúc & Tích hợp
            </h4>
            <p className="text-xs leading-relaxed text-[#9EA3AE]">
              Frontend xây dựng bằng React 19 + TypeScript + Tailwind CSS. Đã cấu hình sẵn tầng API Client để kết nối trực tiếp với backend Python FastAPI chạy trong VS Code.
            </p>
            <div className="pt-1">
              <button
                onClick={onOpenFastApiModal}
                className="w-full py-2.5 px-3 rounded-[8px] bg-[#11141C] border border-white/[0.08] hover:border-[#E8B65B]/40 text-xs font-medium text-[#F5F2EA] flex items-center justify-center gap-2 transition-all group"
              >
                <span>Mở hướng dẫn kết nối FastAPI</span>
                <span className="text-[#E8B65B] group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <p className="text-[#9EA3AE]">
            © 2026 CineMatch ML V2. Dự án học phần Máy học — Đại học Kỹ thuật Công nghệ Cần Thơ.
          </p>
          <div className="flex items-center gap-6">
            <span className="text-[11px] text-[#9EA3AE]/60 font-mono">
              [Status: Ready for FastAPI Backend]
            </span>
            <button
              onClick={() => onNavigateTab('dashboard')}
              className="hover:text-[#E8B65B] transition-colors"
            >
              Báo cáo thực nghiệm
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
