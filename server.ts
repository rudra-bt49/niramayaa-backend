import dotenv from 'dotenv';
dotenv.config();

import app from "./src/app";

const PORT: number = parseInt(process.env.PORT as string , 10);

// Initialize scheduled cron jobs
import './src/cron/availability.cron';

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});