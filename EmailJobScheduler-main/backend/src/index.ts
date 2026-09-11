import path from "node:path";
import dotenv from "dotenv";

// Load the monorepo's shared root .env explicitly by path, rather than
// "dotenv/config" (which resolves relative to process.cwd() — and cwd is
// backend/ when this runs via the root `npm run dev` workspace script, so it
// would silently miss the root .env and leave DATABASE_URL etc. unset).
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import cors from "cors";
import express from "express";
import { emailsRouter } from "./routes/emails";
import { sendersRouter } from "./routes/senders";
import "./queue/worker";
import { reconcileScheduledJobs } from "./queue/reconcile";

const app = express();
const port = process.env.PORT ?? 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/emails", emailsRouter);
app.use("/senders", sendersRouter);

app.listen(port, async () => {
  console.log(`Backend listening on http://localhost:${port}`);
  await reconcileScheduledJobs();
});
