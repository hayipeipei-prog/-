import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameCard } from './components/GameCard';
import { FocusBar } from './components/FocusBar';
import { generateQuestions } from './services/geminiService';
import { initAudio, playCorrectSound, playIncorrectSound } from './services/audioService';
import { MathProblem, GameState, SwipeDirection, FocusState } from './types';
import { Play, RotateCcw, Check, X, Trophy, Activity, Zap, Clock } from 'lucide-react';

const MAX_GAME_TIME = 150; // 2 minutes 30 seconds
const QUESTIONS_PER_ROUND = 10;

const App: React.FC = () => {
  // Game State
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [questions, setQuestions] = useState<MathProblem[]>([]);
  const [score, setScore] = useState(0);
  
  // Timers
  const [gameTimeLeft, setGameTimeLeft] = useState(MAX_GAME_TIME);
  const [questionTimeLeft, setQuestionTimeLeft] = useState(0);
  const [currentQuestionMaxTime, setCurrentQuestionMaxTime] = useState(4); // Default 4s

  const [streak, setStreak] = useState(0);
  
  // Difficulty & Round Logic
  const [level, setLevel] = useState(1);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [roundCorrectCount, setRoundCorrectCount] = useState(0);
  const [roundHistory, setRoundHistory] = useState<number[]>([]); // Stores accuracy % of previous rounds

  // Simulated "External Device" Focus Value (0-100)
  const [focusScore, setFocusScore] = useState(50);
  
  // Interactive Visual State
  const [dragOffset, setDragOffset] = useState(0);

  const globalTimerRef = useRef<number | null>(null);

  // Initialize questions
  const loadQuestions = useCallback(async (targetLevel: number) => {
    const newQuestions = await generateQuestions(QUESTIONS_PER_ROUND, targetLevel);
    setQuestions(prev => [...prev, ...newQuestions]);
  }, []);

  // Determine Time Limit per Question based on Level (in seconds)
  const getQuestionTimeLimit = (lvl: number) => {
    switch (lvl) {
      case 1: return 4;
      case 2: return 6;
      case 3: return 6;
      case 4: return 10;
      case 5: return 14;
      case 6: return 16;
      case 7: return 20;
      case 8: return 22; // 3-Digit Addition/Subtraction
      case 9: return 26; // 3-Digit Mixed
      case 10: return 30; // 3-Digit Parentheses
      default: return 4;
    }
  };

  const startGame = async () => {
    // Initialize audio context on user interaction
    initAudio();

    setGameState(GameState.LOADING);
    setScore(0);
    setStreak(0);
    setFocusScore(50); // Reset focus
    setGameTimeLeft(MAX_GAME_TIME);
    setQuestions([]);
    setDragOffset(0);
    
    // Reset Level logic
    setLevel(1);
    setQuestionsAnswered(0);
    setRoundCorrectCount(0);
    setRoundHistory([]);
    
    // Set initial question timer
    const startLimit = getQuestionTimeLimit(1);
    setCurrentQuestionMaxTime(startLimit);
    setQuestionTimeLeft(startLimit);

    await loadQuestions(1);
    
    setGameState(GameState.PLAYING);
  };

  const endGame = () => {
    setGameState(GameState.GAME_OVER);
    if (globalTimerRef.current) clearInterval(globalTimerRef.current);
  };

  // Determine Focus State based on the numerical value
  const getFocusState = (score: number) => {
    if (score >= 55) return FocusState.HIGH;
    if (score > 30) return FocusState.MEDIUM;
    return FocusState.LOW;
  };

  // ----------------------------------------------------------------
  // Global & Question Timer Loop with Focus Dilation
  // ----------------------------------------------------------------
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      globalTimerRef.current = window.setInterval(() => {
        // TIME DILATION LOGIC
        // Standard decrement is 0.1s per 100ms (real time)
        // High Focus -> Slow down time (0.07s passed) -> Player has MORE time
        // Low Focus -> Speed up time (0.14s passed) -> Player has LESS time
        
        let timePassed = 0.1;

        if (focusScore >= 55) {
          timePassed = 0.07; // 0.7x speed
        } else if (focusScore <= 30) {
          timePassed = 0.14; // 1.4x speed
        }

        // Update Global Game Timer
        setGameTimeLeft((prev) => {
          if (prev <= timePassed) {
            endGame();
            return 0;
          }
          return prev - timePassed;
        });

        // Update Question Timer
        // Only count down if there are questions loaded and we aren't waiting
        if (questions.length > 0) {
            setQuestionTimeLeft((prev) => {
                // If we hit 0, we stay at 0 until the useEffect trigger handles the timeout
                return Math.max(0, prev - timePassed);
            });
        }

        // Natural focus decay (simulating need to maintain attention)
        setFocusScore(prev => Math.max(0, prev - 0.15));

      }, 100);
    }
    return () => {
      if (globalTimerRef.current) clearInterval(globalTimerRef.current);
    };
  }, [gameState, focusScore, questions.length]);

  // ----------------------------------------------------------------
  // Question Timeout Handler
  // ----------------------------------------------------------------
  useEffect(() => {
      // If time hits 0 and we are playing, treat as timeout (NONE swipe)
      if (gameState === GameState.PLAYING && questionTimeLeft <= 0 && questions.length > 0) {
          handleSwipe(SwipeDirection.NONE);
      }
  }, [questionTimeLeft, gameState, questions.length]);

  // ----------------------------------------------------------------
  // Difficulty Adjustment Logic
  // ----------------------------------------------------------------
  const checkDifficulty = (finalRoundAccuracy: number) => {
    let newLevel = level;
    let shouldUpdate = false;

    // Rule 1: Previous round <= 50% -> Level Down
    if (finalRoundAccuracy <= 0.5) {
      newLevel = Math.max(1, level - 1);
      shouldUpdate = true;
    } 
    // Rule 2: Continuous 20 questions > 90% -> Level Up
    // This implies looking at the average of current round + previous round
    else if (roundHistory.length > 0) {
      const prevRoundAccuracy = roundHistory[roundHistory.length - 1];
      const twoRoundAverage = (finalRoundAccuracy + prevRoundAccuracy) / 2;
      
      // > 90% means strictly greater than 0.9 (e.g. 19/20 correct)
      if (twoRoundAverage > 0.9) {
        newLevel = Math.min(10, level + 1); // Max Level 10
        shouldUpdate = true;
      }
    }

    if (shouldUpdate && newLevel !== level) {
      setLevel(newLevel);
      loadQuestions(newLevel); 
      setRoundHistory([]); // Reset history on level change so player must verify proficiency at new level
    } else {
       // If no level change, simply append current round stats
       setRoundHistory(prev => [...prev, finalRoundAccuracy]);
       
       if (questions.length < 5) {
         loadQuestions(level);
       }
    }
  };


  // ----------------------------------------------------------------
  // Interaction Handler
  // ----------------------------------------------------------------
  const handleSwipe = async (direction: SwipeDirection) => {
    // Reset drag visuals
    setDragOffset(0);

    if (questions.length === 0) return;

    // Reset Timer for next question immediately
    const nextLimit = getQuestionTimeLimit(level);
    setCurrentQuestionMaxTime(nextLimit);
    setQuestionTimeLeft(nextLimit);

    const currentCard = questions[0];
    const isActuallyCorrect = currentCard.isCorrect;
    
    let isSuccess = false;

    // If direction is NONE, it means Timeout -> treat as wrong (skip)
    if (direction !== SwipeDirection.NONE) {
      if (direction === SwipeDirection.RIGHT && isActuallyCorrect) isSuccess = true;
      if (direction === SwipeDirection.LEFT && !isActuallyCorrect) isSuccess = true;
    }

    if (isSuccess) {
      playCorrectSound();
      setScore(s => s + 10 + (streak * 2));
      setStreak(s => s + 1);
      
      // Update Round Stats
      setRoundCorrectCount(prev => prev + 1);
      
      // Correct answer boosts Focus
      setFocusScore(prev => Math.min(100, prev + 4));
      
    } else {
      // Only play error sound if it wasn't a timeout (timeout is silent failure)
      if (direction !== SwipeDirection.NONE) {
        playIncorrectSound();
      }
      setStreak(0);
      
      // Wrong answer hurts Focus
      setFocusScore(prev => Math.max(0, prev - 12));
    }

    // Logic for Round Completion
    const nextQuestionCount = questionsAnswered + 1;
    setQuestionsAnswered(nextQuestionCount);

    if (nextQuestionCount % QUESTIONS_PER_ROUND === 0) {
      const finalRoundCorrect = isSuccess ? roundCorrectCount + 1 : roundCorrectCount;
      const accuracy = finalRoundCorrect / QUESTIONS_PER_ROUND;
      checkDifficulty(accuracy);
      setRoundCorrectCount(0);
    } else {
       if (questions.length < 5) {
         loadQuestions(level);
       }
    }

    // Remove top card (Move to next)
    setQuestions(prev => prev.slice(1));
  };

  const handleCardDrag = (xOffset: number) => {
    setDragOffset(xOffset);
  };

  const getLeftCircleScale = () => {
    if (dragOffset >= 0) return 1;
    const intensity = Math.min(Math.abs(dragOffset) / 150, 0.5);
    return 1 + intensity;
  };

  const getRightCircleScale = () => {
    if (dragOffset <= 0) return 1;
    const intensity = Math.min(Math.abs(dragOffset) / 150, 0.5);
    return 1 + intensity;
  };

  const currentFocusState = getFocusState(focusScore);

  return (
    <div className="relative w-full h-screen bg-[#2D8C85] overflow-hidden flex flex-col items-center justify-between py-6">
      
      {/* --- Background Decorative Elements --- */}
      <div 
        className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 w-[60vw] h-[60vw] max-w-[500px] max-h-[500px] bg-[#FF9456] rounded-full opacity-90 pointer-events-none transition-transform duration-100 ease-out will-change-transform"
        style={{ transform: `translate(-50%, -50%) scale(${getLeftCircleScale()})` }} 
      />
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-bold text-4xl hidden md:block pointer-events-none">
        FALSE
      </div>

      <div 
        className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 w-[60vw] h-[60vw] max-w-[500px] max-h-[500px] bg-[#70F7C6] rounded-full opacity-90 pointer-events-none transition-transform duration-100 ease-out will-change-transform"
        style={{ transform: `translate(50%, -50%) scale(${getRightCircleScale()})` }} 
      />
      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 font-bold text-4xl hidden md:block pointer-events-none">
        TRUE
      </div>

      {/* --- Header: Primary Stats (Time & Score) --- */}
      <div className="relative z-10 w-full max-w-md px-6 flex justify-between items-center text-white pt-2">
         {/* Time */}
        <div className="flex flex-col items-start">
           <div className="flex items-center gap-2 opacity-60">
              <Clock className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider font-semibold">Time</span>
           </div>
           <span className="text-4xl font-mono font-bold tracking-tight">{Math.ceil(gameTimeLeft)}s</span>
        </div>

        {/* Score */}
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2 opacity-60">
             <Trophy className="w-4 h-4" />
             <span className="text-xs uppercase tracking-wider font-semibold">Score</span>
          </div>
          <span className="text-4xl font-mono font-bold tracking-tight">{score}</span>
        </div>
      </div>

      {/* --- Sub-Header: Secondary Stats (Focus & Level) --- */}
      <div className="relative z-10 w-full max-w-md px-6 flex justify-between items-center mt-2">
         {/* Focus */}
         <div className="flex items-center gap-3 bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm border border-white/10">
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-white/80" />
                  <span className="text-[10px] text-white/80 uppercase tracking-wider font-bold">Focus</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-white leading-none">{Math.round(focusScore)}</span>
                <span className={`text-[9px] font-bold px-1.5 py-[1px] rounded-full leading-tight ${
                  currentFocusState === FocusState.HIGH ? 'bg-emerald-400 text-emerald-900' : 
                  currentFocusState === FocusState.LOW ? 'bg-orange-400 text-orange-900' : 'bg-yellow-400 text-yellow-900'
                }`}>
                  {currentFocusState === FocusState.HIGH ? 'HI' : currentFocusState === FocusState.LOW ? 'LO' : 'MED'}
                </span>
              </div>
            </div>
         </div>

         {/* Level */}
         <div className="flex items-center gap-3 bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm border border-white/10">
             <div className="flex flex-col items-end">
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-white/80 uppercase tracking-wider font-bold">Level</span>
                    <Zap className="w-3 h-3 text-white/80" />
                </div>
                <span className="text-lg font-bold text-white leading-none">{level}</span>
             </div>
         </div>
      </div>
      
      {currentFocusState === FocusState.HIGH && (
          <div className="relative z-10 text-[10px] text-emerald-200 animate-pulse font-bold tracking-wide mt-1">
            FOCUS ZONED: TIME DILATION ACTIVE (0.7x)
          </div>
      )}

      {/* --- Main Game Area (Card Stack) --- */}
      <div className="relative z-20 flex-1 w-full flex items-center justify-center">
        <div className="relative w-full max-w-[90%] md:max-w-[420px] h-64 flex justify-center">
          {gameState === GameState.PLAYING && questions.map((q, i) => (
            i < 3 && (
              <GameCard 
                key={q.id} 
                problem={q} 
                index={i} 
                onSwipe={handleSwipe}
                onDrag={i === 0 ? handleCardDrag : undefined}
              />
            )
          ))}

          {gameState === GameState.PLAYING && questions.length === 0 && (
             <div className="absolute inset-0 flex items-center justify-center text-white font-bold animate-pulse">
               Generating Level {level}...
             </div>
          )}

          {gameState !== GameState.PLAYING && (
             <div className="absolute top-0 z-30 w-[90%] md:w-[400px] bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                {gameState === GameState.MENU ? (
                  <>
                    <h1 className="text-4xl font-extrabold text-white mb-2 drop-shadow-lg">MATH REFLEX</h1>
                    <p className="text-teal-50 mb-8 text-sm max-w-[260px] mx-auto leading-relaxed">
                      Maintain high <span className="text-emerald-300 font-bold">Focus</span> to slow down time. 
                      Adaptive difficulty challenges your speed.
                    </p>
                    <button 
                      onClick={startGame}
                      className="group relative px-8 py-4 bg-white text-[#2D8C85] rounded-full font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all active:scale-95 flex items-center gap-2"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      START GAME
                    </button>
                  </>
                ) : gameState === GameState.LOADING ? (
                   <div className="flex flex-col items-center">
                     <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
                     <span className="text-white font-bold">Calibrating Focus...</span>
                   </div>
                ) : (
                  <>
                    <Trophy className="w-16 h-16 text-yellow-300 mb-4 drop-shadow-md" />
                    <h2 className="text-3xl font-bold text-white mb-1">Time's Up!</h2>
                    <p className="text-teal-50 mb-6">Final Score: <span className="text-2xl font-bold text-white">{score}</span></p>
                    <div className="grid grid-cols-2 gap-4 text-left w-full mb-6 bg-black/10 p-4 rounded-lg">
                        <div>
                            <span className="text-xs text-white/50 block">Max Level</span>
                            <span className="text-lg font-bold text-white">{level}</span>
                        </div>
                        <div>
                            <span className="text-xs text-white/50 block">Avg Focus</span>
                            <span className="text-lg font-bold text-white">{Math.round(focusScore)}</span>
                        </div>
                    </div>
                    <button 
                      onClick={startGame}
                      className="px-8 py-3 bg-white text-[#2D8C85] rounded-full font-bold shadow-lg hover:scale-105 transition-all flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      PLAY AGAIN
                    </button>
                  </>
                )}
             </div>
          )}
        </div>
      </div>

      {/* --- Footer: Question Timer Bar --- */}
      <div className="relative z-10 w-full px-6 pb-10 flex flex-col items-center gap-2">
        <FocusBar current={questionTimeLeft} max={currentQuestionMaxTime} focusLevel={focusScore} />
        
        {/* Controls Guide */}
        {gameState === GameState.PLAYING && (
          <div className="flex w-full max-w-xs justify-between mt-4 opacity-40">
             <X className="w-5 h-5 text-white" />
             <Check className="w-5 h-5 text-white" />
          </div>
        )}
      </div>

    </div>
  );
};

export default App;