# Rencana Implementasi K4 Store

K4 Store adalah aplikasi belanja bahan pokok (sembako) sehari-hari daring yang dirancang untuk seluruh kalangan masyarakat dengan antarmuka menenangkan berbasis warna sage green dan warm off-white, dilengkapi pelacakan kurir real-time, sistem pembayaran aman, program loyalitas poin, ulasan produk terverifikasi, live chat bantuan pelanggan, manajemen inventaris otomatis, serta dasbor analitik penjualan.

## User Review & Critical Decisions

> [!IMPORTANT]
> Ringkasan preferensi pengguna yang telah dikonfirmasi pada tahap klarifikasi:
> - **Mode Tampilan**: Tampilan responsif modern dengan opsi simulator mobile (dapat beralih antara tampilan layar penuh dan frame smartphone interaktif).
> - **Palet Warna**: Hijau sage (`#2E6F56`, `#4B836B`) dan daun segar berpadu dengan latar warm off-white (`#FBFBF9`), memberikan kesan tenang, bersih, dan segar.
> - **Katalog Awal**: Sembako lengkap mencakup beras premium, minyak goreng, telur ayam, gula pasir, bumbu dapur, tepung terigu, sayuran segar, dan paket hemat bulanan.
> - **Arsitektur Front-End & Back-End**: Sesuai instruksi lingkungan web AI Studio, front-end diimplementasikan dengan React modern + Tailwind CSS v4 yang mengadopsi pola sentuhan mobile-first (React Native UX feel), didukung server Node.js/Express dengan skema data relasional dan otentikasi akun yang aman.

---

## 1. Overview & Core Concept

- **What It Does**: Memudahkan masyarakat (ibu rumah tangga, pekerja, lansia, dan keluarga) membeli bahan pangan pokok tanpa antre, dengan perhitungan ongkir otomatis, pilihan pembayaran fleksibel (QRIS, E-Wallet, Virtual Account Bank, COD), serta pelacakan kurir interaktif langsung di atas peta dengan status progresif.
- **Target Audience / Persona**: 
  - Ibu rumah tangga dan keluarga yang membutuhkan pasokan sembako rutin dengan harga transparan dan mutu terjamin.
  - Generasi muda dan pekerja sibuk yang membutuhkan pengiriman cepat dan pelacakan transparan.
  - Pengguna lanjut usia atau pemula teknologi yang membutuhkan navigasi simpel, teks berukuran jelas, dan proses belanja tanpa langkah berbelit-belit.
- **Key Value**: Belanja sembako higienis, hemat, dan pasti sampai; transparansi inventaris tanpa risiko kehabisan stok setelah memesan; dan apresiasi loyalitas berupa poin reward di setiap transaksi.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Jelajah & Temukan Produk**: Pengguna melihat kategori utama (Beras & Karbo, Minyak & Bumbu, Telur & Protein, Sayur Segar, Paket Hemat). Kartu produk bersih menampilkan foto berkualitas tinggi, berat/kemasan, sisa stok aktual, rating ulasan, dan tombol tambah ke keranjang satu ketuk.
2. **Detail Produk & Ulasan Pembeli**: Pengguna dapat membuka detail produk untuk membaca komposisi/kualitas, melihat ulasan foto dari pembeli lain, serta memberi ulasan untuk produk yang sudah dibeli.
3. **Keranjang & Checkout Aman**: Pengguna meninjau keranjang belanja, memilih voucher diskon atau menukarkan K4 Poin, memilih alamat pengiriman, dan memilih metode pembayaran (QRIS dinamis instan, VA Bank, E-Wallet, atau Bayar di Tempat/COD).
4. **Pelacakan Pengiriman Real-Time**: Halaman pelacakan menampilkan peta rute kurir interaktif, estimasi waktu tiba (ETA), profil kurir lengkap (nama, nomor kontak, plat kendaraan), dan linimasa status 5 tahap (Menunggu Konfirmasi $\to$ Diproses Gudang $\to$ Kurir Menjemput $\to$ Sedang Diantar $\to$ Pesanan Selesai).
5. **Program Loyalitas K4 Poin**: Akun pengguna mengumpulkan poin setiap kelipatan Rp 1.000 belanja, memiliki tingkat keanggotaan (Sahabat Dapur $\to$ Juragan Sembako), dan riwayat perolehan poin.
6. **Live Chat Bantuan K4 Care**: Pengguna dapat berkomunikasi langsung dengan tim bantuan toko untuk menanyakan ketersediaan produk, estimasi tiba, atau mengajukan kendala pengiriman.
7. **Dasbor Analitik & Inventaris Toko**: Mode admin/toko yang terintegrasi untuk melihat omzet harian, jumlah pesanan, produk terlaris, notifikasi stok menipis (< 10 unit), serta tombol restock instan.

### Visual Identity & Theme
- **Aesthetic Direction**: Minimalis segar dan menenangkan (*calming organic marketplace*). Mengutamakan keterbacaan tinggi, sudut membulat yang bersahabat (`rounded-2xl`), dan penataan lapang tanpa elemen berantakan.
- **Color Palette & Mood**:
  - *Dominant Canvas (60%)*: Warm Off-White (`#FBFBF9`) dan Soft Pure White (`#FFFFFF`) untuk kartu konten.
  - *Structural Surfaces (30%)*: Sage Muted Green (`#EBF4F0`, `#D8E9E1`) untuk aksen latar belakang, hairline divider tipis (`#E6EDE8`), serta warna teks netral arang lembut (`#1F2923` dan `#4A5850`).
  - *Accent Budget (10%)*: Fresh Deep Emerald / Sage (`#2E6F56` dan `#3D8568`) untuk tombol aksi utama, badge status aktif, dan indikator navigasi terpilih. Aksen oranye labu lembut (`#E07A5F`) khusus untuk diskon atau peringatan stok kritis.
- **Typography & Hierarchy**:
  - Display Font: *Plus Jakarta Sans* (SemiBold/Bold) untuk judul bagian dan nama toko.
  - Body Font: *Plus Jakarta Sans* (Regular/Medium) dengan kontras warna yang nyaman di mata.
  - Numeric Font: *Plus Jakarta Sans* dengan `tabular-nums` untuk nominal harga Rupiah dan angka kuantitas agar sejajar rapi.
- **Component Styling & Layout**:
  - Top Bar Kontrak 3 Zona: Brand wordmark "K4 Store", kategori pintas navigasi, dan tombol aksi (Keranjang & Notifikasi).
  - Mode Switcher: Tombol elegan di bagian atas untuk beralih antara "Tampilan Layar Responsif" dan "Simulator Smartphone" agar pengguna dapat menguji kedua pengalaman.
  - Bottom Tab Bar (pada simulator mobile): 4 menu ergonomis yang mudah dijangkau ibu jari (Beranda, Pesanan/Lacak, Poin Reward, Akun/Admin).

### Interactive Feedback & Motion
- Transisi halus (150-200ms) menggunakan kurva bezier natural.
- Animasi pergerakan titik kurir di peta dengan transisi posisi mulus.
- Notifikasi push in-app dengan banner ringkas saat pesanan berpindah status.
- Feedback getar/skala lembut (`scale-95` ke `scale-100`) saat menekan tombol checkout atau menambah barang.

---

## 3. Key Product Decisions & Trade-Offs

- **Simulasi Pelacakan Kurir Interaktif**:
  - *Pendekatan*: Menyediakan peta visual berbasis SVG interaktif dengan rute kurir aktif, animasi pergerakan kendaraan, indikator jarak tempuh (km), dan tombol simulasi percepatan status untuk kemudahan pengujian fitur secara langsung.
  - *Alasan*: Pengguna dapat langsung merasakan fitur pelacakan real-time secara instan tanpa harus menunggu kurir sungguhan di jalan.
- **Dua Perspektif Terintegrasi (Pembeli & Pengelola Toko)**:
  - *Pendekatan*: Menggabungkan tampilan belanja pelanggan dengan panel kontrol analitik & manajemen stok yang dapat diakses dengan mudah via toggle peran (*Customer View* vs *Store Admin View*).
  - *Alasan*: Memenuhi kedua kebutuhan utama pengguna (pembelian & pelacakan barang, sekaligus dasbor penjualan harian dan pemantauan stok otomatis).
- **Sistem Pembayaran Multi-Channel Aman**:
  - *Pendekatan*: Menyediakan antarmuka pembayaran lengkap dengan generator QRIS dinamis, nomor rekening Virtual Account (BCA, Mandiri, BRI), E-Wallet (GoPay, OVO, ShopeePay), dan opsi COD dengan rincian biaya yang transparan.
- **Penyimpanan Status Terpadu (State Store & Express Backend)**:
  - *Pendekatan*: Menggunakan Express API di sisi server untuk mengelola inventaris, pesanan, dan analitik, dipadukan dengan sinkronisasi local storage di client agar data tetap konsisten selama sesi berjalan.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                              K4 STORE                                  │
│                 (Responsive Web & Mobile Simulator)                   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   ┌────────────────────┐   ┌───────────────────┐   ┌───────────────┐   │
│   │   Storefront &     │   │   Keranjang &     │   │   Lacak Live  │   │
│   │     Katalog        │   │    Checkout       │   │  Kurir & Peta │   │
│   └─────────┬──────────┘   └─────────┬─────────┘   └───────┬───────┘   │
│             │                        │                     │           │
│   ┌─────────┴──────────┐   ┌─────────┴─────────┐   ┌───────┴───────┐   │
│   │   Program Poin     │   │   Live Chat CS    │   │  Admin Panel  │   │
│   │    Loyalitas       │   │    "K4 Care"      │   │  & Analitik   │   │
│   └─────────┬──────────┘   └─────────┬─────────┘   └───────┬───────┘   │
│             │                        │                     │           │
│             └────────────────────────┼─────────────────────┘           │
│                                      ▼                                 │
│                     ┌────────────────────────────────┐                 │
│                     │      Client State Manager      │                 │
│                     │  (Cart, Orders, Chat, User)    │                 │
│                     └────────────────┬───────────────┘                 │
│                                      │                                 │
│                                      ▼ HTTP / REST                     │
│                     ┌────────────────────────────────┐                 │
│                     │     Node.js / Express Server   │                 │
│                     │  (/api/products, /api/orders,  │                 │
│                     │   /api/inventory, /api/stats)  │                 │
│                     └────────────────┬───────────────┘                 │
│                                      ▼                                 │
│                     ┌────────────────────────────────┐                 │
│                     │      Relational Data Store     │                 │
│                     │   (Products, Orders, Reviews,  │                 │
│                     │      Inventory, Chat Logs)     │                 │
│                     └────────────────────────────────┘                 │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Model & Entities
- **Product**: `id`, `name`, `category`, `price`, `originalPrice`, `unit` (e.g. 1 kg, 500 ml), `stock`, `minStockWarning`, `image`, `description`, `rating`, `reviewCount`, `reviews[]`.
- **Order**: `id`, `orderNumber`, `items[]`, `totalPrice`, `pointsEarned`, `pointsUsed`, `discount`, `paymentMethod`, `paymentStatus`, `shippingStatus` (`pending` $\to$ `processing` $\to$ `picked_up` $\to$ `in_transit` $\to$ `delivered`), `courier` (nama, foto, kendaraan, telepon, koordinat lokasi saat ini), `address`, `createdAt`, `timeline[]`.
- **User / Loyalty**: `id`, `name`, `email`, `phone`, `avatar`, `pointsBalance`, `tier` (`Sahabat Dapur`, `Juragan Sembako`), `vouchers[]`.
- **Review**: `id`, `productId`, `userName`, `userAvatar`, `rating`, `comment`, `date`, `verifiedPurchase`.
- **ChatMessage**: `id`, `sender` (`user` | `cs`), `text`, `timestamp`, `quickReplies[]`.
- **AnalyticsSummary**: `dailyRevenue`, `ordersToday`, `averageOrderValue`, `topSellingProducts[]`, `lowStockAlerts[]`.

### Interactive Component & State Mapping
- `StorefrontView`: Filter kategori (Semua, Beras, Minyak & Bumbu, Telur & Protein, Sayur Segar, Paket Hemat), pencarian cepat, kartu produk interaktif dengan indikator stok aktual.
- `ProductDetailModal`: Tampilan gambar besar, deskripsi nutrisi/penyimpanan, daftar ulasan bertanda verifikasi, formulir tambah ulasan baru.
- `CartDrawer & CheckoutModal`: Penghitungan otomatis subtotal, tukar poin dengan slider/tombol cepat, pilihan pembayaran (QRIS dinamis lengkap dengan QR code SVG, Virtual Account bank nasional, GoPay/OVO/ShopeePay, COD).
- `OrderTrackingView`: Peta simulasi interaktif SVG dengan rute gudang $\to$ alamat pembeli, posisi kurir yang bergerak dinamis, linimasa progres, tombol panggil/chat kurir, dan simulasi percepatan status untuk verifikasi penguji.
- `LoyaltyProgramView`: Kartu keanggotaan digital, saldo poin, katalog voucher potongan harga, dan riwayat transaksi poin.
- `LiveChatWidget`: Percakapan real-time dengan agen CS "K4 Care" lengkap dengan balasan otomatis ramah dan pesan interaktif.
- `AdminDashboardView`: Metrik penjualan harian real-time, grafik tren omzet, pemantauan inventaris otomatis dengan badge stok kritis (< 10 unit), serta tombol restock instan.
- `NotificationCenter`: Daftar riwayat notifikasi pesanan dan push pop-up banner saat status pesanan atau stok diperbarui.
- `DeviceSimulatorToggle`: Beralih antara mode layar penuh responsif dan mode simulator smartphone (iPhone/Android frame) sesuai preferensi pengguna.
