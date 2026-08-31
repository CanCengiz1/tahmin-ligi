import { writeFileSync, mkdirSync } from "node:fs";

const cfg = {
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
  ADMINS: (process.env.ADMINS || "").split(",").map(s => s.trim()).filter(Boolean)
};

if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
  console.error("SUPABASE_URL ve SUPABASE_ANON_KEY tanimli degil.");
  process.exit(1);
}

mkdirSync("app", { recursive: true });
writeFileSync("app/config.js", `window.CONFIG = ${JSON.stringify(cfg, null, 2)};\n`);
console.log("app/config.js olusturuldu");