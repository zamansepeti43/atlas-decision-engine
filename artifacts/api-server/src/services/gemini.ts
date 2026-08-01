import { Groq } from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

const DEFAULT_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

interface GeminiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function askGemini(prompt: string | GeminiMessage[]) {
  try {
    const messages = typeof prompt === "string"
      ? [{ role: "user" as const, content: prompt }]
      : prompt;

    if (!process.env.GROQ_API_KEY) {
      console.warn("GROQ_API_KEY is not configured; using a local fallback reply.");
      const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? "Mesaj";
      return `Bu mesaj için Groq anahtarı tanımlı olmadığı için yerel yanıt kullanıldı: ${lastUserMessage}`;
    }

    const completion = await groq.chat.completions.create({
      model: DEFAULT_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 800,
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