import { Groq } from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

interface GeminiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function askGemini(prompt: string | GeminiMessage[]) {
  try {
    const messages = typeof prompt === "string"
      ? [{ role: "user" as const, content: prompt }]
      : prompt;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
    });

    return completion.choices[0]?.message?.content ?? "";
  } catch (error) {
    console.error("🔥 GROQ HATASI:", error);

    if (error instanceof Error) {
      throw new Error(error.stack || error.message);
    }

    throw error;
  }
}