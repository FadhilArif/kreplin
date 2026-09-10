# Kraepelin Practice

Platform latihan Tes Kraepelin tanpa email login. Frontend berjalan di GitHub Pages dan backend memakai Google Apps Script + Google Sheets.

## Struktur Google Sheets

Spreadsheet ID:
`1V_l6EZBGTu-ukTp0G8SIOqZvDxXViun-aSycwSFc_cM`

Worksheet **User**:
- `user-id`
- `username`
- `password_hash`
- `salt`
- `created_at`

Worksheet **TestHistory**:
- `test_id`
- `user_id`
- `tanggal`
- `speed`
- `accuracy`
- `consistency`
- `endurance`

## Google Apps Script

1. Buka Google Sheets → Extensions → Apps Script.
2. Ganti isi `Code.gs` dengan file `Code.gs` pada project ini.
3. Deploy → New deployment → Web app.
4. Execute as: Me.
5. Who has access: Anyone.
6. Salin URL `/exec` yang diberikan Google.

URL yang sudah dipasang di `app.js` saat project ini dibuat:
`https://script.google.com/macros/s/AKfycbwtcJdN60aa3sbe-CGyqGSj72g7AH47dNJySyNk41pS_3Q7e-M03wfQSumNxItNgP_-yw/exec`

Jika membuat deployment baru, ganti `CONFIG.API_URL` di `app.js`.

## Fitur

- Register username + password.
- Password tidak disimpan sebagai plaintext di Sheet.
- Login memakai session token.
- Histori per akun disimpan di `TestHistory`.
- Tes: 50 kolom × 26 soal × 15 detik/kolom.
- Angka baru diacak setiap tes.
- Refresh tidak sengaja saat tes berlangsung memulihkan progress dari browser.
- Tombol Home saat tes membuka konfirmasi; jika dikonfirmasi, progress langsung dihapus/hangus dan tidak masuk histori.
- Hasil akhir otomatis disimpan ke histori.
- Halaman hasil dapat diunduh sebagai PDF.
- Hasil halaman tidak disimpan setelah halaman hasil ditinggalkan/di-refresh; histori akun tetap tersimpan.
- Responsive untuk monitor, laptop, tablet, dan handphone.

## Catatan keamanan

Google Sheets cocok untuk MVP atau penggunaan kecil. Untuk skala besar/produksi, pindahkan autentikasi dan histori ke database sungguhan. Jangan menyimpan password plaintext.
