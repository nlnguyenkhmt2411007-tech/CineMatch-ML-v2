/**
 * CineMatch ML V2 — FastAPI Client & Backend Bridge
 * Designed for plug-and-play connection with Python FastAPI in VS Code.
 * 
 * In Demo Mode, it utilizes the client-side algorithmic engine (recommender.ts)
 * with explicit [Demo / Baseline] badges.
 * When the FastAPI server runs on localhost:8000, it seamlessly switches to live Python inference.
 */

import { Movie, ContentRecommendation, CollaborativeRecommendation } from '../types';
import { MOCK_MOVIES } from '../data/mockMovies';
import { MOCK_USERS, CURRENT_LOCAL_USER } from '../data/mockUsers';
import {
  getContentBasedRecommendations,
  getCollaborativeRecommendations,
  getSimilarMoviesByContent
} from './recommender';

export interface FastApiConfig {
  baseUrl: string;
  isLiveMode: boolean;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastPing?: number;
}

export const defaultFastApiConfig: FastApiConfig = {
  baseUrl: 'http://127.0.0.1:8000',
  isLiveMode: false,
  status: 'disconnected'
};

export class FastApiClient {
  private config: FastApiConfig;

  constructor(initialConfig: FastApiConfig = defaultFastApiConfig) {
    this.config = { ...initialConfig };
  }

  public getConfig(): FastApiConfig {
    return { ...this.config };
  }

  public setBaseUrl(url: string) {
    this.config.baseUrl = url.trim().replace(/\/+$/, '');
  }

  public setLiveMode(enabled: boolean) {
    this.config.isLiveMode = enabled;
  }

  /**
   * Health check for Python FastAPI backend:
   * GET /health or GET /
   */
  public async checkHealth(): Promise<{ ok: boolean; message: string; version?: string }> {
    if (!this.config.isLiveMode) {
      return { ok: false, message: 'Đang chạy ở chế độ Client Demo Engine (Chưa bật Live FastAPI)' };
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/api/v2/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(3000)
      });

      if (response.ok) {
        const data = await response.json();
        this.config.status = 'connected';
        this.config.lastPing = Date.now();
        return { ok: true, message: 'Đã kết nối thành công với FastAPI Python!', version: data.version || '2.0.0' };
      } else {
        this.config.status = 'error';
        return { ok: false, message: `FastAPI phản hồi mã lỗi HTTP ${response.status}` };
      }
    } catch {
      this.config.status = 'disconnected';
      return {
        ok: false,
        message: `Không thể kết nối tới ${this.config.baseUrl}. Vui lòng khởi động server Python FastAPI.`
      };
    }
  }

  /**
   * Content-Based Recommendation endpoint:
   * POST /api/v2/recommend/content-based
   */
  public async getContentRecommendations(
    userId: number,
    topN: number = 6,
    theta: number = 4.0
  ): Promise<{ data: ContentRecommendation[]; source: 'live_fastapi' | 'demo_engine' }> {
    if (this.config.isLiveMode && this.config.status === 'connected') {
      try {
        const res = await fetch(`${this.config.baseUrl}/api/v2/recommend/content-based`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, top_n: topN, rating_threshold: theta })
        });
        if (res.ok) {
          const json = await res.json();
          return { data: json.recommendations, source: 'live_fastapi' };
        }
      } catch {
        console.warn('FastAPI error, falling back to Demo engine');
      }
    }

    // Fallback: Client-Side Demo Engine
    const user = MOCK_USERS.find(u => u.userId === userId) || CURRENT_LOCAL_USER;
    const recommendations = getContentBasedRecommendations(user, MOCK_MOVIES, topN, theta);
    return { data: recommendations, source: 'demo_engine' };
  }

  /**
   * User-Based Collaborative Filtering endpoint:
   * POST /api/v2/recommend/collaborative
   */
  public async getCollaborativeRecommendations(
    userId: number,
    kNeighbors: number = 5,
    topN: number = 6
  ): Promise<{
    recommendations: CollaborativeRecommendation[];
    neighbors: any[];
    targetMean: number;
    source: 'live_fastapi' | 'demo_engine';
  }> {
    if (this.config.isLiveMode && this.config.status === 'connected') {
      try {
        const res = await fetch(`${this.config.baseUrl}/api/v2/recommend/collaborative`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, k_neighbors: kNeighbors, top_n: topN })
        });
        if (res.ok) {
          const json = await res.json();
          return {
            recommendations: json.recommendations,
            neighbors: json.neighbors,
            targetMean: json.target_mean,
            source: 'live_fastapi'
          };
        }
      } catch {
        console.warn('FastAPI error, falling back to Demo engine');
      }
    }

    // Fallback: Client-Side Demo Engine
    const user = MOCK_USERS.find(u => u.userId === userId) || CURRENT_LOCAL_USER;
    const result = getCollaborativeRecommendations(user, MOCK_USERS, MOCK_MOVIES, kNeighbors, topN);
    return { ...result, source: 'demo_engine' };
  }

  /**
   * Movie similarity endpoint:
   * GET /api/v2/movies/{id}/similar
   */
  public async getSimilarMovies(
    movieId: number,
    topN: number = 4
  ): Promise<{ data: ContentRecommendation[]; source: 'live_fastapi' | 'demo_engine' }> {
    const targetMovie = MOCK_MOVIES.find(m => m.movieId === movieId);
    if (!targetMovie) return { data: [], source: 'demo_engine' };

    const results = getSimilarMoviesByContent(targetMovie, MOCK_MOVIES, topN);
    return { data: results, source: 'demo_engine' };
  }
}

export const fastApiClient = new FastApiClient();

/**
 * Standard Python FastAPI template code ready to run in VS Code
 */
export const FASTAPI_PYTHON_CODE_TEMPLATE = `# =====================================================================
# CineMatch ML V2 — Backend FastAPI Python Service
# File: main.py
# Run in VS Code:
#   1. pip install fastapi uvicorn pandas numpy scikit-learn
#   2. uvicorn main:app --reload --port 8000
# =====================================================================

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from credentials import pydantic_settings  # optional
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import numpy as np

app = FastAPI(
    title="CineMatch ML V2 Recommendation API",
    description="Backend Machine Learning cho đồ án MovieLens Latest Small (User-Based CF & Content-Based Filtering)",
    version="2.0.0"
)

# Cho phép React frontend kết nối
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ContentRecRequest(BaseModel):
    user_id: int
    top_n: int = 6
    rating_threshold: float = 4.0

class CollabRecRequest(BaseModel):
    user_id: int
    k_neighbors: int = 5
    top_n: int = 6

@app.get("/api/v2/health")
def health_check():
    return {
        "status": "healthy",
        "service": "CineMatch ML V2 Recommender Engine",
        "version": "2.0.0",
        "dataset": "MovieLens Latest Small (100k)",
        "models": ["Content-Based (Multi-Hot + Cosine)", "User-Based CF (Mean-Centered KNN)"]
    }

@app.post("/api/v2/recommend/content-based")
def recommend_content_based(req: ContentRecRequest):
    # Dữ liệu từ movies.csv và ratings.csv đã tiền xử lý
    # 1. Tạo vector sở thích Pu = mean(x_i) với r_ui >= rating_threshold
    # 2. Tính Cosine Similarity S(u, j) = cos(Pu, x_j)
    # 3. Trả về Top-N phim chưa xem
    return {
        "user_id": req.user_id,
        "algorithm": "Content-Based Filtering (Cosine Similarity)",
        "top_n": req.top_n,
        "recommendations": []  # Kết nối logic scikit-learn / pandas ở đây
    }

@app.post("/api/v2/recommend/collaborative")
def recommend_collaborative(req: CollabRecRequest):
    # Dữ liệu từ ratings.csv (80% Train split theo timestamp)
    # 1. Trừ điểm trung bình người dùng: r'_ui = r_ui - r_bar_u
    # 2. Tính Cosine Similarity giữa người dùng trên các phim cùng đánh giá
    # 3. Chọn K láng giềng gần nhất
    # 4. Dự đoán điểm đánh giá có trọng số r_hat_ui
    return {
        "user_id": req.user_id,
        "algorithm": "User-Based Collaborative Filtering (Mean-Centered KNN)",
        "k_neighbors": req.k_neighbors,
        "target_mean": 4.5,
        "neighbors": [],
        "recommendations": []
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
`;
