# BarikatGym — Claude Context

## Proje Özeti
Türkçe bir spor salonu yönetim uygulaması. QR kod + GPS tabanlı giriş/çıkış sistemi, üyelik takibi ve admin paneli. Ankara'daki Barikat Gym için geliştirilmiş.

## Tech Stack
- **React Native 0.81.5** + **Expo 54** + **TypeScript 5.9**
- **Expo Router 6** (dosya tabanlı routing)
- **NativeWind 4** (Tailwind CSS for RN)
- **Supabase** (PostgreSQL + auth + realtime)
- **expo-location** + **expo-camera** + **expo-background-fetch**

## Klasör Yapısı
```
app/
  _layout.tsx          # Root layout (LocationGuard, AuthGuard, dark theme)
  (auth)/login.tsx     # Login/signup + admin invite code
  member/
    _layout.tsx        # Tab nav + realtime profile subscription + sneak detection
    index.tsx          # Dashboard (doluluk, aktivite grafiği)
    scan.tsx           # QR tarayıcı + GPS doğrulama
    profile.tsx        # Üye profil yönetimi
  admin/
    _layout.tsx        # Admin tab nav
    index.tsx          # Live radar, manuel giriş
    members.tsx        # Üye listesi & yönetim
    profile.tsx        # Admin ayarlar, invite kodu üretme
lib/
  supabase.ts          # Supabase client
  types.ts             # TypeScript interfaces
  location.ts          # GPS doğrulama, haversine, GYM_CONFIG
hooks/useAuth.ts       # Auth state (signIn, signUp, signOut)
utils/
  sneakDetection.ts    # Arka plan kaçak giriş tespiti
  backgroundTasks.ts   # Otomatik çıkış background task
  dateHelpers.ts       # Üyelik durumu hesaplama
constants/theme.ts     # Renkler, fontlar, iş mantığı sabitleri
components/            # TacticalInput, TacticalButton, DeerLogo, OccupancyDisplay, ActivityChart, CustomAlert
supabase/setup.sql     # Ana şema (profiles, gym_logs, notifications)
```

## Supabase
- **URL:** https://nczyzmejgrervwqvhtkb.supabase.co
- **Project ID:** nczyzmejgrervwqvhtkb
- **EAS Project ID:** 3bf97748-ccfb-4c9d-8b8c-2282a1896f25
- Anahtarlar `lib/supabase.ts` içinde hardcoded (public ANON_KEY, kasıtlı)

## Veritabanı Tabloları

### `profiles`
```
id (UUID, PK = auth.users.id)
full_name, avatar_url
role: "admin" | "member"
status: "active" | "inactive" | "frozen" | "pending" | "expired"
membership_start, membership_end (timestamp tz)
freeze_quota, freeze_start_date, planned_freeze_days
is_inside (boolean)
```

### `gym_logs`
```
id, user_id (FK profiles)
entry_time, exit_time (nullable)
status: "inside" | "completed"
```

### `notifications`
```
id, user_id, message, is_read
type: "alert" | "sneak_alert"
```

### `admin_invites`
```
id, code (text unique uppercase), is_used (bool), used_by (UUID nullable)
```

## Kritik İş Mantığı Sabitleri

| Sabit | Değer | Açıklama |
|-------|-------|----------|
| Gym Latitude | 39.919396214196894 | Barikat Gym koordinatı (Ankara) |
| Gym Longitude | 32.82346193468419 | Barikat Gym koordinatı |
| Giriş Doğrulama Yarıçapı | 100m | QR kod doğrulama için gerekli mesafe |
| Kaçak Tespit Yarıçapı | 15m | Geofence sınırı |
| Bekleme Süresi (dwell) | 10 dakika | Kaçak alarmı için minimum süre |
| Otomatik Çıkış Süresi | 3 saat | İçerideyken otomatik çıkış |
| Otomatik Çıkış Mesafesi | 100m | + bu mesafede ise çıkış |
| Üyelik Uyarı Eşiği | 7 gün | Dolmak üzere uyarısı |
| Auth Timeout | 3 saniye | Rol çözümleme fail-safe |
| Admin Tap Count | 3 tap (1.5s) | Invite kodu alanını göstermek için |
| Background Task | 15 dakika | Otomatik çıkış kontrol sıklığı |

## Tema ve Renkler
```javascript
COLORS = {
  black: "#121212",     // Ana arka plan
  green: "#4B5320",     // Ana aksan (haki yeşili)
  greenLight: "#5C6B2A",
  greenDark: "#3A4119",
  text: "#E0E0E0",
  textMuted: "#A0A0A0",
  red: "#8B0000",       // Hata rengi
  amber: "#B8860B",     // Uyarı rengi
}
```

Font: Inter (regular/medium/semibold/bold/black)

## Auth & Rol Akışı
1. `useAuth.ts` → Supabase auth session yönetimi
2. `AuthGuard` (root layout) → profiles tablosundan role okur
3. `role === "admin"` → `/admin` yönlendir
4. Diğer → `/member` yönlendir
5. Yok → `/(auth)/login` yönlendir

## Admin Invite Sistemi
- Login ekranında logo'ya 3 kez tap → invite kodu alanı görünür
- `admin_invites` tablosundaki geçerli kod girilir
- Kayıt olunca `role="admin"` set edilir, kod `is_used=true` yapılır

## Kaçak Giriş Tespiti (sneakDetection.ts)
- Background location task: `"sneak-detection-task"`
- 30s aralıklarla konum güncelleme, 5m hareket tetikleyici
- 15m yarıçapta ≥10 dakika bekleme → `gym_logs`'ta bugün giriş yok → `sneak_alert` bildirimi
- Günde 1 alarm spam koruması

## Üyelik Durumu Hesaplama (dateHelpers.ts)
```
membership_end null → "inactive"
daysLeft < 0 → "expired"
daysLeft ≤ 7 → "expiring_soon"
daysLeft > 7 → "active"
NOT: bugün = daysLeft=1 (sıfır değil, hâlâ aktif)
```

## Platform & Build
- **Bundle ID:** com.barikatgym.app
- **Orientation:** portrait only
- **Android:** edge-to-edge, background location permission
- **iOS:** Non-exempt encryption: false, background modes: location + fetch
- Background tasks Expo Go'da çalışmaz, custom build gerektirir

## Dikkat Edilmesi Gerekenler
- Sneak detection 15m yarıçapı GPS hassasiyetiyle false positive üretebilir
- Avatar upload base64 ile yapılıyor — büyük görseller için sıkıştırma gerekebilir
- Email değiştirme OTP akışı (çok adımlı) — tam implemente edilip edilmediği doğrulanmalı
- LocationGuard konum iznini mandatory yapıyor — izin reddedilirse uygulama tamamen bloke
