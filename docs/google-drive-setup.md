# Setup Google Drive Integration

Panduan ini menjelaskan cara mengintegrasikan fitur **Working Paper** dengan Google Drive menggunakan OAuth2 user credentials. File yang diupload akan masuk ke Google Drive akun pribadi Anda, terorganisir otomatis per project dan checklist.

---

## Prasyarat

- Akun Google (personal atau Google Workspace)
- Akses ke [Google Cloud Console](https://console.cloud.google.com)
- Project sudah jalan di Docker

---

## Langkah 1 — Buat Google Cloud Project

1. Buka [console.cloud.google.com](https://console.cloud.google.com)
2. Klik dropdown project di pojok kiri atas → **New Project**
3. Isi nama project, klik **Create**
4. Pastikan project baru terpilih di dropdown

---

## Langkah 2 — Aktifkan Google Drive API

1. Di menu kiri → **APIs & Services** → **Library**
2. Cari `Google Drive API` → klik **Enable**

---

## Langkah 3 — Buat OAuth Consent Screen

> Langkah ini wajib sebelum bisa membuat OAuth credentials.

1. Di menu kiri → **APIs & Services** → **OAuth consent screen**
2. User Type: pilih **External** → klik **Create**
3. Isi form:
   - **App name**: `Audit Dashboard`
   - **User support email**: email Anda
   - **Developer contact information**: email Anda
4. Klik **Save and Continue**
5. Di halaman **Scopes**: langsung klik **Save and Continue** (skip)
6. Di halaman **Test users**:
   - Klik **+ Add Users**
   - Masukkan email Google Anda (yang akan dipakai untuk authorize)
   - Klik **Add** → **Save and Continue**
7. Klik **Back to Dashboard**

> **Penting**: Wajib tambahkan email Anda sebagai Test User. Tanpa ini, Google akan memblokir akses dengan error *"App has not completed verification process"*.

---

## Langkah 4 — Buat OAuth 2.0 Credentials

> **Penting**: Pilih tipe **Web application**, bukan Desktop app. Tipe Desktop app tidak kompatibel dengan OAuth Playground yang digunakan di langkah berikutnya.

1. Di menu kiri → **APIs & Services** → **Credentials**
2. Klik **+ Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `audit-dashboard` (bebas)
5. Di bagian **Authorized redirect URIs** → klik **+ Add URI**
6. Masukkan persis:
   ```
   https://developers.google.com/oauthplayground
   ```
7. Klik **Create**
8. Catat **Client ID** dan **Client Secret** yang muncul

---

## Langkah 5 — Dapatkan Refresh Token

1. Buka [developers.google.com/oauthplayground](https://developers.google.com/oauthplayground)
2. Klik ikon **gear (⚙)** di pojok kanan atas
3. Centang **"Use your own OAuth credentials"**
4. Isi:
   - **OAuth Client ID**: Client ID dari langkah 4
   - **OAuth Client Secret**: Client Secret dari langkah 4
5. Tutup panel gear
6. Di kolom kiri, scroll ke **Drive API v3**
7. Centang scope: `https://www.googleapis.com/auth/drive`
8. Klik **Authorize APIs**
9. Login dengan akun Google yang sama dengan yang Anda daftarkan sebagai test user
10. Klik **Allow** di halaman consent
11. Klik **Exchange authorization code for tokens**
12. Salin nilai **Refresh token** (dimulai dengan `1//0...`)

> **Catatan**: Refresh token tidak expired selama akun Anda tidak mencabut akses. Simpan dengan aman — tidak perlu diulang kecuali credentials dicabut.

---

## Langkah 6 — Buat Folder di Google Drive

1. Buka [drive.google.com](https://drive.google.com)
2. Klik **+ New** → **New Folder**
3. Nama folder: `Audit Shared Drive` (atau sesuai kebutuhan)
4. Setelah dibuat, buka folder tersebut
5. Salin **Folder ID** dari URL browser:
   ```
   https://drive.google.com/drive/folders/[FOLDER_ID_ADA_DI_SINI]
   ```

---

## Langkah 7 — Isi `.env`

Tambahkan atau update variabel berikut di file `.env`:

```env
GOOGLE_DRIVE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_DRIVE_CLIENT_SECRET=GOCSPX-xxxx
GOOGLE_DRIVE_REFRESH_TOKEN=1//04xxxx
GOOGLE_DRIVE_ROOT_FOLDER_ID=1AbCdEfGhIjKlMnOpQrStUvWx
```

> **Jangan commit file `.env` ke git.** Pastikan `.env` sudah masuk `.gitignore`.

---

## Langkah 8 — Build dan Jalankan

```bash
docker-compose up --build -d
```

Setelah container up, cek log backend untuk konfirmasi:

```bash
docker-compose logs backend | grep -i drive
# Output yang diharapkan:
# Google Drive integration enabled
```

---

## Struktur Folder Otomatis di Drive

Setiap kali working paper diupload, sistem akan otomatis membuat folder jika belum ada:

```
Audit Shared Drive/
├── {Nama Project A}/
│   ├── {Nama Checklist 1}/
│   │   ├── bukti_transfer.pdf
│   │   └── rekapitulasi.xlsx
│   ├── {Nama Checklist 2}/
│   │   └── foto_aset.jpg
│   └── General/
│       └── dokumen_umum.docx
└── {Nama Project B}/
    └── ...
```

Folder `General` dipakai untuk working paper yang tidak dikaitkan ke checklist tertentu.

---

## Troubleshooting

| Error | Penyebab | Solusi |
|---|---|---|
| `Service Accounts do not have storage quota` | Memakai Service Account JSON bukan OAuth2 | Ikuti panduan ini dari awal (pakai OAuth2 Web credentials) |
| `redirect_uri_mismatch` | OAuth client type bukan Web application | Buat credentials baru dengan tipe **Web application** dan tambahkan redirect URI playground |
| `Access blocked: App has not completed verification` | Email tidak terdaftar sebagai test user | Tambahkan email di OAuth consent screen → Test users |
| `Google Drive integration disabled` di log | Env vars belum diisi atau salah | Cek keempat variabel `GOOGLE_DRIVE_*` di `.env` |
| `OAuth2 token error: invalid_grant` | Refresh token kadaluarsa atau dicabut | Ulangi langkah 5 untuk mendapatkan refresh token baru |

---

## Mencabut Akses (jika diperlukan)

Untuk mencabut akses aplikasi ke Drive Anda:

1. Buka [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
2. Cari `Audit Dashboard`
3. Klik **Remove Access**

Setelah dicabut, refresh token tidak berlaku lagi dan perlu diulang dari langkah 5.
