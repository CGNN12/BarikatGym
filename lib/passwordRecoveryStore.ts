/**
 * Şifre Sıfırlama Kilit Sistemi (Password Recovery Lock)
 * 
 * Supabase, OTP doğrulandığında otomatik session oluşturur.
 * Bu, AuthGuard'ın kullanıcıyı Dashboard'a yönlendirmesine neden olur.
 * 
 * Bu modül, şifre sıfırlama akışı sırasında AuthGuard'ın
 * yönlendirme yapmasını engelleyen global bir bayrak sağlar.
 */

let _isRecoveryMode = false;

export const PasswordRecoveryStore = {
  /** Şifre sıfırlama modunu aktif eder — AuthGuard yönlendirmesi engellenir */
  activate: () => {
    _isRecoveryMode = true;
  },

  /** Şifre sıfırlama modunu deaktif eder — normal yönlendirme devam eder */
  deactivate: () => {
    _isRecoveryMode = false;
  },

  /** Şifre sıfırlama modunun aktif olup olmadığını döner */
  isActive: () => _isRecoveryMode,
};
