// Bu dosyayi config.js olarak kopyalayin ve doldurun.
//   cp app/config.example.js app/config.js
// config.js git'e gitmez (.gitignore). Publishable key tarayicida gorunur;
// verinin korunmasi RLS politikalarina baglidir, anahtarin gizliligine degil.

const CONFIG = {
  SUPABASE_URL: "",            // https://xxxx.supabase.co  (sonuna /rest/v1 EKLEMEYIN)
  SUPABASE_ANON_KEY: "",       // Settings > API Keys > publishable key (sb_publishable_...)
  ADMINS: ["MarcoSikensio"]    // mac sonucunu girebilecek takma adlar
};
