import React, { useRef, useState, useEffect } from 'react';
import { MathProblem, SwipeDirection } from '../types';

interface GameCardProps {
  problem: MathProblem;
  index: number; // 0 is top card
  onSwipe: (direction: SwipeDirection) => void;
  onDrag?: (xOffset: number) => void;
}

export const GameCard: React.FC<GameCardProps> = ({ problem, index, onSwipe, onDrag }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [rotation, setRotation] = useState(0);
  
  // Only the top card is interactive
  const isInteractive = index === 0;

  // Visual stacking effect
  const scale = 1 - index * 0.05;
  const translateY = index * 12; // stack offset
  const opacity = 1 - index * 0.2;
  const zIndex = 100 - index;

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isInteractive) return;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isInteractive || !isDragging) return;
    
    // Simple drag delta
    const newX = position.x + e.movementX;
    const newY = position.y + e.movementY;
    
    setPosition({ x: newX, y: newY });
    
    // Report drag to parent for background effects
    if (onDrag) {
      onDrag(newX);
    }
    
    // Rotate based on X movement for effect
    const rotate = newX * 0.05;
    setRotation(rotate);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isInteractive || !isDragging) return;
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    const threshold = 100; // Pixels to trigger swipe

    if (position.x > threshold) {
      onSwipe(SwipeDirection.RIGHT);
    } else if (position.x < -threshold) {
      onSwipe(SwipeDirection.LEFT);
    } else {
      // Reset position (spring back)
      setPosition({ x: 0, y: 0 });
      setRotation(0);
      if (onDrag) onDrag(0);
    }
  };

  // If index changes (cards shifted), reset visual state
  useEffect(() => {
    setPosition({ x: 0, y: 0 });
    setRotation(0);
    if (onDrag && isInteractive) onDrag(0);
  }, [problem.id, isInteractive]);

  return (
    <div
      ref={cardRef}
      className="absolute top-0 left-0 right-0 h-64 w-full flex items-center justify-center cursor-grab active:cursor-grabbing card-stack-item touch-none"
      style={{
        transform: `translate3d(${position.x}px, ${translateY + position.y}px, 0) scale(${scale}) rotate(${rotation}deg)`,
        opacity: opacity,
        zIndex: zIndex,
        pointerEvents: isInteractive ? 'auto' : 'none',
        transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="relative w-[90%] md:w-[420px] bg-slate-700 rounded-2xl border-4 border-white shadow-2xl overflow-hidden select-none">
        {/* Card Content */}
        <div className="h-64 flex flex-col items-center justify-center p-4">
          <div className="w-full flex justify-center">
            <span className="text-white text-5xl md:text-6xl font-bold font-mono tracking-wider text-center drop-shadow-md whitespace-nowrap overflow-visible">
              {problem.equation}
            </span>
          </div>
          <div className="mt-8 text-slate-400 text-sm font-semibold uppercase tracking-widest">
            {isInteractive ? 'Swipe to decide' : 'Next'}
          </div>
        </div>
        
        {/* Swipe Indicators (Visual feedback inside card) */}
        {isInteractive && isDragging && position.x > 50 && (
          <div className="absolute inset-0 bg-green-500/20 flex items-center justify-end pr-8 transition-opacity duration-200">
            <span className="text-green-300 font-bold text-3xl tracking-widest">TRUE</span>
          </div>
        )}
        {isInteractive && isDragging && position.x < -50 && (
          <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-start pl-8 transition-opacity duration-200">
            <span className="text-orange-300 font-bold text-3xl tracking-widest">FALSE</span>
          </div>
        )}
      </div>
    </div>
  );
};