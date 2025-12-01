import React from 'react';

interface FocusBarProps {
  current: number; // Current question time left
  max: number;     // Max time for this question
  focusLevel: number;
}

export const FocusBar: React.FC<FocusBarProps> = ({ current, max, focusLevel }) => {
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));

  // High Focus (>= 55): Green
  // Medium Focus (30-55): Yellow
  // Low Focus (<= 30): Orange
  let colorClass = 'bg-yellow-400'; // Default Medium
  if (focusLevel >= 55) colorClass = 'bg-emerald-400';
  else if (focusLevel <= 30) colorClass = 'bg-orange-500';

  return (
    <div className="w-full max-w-sm h-1.5 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm relative">
      <div 
        className={`h-full ${colorClass} transition-all duration-100 ease-linear shadow-[0_0_8px_rgba(255,255,255,0.2)]`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};