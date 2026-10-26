# موقع الوعد | Al Waad

## تحديث موقعك الحالي (ملف الـ zip الصغير: al-waad-update.zip)
1. في Supabase افتح **SQL Editor** والصق محتوى `supabase-setup.sql` كاملاً ثم **Run** (آمن للتشغيل أكثر من مرة).
2. اجعل نفسك المالك (غيّر البريد): 
   `update public.profiles set role='owner' where id=(select id from auth.users where email='YOUR_EMAIL_HERE');`
3. في Cloudflare Pages ← مشروعك ← **Create deployment** ← ارفع `al-waad-update.zip` (الملفات داخله مباشرة بدون مجلد). ملف `config.js` الخاص بك لا يتغير.

## موقع جديد
ارفع `al-waad-full.zip` ثم افتح `config.js` واكتب SUPABASE_URL و SUPABASE_ANON_KEY (من Supabase ← Project Settings ← API).
بدون المفاتيح يعمل الموقع في وضع التجربة.
