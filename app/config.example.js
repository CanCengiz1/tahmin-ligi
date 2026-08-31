// Bu dosyayi config.js olarak kopyalayin ve doldurun.
//   cp app/config.example.js app/config.js
// config.js git'e girmez (.gitignore). Publishable key tarayicida gorunebilir;
// güvenlik Supabase Auth + RLS politikaları ile sağlanır.

window.CONFIG = {
  SUPABASE_URL: "",       // https://xxxx.supabase.co  (sonuna /rest/v1 EKLEMEYIN)
  SUPABASE_ANON_KEY: ""   // Settings > API Keys > publishable key (sb_publishable_...)
};
