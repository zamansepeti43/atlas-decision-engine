import { Router } from "express";
import { askGemini } from "../services/gemini";

const router = Router();

router.post("/", async (req, res) => {
  try {
      const { message } = req.body;

          if (!message) {
                return res.status(400).json({
                        error: "Mesaj gerekli."
                              });
                                  }

                                      const reply = await askGemini(message);

                                          res.json({
                                                success: true,
                                                      reply
                                                          });

                                                            } catch (error) {

    console.error("CHAT HATASI:", error);

    return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
    });
}
});

export default router;