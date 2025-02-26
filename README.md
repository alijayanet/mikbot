# Alijaya Net Monitor

Aplikasi Node.js untuk memantau koneksi PPPoE dan mengirim notifikasi melalui WhatsApp.

## Fitur Utama

- Pemantauan koneksi PPPoE secara real-time
- Integrasi WhatsApp untuk notifikasi dan perintah
- Manajemen pengguna PPPoE (tambah, edit, hapus pengguna)
- Manajemen pengguna Hotspot
- Pembaruan status dan notifikasi otomatis
- Pemantauan status koneksi
- Antarmuka perintah admin melalui WhatsApp

## Persyaratan Sistem

- Node.js >= 14.0.0
- Router MikroTik dengan akses API yang aktif
- Akun WhatsApp untuk notifikasi

## Dependensi

- whatsapp-web.js: ^1.23.0
- puppeteer: ^21.7.0
- qrcode-terminal: ^0.12.0
- node-routeros: ^1.6.9
- dotenv: ^16.3.1
- axios: ^1.6.2

## Cara Instalasi

```
apt install git curl -y
```
```
git clone https://github.com/alijayanet/mikbot
```
```
cd mikbot
```
```
npm install
```
```
node index.js
```


Saat pertama kali menjalankan aplikasi, Anda perlu memindai kode QR untuk mengautentikasi WhatsApp.

# Perintah WhatsApp

Berikut adalah perintah-perintah yang tersedia melalui WhatsApp:

addpppoe <username> <password> <profile> - Menambah pengguna PPPoE baru

editpppoe <username> <newprofile> - Mengedit profil pengguna PPPoE yang ada

delpppoe <username> - Menghapus pengguna PPPoE

checkpppoe - Memeriksa pengguna PPPoE yang aktif

addhotspot <username> <password> <profile> - Menambah pengguna hotspot baru

delhotspot <username> - Menghapus pengguna hotspot

checkhotspot - Memeriksa pengguna hotspot yang aktif

help - Menampilkan daftar perintah yang tersedia

Detail Fitur

Pemantauan otomatis koneksi PPPoE

Notifikasi WhatsApp real-time untuk perubahan status koneksi

Manajemen pengguna melalui perintah WhatsApp

Penanganan reconnect otomatis

Pencatatan error dan notifikasi

# Pengembang
alijaya-net

# Lisensi
ISC

# Kontribusi
Kontribusi, laporan masalah, dan permintaan fitur sangat diterima!

# Dukungan
Untuk mendapatkan bantuan, silakan buat issue di repositori atau hubungi administrator melalui WhatsApp.

https://wa.me/6281947215703

atau link group telegram

https://t.me/alijayaNetAcs

# Catatan Penting

Pastikan router MikroTik Anda dapat diakses melalui API

Nomor WhatsApp admin harus sudah terdaftar di file .env

Aplikasi membutuhkan koneksi internet yang stabil

Backup konfigurasi MikroTik sebelum menggunakan aplikasi ini

