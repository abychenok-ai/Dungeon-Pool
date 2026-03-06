
import { GoogleGenAI } from "@google/genai";
import { GameState } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getGameTip(gameState: GameState): Promise<string> {
  try {
    const ballsRemaining = gameState.balls.filter(b => !b.isCue).length;

    const prompt = `
      Act as a pool coach.
      Balls Remaining on Table: ${ballsRemaining}
      Current Score: ${gameState.score}
      Goal: Clear all colored balls using the white cue ball.
      Provide a very short, encouraging tip or reaction (max 12 words).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    return response.text || "Focus on your aim!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Line up your shot!";
  }
}
