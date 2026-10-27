import { UserProfile } from '../types';

export const MOCK_USERS: UserProfile[] = [
  {
    userId: 1,
    name: 'Người dùng #1 (Action & Sci-Fi Enthusiast)',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
    bio: 'Thành viên kỳ cựu MovieLens. Yêu thích các tác phẩm Star Wars, The Matrix và phiêu lưu sử thi.',
    preferredGenres: ['Action', 'Adventure', 'Sci-Fi'],
    ratings: {
      1: 4.0,     // Toy Story
      260: 5.0,   // Star Wars IV
      1196: 5.0,  // Empire Strikes Back
      1210: 5.0,  // Return of Jedi
      2571: 5.0,  // The Matrix
      589: 4.5,   // T2
      1240: 4.0,  // Terminator 1
      6: 4.0,     // Heat
    },
    avgRating: 4.56
  },
  {
    userId: 15,
    name: 'Người dùng #15 (Sci-Fi & Thriller Fan)',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=200&q=80',
    bio: 'Đam mê các kịch bản hack não, không gian sâu và phim trinh thám tội phạm đương đại.',
    preferredGenres: ['Sci-Fi', 'Thriller', 'Mystery'],
    ratings: {
      2571: 5.0,  // Matrix
      79132: 4.5, // Inception
      109487: 5.0,// Interstellar
      58559: 4.5, // The Dark Knight
      50: 4.0,    // Usual Suspects
      260: 4.0,   // Star Wars IV
    },
    avgRating: 4.50
  },
  {
    userId: 100,
    name: 'Người dùng #100 (Crime & Drama Connoisseur)',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    bio: 'Tập trung vào điện ảnh kinh điển những năm 70-90: The Godfather, Shawshank, Pulp Fiction.',
    preferredGenres: ['Crime', 'Drama'],
    ratings: {
      318: 5.0,   // Shawshank
      858: 5.0,   // Godfather 1
      1221: 4.5,  // Godfather 2
      296: 4.5,   // Pulp Fiction
      593: 4.0,   // Silence of Lambs
      608: 4.0,   // Fargo
      1704: 4.5,  // Good Will Hunting
    },
    avgRating: 4.50
  },
  {
    userId: 300,
    name: 'Người dùng #300 (Family & Animation Lover)',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    bio: 'Yêu thích các phim gia đình, hoạt hình Pixar ấm áp và câu chuyện truyền cảm hứng.',
    preferredGenres: ['Animation', 'Children', 'Comedy', 'Fantasy'],
    ratings: {
      1: 5.0,     // Toy Story
      2: 4.5,     // Jumanji
      8961: 5.0,  // Incredibles
      356: 4.5,   // Forrest Gump
      4993: 4.0,  // LOTR 1
    },
    avgRating: 4.60
  },
  {
    userId: 414,
    name: 'Người dùng #414 (Super-Cinephile - 2698 Ratings)',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    bio: 'Một trong những người dùng hoạt động tích cực nhất MovieLens. Đánh giá đa dạng mọi thể loại điện ảnh.',
    preferredGenres: ['Drama', 'Action', 'Crime', 'Sci-Fi', 'Comedy'],
    ratings: {
      1: 4.0,
      6: 3.5,
      260: 5.0,
      296: 5.0,
      318: 5.0,
      356: 4.0,
      593: 4.0,
      2571: 5.0,
      4993: 4.5,
      58559: 4.0,
      7153: 4.5,
      858: 5.0,
      1221: 4.5,
    },
    avgRating: 4.50
  },
  {
    userId: 610,
    name: 'Người dùng #610 (Modern Action & Noir Buff)',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=200&q=80',
    bio: 'Thích hành động gay cấn, nhịp độ nhanh và bầu không khí đen tối (Dark Knight, Heat, Matrix, Inception).',
    preferredGenres: ['Action', 'Thriller', 'Crime'],
    ratings: {
      6: 4.5,     // Heat
      2571: 4.5,  // Matrix
      58559: 5.0, // Dark Knight
      79132: 4.5, // Inception
      593: 4.0,   // Silence of Lambs
      589: 4.5,   // Terminator 2
      1240: 4.0,  // Terminator 1
    },
    avgRating: 4.43
  }
];

export const CURRENT_LOCAL_USER: UserProfile = {
  userId: 999,
  name: 'Khách / Bạn (Tài khoản hiện tại)',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
  bio: 'Hồ sơ thử nghiệm tương tác trong phiên duyệt web hiện tại. Bạn có thể chấm điểm phim để cá nhân hóa đề xuất theo thời gian thực.',
  preferredGenres: ['Action', 'Sci-Fi', 'Adventure'],
  ratings: {
    260: 4.5,
    2571: 5.0,
    79132: 4.5,
  },
  avgRating: 4.67
};
