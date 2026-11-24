# ✦ LUMI — Your TEP Study Companion

**Web app belajar TEP UNESA yang mobile-first, modern, minimalis, dan penuh motivasi.**

Visual: **Light Mode + Deep Navy + Vibrant Coral**. Dibangun memakai **Google Sheets sebagai bank soal yang bisa terus diperbarui**, **Google Apps Script sebagai backend sekaligus web app**, dan **GitHub sebagai tempat menyimpan kode**.

![Preview desain LUMI](assets/lumi-ui-concept.png)

## ✨ Fitur

- Beranda achievement dashboard: **Level, XP, streak, target mingguan, badge, akurasi tiap section**.
- Latihan **Listening / Structure / Reading**, atau campuran.
- Filter **Kategori Materi** dan jumlah soal.
- **Practice Mode**: cek jawaban + terjemahan + pembahasan setelah menjawab.
- **Mock Mode**: 1 menit/soal (simulasi singkat), skor dan pembahasan muncul di akhir. **Ini bukan pengaturan waktu resmi TEP.**
- Listening menampilkan **transkrip** dari `BANK_TEKS` (bukan audio); Reading memakai passage yang sama untuk beberapa soal.
- **Mistake Notebook**: ulangi soal yang terakhir dijawab salah.
- Riwayat progres otomatis di sheet `RIWAYAT_BELAJAR`.
- **Kunci tidak dikirim ke browser sebelum cek jawaban / selesai tes.**
- Responsif: dapat dibuka melalui browser HP; dapat ditambahkan sebagai shortcut ke home screen.

## 🚀 Mulai dalam 10 langkah (tanpa terminal / tanpa GitHub dulu)

1. Buka [Google Drive](https://drive.google.com/), upload `data/Bank_Soal_TEP_UNESA_268.xlsx`.
2. Buka file itu di **Google Sheets**, lalu pilih **File → Save as Google Sheets** agar menjadi spreadsheet Google native.
3. Pastikan ada sheet `LISTENING`, `STRUCTURE`, `READING`, `BANK_TEKS` dan judul kolom di **baris 1**. Jangan mengganti nama kolom.
4. Di Google Sheets, pilih **Extensions → Apps Script** (Ekstensi → Apps Script).
5. Di Apps Script, buka `Code.gs` dan ganti semuanya dengan isi file **`Code.gs`** di repo ini.
6. Buat tiga file baru lewat **+ → HTML** bernama persis **`Index`**, **`Styles`**, **`Scripts`**. Salin isi file `Index.html`, `Styles.html`, dan `Scripts.html` masing-masing. Jangan membuat file bernama `Styles.html.html`.
7. Di **Project Settings**, aktifkan **Show "appsscript.json" manifest file in editor**, lalu isi `appsscript.json` sesuai file di repo ini. Simpan semuanya.
8. Pilih fungsi `setupLumi` dari menu function di editor, klik **Run**, dan izinkan akses Google Sheets yang diminta. Fungsi ini membuat sheet `RIWAYAT_BELAJAR` otomatis.
9. Klik **Deploy → New deployment → Web app**. Pilih **Execute as: Me** dan **Who has access: Only myself** (atau label bahasa Indonesia yang setara). Klik Deploy dan salin URL Web App (`.../exec`).
10. Buka URL tadi di **HP** dengan akun Google yang diberi akses. Di Chrome Android, menu **⋮ → Add to Home screen** / "Tambahkan ke layar utama" untuk shortcut.

> **Penting:** aplikasi ini sengaja dirancang **untuk penggunaan pribadi**. Jangan mengubah akses menjadi **Anyone** jika kamu belum menambahkan autentikasi dan pemisahan data pengguna. Semua riwayat versi sekarang disimpan dalam satu sheet bersama.

### Jika Script tidak dibuat dari spreadsheet (standalone)

Di **Project Settings → Script Properties**, tambahkan properti:

| Property | Value |
| --- | --- |
| `SPREADSHEET_ID` | ID di URL spreadsheet Google Sheets yang kamu gunakan |

Opsional: set Script Property `DISPLAY_NAME` dengan panggilan yang ingin tampil di beranda (contoh: nama depanmu). Jika tidak diatur, aplikasi menampilkan **Learner**.

Untuk project Apps Script yang dibuat melalui menu **Extensions** di Google Sheets, properti tersebut **tidak diperlukan** karena LUMI memakai spreadsheet aktif.

## 🔄 Bagaimana menambah soal?

**Cukup tambahkan baris ke Google Sheets.** Tidak perlu mengubah Apps Script dan **tidak perlu deploy ulang hanya untuk perubahan data spreadsheet**.

- `LISTENING`: masukkan ID Soal, Bagian, Kategori Materi, ID Teks, pertanyaan, pilihan A–D, Kunci, terjemahan, pembahasan.
- `STRUCTURE`: ID Soal, Jenis Soal, Kategori Materi, kalimat, pilihan A–D, Kunci, terjemahan, pembahasan.
- `READING`: ID Soal, Kategori Materi, ID Teks, pertanyaan, pilihan A–D, Kunci, terjemahan, pembahasan.
- `BANK_TEKS`: ID Teks, Section, Jenis Teks, Judul/Topik, Teks Asli EN, Terjemahan ID.

**Jaga ID unik.** Jika satu passage dipakai untuk banyak soal, ulangi `ID Teks` yang sama di beberapa baris soal. Soal belum lengkap (opsi kosong, kunci tidak A–D, atau ID Teks tidak tersedia) dilewati otomatis supaya tidak muncul sebagai soal rusak.

Perubahan terlihat saat pengguna **reload halaman atau mulai sesi latihan baru**. Jika sedang mengerjakan sesi, sebaiknya selesaikan dulu sebelum mengubah soal yang aktif.

## 📁 Struktur repo

```text
lumi-tep-study-app/
├── Code.gs                 # Backend: Sheets, quiz, scoring, XP, history
├── Index.html              # Kerangka halaman web
├── Styles.html             # Navy + coral UI & mobile responsive styling
├── Scripts.html            # Interaksi UI, latihan, hasil, progress
├── appsscript.json         # Manifest Apps Script
├── .clasp.json.example     # Contoh konfigurasi untuk sinkron via clasp
├── .claspignore            # Hanya file Apps Script yang dikirim ke Google
├── .gitignore              # Abaikan kredensial dan file rahasia
├── package.json            # npm scripts dan clasp CLI
├── data/
│   └── Bank_Soal_TEP_UNESA_268.xlsx # Contoh database awal
├── assets/
│   └── lumi-ui-concept.png  # Referensi visual
├── docs/
│   ├── SETUP.md             # Langkah setup rinci
│   ├── SCHEMA.md            # Kontrak kolom dari workbook
│   ├── ARCHITECTURE.md      # Data flow, keamanan, limitasi
│   ├── PREVIEW.md           # Cara membuka demo HTML lokal
│   ├── VALIDATION.md        # Audit awal bank soal 268 butir
│   └── preview.html         # Demo interaktif tanpa Google Sheets
└── tests/
    ├── check-html.js       # Validasi JS embedded
    └── server.test.js      # Uji fungsi server dengan mock Google Sheets
```

## 🐙 Upload ke GitHub

Repo GitHub **menyimpan kode dan versi pengembangan**, sedangkan URL aplikasi tetap URL **Web App Google Apps Script**; tidak perlu GitHub Pages.

Cara mudah:

1. Buat repository **Private**, misalnya `lumi-tep-study-app`.
2. Download ZIP proyek ini dan **ekstrak** di laptop. Jangan upload ZIP sebagai satu file jika ingin struktur folder muncul di repo.
3. Buka repository di GitHub → **Add file → Upload files**, unggah isi folder yang telah diekstrak (atau gunakan GitHub Desktop).
4. Setiap kali kode diubah, simpan commit baru. Jangan commit `.clasp.json`, token akses, password, atau data pribadi.

### Sinkron GitHub → Apps Script dengan `clasp` (opsional, setelah setup manual berhasil)

Diperlukan Node.js dan Apps Script API yang diaktifkan pada [pengaturan Apps Script](https://script.google.com/home/usersettings).

```bash
npm install
npm run login
cp .clasp.json.example .clasp.json
# Edit .clasp.json, ganti scriptId dengan Script ID di Apps Script → Project Settings
npm run status
npm run push
```

Di Windows PowerShell, gunakan `Copy-Item .clasp.json.example .clasp.json` menggantikan `cp`.

**Hati-hati:** `clasp push` akan **mengganti kode** di project Apps Script yang dituju. Pastikan `scriptId` benar. Setelah mengubah *kode*, buat/update deployment versi web app di Apps Script melalui **Deploy → Manage deployments → Edit → New version**. Setelah mengubah *data Sheets saja*, **tidak perlu** update deployment.

Untuk mulai repo Git lewat terminal:

```bash
git init
git add .
git commit -m "Initial LUMI TEP study app"
git branch -M main
git remote add origin https://github.com/USERNAME/lumi-tep-study-app.git
git push -u origin main
```

## 👀 Demo tampilan tanpa menghubungkan Google

Buka `docs/preview.html` setelah mengekstrak ZIP. Ini demo interaktif dengan **data simulasi**, bukan database 268 soal dan bukan aplikasi yang menyimpan progres. Cocok untuk meninjau tampilan sebelum deployment.

## 🧪 Pemeriksaan

```bash
npm run check
```

Uji statis dan uji logic lokal tidak menggantikan **pengujian langsung di akun Google** (perlu otorisasi dan Web App deployment). Setelah deployment, uji: buka beranda → latihan 5 soal → cek jawaban → selesai → lihat `RIWAYAT_BELAJAR` → tambah soal di Sheets → refresh aplikasi.

## ⚠️ Batasan yang disengaja

- Audio belum tersedia; Listening memakai **transkrip**, mengikuti bank soal yang ada.
- Mode simulasi adalah **latihan singkat 1 menit/soal**, bukan konversi skor resmi TEP. Persentase akurasi dan XP adalah metrik belajar, **bukan prediksi skor TEP UNESA**.
- Tidak ada sistem akun multi-user, pembayaran, push notification, atau mode offline.
- Koneksi internet dibutuhkan untuk membaca Google Sheets dan menyimpan progres.
- Perubahan **kode** perlu deployment versi baru; perubahan **data** tidak.
- Session quiz sementara disimpan di Apps Script CacheService; jika sudah terlalu lama (maks. 6 jam) atau cache terhapus, mulai sesi baru.

## Referensi dokumentasi Google

- [Google Apps Script Web Apps](https://developers.google.com/apps-script/guides/web)
- [HTML Service + google.script.run](https://developers.google.com/apps-script/guides/html/communication)
- [Apps Script clasp](https://developers.google.com/apps-script/guides/clasp)

Dibuat untuk belajar secara konsisten, bukan sekadar mengumpulkan angka. **Study · Practice · Improve · Achieve** ✦
