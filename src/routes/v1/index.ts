/**
 * @file src/routes/v1/index.ts
 * @description v1 routes
 * @author Mahros AL-Qabasy <mahros.dev>
 */
import { Router } from "express";
import multer from "multer";
import { AnalyzeService } from "../../services/analyze.service";


const router = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
});

const analyzeService = new AnalyzeService();


/**
 * health
 */
router.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        message: "API is healthy",
    });
});



/**
 * analyze
 */
router.post("/analyze", upload.single("file"), async (req, res) => {
    const result = await analyzeService.analyze(req);
    return res.status(result.status).json(result.body);
});














/**
 * health
 */

export default router;
