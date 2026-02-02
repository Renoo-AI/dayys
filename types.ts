
export interface StreakData {
  currentStreak: number;
  maxStreak: number;
  lastCheckIn: number | null; // Timestamp
  history: number[]; // Array of timestamps
}

export interface AIAnalysis {
  summary: string;
  advice: string;
  consistencyScore: number;
  trend: 'improving' | 'stable' | 'declining';
}
