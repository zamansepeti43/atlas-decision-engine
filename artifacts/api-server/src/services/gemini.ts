import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

export async function askGemini(prompt: string) {
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
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