import { GoogleGenAI, Type } from "@google/genai";
import { MathProblem } from "../types";

// Helper for random integers
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Helper to evaluate a simple math string safely
// Note: In a real prod env, avoid eval. for this strictly controlled input, it's acceptable for the demo.
const safeEval = (str: string): number => {
  // eslint-disable-next-line no-new-func
  return new Function('return ' + str)();
};

// --- Local Generation Logic for Fallback ---

const generateEquationForLevel = (level: number): { equation: string, isCorrect: boolean } => {
  let equationStr = "";
  let correctAnswer = 0;
  
  const ops = ['+', '-'];
  const mixedOps = ['+', '-', '*', '/'];

  // Decide if we want to generate a correct or incorrect equation (50/50)
  const shouldBeCorrect = Math.random() > 0.5;

  switch (level) {
    case 1: { 
      // 1-10 addition/subtraction
      const op = ops[randomInt(0, 1)];
      const a = randomInt(1, 10);
      const b = randomInt(1, 10);
      
      if (op === '+') {
        const sum = a + b;
        if (sum <= 10) {
           equationStr = `${a} + ${b}`;
           correctAnswer = sum;
        } else {
           equationStr = `${sum} - ${b}`;
           correctAnswer = a;
        }
      } else {
        const max = Math.max(a, b);
        const min = Math.min(a, b);
        equationStr = `${max} - ${min}`;
        correctAnswer = max - min;
      }
      break;
    }
    case 2: {
      // 1-20 addition/subtraction
      const op = ops[randomInt(0, 1)];
      const a = randomInt(1, 20);
      const b = randomInt(1, 20);
      if (op === '+') {
        const sum = a + b;
        if (sum <= 20) {
          equationStr = `${a} + ${b}`;
          correctAnswer = sum;
        } else {
          equationStr = `${sum} - ${b}`;
          correctAnswer = a;
        }
      } else {
        const max = Math.max(a, b);
        const min = Math.min(a, b);
        equationStr = `${max} - ${min}`;
        correctAnswer = max - min;
      }
      break;
    }
    case 3: {
      // Simple +, -, *, /
      const op = mixedOps[randomInt(0, 3)];
      if (op === '*') {
        const a = randomInt(2, 9);
        const b = randomInt(2, 9);
        equationStr = `${a} * ${b}`;
        correctAnswer = a * b;
      } else if (op === '/') {
        const b = randomInt(2, 9);
        const ans = randomInt(2, 9);
        const a = b * ans;
        equationStr = `${a} / ${b}`;
        correctAnswer = ans;
      } else {
         const a = randomInt(1, 50);
         const b = randomInt(1, 50);
         if (op === '+') {
           equationStr = `${a} + ${b}`;
           correctAnswer = a + b;
         } else {
           const max = Math.max(a, b);
           const min = Math.min(a, b);
           equationStr = `${max} - ${min}`;
           correctAnswer = max - min;
         }
      }
      break;
    }
    case 4: {
      // Mixed 2-digit, NO CARRY/BORROW
      const op = ops[randomInt(0, 1)];
      if (op === '+') {
        // No carry addition: unit+unit < 10, ten+ten < 10
        const aUnits = randomInt(0, 4);
        const bUnits = randomInt(0, 4);
        const aTens = randomInt(1, 4);
        const bTens = randomInt(1, 4);
        
        const A = aTens * 10 + aUnits;
        const B = bTens * 10 + bUnits;
        
        equationStr = `${A} + ${B}`;
        correctAnswer = A + B;
      } else {
        // No borrow subtraction: aUnits >= bUnits, aTens >= bTens
        const aUnits = randomInt(1, 9);
        const bUnits = randomInt(0, aUnits); // Ensure no borrow
        const aTens = randomInt(2, 9);
        const bTens = randomInt(1, aTens); // Ensure result is positive
        
        const A = aTens * 10 + aUnits;
        const B = bTens * 10 + bUnits;
        
        equationStr = `${A} - ${B}`;
        correctAnswer = A - B;
      }
      break;
    }
    case 5: {
      // 2-digit mixed (Standard carry/borrow allowed)
      const op = ops[randomInt(0, 1)];
      const A = randomInt(10, 99);
      const B = randomInt(10, 99);
      
      if (op === '+') {
        equationStr = `${A} + ${B}`;
        correctAnswer = A + B;
      } else {
        const max = Math.max(A, B);
        const min = Math.min(A, B);
        equationStr = `${max} - ${min}`;
        correctAnswer = max - min;
      }
      break;
    }
    case 6: {
      // 100 limit, 3 numbers, 4 operations
      // Example: 20 + 30 - 10 or 5 * 4 + 10
      // We'll generate A op1 B op2 C
      const op1 = mixedOps[randomInt(0, 1)]; // stick to + - for first op to keep it safe for now, or careful logic
      // Simplified: A +/- B +/- C within 100
      const A = randomInt(10, 50);
      const B = randomInt(5, 30);
      const C = randomInt(5, 30);
      const opA = randomInt(0, 1) === 0 ? '+' : '-';
      const opB = randomInt(0, 1) === 0 ? '+' : '-';
      
      let val = 0;
      if (opA === '+') val = A + B; else val = A - B;
      // Ensure intermediate positive
      if (val < 0) {
         equationStr = `${B} - ${A} ${opB} ${C}`;
         val = B - A; // quick swap
      } else {
         equationStr = `${A} ${opA} ${B} ${opB} ${C}`;
      }
      
      if (opB === '+') val += C; else val -= C;
      
      correctAnswer = val;
      break;
    }
    case 7: {
      // 100 limit, with parentheses
      // Example: 2 * (10 + 5)
      const A = randomInt(2, 9);
      const B = randomInt(2, 20);
      const C = randomInt(2, 20);
      
      // Structure: A * (B + C)
      equationStr = `${A} * (${B} + ${C})`;
      correctAnswer = A * (B + C);
      // Ensure < 100 constraint roughly? 5 * 20 = 100.
      if (correctAnswer > 200) {
        // Fallback to simpler
         const max = Math.max(B, C);
         const min = Math.min(B, C);
         equationStr = `${A} * (${max} - ${min})`;
         correctAnswer = A * (max - min);
      }
      break;
    }
    case 8: {
      // Level 8: 3-Digit Addition & Subtraction (e.g. 540 + 403 - 292)
      // Structure: A +/- B +/- C
      // Digits: 100-999
      const A = randomInt(100, 500);
      const B = randomInt(100, 500);
      const C = randomInt(100, 500);
      
      const op1 = Math.random() > 0.5 ? '+' : '-';
      const op2 = Math.random() > 0.5 ? '+' : '-';
      
      // We construct string carefully to avoid negative intermediates if possible, though strict left-to-right handles it.
      // Let's force start with a large number if first op is minus.
      let term1 = A;
      let term2 = B;
      
      // First op
      let val = 0;
      if (op1 === '+') {
        val = term1 + term2;
      } else {
        term1 = Math.max(A, B);
        term2 = Math.min(A, B);
        val = term1 - term2;
      }
      
      // Second op
      let term3 = C;
      let finalVal = 0;
      if (op2 === '+') {
        finalVal = val + term3;
      } else {
        // If val < term3, we might want to swap sign or adjust
        if (val < term3) {
           // Change - to + or reduce C
           term3 = randomInt(10, val); 
        }
        finalVal = val - term3;
      }
      
      equationStr = `${term1} ${op1} ${term2} ${op2} ${term3}`;
      correctAnswer = finalVal;
      break;
    }
    case 9: {
      // Level 9: 3-Digit Mixed Operations (No parentheses)
      // Example: 864 / 4 - 111 = 105
      // Structure: A / B +/- C or A * B +/- C
      // Constraint: Integer results
      
      const pattern = randomInt(0, 1); // 0: Division based, 1: Multiplication based
      
      if (pattern === 0) {
         // (A / B) +/- C
         // B is single digit for mental math feasibility? Or small 2 digit.
         // Let's keep B single digit (2-9)
         const B = randomInt(2, 9);
         const resultDiv = randomInt(50, 200); // The result of A/B
         const A = B * resultDiv; // A is 3 digit
         
         const C = randomInt(10, 300);
         const op2 = Math.random() > 0.5 ? '+' : '-';
         
         if (op2 === '+') {
           correctAnswer = resultDiv + C;
         } else {
           correctAnswer = resultDiv - C;
         }
         equationStr = `${A} / ${B} ${op2} ${C}`;
      } else {
         // A * B +/- C
         // A (2-digit), B (1-digit), C (3-digit)
         const A = randomInt(20, 90);
         const B = randomInt(2, 9);
         const product = A * B;
         
         const C = randomInt(10, 300);
         const op2 = Math.random() > 0.5 ? '+' : '-';
         
         if (op2 === '+') {
            correctAnswer = product + C;
         } else {
            correctAnswer = product - C;
         }
         equationStr = `${A} * ${B} ${op2} ${C}`;
      }
      break;
    }
    case 10: {
      // Level 10: 3-Digit Mixed WITH Parentheses
      // Example: (733+635)/2 = 684
      // Structure: (A +/- B) / C  or  A + (B - C)
      
      const pattern = randomInt(0, 1);
      
      if (pattern === 0) {
        // (A +/- B) / C
        // C single digit
        const C = randomInt(2, 5); // divisor
        const finalVal = randomInt(100, 300); // desired result
        const numerator = finalVal * C; // A +/- B must equal this
        
        // Split numerator into A and B
        // numerator = A + B
        const split = randomInt(Math.floor(numerator * 0.3), Math.floor(numerator * 0.7));
        const A = split;
        const B = numerator - split;
        
        equationStr = `(${A} + ${B}) / ${C}`;
        correctAnswer = finalVal;
      } else {
        // A * (B +/- C)
        // Keep it reasonable. 
        const A = randomInt(2, 9);
        const bracketResult = randomInt(20, 100);
        // bracketResult = B - C or B + C
        const B = randomInt(bracketResult + 10, bracketResult + 100);
        const C = B - bracketResult;
        
        equationStr = `${A} * (${B} - ${C})`;
        correctAnswer = A * bracketResult;
      }
      break;
    }
    default: {
      // Fallback
      const a = randomInt(1, 10);
      const b = randomInt(1, 10);
      equationStr = `${a} + ${b}`;
      correctAnswer = a + b;
    }
  }

  // Final display value
  let displayValue = correctAnswer;

  if (!shouldBeCorrect) {
    // Generate a believable wrong answer (close to real answer)
    const offset = randomInt(1, 5) * (Math.random() > 0.5 ? 1 : -1);
    displayValue = correctAnswer + offset;
    // Ensure display isn't accidentally correct (rare but possible with logic above) if offset is 0, but range starts at 1
    // Ensure positive?
    if (displayValue < 0) displayValue = Math.abs(displayValue);
  }

  return {
    equation: `${equationStr} = ${displayValue}`,
    isCorrect: shouldBeCorrect
  };
};

const getPromptForLevel = (level: number) => {
  const basePrompt = `Generate a JSON object containing a list of math problems.
The JSON structure must be:
{
  "problems": [
    { "id": "unique_id", "equation": "problem_string", "isCorrect": boolean }
  ]
}
Generate 10 problems. roughly 50% should be mathematically correct equations, and 50% should be incorrect equations (with answers that are close but wrong).
Do not use markdown code blocks. Just return the JSON.
`;

  switch(level) {
    case 1:
      return basePrompt + `Difficulty Level 1: Numbers 1-10. Simple Addition and Subtraction. Result must be positive. Format "a + b = c" or "a - b = c".`;
    case 2:
      return basePrompt + `Difficulty Level 2: Numbers 1-20. Simple Addition and Subtraction. Result must be positive.`;
    case 3:
      return basePrompt + `Difficulty Level 3: Simple Addition, Subtraction, Multiplication (tables 2-9), Division (integer results). Numbers up to 50.`;
    case 4:
      return basePrompt + `Difficulty Level 4: 2-digit numbers mixed Addition and Subtraction. CRITICAL: NO CARRY (regrouping) for addition, NO BORROW for subtraction. Result positive.`;
    case 5:
      return basePrompt + `Difficulty Level 5: 2-digit numbers mixed Addition and Subtraction. Carrying and borrowing IS allowed. Result positive.`;
    case 6:
      return basePrompt + `Difficulty Level 6: 3 numbers involved (e.g., A + B - C). 4 operations allowed. Numbers generally within 100. Result positive.`;
    case 7:
      return basePrompt + `Difficulty Level 7: 3 numbers involved with PARENTHESES. (e.g., A * (B + C)). Numbers generally within 100. Result positive.`;
    case 8:
      return basePrompt + `Difficulty Level 8: 3-Digit Addition and Subtraction with 3 numbers (e.g., 540 + 403 - 292). Numbers 100-999. Result positive.`;
    case 9:
      return basePrompt + `Difficulty Level 9: 3-Digit Mixed Operations WITHOUT parentheses. (e.g., 864 / 4 - 111). Division must result in integers. 3 numbers involved.`;
    case 10:
      return basePrompt + `Difficulty Level 10: 3-Digit Mixed Operations WITH PARENTHESES. (e.g., (733+635)/2 ). Complex structure allowed. Division must result in integers.`;
    default:
      return basePrompt + `Difficulty Level 1: Numbers 1-10.`;
  }
};

export const generateQuestions = async (count: number, level: number): Promise<MathProblem[]> => {
  try {
    // Attempt to use API
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = getPromptForLevel(level);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const json = JSON.parse(text);
    
    if (json.problems && Array.isArray(json.problems)) {
      return json.problems.map((p: any) => ({
        ...p,
        difficulty: level
      }));
    }
    throw new Error("Invalid JSON structure");

  } catch (error) {
    console.warn("Gemini API Error or Fallback triggered:", error);
    // Fallback to local generation
    const localProblems: MathProblem[] = [];
    for (let i = 0; i < count; i++) {
       const prob = generateEquationForLevel(level);
       localProblems.push({
         id: `local-${Date.now()}-${i}`,
         equation: prob.equation,
         isCorrect: prob.isCorrect,
         difficulty: level
       });
    }
    return localProblems;
  }
};
