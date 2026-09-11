# Personal Workplace ToDo

Aplikasi to-do list dan logbook lokal berbasis HTML, CSS, dan JavaScript tanpa dependency eksternal.

## Menjalankan aplikasi

1. Buka `outputs/personal-todo/index.html` dengan browser Windows.
2. Untuk menjalankan reminder background, gunakan `start-reminder-monitor.bat`.
3. Shortcut `Personal Workplace ToDo.lnk` mengarah ke launcher lokal aplikasi.

## Fitur

- Task dengan tanggal dan jam mulai serta deadline.
- Priority, kategori, tag, checklist, dan status selesai.
- Reminder lokal melalui helper Python Windows.
- Lampiran gambar, video, dan audio menggunakan IndexedDB browser.
- Backup dan restore task melalui JSON.
- Notebook/logbook dengan baris dan kolom yang dapat disesuaikan.
- Export logbook ke workbook Excel `.xlsx` asli.

## Penyimpanan data

Task dan logbook utama disimpan di `localStorage` browser menggunakan key:

- `personalWorkplaceTodos.v1`
- `personalWorkplaceLogbook.v1`

Media lampiran disimpan di IndexedDB browser. Karena data tersebut berada di profil browser, tidak otomatis ikut Git. Gunakan tombol `Export` pada aplikasi untuk membuat backup JSON sebelum pindah perangkat.

Folder `outputs/personal-todo/data` berisi data sinkronisasi reminder yang tersedia saat repository dibuat. File itu adalah snapshot, bukan sumber penyimpanan utama aplikasi.

## Struktur

- `outputs/personal-todo/index.html` - halaman aplikasi.
- `outputs/personal-todo/styles.css` - visual system dan responsive layout.
- `outputs/personal-todo/app.js` - task, logbook, import/export, dan media.
- `outputs/personal-todo/reminder_service.py` - helper reminder lokal.
- `outputs/personal-todo/assets` - icon aplikasi.

## Catatan berbagi

Saat repository dibagikan, source code dan snapshot file ikut tersedia, tetapi isi `localStorage`, IndexedDB, dan file media browser tidak ikut tersinkron. Export JSON dari browser adalah cara yang disarankan untuk membawa progress aktual.
