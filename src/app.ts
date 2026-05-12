import express, { Application } from "express";
import cors, { CorsOptions } from "cors";
import helmet from "helmet";
import hpp from "hpp";


/**
 * routes
 */
import v1Routes from "./routes/v1";





export const createApp = (): Application => {
  const app = express();

  /**
   * Disallow all crawlers via robots.txt
   */
  app.get("/robots.txt", (req, res) => {
    res.type("text/plain");
    res.send("User-agent: *\nDisallow: /");
  });

  /**
   * strict secure headers for API
   */
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
        },
      },
      referrerPolicy: { policy: "no-referrer" },
      noSniff: true,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }),
  );



  /**
   * handle cors
   */
  const defaultAllowedDomains: string[] = [
    "localhost",
    "127.0.0.1",
    "usercontent.goog",
    "ngrok-free.dev",
    "lovable.app",
    "mahros.dev",
    "run.app",
    "civara.mahros.dev"
  ];

  const allowedDomainsEnv = process.env.CORS_ALLOWED_DOMAINS;
  const allowedDomains: string[] = allowedDomainsEnv
    ? allowedDomainsEnv
      .split(",")
      .map((domain: string) => domain.trim().toLowerCase())
      .filter(Boolean)
    : defaultAllowedDomains;

  const createCorsOptions = (): CorsOptions => ({
    origin: (origin: string | undefined, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      let hostname: string;
      let host: string;

      try {
        const parsedOrigin = new URL(origin);
        hostname = parsedOrigin.hostname.toLowerCase();
        host = parsedOrigin.host.toLowerCase();
      } catch {
        return callback(new Error("Invalid origin"));
      }

      const isAllowed = allowedDomains.some((domain: string) => {
        return (
          host === domain ||
          hostname === domain ||
          hostname.endsWith(`.${domain}`)
        );
      });

      if (isAllowed) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    // allowedHeaders: ["Content-Type", "Authorization"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-skip-auth-failure",
      "x-skip-error-toast",
      "x-lang",
    ],
  });

  const corsOptions: CorsOptions = createCorsOptions();
  app.use(cors(corsOptions));

  /**
   * parse request json
   */
  app.use(express.json());

  /**
   * protect against HTTP Parameter Pollution attacks
   */
  app.use(hpp());

  /**
   * hadle proxy trust
   */
  app.set("trust proxy", 1);


  /**
 * health
 */
  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      message: "API is healthy",
    });
  });


  /**
   * ROUTE /api/v1
   */
  app.use("/api/v1", v1Routes);



  return app;
};
