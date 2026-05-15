import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt, historyContext } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not set on the server." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const systemInstruction = `You are an expert AI Prompt Engineer helping a user write the most effective prompt possible for another AI model.
The user wants to formulate a request.

YOUR TASK:
1. Analyze the user's raw input.
2. Rewrite it into a highly structured, clear, and comprehensive prompt that an LLM would perfectly understand.
3. Include specific constraints, format requests, or context boundaries if implied by the user.
4. DO NOT answer the prompt itself. YOUR ONLY OUTPUT MUST BE THE FULLY OPTIMIZED PROMPT ITSELF, ready to be copied and pasted.
5. If the user provides recent contextual history, use it strictly to understand missing details in their current prompt.
6. The output should be in the same language as the user's prompt (most likely Ukrainian).

Recent user context (for your understanding only, do not output this as part of the optimized prompt unless relevant):
${historyContext || "None provided."}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return NextResponse.json({ optimizedPrompt: response.text });
  } catch (error: any) {
    console.error("Optimization error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to optimize prompt." },
      { status: 500 }
    );
  }
}
