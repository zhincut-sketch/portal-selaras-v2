import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  query, orderBy, updateDoc, deleteDoc, doc, where, serverTimestamp 
} from "firebase/firestore";
import { 
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInWithCustomToken, signInAnonymously 
} from "firebase/auth";

// --- (MULAI) KONFIGURASI & DATA ---

// ==============================================================================
// ⚠️ TUGAS ANDA: PASTE CONFIG FIREBASE ANDA DI BAWAH INI ⚠️
// Catatan: Jika Anda menjalankan di Canvas, config akan otomatis diinjeksi.
// ==============================================================================

const manualConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// ==============================================================================

// Helper untuk mendapatkan ID Aplikasi dari environment
const appId = typeof __app_id !== 'undefined' ? __app_id : (manualConfig.appId || 'default-app-id');

// Inisialisasi Firebase dengan Safety Check
let db = null;
let auth = null;

try {
    // Prioritaskan config dari environment jika ada
    const configToUse = (typeof __firebase_config !== 'undefined' && __firebase_config)
        ? JSON.parse(__firebase_config) 
        : manualConfig;

    // Cek apakah config valid (tidak default string)
    if (configToUse.apiKey && configToUse.apiKey !== "ISI_API_KEY_ANDA_DISINI") {
        const app = initializeApp(configToUse);
        db = getFirestore(app);
        auth = getAuth(app);
        // Optional: setLogLevel('Debug') for debugging firestore.
        // setLogLevel('Debug');
    } else {
        console.warn("⚠️ Firebase Config belum diisi atau tidak valid. Fitur dinamis (chat, admin, komentar) akan non-aktif.");
    }
} catch (error) {
    console.error("Firebase Init Error:", error);
}

// Helper untuk path koleksi yang benar (CRITICAL FIX)
// Komentar Publik
const getCommentsCollection = (dbInstance) => {
    // Pastikan appId valid
    const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    return collection(dbInstance, 'artifacts', currentAppId, 'public', 'data', 'comments');
};

// Konsultasi Alumni / Q&A
const getConsultationCollection = (dbInstance) => {
    const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    return collection(dbInstance, 'artifacts', currentAppId, 'public', 'data', 'consultations');
};

// Lowongan Kerja (Loker)
const getJobsCollection = (dbInstance) => {
  const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  return collection(dbInstance, 'artifacts', currentAppId, 'public', 'data', 'jobs');
};

// Produk Alumni
const getProductsCollection = (dbInstance) => {
  const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  return collection(dbInstance, 'artifacts', currentAppId, 'public', 'data', 'products');
};

// --- TAMBAHAN HELPER KOLEKSI GALERI ---
const getGalleryCollection = (dbInstance) => {
  const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  return collection(dbInstance, 'artifacts', currentAppId, 'public', 'data', 'gallery');
};

// Ubah berbagai URL Google Drive menjadi URL gambar yang bisa ditampilkan
const convertDriveImage = (url) => {
  // Kalau belum ada / kosong → langsung pakai gambar default jabat tangan
  if (!url) {
    return 'https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=1000&auto=format&fit=crop';
  }

  // Ambil FILE_ID dari beberapa pola URL:
  // - https://drive.google.com/open?id=FILE_ID
  // - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  // - ...&id=FILE_ID
  const match = url.match(/(?:\/file\/d\/|[?&]id=)([a-zA-Z0-9_-]+)/);
  if (!match) return url; // kalau bukan link drive, pakai apa adanya

  const id = match[1];
  // Link langsung ke konten file
  return `https://drive.google.com/uc?export=view&id=${id}`;
};


// 1. URL DATABASE PUBLIK (Google Sheet - Output CSV)
const JADWAL_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTnz2hzmeoVMrKYwKuc1dOvW3mmkOSoPkug2UjSUwwAUKj3HrG5rvXMwd5bbuWKGI3MOOLHf-JxlY5U/pub?gid=0&single=true&output=csv";
const GALERI_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQZibbv1GsZEIS2VpQ7i88LWtq2TjQVMsePWxQxJQ3lbdbWY9k69b00eMdgTJzYQ4jY_bEu_KHLrmJ3/pub?gid=1399593239&single=true&output=csv"; 
const STATS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTnz2hzmeoVMrKYwKuc1dOvW3mmkOSoPkug2UjSUwwAUKj3HrG5rvXMwd5bbuWKGI3MOOLHf-JxlY5U/pub?gid=292919539&single=true&output=csv";
// Menggunakan URL baru untuk data peserta sesuai permintaan pengguna
const PESERTA_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTnz2hzmeoVMrKYwKuc1dOvW3mmkOSoPkug2UjSUwwAUKj3HrG5rvXMwd5bbuWKGI3MOOLHf-JxlY5U/pub?gid=1843512327&single=true&output=csv"; 
// URL LAKON DASAMUKA
const LOKER_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQsFQY1xmGZlkg6d_ttn2Jrzc0HM5OztCKPfZnRZOKNphNWQrKKjNWY3AbTcIYjwZ3S3_zoyvK_ImjZ/pub?gid=1841772565&single=true&output=csv";
const PRODUK_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQWbool9cFBa574TFpokKLYXQcVYmHYPwI0bI_WN7C_lB9rr3r0aTWGa7aSU1O1lPsyqevaSFCYKLNf/pub?gid=669152934&single=true&output=csv";

// 2. URL INTEGRASI CHAT
const CHAT_WEBHOOK_SELARAS = "https://n8n-ivxfgdjnye5x.kol.sumopod.my.id/webhook/Selaraschat";
const CHAT_WEBHOOK_KONSULTASI = "https://n8n-ivxfgdjnye5x.kol.sumopod.my.id/webhook/KonsultasiChat_Placeholder";

// Link External
const FORM_LOKER_URL = "https://forms.gle/5g1Whd6uvtU79bHi6";
const FORM_PRODUK_URL = "https://forms.gle/iHVrM4c9XNkbjE7w5";
const FORM_IMPORT_PESERTA_URL = "https://forms.google.com/your-import-peserta-form-url";
const FORM_GALERI_URL = "https://forms.gle/1pfUwJ731R8ddoRR6";

// --- DATA HELPER ---

// Static data removed as per original provided code logic, only CSVs are used.

const getScheduleStatus = (startDateStr, endDateStr) => {
  // 1. Cek Khusus: Jika salah satu tanggal berisi "segera hadir"
  if (
    (startDateStr && startDateStr.trim().toLowerCase() === "segera hadir") ||
    (endDateStr && endDateStr.trim().toLowerCase() === "segera hadir")
  ) {
    return "Akan Datang"; // Status otomatis jadi "Akan Datang"
  }

  // 2. Logika Tanggal Biasa (seperti sebelumnya)
  const today = new Date();
  // Set jam hari ini ke 00:00:00 agar perbandingan tanggal lebih akurat
  today.setHours(0, 0, 0, 0);

  if (!startDateStr || !endDateStr) return "Selesai"; // Anggap selesai jika data kosong

  try {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    
    // Cek validitas kedua tanggal
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        // Jika data ada tapi bukan tanggal valid (dan bukan "segera hadir"),
        // bisa dianggap "Akan Datang" (asumsi data belum fix) atau "Selesai".
        // Mari kita buat "Akan Datang" agar lebih aman infonya.
        return "Akan Datang"; 
    }

    if (today < startDate) return "Akan Datang";
    if (today > endDate) return "Selesai";
    return "Berlangsung"; // Jika hari ini ada di antara tanggal mulai dan selesai

  } catch (e) { return "Selesai"; }
};

// ADDED: Helper warna status
const getStatusColor = (status) => {
  switch (status) {
    case "Akan Datang": return "bg-yellow-500/20 text-yellow-300 border-yellow-500/50";
    case "Berlangsung": return "bg-emerald-500/20 text-emerald-300 border-emerald-500/50";
    case "Selesai": return "bg-red-500/20 text-red-300 border-red-500/50";
    default: return "bg-slate-700 text-slate-300 border-slate-600";
  }
};

const formatDate = (dateStr) => {
  // Jika data kosong, kembalikan strip
  if (!dateStr) return "-";

  // INI TAMBAHAN PENTINGNYA:
  // Cek dulu, kalau tulisannya "segera hadir", langsung tampilkan apa adanya.
  if (dateStr.trim().toLowerCase().includes("segera")) {
    return "Segera Hadir";
  }

  // Kalau bukan "segera hadir", baru coba format sebagai tanggal biasa
  try {
    const date = new Date(dateStr);
    // Kalau gagal jadi tanggal angka, kembalikan teks aslinya saja biar aman
    return isNaN(date.getTime()) ? dateStr : date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  } catch (e) { return dateStr; }
};

// Fungsi Parse CSV (Robust)
const parseCSV = (text) => {
  if (!text || typeof text !== 'string') return [];
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let insideQuote = false;
  const cleanText = text.replace(/\r/g, '');

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      currentRow.push(currentCell);
      currentCell = '';
    } else if (char === '\n' && !insideQuote) {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h ? h.trim().toLowerCase().replace(/\s/g, '').replace(/[^\w]/g, '') : '');
  
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((key, index) => {
      if (key && row[index] !== undefined) {
        let val = row[index].trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        obj[key] = val;
      }
    });
    return Object.keys(obj).length > 0 ? obj : null;
  }).filter(Boolean);
};

// Ubah URL Google Drive (open?id=FILE_ID atau file/d/FILE_ID/...) menjadi URL yang bisa di-embed di <img>
const convertToEmbedLink = (url) => {
  if (!url) return null;

  // 1. Ambil ID File dari link Google Drive
  const idMatch = url.match(/(?:[?&]id=|\/file\/d\/)([a-zA-Z0-9_-]+)/);

  if (!idMatch) return url; // Kalau bukan link drive, biarkan apa adanya

  const fileId = idMatch[1];

  // 2. GUNAKAN FORMAT "THUMBNAIL" (Trik Anti-Blokir)
  // parameter "&sz=w1000" artinya kita minta gambar ukuran lebar 1000px (HD)
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
};


// --- NORMALISASI DATA ---

const normalizeGalleryData = (rawItem) => {
    if (!rawItem) return null;
    const getVal = (keywords) => {
        const key = Object.keys(rawItem).find(k => keywords.some(kw => k.includes(kw)));
        return key ? rawItem[key] : "";
    };
    let type = getVal(['jenis', 'type', 'kategori', 'format']) || 'foto';
    if (type.toLowerCase().includes('video')) type = 'video';
    else type = 'foto';

    return {
        src: getVal(['link', 'url', 'upload', 'file', 'src', 'gambar', 'foto', 'video']),
        title: getVal(['judul', 'kegiatan', 'title', 'caption', 'keterangan']) || "Dokumentasi Kegiatan",
        type: type
    };
};

const normalizeLokerData = (rawItem, id) => {
    if (!rawItem) return null;
    const getVal = (keywords) => {
        const key = Object.keys(rawItem).find(k => keywords.some(kw => k.includes(kw)));
        return key ? rawItem[key] : "";
    };
    return {
        id: id,
        title: getVal(['judul', 'posisi', 'lowongan', 'pekerjaan']) || "Lowongan Tanpa Judul",
        company: getVal(['perusahaan', 'pt', 'cv', 'usaha']) || "Perusahaan Anonim",
        status: getVal(['status', 'jenis', 'tipe']) || "Full Time",
        location: getVal(['lokasi', 'penempatan', 'kota', 'domisili']) || "Magelang",
        education: getVal(['pendidikan', 'kualifikasi', 'lulusan']) || "SMA/SMK/Sederajat",
        regLink: getVal(['link', 'tautan', 'web', 'url', 'form']),
        deadline: getVal(['batas', 'akhir', 'deadline', 'tutup']),
        benefits: getVal(['tunjangan', 'fasilitas', 'benefit', 'gaji']),
        freshGrad: getVal(['fresh', 'graduate', 'pengalaman']) || "Boleh mendaftar",
        image: getVal(['gambar', 'foto', 'flyer', 'brosur', 'upload']) || "https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=1000&auto=format&fit=crop",
        desc: getVal(['deskripsi', 'keterangan', 'syarat', 'detail']) || "Hubungi kontak untuk detail lebih lanjut.",
        contact: getVal(['nomorpic', 'nopic', 'pic']) || getVal(['wa', 'kontak', 'hubungi']) || "628123456789"
    };
};

const normalizeProdukData = (rawItem, id) => {
    if (!rawItem) return null;
    const getVal = (keywords) => {
        const key = Object.keys(rawItem).find(k => keywords.some(kw => k.includes(kw)));
        return key ? rawItem[key] : "";
    };
    return {
        id: id,
        name: getVal(['nama_produk', 'produk', 'barang']) || "Produk Unggulan",
        alumni: getVal(['alumni', 'pemilik', 'penjual']) || "Alumni BLK",
        price: getVal(['harga', 'price', 'biaya']) || "Hubungi Penjual",
        image: getVal(['gambar', 'foto', 'image', 'upload']) || "https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?q=80&w=1000&auto=format&fit=crop",
        wa_message: `Halo, saya tertarik dengan produk ${getVal(['nama_produk']) || 'Anda'} dari web SELARAS.`,
        contact: getVal(['wa', 'kontak', 'hubungi', 'pesan']) || "628123456789",
        desc: getVal(['deskripsi', 'keterangan', 'detail', 'tentang']) || "Tidak ada deskripsi detail untuk produk ini.",
        delivery: getVal(['deliv', 'antar', 'kirim', 'delivery']) || "Konfirmasi Penjual",
        trainingInfo: getVal(['alumniapa', 'angkatan', 'tahun', 'pelatihan', 'program']) || "Alumni Pelatihan BLK",
        socialLink: getVal(['medsos', 'sosmed', 'instagram', 'facebook', 'link']) || ""
    };
};

// --- COMPONENTS ---

// --- COMPONENTS ---

// --- COMPONENTS ---

function Navbar({ setCurrentPage, user, onLogout }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  return (
    <header className="w-full fixed top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/10 shadow-sm shadow-emerald-900/20">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-2"> {/* Update: py-3 jadi py-2 agar lebih ramping */}
          
          {/* BAGIAN LOGO & TEKS (UPDATE DISINI) */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setCurrentPage("beranda")}>
            {/* 1. Logo Pemkot Magelang */}
            <img src="https://magelangkota.go.id/logo-kota-magelang.svg" className="w-10 h-12 md:w-12 md:h-14 object-contain drop-shadow-[0_0_5px_rgba(255,255,255,0.3)] group-hover:drop-shadow-[0_0_10px_rgba(16,185,129,0.8)] transition-all" alt="Logo Pemkot Magelang" />
            
            {/* 2. Teks 3 Baris */}
            <div className="flex flex-col justify-center">
              {/* Baris 1: Judul Utama */}
              <div className="font-bold text-base md:text-lg leading-tight text-white group-hover:text-emerald-300 transition-colors">SELARAS</div>
              
              {/* Baris 2 & 3: Subjudul (Hidden di HP sangat kecil agar tidak penuh) */}
              <div className="hidden sm:block">
                  <div className="text-[10px] md:text-xs text-slate-300 leading-tight">UPT Balai Latihan Kerja</div>
                  {/* Update: Menambahkan baris Dinas Tenaga Kerja */}
                  <div className="text-[10px] md:text-xs text-slate-300 leading-tight">Dinas Tenaga Kerja – Kota Magelang</div>
              </div>
            </div>
          </div>
          {/* BATAS AKHIR UPDATE LOGO & TEKS */}

          <nav className="hidden md:flex gap-6 text-sm items-center text-slate-200">
            <button onClick={() => setCurrentPage("beranda")} className="hover:text-emerald-300 transition-colors font-medium">Beranda</button>
            <button onClick={() => setCurrentPage("dasamuka")} className="hover:text-emerald-300 transition-colors font-medium">Lakon Dasamuka</button>
            {user && !user.isAnonymous ? (
              <div className="flex items-center gap-4">
                <button onClick={() => setCurrentPage("dashboard")} className="text-emerald-400 font-bold border border-emerald-500/50 rounded-full px-4 py-1.5 hover:bg-emerald-500/10 transition-all">Dashboard Admin</button>
                <button onClick={onLogout} className="text-red-400 hover:text-red-300 transition-colors">Keluar</button>
              </div>
            ) : (
              <button onClick={() => setCurrentPage("login")} className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg hover:shadow-emerald-500/50 transition-all">Masuk Pegawai</button>
            )}
          </nav>
          <div className="md:hidden">
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-200 p-2 hover:text-emerald-400 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
          </div>
        </div>
        {isMobileMenuOpen && (
          <div className="md:hidden bg-slate-900/95 backdrop-blur-md border-b border-white/10 p-4 flex flex-col gap-4 text-sm text-slate-200 animate-fade-in">
              <button onClick={() => {setCurrentPage("beranda"); setIsMobileMenuOpen(false)}} className="text-left py-2 hover:text-emerald-400 border-b border-white/5">Beranda</button>
              <button onClick={() => {setCurrentPage("dasamuka"); setIsMobileMenuOpen(false)}} className="text-left py-2 hover:text-emerald-400 border-b border-white/5">Lakon Dasamuka</button>
              <div className="pt-2">
               {user && !user.isAnonymous ? <button onClick={onLogout} className="text-red-400 font-bold w-full text-left py-2">Keluar</button> : <button onClick={() => {setCurrentPage("login"); setIsMobileMenuOpen(false)}} className="text-emerald-400 font-bold w-full text-left py-2">Masuk Pegawai</button>}
              </div>
          </div>
        )}
    </header>
  );
}

// --- NEW ADMIN TICKET ITEM COMPONENT (Internal to ConsultationAdminView) ---

function TicketItemAdmin({ ticket, dbInstance, StatusBadge }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [isReplying, setIsReplying] = useState(false);
    const repliesEndRef = useRef(null);

    const scrollToBottom = () => { repliesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };
    useEffect(() => {
        if (isExpanded) {
            setTimeout(scrollToBottom, 100); 
        }
    }, [isExpanded, ticket.replies.length]);
    
    const handleReply = async (e) => {
        e.preventDefault();
        if (!dbInstance || !replyText.trim()) return;

        setIsReplying(true);
        try {
            const newReply = {
                type: 'admin',
                text: replyText.trim(),
                createdAt: new Date().toISOString(),
            };
            
            const currentReplies = ticket.replies || [];
            currentReplies.push(newReply);

            await updateDoc(doc(getConsultationCollection(dbInstance), ticket.id), {
                replies: currentReplies,
                status: 'answered', // Set status ke answered setelah dibalas
                lastUpdate: serverTimestamp()
            });

            setReplyText('');
            setIsExpanded(true); // Biarkan tetap terbuka untuk potensi balasan lanjutan
        } catch (e) {
            console.error("Error submitting admin reply:", e);
        } finally {
            setIsReplying(false);
        }
    }
    
    const handleCloseTicketAdmin = async () => {
        if (!dbInstance) return;
        
        // Custom Modal UI instead of window.confirm
        const isConfirmed = await new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 animate-fade-in';
            modal.innerHTML = `
                <div class="bg-slate-900 border border-red-500/50 text-white rounded-xl w-full max-w-sm shadow-2xl p-6">
                    <h3 class="text-xl font-bold mb-4 text-red-400">Konfirmasi Penutupan Tiket</h3>
                    <p class="text-slate-300 mb-6 text-sm">Anda yakin ingin MENUTUP tiket dari ${ticket.name}? Aksi ini akan menghentikan diskusi.</p>
                    <div class="flex justify-end gap-3">
                        <button id="cancelBtn" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-semibold">Batal</button>
                        <button id="confirmBtn" class="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white text-sm font-semibold">Tutup Tiket</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            document.getElementById('cancelBtn').onclick = () => { document.body.removeChild(modal); resolve(false); };
            document.getElementById('confirmBtn').onclick = () => { document.body.removeChild(modal); resolve(true); };
        });

        if (!isConfirmed) return;
        
        try {
            await updateDoc(doc(getConsultationCollection(dbInstance), ticket.id), {
                status: 'closed',
                lastUpdate: serverTimestamp()
            });
            setIsExpanded(false);
        } catch (e) {
            console.error("Error closing ticket from admin:", e);
        }
    }
    
    const isAnswered = ticket.replies && ticket.replies.some(r => r.type === 'admin');
    // Status ditampilkan sebagai 'answered' jika sudah ada balasan admin dan status belum 'closed'
    const displayStatus = isAnswered && ticket.status !== 'closed' ? 'answered' : ticket.status;
    const repliesCount = ticket.replies ? ticket.replies.length + 1 : 1; 

    return (
        <div className={`bg-slate-900 rounded-xl shadow-lg transition-all ${displayStatus === 'open' ? 'border-yellow-500 border-2' : 'border border-slate-700'}`}>
            <div 
                className="p-4 cursor-pointer hover:bg-slate-800 transition-colors rounded-xl flex justify-between items-center"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className='flex flex-col gap-1 w-full'>
                    <div className='flex items-center gap-3'>
                        <span className='font-bold text-white text-md flex-1 truncate'>{ticket.question}</span>
                        <StatusBadge status={displayStatus} />
                    </div>
                    <p className='text-xs text-slate-500'>
                        Dari: <span className='text-emerald-400 font-semibold'>{ticket.name}</span> | Kontak: {ticket.contact} | {repliesCount} Balasan
                    </p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-400 transition-transform ml-4 shrink-0 ${isExpanded ? 'rotate-180' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>

            {isExpanded && (
                <div className='border-t border-slate-700 p-4 space-y-4'>
                    {/* RIWAYAT CHAT */}
                    <div className='max-h-64 overflow-y-auto space-y-3 custom-scrollbar p-1'>
                            {/* Initial Question (User) */}
                        <div className={`flex justify-end`}>
                            <div className={`max-w-[90%] p-3 rounded-xl text-sm leading-relaxed shadow-sm bg-blue-600 text-white rounded-tr-none`}>
                                <p className='font-semibold mb-1'>[Pertanyaan Awal] - {ticket.name}</p>
                                {ticket.question}
                                <span className='block text-[10px] text-blue-200 mt-2 text-right'>
                                    {ticket.createdAt ? new Date(ticket.createdAt.seconds * 1000).toLocaleTimeString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Baru saja'}
                                </span>
                            </div>
                        </div>
                            {/* Replies */}
                        {ticket.replies.map((reply, idx) => (
                            <div key={idx} className={`flex ${reply.type === 'admin' ? 'justify-start' : 'justify-end'}`}>
                                <div className={`max-w-[90%] p-3 rounded-xl text-sm leading-relaxed shadow-sm ${reply.type === 'admin' ? 'bg-emerald-700 text-white rounded-tl-none' : 'bg-blue-600 text-white rounded-tr-none'}`}>
                                    <p className='font-semibold mb-1'>[{reply.type === 'admin' ? 'Jawaban Petugas' : 'Tanggapan Alumni'}]</p>
                                    {reply.text}
                                    <span className={`block text-[10px] mt-2 text-right ${reply.type === 'admin' ? 'text-emerald-200' : 'text-blue-200'}`}>
                                            {new Date(reply.createdAt || Date.now()).toLocaleTimeString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        ))}
                        <div ref={repliesEndRef} />
                    </div>
                    
                    {/* REPLY / ACTION SECTION */}
                    {displayStatus !== 'closed' ? (
                        <div className='mt-4 pt-4 border-t border-slate-700'>
                            <h5 className='text-sm font-semibold text-white mb-2'>Balas Alumni</h5>
                            <form onSubmit={handleReply} className='flex gap-2'>
                                <textarea 
                                    rows="2" 
                                    value={replyText} 
                                    onChange={(e) => setReplyText(e.target.value)} 
                                    placeholder="Ketik balasan Anda (wajib dijawab jika status 'Menunggu Petugas')..."
                                    className='flex-1 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white resize-none focus:outline-none focus:border-emerald-500'
                                    required
                                />
                                <button 
                                    type="submit" 
                                    disabled={isReplying || !replyText.trim()}
                                    className='px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-bold rounded-lg text-sm transition-colors self-end shrink-0'
                                >
                                    {isReplying ? "Mengirim..." : "Kirim Balasan"}
                                </button>
                            </form>
                            <button
                                type="button"
                                onClick={handleCloseTicketAdmin}
                                className='mt-2 text-xs text-red-400 hover:text-red-300 underline'
                            >
                                Tutup Tiket Ini (Selesai)
                            </button>
                        </div>
                    ) : (
                        <div className='mt-4 pt-4 border-t border-slate-700 text-center text-sm text-slate-500'>
                            Tiket ini sudah ditutup.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// --- NEW COMPONENT: ConsultationAdminView (Admin Interface) ---
function ConsultationAdminView({ dbInstance, onBack }) {
    const [tickets, setTickets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState('open'); // open, answered, closed, all
    const filterOptions = [
        { key: 'open', label: 'Menunggu Petugas' },
        { key: 'answered', label: 'Sudah Dijawab' },
        { key: 'closed', label: 'Selesai' },
        { key: 'all', label: 'Semua Tiket' }
    ];

    // 1. Fetch ALL consultation tickets
    useEffect(() => {
        if (!dbInstance) {
            setIsLoading(false);
            return;
        }

        // Fetch all tickets. Filtering by status will be done locally for flexibility.
        const q = query(getConsultationCollection(dbInstance), orderBy("lastUpdate", "desc"));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedTickets = snapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data(),
                replies: doc.data().replies || [] 
            }));

            setTickets(fetchedTickets);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching consultations for admin:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [dbInstance]);
    
    // Helper function for the badges used in both admin and alumni view
    const StatusBadge = ({ status }) => {
        let text, color;
        switch(status) {
            case 'open': 
                text = 'Menunggu Petugas'; 
                color = 'bg-yellow-600 text-yellow-100'; 
                break;
            case 'answered': 
                text = 'Sudah Dijawab'; 
                color = 'bg-emerald-600 text-emerald-100'; 
                break;
            case 'closed': 
                text = 'Selesai'; 
                color = 'bg-slate-600 text-slate-300'; 
                break;
            default: 
                text = 'N/A'; 
                color = 'bg-slate-500'; 
        }
        return (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${color}`}>
                {text}
            </span>
        );
    };

    const filteredTickets = tickets.filter(ticket => {
        const isAnswered = ticket.replies && ticket.replies.some(r => r.type === 'admin');
        const displayStatus = isAnswered && ticket.status !== 'closed' ? 'answered' : ticket.status;
        
        if (filter === 'all') return true;
        if (filter === 'answered') return displayStatus === 'answered';
        
        // This handles 'open' and 'closed' precisely matching the stored status
        return ticket.status === filter;
    });

    const getTicketCount = (statusKey) => {
        if (statusKey === 'all') return tickets.length;
        return tickets.filter(ticket => {
            const isAnswered = ticket.replies && ticket.replies.some(r => r.type === 'admin');
            const displayStatus = isAnswered && ticket.status !== 'closed' ? 'answered' : ticket.status;
            
            if (statusKey === 'answered') return displayStatus === 'answered';
            return ticket.status === statusKey;
        }).length;
    };
    
    return (
        <div className="animate-fade-in">
            <button onClick={onBack} className="text-emerald-400 mb-4 flex items-center gap-2 hover:underline">
                ← Kembali ke Dashboard
            </button>
            <h2 className="text-2xl font-bold text-white mb-6">Kelola Tiket Konsultasi ({getTicketCount(filter)})</h2>
            
            <div className='flex flex-wrap gap-3 p-4 bg-slate-800 border border-slate-700 rounded-xl mb-6'>
                {filterOptions.map(option => (
                    <button
                        key={option.key}
                        onClick={() => setFilter(option.key)}
                        className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${filter === option.key ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                    >
                        {option.label} ({getTicketCount(option.key)})
                    </button>
                ))}
            </div>

            <div className='space-y-4'>
                {isLoading ? (
                    <div className="text-center py-12 text-emerald-400">Memuat tiket...</div>
                ) : filteredTickets.length === 0 ? (
                    <div className="text-center p-10 bg-slate-900 rounded-xl border border-slate-800 text-slate-500">
                        Tidak ada tiket konsultasi pada filter "{filterOptions.find(o => o.key === filter).label}".
                    </div>
                ) : (
                    filteredTickets.map(ticket => (
                        <TicketItemAdmin 
                            key={ticket.id}
                            ticket={ticket}
                            dbInstance={dbInstance}
                            StatusBadge={StatusBadge}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

// ==============================================================================
// 1. KOMPONEN UTAMA DASHBOARD PAGE (VERSI FINAL: GFORM LINK + HAPUS ITEM)
// ==============================================================================
function DashboardPage({ user, pesertaData, kejuruanOptions, isLoading, error, onBackToHome }) {
    const [view, setView] = useState('main');
    
    // --- STATE DATA ---
    const [pendingComments, setPendingComments] = useState([]);
    const [approvedComments, setApprovedComments] = useState([]);
    
    const [pendingJobs, setPendingJobs] = useState([]);
    const [approvedJobs, setApprovedJobs] = useState([]);
    
    const [pendingProducts, setPendingProducts] = useState([]);
    const [approvedProducts, setApprovedProducts] = useState([]);
    
    // STATE GALERI (Hanya List Item untuk dihapus, TIDAK ADA input manual lagi)
    const [galleryItems, setGalleryItems] = useState([]);
    const [isModerating, setIsModerating] = useState(false);

    // --- 2. FETCH DATA REALTIME ---
    useEffect(() => {
        if (!db || !user) return;

        // A. KOMENTAR
        const u1 = onSnapshot(query(getCommentsCollection(db), where("status", "==", "pending")), (s) => setPendingComments(s.docs.map(d => ({id:d.id, ...d.data()}))));
        const u2 = onSnapshot(query(getCommentsCollection(db), where("status", "==", "approved"), orderBy("createdAt", "desc")), (s) => setApprovedComments(s.docs.map(d => ({id:d.id, ...d.data()}))));
        
        // B. LOKER
        const u3 = onSnapshot(query(getJobsCollection(db), where("moderationStatus", "==", "pending")), (s) => setPendingJobs(s.docs.map(d => ({id:d.id, ...d.data()}))));
        const u4 = onSnapshot(query(getJobsCollection(db), where("moderationStatus", "==", "approved")), (s) => setApprovedJobs(s.docs.map(d => ({id:d.id, ...d.data()}))));
        
        // C. PRODUK
        const u5 = onSnapshot(query(getProductsCollection(db), where("moderationStatus", "==", "pending")), (s) => setPendingProducts(s.docs.map(d => ({id:d.id, ...d.data()}))));
        const u6 = onSnapshot(query(getProductsCollection(db), where("moderationStatus", "==", "approved")), (s) => setApprovedProducts(s.docs.map(d => ({id:d.id, ...d.data()}))));
        
        // D. GALERI (Ambil dari Firestore agar bisa dihapus)
        const u7 = onSnapshot(query(getGalleryCollection(db), orderBy("createdAt", "desc")), (s) => setGalleryItems(s.docs.map(d => ({ id: d.id, ...d.data() }))));

        return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); };
    }, [user]);

    // --- 3. ACTION HANDLERS ---

    // Hapus Permanen (Generic untuk semua koleksi)
    const handleDelete = async (collectionFunc, id, name) => {
        if (!window.confirm(`⚠️ Yakin ingin MENGHAPUS PERMANEN "${name}"? Data tidak bisa kembali.`)) return;
        setIsModerating(true);
        try { await deleteDoc(doc(collectionFunc(db), id)); } 
        catch (e) { console.error(e); alert("Gagal menghapus data."); } 
        finally { setIsModerating(false); }
    };

    // Approve / Update Status
    const handleStatusUpdate = async (collectionFunc, id, field, val) => {
        setIsModerating(true);
        try { 
            await updateDoc(doc(collectionFunc(db), id), { 
                [field]: val, 
                approvedAt: serverTimestamp(),
                approvedBy: user?.email || 'admin' 
            }); 
        } 
        catch (e) { console.error(e); } 
        finally { setIsModerating(false); }
    };

    // --- 4. RENDER SUB-VIEWS ---

    // VIEW 1: MANAJEMEN GALERI (UPDATED: HANYA TOMBOL LINK & LIST HAPUS)
    if (view === 'gallery') {
        return (
            <section className="pt-24 md:pt-32 pb-16 min-h-screen bg-slate-950">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                        <div>
                            <button onClick={() => setView('main')} className="text-emerald-400 mb-2 flex items-center gap-2 hover:underline">← Kembali ke Dashboard</button>
                            <h2 className="text-2xl font-bold text-white">Manajemen Galeri Foto</h2>
                        </div>
                        
                        {/* TOMBOL INPUT KHUSUS KE GOOGLE FORM */}
                        <a href={FORM_GALERI_URL} target="_blank" rel="noreferrer" className="px-6 py-3 bg-pink-600 hover:bg-pink-500 text-white text-sm font-bold rounded-xl shadow-lg flex items-center gap-2 transition-all transform hover:scale-105 hover:shadow-pink-500/20">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            <span>Input Galeri Baru (Via GForm)</span>
                        </a>
                    </div>

                    {galleryItems.length === 0 ? (
                        <div className="text-center p-12 bg-slate-900 border border-slate-800 rounded-xl">
                            <p className="text-slate-500">Belum ada foto yang tampil. Silakan input via tombol di atas.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {galleryItems.map(item => (
                                <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden group relative hover:border-pink-500/50 transition-all">
                                    <div className="h-40 bg-slate-800 relative">
                                        <img 
                                            src={convertToEmbedLink(item.src) || "https://placehold.co/600x400?text=No+Image"} 
                                            alt={item.title}
                                            referrerPolicy="no-referrer"
                                            className="w-full h-full object-cover"
                                            onError={(e) => e.target.src = "https://placehold.co/600x400?text=Error"}
                                        />
                                        {/* Overlay Judul */}
                                        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 to-transparent p-2">
                                            <p className="text-[10px] font-bold text-white line-clamp-2">{item.title}</p>
                                        </div>
                                    </div>
                                    
                                    {/* Tombol Hapus */}
                                    <button 
                                        onClick={() => handleDelete(getGalleryCollection, item.id, item.title)} 
                                        className="w-full py-2 bg-red-900/20 text-red-400 border-t border-slate-800 hover:bg-red-600 hover:text-white text-[10px] font-bold uppercase transition-all"
                                    >
                                        Hapus Permanen
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        );
    }

    // VIEW 2: MODERASI KOMENTAR
    if (view === 'moderasi') {
        return (
            <section className="pt-24 md:pt-32 pb-16 min-h-screen bg-slate-950">
                <div className="max-w-5xl mx-auto px-4">
                    <button onClick={() => setView('main')} className="text-emerald-400 mb-4 flex items-center gap-2 hover:underline">← Kembali ke Dashboard</button>
                    
                    {/* Pending */}
                    <h2 className="text-xl font-bold text-yellow-400 mb-4 border-b border-white/10 pb-2">Moderasi Komentar Baru ({pendingComments.length})</h2>
                    <div className="space-y-4 mb-10">
                        {pendingComments.length === 0 ? <p className="text-slate-600 text-sm italic">Tidak ada komentar baru.</p> : pendingComments.map((comment) => (
                            <div key={comment.id} className="bg-slate-900 border border-yellow-500/30 p-4 rounded-xl flex justify-between items-center gap-4 animate-fade-in">
                                <div>
                                    <div className="font-bold text-emerald-400 text-sm">{comment.name} <span className="text-slate-500 font-normal">({comment.date})</span></div>
                                    <p className="text-slate-200 text-sm mt-1">{comment.comment}</p>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <button onClick={() => handleStatusUpdate(getCommentsCollection, comment.id, "status", "approved")} disabled={isModerating} className="px-3 py-1 bg-emerald-600 rounded text-xs font-bold text-white hover:bg-emerald-500">Terima</button>
                                    <button onClick={() => handleDelete(getCommentsCollection, comment.id, "Komentar")} disabled={isModerating} className="px-3 py-1 bg-red-600 rounded text-xs font-bold text-white hover:bg-red-500">Hapus</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Approved */}
                    <h2 className="text-xl font-bold text-emerald-500 mb-4 border-b border-white/10 pb-2">Komentar Tayang ({approvedComments.length})</h2>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {approvedComments.map((comment) => (
                            <div key={comment.id} className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg flex justify-between items-center gap-4">
                                <div className="flex-1">
                                    <div className="font-bold text-slate-300 text-xs">{comment.name} <span className="text-slate-500">({comment.date})</span></div>
                                    <p className="text-slate-400 text-xs mt-1 line-clamp-2">{comment.comment}</p>
                                </div>
                                <button onClick={() => handleDelete(getCommentsCollection, comment.id, "Komentar")} disabled={isModerating} className="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-[10px] font-bold text-red-400 hover:bg-red-900/30 hover:border-red-500 shrink-0">Hapus</button>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    // VIEW 3: LOKER & PRODUK
    if (view === 'lokerProduk') {
        return (
            <section className="pt-24 md:pt-32 pb-16 min-h-screen bg-slate-950">
                <div className="max-w-6xl mx-auto px-4">
                    <button onClick={() => setView('main')} className="text-emerald-400 mb-4 flex items-center gap-2 hover:underline">← Kembali ke Dashboard</button>
                    <h2 className="text-2xl font-bold text-white mb-2">Manajemen Loker & Produk</h2>
                    <p className="text-xs text-slate-400 mb-8">Setujui item baru atau hapus item lama yang sudah kadaluarsa.</p>

                    {/* GROUP LOKER */}
                    <div className="mb-12">
                        <h3 className="text-xl font-bold text-emerald-300 mb-4 flex items-center gap-2">Lowongan Kerja</h3>
                        
                        <div className="mb-6">
                            <h4 className="text-sm font-bold text-yellow-400 mb-3 uppercase tracking-wider">Menunggu Persetujuan ({pendingJobs.length})</h4>
                            {pendingJobs.length === 0 ? <p className="text-slate-600 text-xs italic">Tidak ada lowongan pending.</p> : 
                            <div className="grid md:grid-cols-2 gap-4">
                                {pendingJobs.map(job => (
                                    <AdminCardItem key={job.id} item={job} type="loker" isPending={true} 
                                        onApprove={() => handleStatusUpdate(getJobsCollection, job.id, "moderationStatus", "approved")} 
                                        onDelete={() => handleDelete(getJobsCollection, job.id, job.title)} 
                                        disabled={isModerating} 
                                    />
                                ))}
                            </div>}
                        </div>

                        <div>
                            <h4 className="text-sm font-bold text-emerald-600 mb-3 uppercase tracking-wider">Sedang Tayang ({approvedJobs.length})</h4>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {approvedJobs.map(job => (
                                    <AdminCardItem key={job.id} item={job} type="loker" isPending={false} 
                                        onDelete={() => handleDelete(getJobsCollection, job.id, job.title)} 
                                        disabled={isModerating} 
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="w-full h-px bg-slate-800 my-8"></div>

                    {/* GROUP PRODUK */}
                    <div>
                        <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">Produk Alumni</h3>
                        
                        <div className="mb-6">
                            <h4 className="text-sm font-bold text-yellow-400 mb-3 uppercase tracking-wider">Menunggu Persetujuan ({pendingProducts.length})</h4>
                            {pendingProducts.length === 0 ? <p className="text-slate-600 text-xs italic">Tidak ada produk pending.</p> : 
                            <div className="grid md:grid-cols-2 gap-4">
                                {pendingProducts.map(prod => (
                                    <AdminCardItem key={prod.id} item={prod} type="produk" isPending={true} 
                                        onApprove={() => handleStatusUpdate(getProductsCollection, prod.id, "moderationStatus", "approved")} 
                                        onDelete={() => handleDelete(getProductsCollection, prod.id, prod.name)} 
                                        disabled={isModerating} 
                                    />
                                ))}
                            </div>}
                        </div>

                        <div>
                            <h4 className="text-sm font-bold text-blue-600 mb-3 uppercase tracking-wider">Sedang Tayang ({approvedProducts.length})</h4>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {approvedProducts.map(prod => (
                                    <AdminCardItem key={prod.id} item={prod} type="produk" isPending={false} 
                                        onDelete={() => handleDelete(getProductsCollection, prod.id, prod.name)} 
                                        disabled={isModerating} 
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        );
    }
    
    // VIEW 4: CONSULTATION
    if (view === 'consultation') {
        return (
             <section className="pt-24 md:pt-32 pb-16 min-h-screen bg-slate-950">
                 <div className="max-w-6xl mx-auto px-4">
                     <ConsultationAdminView dbInstance={db} onBack={() => setView('main')} />
                 </div>
             </section>
        );
    }
    
    // VIEW 5: PESERTA
    if (view === 'peserta') {
        return (
            <section className="pt-24 md:pt-32 pb-16 min-h-screen bg-slate-950">
                <div className="max-w-6xl mx-auto px-4">
                    <PesertaDatabaseView pesertaData={pesertaData} isLoading={isLoading} error={error} onBack={() => setView('main')} kejuruanOptions={kejuruanOptions} />
                </div>
            </section>
        );
    }

    // MAIN VIEW (MENU UTAMA DASHBOARD)
    return (
        <section className="pt-24 md:pt-32 pb-16 min-h-screen bg-slate-950">
            <div className="max-w-6xl mx-auto px-4">
                <div className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-white">Dashboard Admin</h1>
                        <p className="text-slate-400">Selamat datang, {user.email || "Petugas"}</p>
                    </div>
                </div>
                {!db && <div className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded-lg text-red-200 text-sm font-bold animate-pulse">⚠️ Database Belum Terkoneksi.</div>}
                
                <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <DashButton icon="💬" label="Komentar" count={pendingComments.length} onClick={() => setView('moderasi')} color="emerald" />
                    <DashButton icon="💼" label="Loker & Produk" count={pendingJobs.length + pendingProducts.length} onClick={() => setView('lokerProduk')} color="blue" />
                    <DashButton icon="📷" label="Manajemen Galeri" count={galleryItems.length} onClick={() => setView('gallery')} color="pink" />
                    <DashButton icon="🙋‍♂️" label="Konsultasi" count={0} onClick={() => setView('consultation')} color="yellow" />
                    <DashButton icon="👥" label="Data Peserta" count={0} onClick={() => setView('peserta')} color="purple" />
                </div>

                <div className="mt-8 bg-slate-900 p-6 rounded-xl border border-slate-800">
                    <h3 className="text-white font-bold mb-4">Link Cepat Input Data</h3>
                    <div className="flex flex-wrap gap-4 text-sm">
                        <a href={FORM_LOKER_URL} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg text-blue-400 hover:text-white hover:bg-blue-600 transition-all border border-slate-700">
                            <span>💼</span> Input Loker
                        </a>
                        <a href={FORM_PRODUK_URL} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg text-blue-400 hover:text-white hover:bg-blue-600 transition-all border border-slate-700">
                            <span>📦</span> Input Produk
                        </a>
                        <a href={FORM_GALERI_URL} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg text-pink-400 hover:text-white hover:bg-pink-600 transition-all border border-slate-700">
                            <span>📷</span> Input Galeri
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
}

// ==============================================================================
// 2. KOMPONEN PENDUKUNG (ADMIN CARD ITEM - JANGAN LUPA DICOPY JUGA)
// ==============================================================================
function AdminCardItem({ item, type, isPending, onApprove, onDelete, disabled }) {
    const imageUrl = item.image ? convertToEmbedLink(item.image) : (
        type === 'loker' 
        ? "https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=1000&auto=format&fit=crop"
        : "https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?q=80&w=1000&auto=format&fit=crop"
    );

    return (
        <div className={`relative bg-slate-900 rounded-xl overflow-hidden border ${isPending ? 'border-yellow-500/40' : 'border-slate-800'} flex flex-col`}>
            <div className="h-32 bg-slate-800 relative group">
                 <img 
                    src={imageUrl} 
                    alt={item.title || item.name} 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={(e) => e.target.src = "https://placehold.co/600x400/1e293b/FFFFFF?text=No+Image"}
                />
                {isPending && <div className="absolute top-2 right-2 bg-yellow-500 text-slate-900 text-[10px] font-bold px-2 py-0.5 rounded shadow">PENDING</div>}
                {!isPending && <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">AKTIF</div>}
            </div>

            <div className="p-3 flex-1 flex flex-col">
                <h4 className="font-bold text-white text-sm line-clamp-1 mb-1" title={item.title || item.name}>{item.title || item.name}</h4>
                <p className="text-xs text-slate-400 mb-3">{type === 'loker' ? item.company : `Oleh: ${item.alumni}`}</p>
                
                <div className="mt-auto flex gap-2 pt-2 border-t border-slate-800/50">
                    {isPending && (
                        <button onClick={onApprove} disabled={disabled} className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded transition-colors">
                            Setujui
                        </button>
                    )}
                    <button onClick={onDelete} disabled={disabled} className={`flex-1 py-1.5 ${isPending ? 'bg-red-600 hover:bg-red-500' : 'bg-slate-800 border border-slate-700 hover:bg-red-900/40 hover:border-red-500 text-red-400'} text-xs font-bold rounded transition-colors`}>
                        {isPending ? 'Tolak' : 'Hapus'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ==============================================================================
// 3. KOMPONEN PENDUKUNG (DASHBOARD BUTTON - JANGAN LUPA DICOPY JUGA)
// ==============================================================================
function DashButton({ icon, label, count, onClick, color }) {
    const colors = {
        emerald: "border-emerald-500/30 hover:border-emerald-500 group-hover:text-emerald-400",
        blue: "border-blue-500/30 hover:border-blue-500 group-hover:text-blue-400",
        yellow: "border-yellow-500/30 hover:border-yellow-500 group-hover:text-yellow-400",
        purple: "border-purple-500/30 hover:border-purple-500 group-hover:text-purple-400",
        pink: "border-pink-500/30 hover:border-pink-500 group-hover:text-pink-400",
    };
    return (
        <button onClick={onClick} className={`bg-slate-900 p-5 rounded-xl border ${colors[color] || colors.emerald} hover:bg-slate-800 transition-all text-left relative group shadow-lg`}>
            <div className="flex justify-between items-start mb-3">
                <div className="text-3xl">{icon}</div>
                {count > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-bounce shadow-md">{count}</span>}
            </div>
            <h3 className={`font-bold text-white text-sm ${colors[color]?.split(" ").pop()}`}>{label}</h3>
        </button>
    );
}


// --- KOMPONEN PESERTA DATABASE (HELPER DASHBOARD) ---
function PesertaDatabaseView({ pesertaData, isLoading, error, onBack, kejuruanOptions }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterKejuruan, setFilterKejuruan] = useState("Semua");

  const filteredData = pesertaData.filter(peserta => {
    // Memperluas filter untuk mencari berdasarkan Nama, Alamat, Kejuruan, atau Tahun
    const lowerSearchTerm = searchTerm.toLowerCase();
    const namaMatch = peserta.nama?.toLowerCase().includes(lowerSearchTerm);
    const nikMatch = peserta.nik?.includes(lowerSearchTerm); // Mempertahankan nik filter
    const alamatMatch = peserta.alamat?.toLowerCase().includes(lowerSearchTerm);
    const tahunMatch = peserta.tahun?.includes(lowerSearchTerm);
    
    const kejuruanMatch = filterKejuruan === "Semua" || peserta.kejuruan === filterKejuruan;
    
    return (namaMatch || nikMatch || alamatMatch || tahunMatch) && kejuruanMatch;
  });

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>Kembali ke Dashboard
          </button>
          <h2 className="text-2xl font-bold text-white">Database Peserta</h2>
        </div>
        <a href={FORM_IMPORT_PESERTA_URL} target="_blank" rel="noreferrer" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg flex items-center gap-2">
          Import Data
        </a>
      </div>
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          {/* UPDATE: Placeholder text disesuaikan */}
          <input type="text" placeholder="Cari Nama, Alamat, NIK, atau Tahun..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
        </div>
        <div><select value={filterKejuruan} onChange={(e) => setFilterKejuruan(e.target.value)} className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">{kejuruanOptions.map(k => <option key={k} value={k}>{k}</option>)}</select></div>
      </div>
      <div className="overflow-hidden bg-slate-900 border border-slate-800 rounded-xl shadow-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            {/* UPDATE: Header kolom sesuai permintaan */}
            <thead className="bg-slate-800 text-slate-300 uppercase text-xs font-bold">
              <tr>
                <th className="px-6 py-3">Nama</th>
                <th className="px-6 py-3">Alamat</th>
                <th className="px-6 py-3">Kejuruan</th>
                <th className="px-6 py-3">Anggaran</th>
                <th className="px-6 py-3">Tahun</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {/* UPDATE: Render 5 kolom baru */}
              {isLoading ? <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-400 animate-pulse">Memuat...</td></tr> : filteredData.map((peserta, idx) => (
                <tr key={idx} className="hover:bg-slate-800/50">
                  <td className="px-6 py-4 text-white font-medium">{peserta.nama || '-'}</td>
                  <td className="px-6 py-4 text-slate-300">{peserta.alamat || '-'}</td>
                  <td className="px-6 py-4 text-slate-300">{peserta.kejuruan || '-'}</td>
                  <td className="px-6 py-4 text-slate-300">{peserta.anggaran || '-'}</td>
                  <td className="px-6 py-4 text-slate-300">{peserta.tahun || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- KOMPONEN BERANDA (VERSI FINAL: GALERI GABUNG + NAVIGASI PANDUAN) ---
function BerandaPage({ allStatsData, staticStatsData, allScheduleData, galleryData, kejuruanOptions, isLoading, error, setCurrentPage }) {
  // CATATAN: State 'galleryType' sudah DIHAPUS karena tidak dipakai lagi.
  
  const [yearFilter, setYearFilter] = useState("berjalan");
  const [kejuruanFilter, setKejuruanFilter] = useState("Semua");
  const [statusFilter, setStatusFilter] = useState("Semua");
  const [selectedStatYear, setSelectedStatYear] = useState(new Date().getFullYear());
  const currentYear = new Date().getFullYear();

  // --- LOGIKA FILTER JADWAL ---
  const filteredSchedule = allScheduleData.filter(item => {
    const status = getScheduleStatus(item.startdate, item.enddate);
    const itemYear = new Date(item.startdate).getFullYear();
    if (yearFilter === "berjalan" && itemYear !== currentYear) return false;
    if (yearFilter === "lalu" && itemYear >= currentYear) return false;
    if (yearFilter === "depan" && itemYear <= currentYear) return false;
    if (kejuruanFilter !== "Semua" && item.kejuruan !== kejuruanFilter) return false;
    if (statusFilter !== "Semua" && status !== statusFilter) return false;
    return true;
  });
  
  // --- LOGIKA GALERI (AMBIL SEMUA) ---
  // Kita tidak lagi memfilter berdasarkan type. Semua data diambil.
  const displayGallery = galleryData; 

  // --- LOGIKA STATISTIK ---
  const availableStatYears = [...new Set(allStatsData.map(row => parseInt(row.tahun)))].filter(Boolean).sort((a, b) => b - a);
  const statsForSelectedYear = allStatsData.find(row => parseInt(row.tahun) === selectedStatYear);
  
  const displayStats = statsForSelectedYear ? [
    { label: "Paket APBN", value: statsForSelectedYear['paketapbn'] || '0', note: `Tahun ${selectedStatYear}` },
    { label: "Paket APBD", value: statsForSelectedYear['paketapbd'] || '0', note: `Tahun ${selectedStatYear}` },
    { label: "Total Paket", value: statsForSelectedYear['totalpaket'] || '0', note: `Tahun ${selectedStatYear}` },
    { label: "Total Peserta", value: statsForSelectedYear['totalpeserta'] || '0', note: `Tahun ${selectedStatYear}` }
  ] : [
    { label: `Paket APBN`, value: '0', note: `Data ${selectedStatYear} tidak ada` },
    { label: `Paket APBD`, value: '0', note: `Data ${selectedStatYear} tidak ada` },
    { label: `Total Paket`, value: '0', note: `Data ${selectedStatYear} tidak ada` },
    { label: `Total Peserta`, value: '0', note: `Data ${selectedStatYear} tidak ada` }
  ];
  
  const finalDisplayStats = [...displayStats, ...(staticStatsData || [])];

  return (
    <>
      {/* 1. HERO SECTION */}
      <section id="hero" className="pt-28 md:pt-40 pb-20 relative overflow-hidden min-h-[80vh] flex items-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 w-full">
          <div className="grid lg:grid-cols-12 gap-8 items-center">
            
            {/* Logo Kiri */}
            <div className="lg:col-span-3 flex justify-center lg:justify-start order-1 animate-fade-in-up">
              <img src="https://i.imgur.com/auZvlcZ.png" alt="Emblem SELARAS" className="w-40 h-auto md:w-56 lg:w-full max-w-[250px] object-contain drop-shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:scale-105 transition-transform duration-500" />
            </div>

            {/* Teks Tengah */}
            <div className="lg:col-span-5 text-center order-2 animate-fade-in-up delay-100 relative z-10">
                <div className="inline-block px-4 py-1 mb-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] md:text-xs font-bold tracking-widest uppercase">PORTAL RESMI BLK KOTA MAGELANG</div>
                <h1 className="text-4xl md:text-6xl font-extrabold mb-4 text-white tracking-tight drop-shadow-lg leading-tight">SELARAS</h1>
                <p className="text-sm md:text-lg text-emerald-100 mb-6 font-medium leading-relaxed">Sistem Elektronik Layanan Administrasi teRpadu dAn Smart</p>
                <p className="text-xs md:text-sm text-slate-400 mb-8 max-w-md mx-auto">Wujudkan kompetensi unggul dan karir cemerlang bersama pelatihan vokasi berstandar nasional.</p>
                
                {/* Tombol Aksi */}
                <div className="flex flex-wrap gap-3 justify-center">
                   <a href="#jadwal" className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-500/30 transition-all transform hover:-translate-y-1">Lihat Jadwal</a>
                   {/* UPDATE: Tombol Daftar mengarah ke Panduan */}
                   <button onClick={() => setCurrentPage("panduan")} className="px-6 py-2.5 rounded-full border border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-300 text-sm font-bold transition-all cursor-pointer">Daftar Sekarang</button>
                </div>
            </div>

            {/* Video Kanan */}
            <div className="lg:col-span-4 order-3 animate-fade-in-up delay-200">
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-2 shadow-2xl border border-white/10 transform rotate-2 hover:rotate-0 transition-all duration-500 group">
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 shadow-inner group-hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] transition-shadow">
                    <video controls className="w-full h-full object-cover" autoPlay loop muted playsInline>
                      <source src="https://i.imgur.com/GUHA593.mp4" type="video/mp4" />
                    </video>
                  </div>
                  <div className="text-center mt-2"><p className="text-[10px] text-slate-400 uppercase tracking-widest">Profil Pelatihan</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* 2. STATISTIK SECTION */}
      <section className="bg-slate-900/50 border-y border-white/5 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
               <h3 className="text-lg font-semibold text-white">Data Kinerja Pelatihan</h3>
               <div className="flex flex-wrap gap-2">
                {availableStatYears.map(year => <button key={year} onClick={() => setSelectedStatYear(year)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${selectedStatYear === year ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'}`}>{year}</button>)}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {isLoading ? <div className="col-span-full text-center text-slate-400 text-xs animate-pulse">Memuat statistik...</div> : finalDisplayStats.map((stat, i) => (
              <div key={i} className="bg-slate-800/40 hover:bg-slate-800/60 transition-colors rounded-xl p-4 border border-white/5 group">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1 group-hover:text-emerald-400 transition-colors">{stat.label}</div>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-[9px] text-slate-500 mt-2 border-t border-white/5 pt-2">{stat.note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. JADWAL SECTION */}
      <section id="jadwal" className="py-16 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-6xl mx-auto px-4">
          <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 mb-6 backdrop-blur-sm">
              <div className="flex flex-wrap gap-4 items-center text-sm">
                <div className="flex flex-col gap-1"><label className="text-[10px] text-slate-400 font-bold uppercase">Kejuruan</label><select className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 focus:border-emerald-500 outline-none min-w-[150px]" value={kejuruanFilter} onChange={(e) => setKejuruanFilter(e.target.value)} disabled={isLoading}>{kejuruanOptions.map(k => <option key={k} value={k}>{k}</option>)}</select></div>
                <div className="flex flex-col gap-1"><label className="text-[10px] text-slate-400 font-bold uppercase">Status</label><select className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 focus:border-emerald-500 outline-none min-w-[150px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} disabled={isLoading}><option value="Semua">Semua</option><option value="Akan Datang">Akan Datang</option><option value="Berlangsung">Berlangsung</option><option value="Selesai">Selesai</option></select></div>
                <div className="flex flex-col gap-1"><label className="text-[10px] text-slate-400 font-bold uppercase">Tahun</label><div className="flex bg-slate-900 rounded-lg p-1 border border-slate-600">{['berjalan', 'lalu', 'depan'].map((t) => (<button key={t} onClick={() => setYearFilter(t)} className={`px-3 py-1.5 rounded-md text-xs capitalize transition-all ${yearFilter === t ? 'bg-emerald-600 text-white' : 'text-slate-400'}`} disabled={isLoading}>{t}</button>))}</div></div>
            </div>
          </div>
          <div className="overflow-hidden bg-slate-900 border border-slate-700 rounded-xl shadow-xl">
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                <thead className="bg-slate-800 text-slate-300 uppercase text-xs font-bold tracking-wider"><tr><th className="px-6 py-4">Program Pelatihan</th><th className="px-6 py-4">Kejuruan</th><th className="px-6 py-4">Periode</th><th className="px-6 py-4 text-center">Kuota</th><th className="px-6 py-4 text-center">Status</th></tr></thead>
                <tbody className="divide-y divide-slate-700">
                  {isLoading ? (
                    <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-400 animate-pulse">Mengambil data...</td></tr>
                  ) : filteredSchedule.length > 0 ? (
                    filteredSchedule.map((item, index) => {
                      const status = getScheduleStatus(item.startdate, item.enddate);
                      // Logika Segera Hadir
                      const isFullSegeraHadir = (item.startdate && item.startdate.toLowerCase().includes("segera")) && (item.enddate && item.enddate.toLowerCase().includes("segera"));
                      return (
                        <tr key={index} className="hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-white">{item.program}</td>
                          <td className="px-6 py-4 text-slate-300">{item.kejuruan}</td>
                          <td className="px-6 py-4 text-slate-300 font-mono text-xs whitespace-nowrap">
                            {isFullSegeraHadir ? <span className="text-yellow-400 font-bold tracking-wide">SEGERA HADIR</span> : <>{formatDate(item.startdate)} <br/> s.d <br/> {formatDate(item.enddate)}</>}
                          </td>
                          <td className="px-6 py-4 text-center text-slate-300">{item.kuota}</td>
                          <td className="px-6 py-4 text-center"><span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${getStatusColor(status)}`}>{status}</span></td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-400 bg-slate-800/20">Tidak ditemukan jadwal.</td></tr>
                  )}
                </tbody>
                </table>
            </div>
          </div>
        </div>
      </section>

      {/* 4. GALERI SECTION (UPDATE: GABUNGAN FOTO & VIDEO) */}
      <section id="galeri" className="py-16 bg-slate-950 relative">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-white">Dokumentasi Kegiatan</h2>
              {/* Tombol Filter SUDAH DIHAPUS */}
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {isLoading ? <div className="col-span-full flex justify-center py-12"><div className="text-emerald-500 animate-pulse">Memuat galeri...</div></div> : displayGallery.length > 0 ? displayGallery.map((item, idx) => (
                <div key={idx} className="group bg-slate-900 rounded-xl overflow-hidden border border-slate-800 hover:border-emerald-500/50 transition-all shadow-lg hover:shadow-emerald-500/10">
                  <div className="aspect-video bg-slate-800 relative overflow-hidden">
                    {/* Logika Otomatis: Cek Tipe */}
                    {item.type && item.type.includes('video') ? 
                        <iframe src={convertToEmbedLink(item.src)} title={item.title} className="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen ></iframe> 
                        : 
                        <img src={convertToEmbedLink(item.src)} alt={item.title} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => e.target.src = 'https://placehold.co/600x400/1e293b/FFFFFF?text=Gambar+Tidak+Tersedia'} />
                    }
                  </div>
                  <div className="p-4">
                      <h4 className="text-sm font-semibold text-slate-200 line-clamp-2 group-hover:text-emerald-400 transition-colors">{item.title}</h4>
                      {/* Label Tipe Kecil */}
                      <span className={`text-[10px] uppercase font-bold mt-2 inline-block px-2 py-0.5 rounded ${item.type && item.type.includes('video') ? 'bg-red-900/50 text-red-300' : 'bg-blue-900/50 text-blue-300'}`}>
                          {item.type && item.type.includes('video') ? 'Video' : 'Foto'}
                      </span>
                  </div>
                </div>
              )) : <div className="col-span-full py-12 text-center border border-dashed border-slate-800 rounded-xl"><p className="text-slate-400">Belum ada dokumentasi.</p></div>}
          </div>
        </div>
      </section>
    </>
  );
}

// --- NEW COMPONENT: TicketCard (Detail Per Ticket - Alumni View) ---
function TicketCard({ ticket, dbInstance, StatusBadge, handleCloseTicket }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [isReplying, setIsReplying] = useState(false);
    const repliesEndRef = useRef(null);

    const scrollToBottom = () => { repliesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };
    useEffect(() => {
        if (isExpanded) {
            // Scroll to the bottom of the conversation when expanded
            setTimeout(scrollToBottom, 100); 
        }
    }, [isExpanded, ticket.replies.length]);
    
    // Note: The structure of ticket.replies should be: 
    // [{ type: 'user' | 'admin', text: '...', createdAt: timestamp (ISO string) }]

    const handleFollowUp = async (e) => {
        e.preventDefault();
        if (!dbInstance || !replyText.trim()) return;

        setIsReplying(true);
        try {
            const newReply = {
                type: 'user',
                text: replyText.trim(),
                createdAt: new Date().toISOString(), 
                // timestamp: serverTimestamp() 
            };
            
            // Get current replies and push new one
            const currentReplies = ticket.replies || [];
            currentReplies.push(newReply);

            await updateDoc(doc(getConsultationCollection(dbInstance), ticket.id), {
                replies: currentReplies,
                status: 'open', // Re-open ticket if user follows up
                lastUpdate: serverTimestamp()
            });

            setReplyText('');

        } catch (e) {
            console.error("Error submitting follow-up:", e);
        } finally {
            setIsReplying(false);
        }
    }
    
    const isAnswered = ticket.replies && ticket.replies.some(r => r.type === 'admin');
    const displayStatus = isAnswered && ticket.status !== 'closed' ? 'answered' : ticket.status;
    const repliesCount = ticket.replies ? ticket.replies.length + 1 : 1; // +1 for the initial question

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-lg">
            <div 
                className="p-4 cursor-pointer hover:bg-slate-800 transition-colors rounded-xl flex justify-between items-center"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className='flex flex-col gap-1 w-full'>
                    <div className='flex items-center gap-3'>
                        <span className='font-bold text-white text-md flex-1 truncate'>{ticket.question}</span>
                        <StatusBadge status={displayStatus} />
                    </div>
                    <p className='text-xs text-slate-500'>
                        Diajukan oleh: {ticket.name} | {repliesCount} Balasan
                    </p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-400 transition-transform ml-4 shrink-0 ${isExpanded ? 'rotate-180' : 'rotate-0'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>

            {isExpanded && (
                <div className='border-t border-slate-700 p-4 space-y-4'>
                    {/* RIWAYAT CHAT */}
                    <div className='max-h-64 overflow-y-auto space-y-3 custom-scrollbar p-1'>
                        {/* Initial Question (User) */}
                        <div className={`flex justify-end`}>
                            <div className={`max-w-[90%] p-3 rounded-xl text-sm leading-relaxed shadow-sm bg-blue-600 text-white rounded-tr-none`}>
                                <p className='font-semibold mb-1'>[Pertanyaan Awal]</p>
                                {ticket.question}
                                <span className='block text-[10px] text-blue-200 mt-2 text-right'>
                                    {ticket.createdAt ? new Date(ticket.createdAt.seconds * 1000).toLocaleTimeString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Baru saja'}
                                </span>
                            </div>
                        </div>

                        {/* Replies */}
                        {ticket.replies.map((reply, idx) => (
                            <div key={idx} className={`flex ${reply.type === 'admin' ? 'justify-start' : 'justify-end'}`}>
                                <div className={`max-w-[90%] p-3 rounded-xl text-sm leading-relaxed shadow-sm ${reply.type === 'admin' ? 'bg-emerald-700 text-white rounded-tl-none' : 'bg-blue-600 text-white rounded-tr-none'}`}>
                                    <p className='font-semibold mb-1'>[{reply.type === 'admin' ? 'Jawaban Petugas' : 'Tanggapan Anda'}]</p>
                                    {reply.text}
                                    <span className={`block text-[10px] mt-2 text-right ${reply.type === 'admin' ? 'text-emerald-200' : 'text-blue-200'}`}>
                                            {new Date(reply.createdAt || Date.now()).toLocaleTimeString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        ))}
                        <div ref={repliesEndRef} />
                    </div>
                    
                    {/* FOLLOW UP / ACTION */}
                    {displayStatus !== 'closed' ? (
                        <div className='mt-4 pt-4 border-t border-slate-700'>
                            <h5 className='text-sm font-semibold text-white mb-2'>Tanyakan Kelanjutan / Tanggapan</h5>
                            <form onSubmit={handleFollowUp} className='flex gap-2'>
                                <textarea 
                                    rows="2" 
                                    value={replyText} 
                                    onChange={(e) => setReplyText(e.target.value)} 
                                    placeholder="Ketik kelanjutan pertanyaan Anda..."
                                    className='flex-1 p-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white resize-none focus:outline-none focus:border-blue-500'
                                    required
                                />
                                <button 
                                    type="submit" 
                                    disabled={isReplying || !replyText.trim()}
                                    className='px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-bold rounded-lg text-sm transition-colors self-end shrink-0'
                                >
                                    {isReplying ? "Mengirim..." : "Kirim"}
                                </button>
                            </form>
                            <button
                                type="button"
                                onClick={() => handleCloseTicket(ticket.id)}
                                className='mt-2 text-xs text-red-400 hover:text-red-300 underline'
                            >
                                Tutup Tiket Konsultasi Ini
                            </button>
                        </div>
                    ) : (
                        <div className='mt-4 pt-4 border-t border-slate-700 text-center text-sm text-slate-500'>
                            Diskusi ini telah ditutup. Silakan buka tiket baru jika ada pertanyaan lain.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// --- NEW COMPONENT: ConsultationSystem (Q&A Ticket - Alumni View) ---
function ConsultationSystem({ dbInstance }) {
    // Unique ID for non-logged-in users to track their tickets (persisted in localStorage)
    const GUEST_ID_KEY = 'dasamuka_consultation_id';
    const [guestId, setGuestId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [tickets, setTickets] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [name, setName] = useState('');
    const [contact, setContact] = useState('');
    const [question, setQuestion] = useState('');
    const [currentView, setCurrentView] = useState('list'); // 'list' or 'submit'
    const [modalMessage, setModalMessage] = useState(null);

    // 1. Initial Load & Guest ID setup
    useEffect(() => {
        let storedId = localStorage.getItem(GUEST_ID_KEY);
        if (!storedId) {
            storedId = 'guest-' + Math.random().toString(36).substring(2, 11);
            localStorage.setItem(GUEST_ID_KEY, storedId);
        }
        setGuestId(storedId);
        // Only set loading to false if dbInstance check is quick and initial localStorage is done
        if (dbInstance) setIsLoading(false); 
    }, [dbInstance]);

    // 2. Fetch Tickets using Guest ID
    useEffect(() => {
        if (!dbInstance || !guestId || isLoading) return;

        // Query: Get all tickets submitted by this guest ID
        const q = query(getConsultationCollection(dbInstance), where("guestId", "==", guestId));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedTickets = snapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data(),
                replies: doc.data().replies || [] // Ensure replies array exists
            }));
            // Sort by createdAt descending
            fetchedTickets.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

            setTickets(fetchedTickets);
            
            // Set view only if it's the initial load or if the user navigated back from modal
            if (fetchedTickets.length === 0 && currentView !== 'submit') {
                 setCurrentView('submit');
            } 
        }, (error) => {
            console.error("Error fetching consultations:", error);
        });

        return () => unsubscribe();
    }, [dbInstance, guestId, isLoading]);

    const handleNewQuestionSubmit = async (e) => {
        e.preventDefault();
        if (!dbInstance || !guestId || !question.trim()) {
            setModalMessage({ title: "Input Tidak Lengkap", body: "Nama dan Pertanyaan wajib diisi.", type: 'error' });
            return;
        }
        
        setIsSubmitting(true);
        try {
            await addDoc(getConsultationCollection(dbInstance), {
                guestId: guestId,
                name: name.trim() || "Anonim Alumni",
                contact: contact.trim() || "-",
                question: question.trim(),
                status: "open", // open, answered, closed
                createdAt: serverTimestamp(),
                replies: [],
                lastUpdate: serverTimestamp()
            });
            
            setQuestion('');
            setModalMessage({ title: "Pertanyaan Terkirim", body: "Tim kami akan segera membalas pertanyaan Anda. Silakan cek di daftar tiket.", type: 'success' });
            setCurrentView('list'); // Switch to list view after submission

        } catch (e) {
            console.error("Error submitting question:", e);
            setModalMessage({ title: "Gagal Mengirim", body: "Terjadi kesalahan saat mengirim pertanyaan. Pastikan koneksi dan Firebase Anda sudah aktif.", type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleCloseTicket = async (ticketId) => {
        if (!dbInstance) return;
        
        const isConfirmed = await new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 animate-fade-in';
            modal.innerHTML = `
                <div class="bg-slate-900 border border-red-500/50 text-white rounded-xl w-full max-w-sm shadow-2xl p-6">
                    <h3 class="text-xl font-bold mb-4 text-red-400">Konfirmasi Tutup Tiket</h3>
                    <p class="text-slate-300 mb-6 text-sm">Anda yakin ingin menutup diskusi ini? Anda tidak dapat menindaklanjuti lagi setelah ditutup.</p>
                    <div class="flex justify-end gap-3">
                        <button id="cancelBtn" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-semibold">Batal</button>
                        <button id="confirmBtn" class="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white text-sm font-semibold">Tutup Tiket</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            document.getElementById('cancelBtn').onclick = () => { document.body.removeChild(modal); resolve(false); };
            document.getElementById('confirmBtn').onclick = () => { document.body.removeChild(modal); resolve(true); };
        });

        if (!isConfirmed) return;

        try {
            await updateDoc(doc(getConsultationCollection(dbInstance), ticketId), { 
                status: 'closed',
                lastUpdate: serverTimestamp()
            });
            setModalMessage({ title: "Tiket Ditutup", body: "Tiket konsultasi ini berhasil ditutup.", type: 'info' });
        } catch (e) {
            console.error("Error closing ticket:", e);
            setModalMessage({ title: "Gagal Menutup", body: "Terjadi kesalahan saat menutup tiket.", type: 'error' });
        }
    }

    const Modal = ({ message, onClose }) => {
        if (!message) return null;
        const colorClass = message.type === 'success' ? 'border-green-500/50 text-green-400' : (message.type === 'error' ? 'border-red-500/50 text-red-400' : 'border-blue-500/50 text-blue-400');
        return (
            <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 animate-fade-in">
                <div className={`bg-slate-900 border ${colorClass} rounded-xl w-full max-w-sm shadow-2xl p-6`}>
                    <h3 className={`text-xl font-bold mb-4 ${message.type === 'success' ? 'text-green-400' : (message.type === 'error' ? 'text-red-400' : 'text-blue-400')}`}>{message.title}</h3>
                    <p className="text-slate-300 mb-6 text-sm">{message.body}</p>
                    <div className="flex justify-end">
                        <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-semibold">Tutup</button>
                    </div>
                </div>
            </div>
        );
    };

    const StatusBadge = ({ status }) => {
        let text, color;
        switch(status) {
            case 'open': 
                text = 'Menunggu Petugas'; 
                color = 'bg-yellow-600 text-yellow-100'; 
                break;
            case 'answered': 
                text = 'Sudah Dijawab'; 
                color = 'bg-emerald-600 text-emerald-100'; 
                break;
            case 'closed': 
                text = 'Selesai'; 
                color = 'bg-slate-600 text-slate-300'; 
                break;
            default: 
                text = 'N/A'; 
                color = 'bg-slate-500'; 
        }
        return (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${color}`}>
                {text}
            </span>
        );
    };
    
    // --- RENDER VIEWS ---

    const renderSubmissionForm = () => (
        <form onSubmit={handleNewQuestionSubmit} className='space-y-4 p-6 bg-slate-800 border border-slate-700 rounded-xl max-w-lg mx-auto'>
            <h4 className='text-xl font-bold text-white mb-2'>Form Konsultasi Baru</h4>
            <p className='text-sm text-slate-400'>Isi data Anda dan pertanyaan konsultasi Anda sebagai alumni.</p>
            <div>
                <label className="block text-sm font-medium text-slate-300">Nama Lengkap (Wajib)</label>
                <input 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="Nama Anda"
                    className="mt-1 w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                    required
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-300">Kontak (WA/Email, untuk follow up)</label>
                <input 
                    type="text" 
                    value={contact} 
                    onChange={(e) => setContact(e.target.value)} 
                    placeholder="0812xxxxxx / email@contoh.com"
                    className="mt-1 w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-300">Pertanyaan / Topik Konsultasi (Wajib)</label>
                <textarea 
                    rows="5" 
                    value={question} 
                    onChange={(e) => setQuestion(e.target.value)} 
                    placeholder="Jelaskan pertanyaan atau kendala karir Anda di sini..."
                    className='mt-1 w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 resize-none'
                    required
                />
            </div>
            <button 
                type="submit" 
                disabled={isSubmitting || !name.trim() || !question.trim() || !dbInstance}
                className='w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-bold rounded-lg text-sm transition-colors'
            >
                {isSubmitting ? "Mengirim Pertanyaan..." : "Kirim Pertanyaan Konsultasi"}
            </button>
            {tickets.length > 0 && (
                <button 
                    type="button"
                    onClick={() => setCurrentView('list')}
                    className='w-full py-2 mt-2 text-blue-400 hover:text-blue-300 text-xs'
                >
                    Lihat {tickets.length} Tiket Saya Sebelumnya
                </button>
            )}
        </form>
    );

    const renderTicketList = () => (
        <div className='max-w-4xl mx-auto'>
            <div className='flex justify-between items-center mb-4'>
                <h4 className='text-xl font-bold text-white'>Riwayat Konsultasi Anda ({tickets.length})</h4>
                <button 
                    onClick={() => setCurrentView('submit')}
                    className='px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-colors'
                >
                    + Ajukan Pertanyaan Baru
                </button>
            </div>

            <div className='space-y-4'>
                {tickets.map(ticket => (
                    <TicketCard 
                        key={ticket.id} 
                        ticket={ticket} 
                        dbInstance={dbInstance}
                        StatusBadge={StatusBadge}
                        handleCloseTicket={handleCloseTicket}
                    />
                ))}
            </div>
        </div>
    );
    
    // RENDER: Main Content
    return (
        <div className="pt-8">
            {isLoading || !guestId ? (
                <div className="text-center py-12 text-emerald-400">Memuat sesi konsultasi...</div>
            ) : (
                <>
                    {!dbInstance && (
                        <div className="p-4 bg-red-900/30 border border-red-500 rounded-xl text-red-200 text-sm font-bold text-center mb-6">
                            ⚠️ Firebase belum terkonfigurasi. Fungsi konsultasi tidak dapat digunakan.
                        </div>
                    )}
                    {currentView === 'submit' ? renderSubmissionForm() : renderTicketList()}
                </>
            )}
            <Modal message={modalMessage} onClose={() => setModalMessage(null)} />
        </div>
    );
}

// --- LAKON DASAMUKA PAGE ---
function LakonDasamukaPage({ dbInstance, kejuruanOptions, lokerData, produkData }) {
  const [tab, setTab] = useState("loker");
  const [selectedLoker, setSelectedLoker] = useState(null);
  const [selectedProduk, setSelectedProduk] = useState(null);

  return (
    <section id="dasamuka" className="pt-24 md:pt-32 pb-16 min-h-screen bg-slate-950">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-3xl p-6 md:p-10 border border-white/5 mb-8 animate-fade-in-up shadow-xl">
  <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
    {/* LOGO DI KIRI */}
    <div className="shrink-0">
      <img
        src="https://i.imgur.com/AHaLrmm.png" // Link logo Lakon Dasamuka
        alt="Logo Lakon Dasamuka"
        // Saya tambahkan sedikit efek bayangan pink agar sesuai dengan warna logonya
        className="w-32 h-auto md:w-44 object-contain drop-shadow-[0_0_15px_rgba(236,72,153,0.3)] hover:scale-105 transition-transform"
      />
    </div>
    {/* TEKS DI KANAN */}
    <div className="text-center md:text-left flex-1">
      <h1 className="text-3xl md:text-5xl font-extrabold mb-2 text-white uppercase tracking-tight">LAKON DASAMUKA</h1>
      <p className="text-sm md:text-lg text-emerald-400 mb-3 font-medium tracking-wide">(Layanan Konsultasi – Datang Sapa Alumni Bekerja)</p>
      <p className="text-sm text-slate-300 max-w-2xl mx-auto md:mx-0 leading-relaxed">
        Portal khusus untuk alumni UPT BLK Kota Magelang sebagai wadah informasi karir, usaha, dan konsultasi.
      </p>
    </div>
  </div>
</div>

        <div className="flex flex-wrap gap-2 justify-center md:justify-start items-center mb-8 text-sm border-b border-slate-800 pb-4">
          <button onClick={() => setTab("loker")} className={`px-6 py-2 rounded-full transition-all ${tab === 'loker' ? 'bg-emerald-500 text-white font-bold shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Info Lowongan Kerja</button>
          <button onClick={() => setTab("produk")} className={`px-6 py-2 rounded-full transition-all ${tab === 'produk' ? 'bg-emerald-500 text-white font-bold shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Produk Alumni</button>
          <button onClick={() => setTab("chat")} className={`px-6 py-2 rounded-full transition-all ${tab === 'chat' ? 'bg-emerald-500 text-white font-bold shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Chat Konsultasi</button>
        </div>
        <div className="min-h-[400px] animate-fade-in">
          {tab === 'loker' && (
  <div className="space-y-6">
    {/* Banner ajakan pasang lowongan */}
    <div className="bg-gradient-to-r from-emerald-900/40 to-slate-900 border border-emerald-500/20 rounded-xl p-4 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <h3 className="font-semibold text-emerald-300 text-sm md:text-base">
          Anda Perusahaan?
        </h3>
        <p className="text-xs md:text-sm text-slate-300">
          Pasang info lowongan kerja untuk alumni BLK secara gratis. Data akan dicek admin sebelum ditayangkan di portal.
        </p>
      </div>
      <a
        href={FORM_LOKER_URL}
        target="_blank"
        rel="noreferrer"
        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-sm font-semibold rounded-lg shadow-md inline-flex items-center gap-2 transition-all"
      >
        Pasang Lowongan
      </a>
    </div>

    {/* Daftar lowongan */}
    {lokerData && lokerData.length > 0 ? (
  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
    {lokerData.map((job) => {
  // --- BAGIAN 1: DEBUGGING (Cek Console Chrome nanti) ---
  console.log("=== CEK DATA LOKER ===");
  console.log("Judul:", job.title);
  console.log("Link Asli:", job.image); 

  // --- BAGIAN 2: LOGIKA GAMBAR ---
  const fallbackImage = "https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=1000&auto=format&fit=crop";
  
  // Kita cek: Kalau job.image ada, kita convert. Kalau tidak ada, pakai fallback.
  const imageSrc = job.image ? convertToEmbedLink(job.image) : fallbackImage;
  
  console.log("Link Final:", imageSrc);

  // --- BAGIAN 3: TAMPILAN (RETURN) ---
  return (
    <div
      key={job.id}
      className="bg-slate-900 rounded-xl border border-slate-800 hover:border-emerald-500/70 hover:shadow-lg hover:shadow-emerald-500/10 transition-all group cursor-pointer flex flex-col"
      onClick={() => setSelectedLoker(job)}
    >
      {/* Gambar poster lowongan */}
      <div className="h-40 bg-slate-800 overflow-hidden rounded-t-xl relative">
        <img
          src={imageSrc}
          alt={job.title}
          
          // PENTING: Supaya Google tidak memblokir gambar
          referrerPolicy="no-referrer"
          
          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          onError={(e) => {
            // Mencegah error berulang (looping)
            if (e.currentTarget.src !== fallbackImage) {
               e.currentTarget.src = fallbackImage;
            }
          }}
        />

        {job.status && (
          <span className="absolute top-3 left-3 bg-emerald-500 text-xs font-semibold px-2 py-1 rounded-full text-white shadow-md">
            {job.status}
          </span>
        )}
      </div>

      {/* Isi kartu lowongan */}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-lg font-semibold text-white truncate">
            {job.title}
          </h3>
        </div>

        <p className="text-emerald-400 text-sm font-medium mb-2 line-clamp-1">
          {job.company}
        </p>

        <div className="flex flex-wrap gap-2 text-xs text-slate-300 mb-3">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800/80 border border-slate-700/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {job.location}
          </span>
          {job.education && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800/80 border border-slate-700/60">
              {job.education}
            </span>
          )}
        </div>

        <p className="text-slate-300 text-sm line-clamp-3 mb-4">
          {job.desc}
        </p>

        <div className="mt-auto flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
          <span>
            Batas: <span className="text-emerald-400">{job.deadline}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Info Alumni
          </span>
        </div>
      </div>
    </div>
  );
})}
  </div>
) : (
  <div className="text-center py-10 text-slate-500 text-sm border border-dashed border-slate-700 rounded-xl">
    Belum ada lowongan yang tersedia.
  </div>
)}

  </div>
)}

          {tab === 'produk' && (
            <div>
              <div className="bg-gradient-to-r from-blue-900/40 to-slate-900 border border-blue-500/20 rounded-xl p-4 mb-6 flex flex-col md:flex-row justify-between items-center gap-4"><div className="text-center md:text-left"><h4 className="text-blue-400 font-bold text-sm mb-1">Anda Alumni BLK?</h4><p className="text-slate-400 text-xs">Promosikan produk wirausaha Anda di sini secara gratis.</p></div><a href={FORM_PRODUK_URL} target="_blank" rel="noreferrer" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-full shadow-lg transition-all flex items-center gap-2">Promosikan Produk</a></div>
              {produkData && produkData.length > 0 ? (
                  <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {produkData.map((item) => {
    // 1. Definisikan Fallback Image khusus Produk
    const fallbackProduct = "https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?q=80&w=1000&auto=format&fit=crop";
    
    // 2. Proses Link Gambar (Gunakan fungsi convert yang sudah diperbarui)
    const productSrc = item.image ? convertToEmbedLink(item.image) : fallbackProduct;

    return (
        <div 
            key={item.id} 
            className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden group hover:shadow-xl transition-all flex flex-col h-full cursor-pointer" 
            onClick={() => setSelectedProduk(item)}
        >
            <div className="w-full h-48 bg-slate-800 relative overflow-hidden">
                <img 
                    src={productSrc} 
                    alt={item.name} 
                    
                    // WAJIB: Supaya Google tidak memblokir
                    referrerPolicy="no-referrer"
                    
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                    onError={(e) => {
                        if (e.currentTarget.src !== fallbackProduct) {
                            e.currentTarget.src = fallbackProduct;
                        }
                    }} 
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                    <div className="text-white font-bold text-xl">{item.price}</div>
                </div>
            </div>
            <div className="p-4 flex-1 flex flex-col">
                <h4 className="font-bold text-white mb-1 line-clamp-2">{item.name}</h4>
                <p className="text-xs text-emerald-400 mb-3 flex-1">{item.alumni}</p>
                <button className="w-full py-2 mt-auto text-xs font-bold rounded-full bg-slate-800 hover:bg-slate-700 text-white transition-colors flex items-center justify-center gap-2 border border-slate-700">Lihat Detail</button>
            </div>
        </div>
    );
})}
                  </div>
              ) : (
                  <div className="text-center py-12 text-slate-500">Belum ada produk alumni yang ditampilkan.</div>
              )}
            </div>
          )}
          {tab === 'chat' && (
            <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 relative overflow-hidden">
              {/* NEW Q&A CONSULTATION SYSTEM */}
              <ConsultationSystem dbInstance={dbInstance} />
            </div>
          )}
        </div>
      </div>

      {selectedLoker && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative">
               <button onClick={() => setSelectedLoker(null)} className="absolute top-4 right-4 z-10 p-2 bg-black/50 rounded-full text-white hover:bg-red-600 transition-colors">X</button>
               <div className="overflow-y-auto p-6">
                <div className="relative h-40 bg-slate-800 overflow-hidden rounded-lg mb-4">
                    <img
        // TAMBAHKAN convertToEmbedLink DI SINI JUGA
        src={convertToEmbedLink(selectedLoker.image) || "https://images.unsplash.com/photo-1521791136064-7986c2920216?q=80&w=1000&auto=format&fit=crop"}
        referrerPolicy="no-referrer"
        alt={selectedLoker.title}
        className="w-full h-full object-cover"
        // ... onError handler ...
    />
                    <span className="absolute top-2 right-2 px-2 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded shadow">{selectedLoker.status}</span>
                </div>
                <h3 className="text-white text-2xl font-bold mb-1">{selectedLoker.title}</h3>
                <h4 className="text-emerald-400 font-medium text-sm mb-4">{selectedLoker.company}</h4>
                
                <div className='grid grid-cols-2 gap-4 text-sm mb-6'>
                    <p className='text-slate-300 flex items-center gap-2'><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>{selectedLoker.location}</p>
                    <p className='text-slate-300 flex items-center gap-2'><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.206 5 7.5 5 5.103 5 3 6.57 3 8.5c0 1.5 1.5 2.5 3.5 3.5 2.07 1.05 3.5 2 3.5 3V19m-4-8h11m-1.5 8h-8.5" /></svg>{selectedLoker.education}</p>
                    <p className='text-slate-300 flex items-center gap-2'><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>{selectedLoker.deadline ? `Batas: ${selectedLoker.deadline}` : "Segera Kirim"}</p>
                    <p className='text-slate-300 flex items-center gap-2'><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c1.657 0 3 .895 3 2s-1.343 2-3 2h-1c-1.657 0-3 .895-3 2s1.343 2 3 2m-3 0h6m-9 8h12a2 2 0 002-2v-1a2 2 0 00-2-2H9a2 2 0 00-2 2v1a2 2 0 002 2z" /></svg>{selectedLoker.freshGrad}</p>
                </div>

                <h5 className="font-bold text-white text-lg mt-6 mb-2">Deskripsi Pekerjaan</h5>
                <p className="text-slate-400 whitespace-pre-wrap">{selectedLoker.desc}</p>
                
                {selectedLoker.benefits && (
                    <>
                        <h5 className="font-bold text-white text-lg mt-6 mb-2">Benefit & Fasilitas</h5>
                        <p className="text-slate-400 whitespace-pre-wrap">{selectedLoker.benefits}</p>
                    </>
                )}

                <div className='mt-8 pt-4 border-t border-slate-700 flex flex-col md:flex-row gap-4'>
                    {selectedLoker.regLink && (
                        <a href={selectedLoker.regLink} target="_blank" rel="noreferrer" className="flex-1 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold text-center transition-colors">Lamar Sekarang</a>
                    )}
                    <a href={`https://wa.me/${selectedLoker.contact}?text=Halo%2C%20saya%20tertarik%20dengan%20lowongan%20kerja%20${selectedLoker.title}%20dari%20web%20SELARAS.`} target="_blank" rel="noreferrer" className="flex-1 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold text-center transition-colors">Hubungi Perusahaan (WA)</a>
                </div>
               </div>
           </div>
        </div>
      )}
      {selectedProduk && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 animate-fade-in">
             <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative">
                 <button onClick={() => setSelectedProduk(null)} className="absolute top-4 right-4 z-10 p-2 bg-black/50 rounded-full text-white hover:bg-red-600 transition-colors">X</button>
                 <div className="overflow-y-auto p-6">
                     <div className="relative h-64 bg-slate-800 overflow-hidden rounded-lg mb-4">
                         <img 
                       src={convertToEmbedLink(selectedProduk.image) || "https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?q=80&w=1000&auto=format&fit=crop"} 
                       alt={selectedProduk.name} 
                       
                       // WAJIB: Tambahkan ini
                       referrerPolicy="no-referrer"
                       
                       className="w-full h-full object-cover" 
                       onError={(e) => e.target.src = 'https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?q=80&w=1000&auto=format&fit=crop'} 
                   />
                         <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3"><div className="text-white font-bold text-xl">{selectedProduk.price}</div></div>
                     </div>
                     <h3 className="text-white text-2xl font-bold mb-1">{selectedProduk.name}</h3>
                     <h4 className="text-emerald-400 font-medium text-sm mb-4">Oleh: {selectedProduk.alumni} ({selectedProduk.trainingInfo})</h4>
                     
                     <h5 className="font-bold text-white text-lg mt-6 mb-2">Deskripsi Produk</h5>
                     <p className="text-slate-400 whitespace-pre-wrap">{selectedProduk.desc}</p>

                     <div className='grid grid-cols-2 gap-4 text-sm mt-6 pt-4 border-t border-slate-700'>
                         <p className='text-slate-300 flex items-center gap-2'><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2v-5a2 2 0 012-2h10a2 2 0 012 2v5a2 2 0 01-2 2z" /></svg>Pengiriman: {selectedProduk.delivery}</p>
                         {selectedProduk.socialLink && <a href={selectedProduk.socialLink} target="_blank" rel="noreferrer" className='text-slate-300 flex items-center gap-2 hover:text-blue-400 transition-colors'><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 10.5L21 3m-3 0h5m0 0v5M4 14l7.5-7.5M4 14H3m7.5 7.5l-7.5-7.5" /></svg>Kunjungi Medsos</a>}
                     </div>

                     <div className='mt-8 pt-4 border-t border-slate-700'>
                         <a href={`https://wa.me/${selectedProduk.contact}?text=${encodeURIComponent(selectedProduk.wa_message)}`} target="_blank" rel="noreferrer" className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold text-center transition-colors flex items-center justify-center gap-2">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                             Hubungi Penjual (WhatsApp)
                         </a>
                     </div>
                 </div>
            </div>
        </div>
      )}
    </section>
  );
}

// --- CHAT WIDGET ---
function ChatWidget({ isOpen, setIsOpen, config }) {
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const defaultConfig = {
    title: "Asisten SELARAS",
    subTitle: "Online (n8n Powered)",
    webhookUrl: CHAT_WEBHOOK_SELARAS,
    initialMessage: "Halo! Ada yang bisa saya bantu terkait pelatihan atau layanan di BLK?"
  };
  const currentConfig = config || defaultConfig;

  // 1. Definisikan key unik berdasarkan title chat (untuk Local Storage)
  const CHAT_STORAGE_KEY = `chatHistory_SELARAS_${currentConfig.title.replace(/\s/g, '')}`;
  const SESSION_KEY = `chatSessionId_SELARAS_${currentConfig.title.replace(/\s/g, '')}`;
  
  // 2. Session ID (Diambil dari Local Storage atau buat baru)
  const [sessionId] = useState(() => {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = 'session-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  });

  // 3. Messages (Diambil dari Local Storage atau default)
  const [messages, setMessages] = useState(() => {
    try {
        const storedMessages = localStorage.getItem(CHAT_STORAGE_KEY);
        if (storedMessages) {
            const parsed = JSON.parse(storedMessages);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch (e) {
        console.error("Failed to load chat history:", e);
    }
    // Pesan Awal
    return [{ text: currentConfig.initialMessage, isUser: false }];
  });

  // 4. Persistence Effect: Simpan pesan ke Local Storage setiap kali berubah
  useEffect(() => {
    try {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
        console.error("Failed to save chat history:", e);
    }
  }, [messages, CHAT_STORAGE_KEY]);

  // 5. Context Change Effect: Muat ulang pesan saat konfigurasi chat berubah
  useEffect(() => {
      // Muat pesan yang benar untuk konteks chat saat ini
      try {
          const storedMessages = localStorage.getItem(CHAT_STORAGE_KEY);
          let newMessages;
          if (storedMessages) {
              const parsed = JSON.parse(storedMessages);
              newMessages = (Array.isArray(parsed) && parsed.length > 0) ? parsed : [{ text: config.initialMessage, isUser: false }];
          } else {
              newMessages = [{ text: config.initialMessage, isUser: false }];
          }

          // Hanya perbarui state jika konten berbeda
          if (JSON.stringify(messages) !== JSON.stringify(newMessages)) {
              setMessages(newMessages);
          }
      } catch (e) {
          console.error("Error loading context messages:", e);
          setMessages([{ text: config.initialMessage, isUser: false }]);
      }

  }, [config.title, config.initialMessage]); 


  const messagesEndRef = useRef(null);
  
  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };
  useEffect(() => { if (isOpen) { scrollToBottom(); } }, [messages, isOpen]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    const userMessage = inputValue.trim();
    setMessages(prev => [...prev, { text: userMessage, isUser: true }]);
    setInputValue("");
    setIsTyping(true);
    
    // Siapkan payload dengan Session ID yang Persisten
    const payload = { chatInput: userMessage, sessionId: sessionId };
    
    // Retry logic with exponential backoff
    const maxRetries = 3;
    let delay = 1000;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(currentConfig.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const responseText = await response.text();
                let botResponse = responseText;
                try {
                    const json = JSON.parse(responseText);
                    const content = json.output || json.text || json.message;
                    if (typeof content === 'object') {
                        botResponse = JSON.stringify(content, null, 2);
                    } else if (content) {
                        botResponse = String(content);
                    } else {
                        botResponse = JSON.stringify(json, null, 2);
                    }
                } catch (e) { /* ignore JSON parse error */ }
                
                setMessages(prev => [...prev, { text: botResponse, isUser: false }]);
                setIsTyping(false);
                return; // Success
            }
            
            // If response is not ok, throw to trigger retry
            throw new Error(`HTTP error! status: ${response.status}`);

        } catch (error) {
            if (i === maxRetries - 1) {
                // Last retry failed
                setMessages(prev => [...prev, { text: "Maaf, gagal terhubung ke server asisten. Silakan coba lagi nanti.", isUser: false }]);
                setIsTyping(false);
                console.error("Chat Webhook failed after max retries:", error);
                break;
            }
            // Wait with exponential backoff
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; 
        }
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end font-sans">
      {isOpen && (
        <div className="mb-4 w-80 md:w-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in-up h-[500px]">
          <div className="bg-emerald-600 p-4 flex justify-between items-center shadow-md">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white"><path fillRule="evenodd" d="M4.848 2.771A49.14 49.14 0 0 1 12 2.25c2.43 0 4.817.17 7.152.521a.75.75 0 0 1 .752.752v8.25a.75.75 0 0 1-.752.752a48.887 48.887 0 0 1-14.304 0 .75.75 0 0 1-.752-.752v-8.25a.75.75 0 0 1 .752-.752Z" clipRule="evenodd" /><path d="M12.75 12.3a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5a.75.75 0 0 1 .75.75Z" /></svg></div>
               <div><h3 className="font-bold text-white text-sm">{currentConfig.title}</h3><div className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse"></span><span className="text-[10px] text-emerald-100">{currentConfig.subTitle}</span></div></div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
          </div>
          <div className="flex-1 bg-slate-900/95 p-4 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
            {messages.map((msg, idx) => (<div key={idx} className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] p-3 rounded-xl text-sm leading-relaxed shadow-sm ${msg.isUser ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'}`}>{msg.text}</div></div>))}
            {isTyping && (<div className="flex justify-start"><div className="bg-slate-800 border border-slate-700 p-3 rounded-xl rounded-tl-none flex gap-1"><div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-100"></div><div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-200"></div></div></div>)}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSendMessage} className="p-3 bg-slate-800 border-t border-slate-700 flex gap-2"><input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Ketik pesan Anda..." className="flex-1 bg-slate-900 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-emerald-500"/><button type="submit" disabled={!inputValue.trim() || isTyping} className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white p-2 rounded-lg transition-colors"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" /></svg></button></form>
        </div>
      )}
      {!isOpen && (
        <button onClick={() => setIsOpen(true)} className="flex items-center gap-2 px-4 py-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-xl hover:shadow-emerald-500/40 transition-all animate-bounce hover:animate-none">
          <div className="relative"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M4.848 2.771A49.14 49.14 0 0 1 12 2.25c2.43 0 4.817.17 7.152.521a.75.75 0 0 1 .752.752v8.25a.75.75 0 0 1-.752.752a48.887 48.887 0 0 1-14.304 0 .75.75 0 0 1-.752-.752v-8.25a.75.75 0 0 1 .752-.752Z" clipRule="evenodd" /><path d="M12.75 12.3a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5a.75.75 0 0 1 .75.75Z" /></svg><span className="absolute top-0 right-0 -mt-1 -mr-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span></div>Chat SELARAS
        </button>
      )}
    </div>
  );
}

// --- KOMPONEN PANDUAN & AKSES PENDAFTARAN (VERSI UPDATE) ---
function PanduanPage({ onBack }) {
  // GANTI STATUS INI JIKA PENDAFTARAN DIBUKA (true/false)
  const isRegistrationOpen = false; 
  
  // State untuk popup panduan
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Data Menu Pintas (Sudah disesuaikan)
  const links = [
    { 
      id: "guide",
      title: "Panduan Pelatihan Skillhub (APBN)", 
      icon: "📋", 
      desc: "Cara buat akun & daftar pelatihan", 
      color: "blue",
      isModal: true // Penanda khusus agar membuka modal
    },
    { 
      title: "Instagram BLK", 
      icon: "📸", 
      desc: "Info update jadwal terbaru", 
      url: "https://instagram.com/blkkotamagelang", 
      color: "pink" 
    },
    { 
      title: "Lokasi / Peta", 
      icon: "📍", 
      desc: "Cek lokasi via Google Maps", 
      url: "https://maps.app.goo.gl/rF91y7o5sP9p5s67A", // Link Maps BLK Magelang
      color: "red" 
    }, 
    { 
      title: "Admin WhatsApp", 
      icon: "💬", 
      desc: "Tanya jawab langsung", 
      url: "https://wa.me/6285741720129", 
      color: "emerald" 
    },
  ];

  return (
    <section className="pt-28 pb-20 min-h-screen bg-slate-950">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10 animate-fade-in-up">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-4">Pusat Informasi Pendaftaran</h1>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Gerbang utama menuju pelatihan kompetensi. Silakan pelajari panduan sebelum mendaftar.
          </p>
        </div>

        {/* STATUS BANNER */}
        <div className={`p-6 rounded-2xl border ${isRegistrationOpen ? 'bg-emerald-900/30 border-emerald-500/50' : 'bg-yellow-900/30 border-yellow-500/50'} text-center mb-12 shadow-lg animate-fade-in`}>
            <h2 className={`text-xl font-bold mb-2 ${isRegistrationOpen ? 'text-emerald-400' : 'text-yellow-400'}`}>
                STATUS PENDAFTARAN: {isRegistrationOpen ? "SEDANG DIBUKA" : "BELUM DIBUKA / TUTUP"}
            </h2>
            <p className="text-slate-300 text-sm mb-6">
                {isRegistrationOpen 
                    ? "Silakan klik tombol di bawah untuk mengisi formulir pendaftaran." 
                    : "Mohon maaf, pendaftaran pelatihan saat ini sedang ditutup. Pantau terus Instagram kami untuk update jadwal terbaru."}
            </p>
            
            {/* TOMBOL DAFTAR UTAMA (Non-aktif jika tutup) */}
            {isRegistrationOpen ? (
                <a href="#" className="inline-block px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-full shadow-lg shadow-emerald-500/30 transition-transform transform hover:-translate-y-1">
                    👉 ISI FORMULIR PENDAFTARAN
                </a>
            ) : (
                <button disabled className="px-8 py-4 bg-slate-700 text-slate-400 font-bold rounded-full cursor-not-allowed border border-slate-600">
                    Formulir Belum Dapat Diakses
                </button>
            )}
        </div>

        {/* GRID MENU INFORMASI */}
        <h3 className="text-white font-bold text-lg mb-6 border-l-4 border-blue-500 pl-3">Menu Informasi</h3>
        <div className="grid md:grid-cols-2 gap-4">
            {links.map((link, idx) => (
                link.isModal ? (
                    // CARD UNTUK PANDUAN (MEMBUKA MODAL)
                    <button 
                        key={idx}
                        onClick={() => setShowGuideModal(true)}
                        className="flex items-center gap-4 p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-emerald-500/50 hover:bg-slate-800 transition-all group text-left w-full"
                    >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl bg-${link.color}-500/10 text-${link.color}-400 group-hover:scale-110 transition-transform`}>
                            {link.icon}
                        </div>
                        <div>
                            <h4 className="text-white font-bold text-sm group-hover:text-emerald-400 transition-colors">{link.title}</h4>
                            <p className="text-xs text-slate-400">{link.desc}</p>
                        </div>
                        <div className="ml-auto text-slate-600 group-hover:text-white transition-colors">↓</div>
                    </button>
                ) : (
                    // CARD MENU BIASA (LINK EXTERNAL)
                    <a 
                        key={idx} 
                        href={link.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-4 p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-emerald-500/50 hover:bg-slate-800 transition-all group"
                    >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl bg-${link.color}-500/10 text-${link.color}-400 group-hover:scale-110 transition-transform`}>
                            {link.icon}
                        </div>
                        <div>
                            <h4 className="text-white font-bold text-sm group-hover:text-emerald-400 transition-colors">{link.title}</h4>
                            <p className="text-xs text-slate-400">{link.desc}</p>
                        </div>
                        <div className="ml-auto text-slate-600 group-hover:text-white transition-colors">→</div>
                    </a>
                )
            ))}
        </div>

        {/* TOMBOL KEMBALI */}
        <div className="mt-12 text-center">
            <button onClick={onBack} className="text-slate-400 hover:text-white text-sm underline">Kembali ke Beranda</button>
        </div>

        {/* --- MODAL POPUP PANDUAN --- */}
        {showGuideModal && (
            <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-slate-900 border border-blue-500/50 rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
                    <button onClick={() => setShowGuideModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
                    
                    <div className="text-center mb-6">
                        <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center text-2xl mx-auto mb-3">📚</div>
                        <h3 className="text-xl font-bold text-white">Panduan Skillhub</h3>
                        <p className="text-xs text-slate-400 mt-1">Silakan pilih panduan yang ingin Anda baca.</p>
                    </div>

                    <div className="space-y-3">
                        <a 
                            href="https://drive.google.com/file/d/14MHZdNWKvHCc1SJruMQPwAN27GG7g4cJ/view" 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500 rounded-xl transition-all group"
                        >
                            <span className="text-2xl">📝</span>
                            <div className="text-left">
                                <div className="text-sm font-bold text-white group-hover:text-blue-400">Panduan Pendaftaran Pelatihan</div>
                                <div className="text-[10px] text-slate-400">Langkah mendaftar pelatihan di Skillhub</div>
                            </div>
                        </a>

                        <a 
                            href="https://drive.google.com/file/d/1fA84i4JWZPUJcnOjH_AP51kmzSlcAolv/view" 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500 rounded-xl transition-all group"
                        >
                            <span className="text-2xl">👤</span>
                            <div className="text-left">
                                <div className="text-sm font-bold text-white group-hover:text-blue-400">Panduan Membuat Akun</div>
                                <div className="text-[10px] text-slate-400">Cara registrasi akun SIAPkerja / Skillhub</div>
                            </div>
                        </a>
                    </div>

                    <button onClick={() => setShowGuideModal(false)} className="mt-6 w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold rounded-lg transition-colors">
                        Tutup
                    </button>
                </div>
            </div>
        )}

      </div>
    </section>
  );
}

// --- FOOTER, LOGIN, DLL ---
function Footer() {
  const [newComment, setNewComment] = useState("");
  const [newName, setNewName] = useState(""); 
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState({ title: '', body: '', type: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvedComments, setApprovedComments] = useState([]);
  const [user, setUser] = useState(null); 

  useEffect(() => {
        if(auth) {
            // Note: onAuthStateChanged listener in App.jsx sets the main user state,
            // this local one is only for ensuring this component has the latest auth state.
            return onAuthStateChanged(auth, setUser); 
        }
  }, []);

  // Fetch Approved Comments Only
useEffect(() => {
  if (!db) {
    return; 
  }

  // CUKUP WHERE SAJA
  const q = query(
    getCommentsCollection(db),
    where("status", "==", "approved")
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const comments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Manual sort tetap boleh
    comments.sort((a, b) => {
      const timeA = a.createdAt ? a.createdAt.seconds : 0;
      const timeB = b.createdAt ? b.createdAt.seconds : 0;
      return timeB - timeA;
    });
    setApprovedComments(comments);
  }, (err) => {
    console.error("Error fetch public comments:", err);
  });

  return () => unsubscribe();
}, [db]);


  const showCustomModal = (title, body, type = 'info') => {
    setModalMessage({ title, body, type });
    setShowModal(true);
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    if (!db) { showCustomModal("Error", "Koneksi database belum disetup. Harap isi config Firebase di kode.", "error"); return; }
    
    setIsSubmitting(true);
    try {
        // FIX: Gunakan helper dengan path yang benar
        await addDoc(getCommentsCollection(db), {
            name: newName.trim() || "Pengguna Anonim", 
            comment: newComment.trim(),
            status: "pending",
            createdAt: serverTimestamp(),
            date: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
        });
        setNewComment("");
        setNewName(""); 
        showCustomModal("Komentar Terkirim", "Komentar Anda telah dikirim dan menunggu persetujuan Admin sebelum ditampilkan.", 'success');
    } catch (e) {
        console.error(e);
        showCustomModal("Gagal", "Terjadi kesalahan saat mengirim komentar. Pastikan Anda terhubung dan memiliki izin tulis.", "error");
    } finally {
        setIsSubmitting(false);
    }
  };

  const Modal = ({ isOpen, onClose, message }) => {
    if (!isOpen) return null;
    const colorClass = message.type === 'success' ? 'border-green-500/50 text-green-400' : (message.type === 'error' ? 'border-red-500/50 text-red-400' : 'border-blue-500/50 text-blue-400');
    return (
      <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 animate-fade-in">
        <div className={`bg-slate-900 border ${colorClass} rounded-xl w-full max-w-sm shadow-2xl p-6`}>
          <h3 className={`text-xl font-bold mb-4 ${message.type === 'success' ? 'text-green-400' : (message.type === 'error' ? 'text-red-400' : 'text-blue-400')}`}>{message.title}</h3>
          <p className="text-slate-300 mb-6 text-sm">{message.body}</p>
          <div className="flex justify-end">
            <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-semibold">Tutup</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <footer id="tentang" className="bg-slate-950 border-t border-white/10">
      <div className="max-w-6xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-12 text-sm text-slate-300">
        
        {/* KOLOM 1: TENTANG & SOCIAL */}
        <div>
            <h3 className="font-bold text-white mb-4 text-lg">UPT BLK Kota Magelang</h3>
            <p className="leading-relaxed mb-4 text-slate-400">Unit Pelaksana Teknis di bawah Dinas Tenaga Kerja yang melaksanakan pelatihan kerja.</p>
            <div className="flex gap-4">
                <a href="https://www.instagram.com/blkkotamagelang" target="_blank" rel="noreferrer" className="flex items-center gap-3 group">
                    {/* UPDATE: Ikon Instagram Standar */}
                    <div className="w-8 h-8 rounded-full border border-slate-600 flex items-center justify-center group-hover:border-emerald-500 group-hover:text-emerald-400 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                    </div>
                    <span className="text-slate-300 group-hover:text-emerald-400 transition-colors">@blkkotamagelang</span>
                </a>
            </div>
        </div>
        
        {/* KOLOM 2: KONTAK */}
        <div>
            <h3 className="font-bold text-white mb-4 text-lg">Kontak</h3>
            <ul className="space-y-3">
                <li className="flex items-center gap-3"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg><span>(0293) 312501</span></li>
                {/* NEW: Nomor WhatsApp */}
                <li className="flex items-center gap-3"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg><span>0857-4172-0129</span></li>
                <li className="flex items-center gap-3"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg><span>blk.magelangkota@gmail.com</span></li>
            </ul>
        </div>
        
        {/* KOLOM 3: LOKASI */}
        <div>
            <h3 className="font-bold text-white mb-4 text-lg">Lokasi Kami</h3>
            <div className="rounded-xl overflow-hidden border border-slate-800 shadow-lg">
                <iframe src="https://maps.google.com/maps?q=UPT+Balai+Latihan+Kerja+Kota+Magelang&t=&z=15&ie=UTF8&iwloc=&output=embed" width="100%" height="180" style={{ border:0 }} allowFullScreen="" loading="lazy" referrerPolicy="no-referrer-when-downgrade"></iframe>
            </div>
            <span className='text-xs text-slate-400 mt-2 block'>Jalan Kebonsari 3 RT 03 RW 01, Kedungsari, Magelang Utara.</span>
        </div>
      </div>

      {/* KOLOM BARU: KOMENTAR PUBLIK (FULL WIDTH) */}
      <div className="bg-slate-900 border-t border-b border-slate-800 py-10">
          <div className="max-w-6xl mx-auto px-4">
             <div className='grid md:grid-cols-2 gap-10'>
                {/* Komentar Column */}
                <div>
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.111A9.501 9.501 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                        Komentar Publik (Kurasi)
                    </h3>
                    <div className='space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar'>
                        {!db && <div className="text-xs text-red-400">Database belum terkoneksi. Setup Firebase di kode.</div>}
                        {db && approvedComments.length === 0 && <div className="text-xs text-slate-500">Belum ada komentar yang ditampilkan.</div>}
                        {approvedComments.map(c => (
                            <div key={c.id} className='p-3 bg-slate-800/70 border border-slate-700 rounded-lg'>
                                <div className='text-xs font-bold text-emerald-400'>{c.name}</div>
                                <div className='text-[10px] text-slate-500 mb-2'>{c.date}</div>
                                <p className='text-sm text-slate-300'>{c.comment}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Form & Metrics Column */}
                <div>
                    <h3 className="text-xl font-bold text-white mb-4">Berikan Komentar Anda</h3>
                    <form onSubmit={handleCommentSubmit} className='space-y-3 p-4 bg-slate-800 border border-slate-700 rounded-xl'>
                        {/* ADDED: Input Nama */}
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Nama Anda (Opsional)"
                            className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                        <textarea
                            rows="4"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder='Tulis komentar, kritik, atau saran Anda tentang layanan BLK di sini...'
                            className='w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 resize-none'
                            required
                        />
                        <button 
                            type="submit" 
                            disabled={isSubmitting}
                            className='w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-bold rounded-lg text-sm transition-colors'
                        >
                            {isSubmitting ? "Mengirim..." : "Kirim Komentar (Moderasi Admin)"}
                        </button>
                    </form>

                    <div className='mt-6 p-4 bg-slate-800/70 border border-slate-700 rounded-xl'>
                        <h4 className='text-sm font-bold text-white mb-3'>Statistik Partisipasi</h4>
<div className='text-xs text-slate-400'>
    {/* Hanya menampilkan data komentar yang real */}
    <div className='p-4 bg-slate-900/80 border border-emerald-500/30 rounded-xl inline-flex items-center gap-3'>
        <div className="p-2 bg-emerald-500/20 rounded-full text-emerald-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
        </div>
        <div>
            <span className='font-bold text-2xl text-white'>{approvedComments.length}</span>
            <span className='tracking-wider block text-[10px] text-emerald-300 font-bold uppercase mt-0.5'>Komentar Publik</span>
        </div>
    </div>
    <p className="mt-2 text-[10px] text-slate-500">Jumlah komentar yang telah dikurasi dan ditampilkan.</p>
</div>
                    </div>
                </div>
             </div>
          </div>
      </div>

      <div className="bg-black/40 border-t border-slate-800"><div className="max-w-6xl mx-auto px-4 py-6 text-xs text-slate-500 flex flex-col md:flex-row justify-between items-center gap-2"><span>© {new Date().getFullYear()} UPT Balai Latihan Kerja – Dinas Tenaga Kerja Kota Magelang</span><span>SELARAS v1.0 (Firebase Enabled)</span></div></div>
      
      <Modal 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        message={modalMessage}
      />
    </footer>
  );
}

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // FIX: Suffix khusus untuk NIP agar dikenali sebagai email oleh Firebase Auth
  const NIP_SUFFIX = "@nip.blk.com"; 

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Menentukan apakah input adalah NIP (hanya angka) atau Email (mengandung '@')
    const isNIP = /^\d+$/.test(email);
    const finalEmail = isNIP ? `${email}${NIP_SUFFIX}` : email;

    // --- LOGIC BYPASS/MOCK FIREBASE ---
    if (!auth) {
        if (email === "12345" && password === "admin") {
            setTimeout(() => {
                // Mock user object for demo when Firebase is not configured
                onLogin({ email: "Admin Demo (NIP 12345)", role: "Super Admin", isAnonymous: false, uid: "demo-admin-id" }); 
                setIsLoading(false);
            }, 1000);
            return;
        } else {
            setError("Firebase Error: Config belum diisi. Gunakan NIP: 12345 Pass: admin untuk mode demo lokal.");
            setIsLoading(false);
            return;
        }
    }
    // --- END LOGIC BYPASS/MOCK FIREBASE ---

    try {
        const userCredential = await signInWithEmailAndPassword(auth, finalEmail, password);
        onLogin(userCredential.user);
    } catch (error) {
        // Karena kita menggunakan finalEmail (dengan suffix), pesan error mungkin kurang jelas.
        // Kita tampilkan pesan error yang umum untuk NIP/Password.
        setError("Login Gagal: Cek NIP/Password Anda. Pastikan NIP terdaftar di Firebase sebagai email.");
        console.error("Firebase Login Error:", error);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <section id="login" className="pt-32 pb-20 min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full px-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500"></div>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white">Login Pegawai</h2>
            <p className="text-slate-400 text-sm mt-2">Masuk ke Dashboard Admin SELARAS</p>
          </div>
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-xs text-center">
                    {error}
                </div>
            )}
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide">NIP Pegawai</label>
              <div className="mt-1 relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg></span>
                  <input 
                      type="text" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" 
                      placeholder="Masukkan NIP Anda (misal: 12345)" 
                      required
                  />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wide">Password</label>
              <div className="mt-1 relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg></span>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" placeholder="••••••••" required/>
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center">
              {isLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : "Masuk Dashboard"}
            </button>
          </form>
          <div className="mt-6 text-center">
             <p className="text-[10px] text-slate-500">Pastikan <span className="text-slate-300">firebaseConfig</span> sudah diisi di kode.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function App() {
  const [currentPage, setCurrentPage] = useState("beranda");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [allScheduleData, setAllScheduleData] = useState([]);
  const [galleryData, setGalleryData] = useState([]);
  const [allStatsData, setAllStatsData] = useState([]);
  const [pesertaData, setPesertaData] = useState([]);
  const [lokerData, setLokerData] = useState([]);
  const [produkData, setProdukData] = useState([]);
  const [kejuruanOptions, setKejuruanOptions] = useState(["Semua"]);

  // Listen Auth State Realtime
  useEffect(() => {
    // CRITICAL: Initialize auth first (Public Anonymous Session or Custom Token)
    const initAuth = async () => {
        if (!auth) {
            setIsLoading(false);
            return;
        }
        try {
            // Cek apakah user sebelumnya sengaja logout (ingin mode tamu)
            const forceGuest = localStorage.getItem('force_guest_mode') === 'true';

            // Check if we have a custom token from environment (for preview)
            // UPDATE: Hanya login admin otomatis jika TIDAK dalam mode forceGuest
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token && !forceGuest) {
                await signInWithCustomToken(auth, __initial_auth_token);
            } else {
                // Fallback for local/other envs OR if user forced guest mode
                await signInAnonymously(auth);
            }
        } catch (error) {
            console.error("Auth Init Error:", error);
            // Fallback: If anonymous sign-in fails, still show the page, but without DB features
            setIsLoading(false); 
        }
    };
    initAuth();

    if (auth) {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            // Auth check complete, now we can set loading to false for the page
            setIsLoading(false);
        });
        return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    // We fetch data regardless of Firebase Auth status, as it relies on public CSVs.
    const fetchData = async () => {
      // Don't set setIsLoading(true) here as we rely on the Auth effect to handle initial global loading state.
      if (!isLoading) { setIsLoading(true); } 
      
      setError(null);
      try {
        // Retry logic for fetching CSVs with exponential backoff
        const fetchWithRetry = async (url, retries = 3) => {
            let delay = 1000;
            for (let i = 0; i < retries; i++) {
                try {
                    const response = await fetch(url);
                    if (response.ok) return response.text();
                    throw new Error(`Failed to fetch ${url}, status: ${response.status}`);
                } catch (err) {
                    if (i === retries - 1) throw err;
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2;
                }
            }
        };

        const urls = [JADWAL_CSV_URL, STATS_CSV_URL, PESERTA_CSV_URL];
        const responses = await Promise.all(urls.map(url => fetchWithRetry(url).catch(e => { console.warn(`Error fetching ${url}:`, e.message); return ""; })));
        const [jadwal, stats, peserta] = responses.map(parseCSV);

        jadwal.sort((a, b) => new Date(a.startdate) - new Date(b.startdate));
        
        setAllScheduleData(jadwal);
        // setGalleryData(galeri.map(normalizeGalleryData).filter(item => item !== null));
        setAllStatsData(stats);
        setPesertaData(peserta);
        // setLokerData(loker.map((i, idx) => normalizeLokerData(i, idx)).filter(item => item !== null));
        // setProdukData(produk.map((i, idx) => normalizeProdukData(i, idx)).filter(item => item !== null));
        
        const kejuruan = [...new Set([...jadwal.map(i => i.kejuruan), ...peserta.map(i => i.kejuruan)])].filter(Boolean);
        setKejuruanOptions(["Semua", ...kejuruan]);

      } catch (err) {
        console.error(err);
        setError("Gagal memuat data. Pastikan internet lancar.");
      } finally {
          // Only set loading to false if Auth initialization already completed.
          if (!auth) {
             setIsLoading(false);
          }
      }
    };
    fetchData();
  }, []); 

      // Dengarkan Loker yang sudah APPROVED dari Firestore
  useEffect(() => {
    if (!db) return; // kalau Firebase belum ready, skip

    const q = query(
      getJobsCollection(db),
      where("moderationStatus", "==", "approved")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        // Sort terbaru di atas (pakai createdAt kalau ada)
        items.sort((a, b) => {
          const tA = a.createdAt?.seconds ?? 0;
          const tB = b.createdAt?.seconds ?? 0;
          return tB - tA;
        });
        setLokerData(items);
      },
      (err) => {
        console.error("Error fetch jobs (approved):", err);
      }
    );

    return () => unsubscribe();
  }, []);

  // Dengarkan Produk Alumni yang sudah APPROVED dari Firestore
  useEffect(() => {
    if (!db) return;

    const q = query(
      getProductsCollection(db),
      where("moderationStatus", "==", "approved")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        items.sort((a, b) => {
          const tA = a.createdAt?.seconds ?? 0;
          const tB = b.createdAt?.seconds ?? 0;
          return tB - tA;
        });
        setProdukData(items);
      },
      (err) => {
        console.error("Error fetch products (approved):", err);
      }
    );

    return () => unsubscribe();
  }, []);

// --- TAMBAHKAN LISTENER REALTIME KHUSUS GALERI DI SINI (Di dalam App) ---
useEffect(() => {
    if (!db) return;
    const q = query(getGalleryCollection(db), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setGalleryData(items); // Masukkan ke state galleryData yang sudah ada
    }, (err) => console.log("Gallery fetch error:", err));
    
    return () => unsubscribe();
    }, []);

  const handleLogout = async () => {
    if (auth) {
        // Tandai bahwa user ingin mode tamu (disimpan di browser)
        localStorage.setItem('force_guest_mode', 'true');

        // Sign out clears the session.
        await signOut(auth);
        
        // Masuk sebagai tamu (Anonymous) agar tetap bisa baca data publik.
        // The onAuthStateChanged listener above will handle setting the user state.
        signInAnonymously(auth).catch((err) => {
            console.warn("Gagal masuk mode tamu (anonim), user mungkin perlu refresh.", err);
        });
    }
    setUser(null);
    setCurrentPage("beranda");
  };

  const renderPage = () => {
    if (currentPage === "beranda") return <BerandaPage allStatsData={allStatsData} staticStatsData={[]} allScheduleData={allScheduleData} galleryData={galleryData} kejuruanOptions={kejuruanOptions} isLoading={isLoading} error={error} setCurrentPage={setCurrentPage}/>;
    if (currentPage === "dasamuka") return <LakonDasamukaPage dbInstance={db} kejuruanOptions={kejuruanOptions} lokerData={lokerData} produkData={produkData} />;
    if (currentPage === "panduan") return <PanduanPage onBack={() => setCurrentPage("beranda")} />;

    // UPDATE: Hapus force_guest_mode saat login berhasil
    if (currentPage === "login") return <LoginPage onLogin={(u) => {
        localStorage.removeItem('force_guest_mode'); 
        setUser(u); 
        setCurrentPage("dashboard");
    }} />;
    
    // REVISI: Pastikan hanya user NON-ANONYMOUS yang bisa akses dashboard
    if (currentPage === "dashboard") return (user && !user.isAnonymous) ? <DashboardPage user={user} pesertaData={pesertaData} kejuruanOptions={kejuruanOptions} isLoading={isLoading} error={error} onBackToHome={() => setCurrentPage('beranda')} /> : <LoginPage onLogin={(u) => {
        localStorage.removeItem('force_guest_mode');
        setUser(u); 
        setCurrentPage("dashboard");
    }} />;
    return null;
  };

  let chatConfig = { title: "Asisten SELARAS", subTitle: "Online", webhookUrl: CHAT_WEBHOOK_SELARAS, initialMessage: "Halo! Ada yang bisa saya bantu?" };
  // UPDATE: ChatWidget hanya untuk halaman beranda
  // if (currentPage === "dasamuka") chatConfig = { title: "Konsultan Alumni", subTitle: "Layanan Alumni", webhookUrl: CHAT_WEBHOOK_KONSULTASI, initialMessage: "Halo Alumni! Ceritakan kendala karir Anda." };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 relative font-sans">
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.5s ease-out; }
        .animate-fade-in-up { animation: fadeInUp 0.5s ease-out; }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #1e293b; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #475569; border-radius: 20px; }
      `}</style>
      <div className="fixed inset-0 -z-10 bg-cover bg-center opacity-20" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=2070')` }} />
      
      <Navbar setCurrentPage={setCurrentPage} user={user} onLogout={handleLogout} />
      <main>{renderPage()}</main>
      <Footer />
      {currentPage === "beranda" && <ChatWidget isOpen={isChatOpen} setIsOpen={setIsChatOpen} config={chatConfig} />}
    </div>
  );
}

export default App;