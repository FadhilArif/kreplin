UPDATE PSYCHOTEST — PDF TEMPLATE + GRAFIK WAKTU

Isi paket:
- app.js
  Versi yang sudah terintegrasi dengan bank soal JSON, pencatatan waktu menjawab,
  grafik performa waktu (biru=benar, merah=salah/kosong), dan PDF template.
- styles.css
  CSS tampilan terbaru, termasuk tombol jawaban 2 kolom untuk teks panjang.
- pdf-template.jpg
  Background template FA-Test berdasarkan template PDF yang diberikan.
- contoh-hasil-pdf.pdf
  Contoh hasil PDF untuk preview.

CARA PASANG:
1. Ganti app.js di repository GitHub dengan app.js dari paket ini.
2. Ganti styles.css dengan styles.css dari paket ini.
3. Tambahkan pdf-template.jpg ke root repository GitHub.
4. Tidak perlu mengubah Code.gs.
5. Tidak perlu mengubah file JSON bank soal.
6. Commit/push lalu tunggu GitHub Pages selesai deploy.

CATATAN:
- PDF sekarang memakai template FA-Test sebagai background halaman.
- Grafik MCQ di PDF ikut menampilkan waktu menjawab tiap soal.
- Batang lebih tinggi = waktu menjawab lebih cepat.
- Biru = benar.
- Merah = salah atau kosong.
- PDF dibuat langsung di browser, tanpa library PDF eksternal.
