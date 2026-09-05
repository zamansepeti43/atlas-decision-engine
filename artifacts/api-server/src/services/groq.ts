import { Groq } from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-20b";
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function askGemini(prompt: string | GroqMessage[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("AI servisi yapılandırılmamış. GEMINI_API_KEY eksik.");

  const content = typeof prompt === "string"
    ? prompt
    : prompt.map((message) => `${message.role.toUpperCase()}:\n${message.content}`).join("\n\n");
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: DEFAULT_GEMINI_MODEL });
  const result = await model.generateContent(content);
  const reply = result.response.text().trim();
  if (!reply) throw new Error("AI servisi boş yanıt döndürdü.");
  return reply;
}

export async function askGroq(prompt: string | GroqMessage[]): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (apiKey) {
    try {
      const messages = typeof prompt === "string"
        ? [{ role: "user" as const, content: prompt }]
        : prompt;
      const groq = new Groq({ apiKey });
      const completion = await groq.chat.completions.create({
        model: DEFAULT_MODEL,
        messages,
        temperature: 0.35,
        max_tokens: 900,
      });
      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) throw new Error("AI servisi boş yanıt döndürdü.");
      return content;
    } catch {
      console.warn("[Atlas AI] Groq request failed; trying Gemini fallback.");
    }
  }

  return askGemini(prompt);
}