import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import * as useragent from "express-useragent";
import apiRoutes from "./routes/api";
import { errorHandler } from "./middlewares/error.middleware";
import { APP_CONSTANTS } from "./shared/constants/app.constants";
import { API } from "./shared/constants/api-routes";

const app = express();

// Security
app.use(helmet());
app.use(cookieParser());
app.use(useragent.express());

// CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

// Body parsers
app.use(
  express.json({
    verify: (req: any, res, buf) => {
      const webhookPath = `${APP_CONSTANTS.API_BASE_PATH}${API.PAYMENT.WEBHOOK}`;
      if (req.originalUrl === webhookPath) {
        console.log(`📦 Webhook hit: ${req.originalUrl}`);
        req.rawBody = buf;
      }
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get(APP_CONSTANTS.ROOT_PATH, (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Niramayaa backend is up and running 🚀",
  });
});

// API Routes
app.use(APP_CONSTANTS.API_BASE_PATH, apiRoutes);

// Error Handler
app.use(errorHandler);

export default app;