const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxZ5Z0HLad_1EaAUmoQBzX8QTTPK3hjQQ540RnPBfO_cjoPuDS8SOrvuBs-gqrY8UPi/exec";

let currentRole = "";
let loginPurpose = "";
let sessionToken = "";
let html5QrCode = null;
let isScannerRunning = false;
let scanInProgress = false;
let loadingGuru = false;

const $ = (id) => document.getElementById(id);

const STATUS_OPTIONS = [
  "Hadir",
  "Terlambat",
  "Waktu pulang",
  "Izin",
  "Sakit",
  "Alfa"
];

/* =========================
   NAVIGASI HALAMAN
========================= */

function showPage(pageId) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });

  const page = $(pageId);
  if (page) page.classList.add("active");
}

function goHome() {
  stopScanner();
  sessionToken = "";
  currentRole = "";
  loginPurpose = "";
  showPage("homePage");
}

function goBackToRole() {
  stopScanner();
  sessionToken = "";
  currentRole = "";
  loginPurpose = "";
  showPage("rolePage");
}

function showRolePage() {
  showPage("rolePage");
}

function showLoginPage(purpose) {
  stopScanner();

  loginPurpose = purpose;

  $("username").value = "";
  $("password").value = "";
  setMessage("loginMessage", "");

  if (purpose === "scan") {
    $("loginTitle").textContent = "Login untuk Absensi";
    $("loginHint").textContent =
      "Guru atau admin harus login sebelum membuka kamera scan QR.";
  } else if (purpose === "guru") {
    $("loginTitle").textContent = "Login Guru";
    $("loginHint").textContent =
      "Masuk menggunakan akun Guru yang terdaftar.";
  } else {
    $("loginTitle").textContent = "Login Admin";
    $("loginHint").textContent =
      "Masuk menggunakan akun Admin yang terdaftar.";
  }

  showPage("loginPage");
}

function logoutAdmin() {
  stopScanner();
  sessionToken = "";
  currentRole = "";
  loginPurpose = "";
  showPage("homePage");
}

/* =========================
   KONEKSI APPS SCRIPT
========================= */

function apiUrl(action, params = {}) {
  const url = new URL(SCRIPT_URL);
  url.searchParams.set("action", action);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

async function apiGet(action, params = {}) {
  const response = await fetch(apiUrl(action, params), {
    method: "GET",
    redirect: "follow",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Server memberikan respons HTTP " + response.status);
  }

  return response.json();
}

function setMessage(id, message, isError = false) {
  const element = $(id);
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error", isError);
}

/* =========================
   LOGIN
========================= */

async function loginAdmin() {
  const username = $("username").value.trim();
  const password = $("password").value;

  if (!username || !password) {
    setMessage("loginMessage", "Username dan password wajib diisi.", true);
    return;
  }

  const button = document.querySelector("#loginPage .btn.primary");

  if (button) {
    button.disabled = true;
    button.textContent = "Memeriksa...";
  }

  try {
    const result = await apiGet("login", {
      username: username,
      password: password
    });

    if (!result.success || !result.token) {
      setMessage("loginMessage", result.message || "Login gagal.", true);
      return;
    }

    const role = String(result.role || "").toUpperCase();

    if (loginPurpose === "admin" && role !== "ADMIN") {
      setMessage("loginMessage", "Halaman ini khusus Admin.", true);
      return;
    }

    if (loginPurpose === "guru" && role !== "GURU") {
      setMessage("loginMessage", "Halaman ini khusus Guru.", true);
      return;
    }

    if (
      loginPurpose === "scan" &&
      !["GURU", "ADMIN"].includes(role)
    ) {
      setMessage(
        "loginMessage",
        "Akun tidak diizinkan melakukan scan.",
        true
      );
      return;
    }

    sessionToken = result.token;
    currentRole = role;

    if (loginPurpose === "scan") {
      showPage("studentPage");
      await startScanner();
    } else if (role === "GURU") {
      showPage("guruPage");
      await loadGuruData();
    } else {
      showPage("adminPage");
      await loadDashboard();
    }
  } catch (error) {
    console.error(error);

    setMessage(
      "loginMessage",
      "Tidak dapat terhubung ke server. Periksa URL dan deployment Apps Script.",
      true
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "LOGIN";
    }
  }
}

/* =========================
   SCANNER QR
========================= */

async function startScanner() {
  if (!sessionToken) {
    showLoginPage("scan");
    return;
  }

  if (!window.Html5Qrcode) {
    setMessage("scanResult", "Pustaka pemindai QR gagal dimuat.", true);
    return;
  }

  try {
    await stopScannerAsync();

    html5QrCode = new Html5Qrcode("reader");

    const cameras = await Html5Qrcode.getCameras();

    if (!cameras || cameras.length === 0) {
      setMessage("scanResult", "Kamera tidak ditemukan.", true);
      return;
    }

    const camera =
      cameras.find((item) => /back|rear|environment/i.test(item.label)) ||
      cameras[cameras.length - 1];

    await html5QrCode.start(
      camera.id,
      {
        fps: 10,
        qrbox: { width: 230, height: 230 },
        aspectRatio: 1
      },
      async (decodedText) => {
        await handleQrScan(decodedText);
      },
      () => {}
    );

    isScannerRunning = true;

    setMessage(
      "scanResult",
      "Kamera aktif. Arahkan ke QR Code siswa."
    );
  } catch (error) {
    console.error(error);

    setMessage(
      "scanResult",
      "Kamera gagal dibuka. Izinkan akses kamera dan gunakan website melalui HTTPS.",
      true
    );
  }
}

async function handleQrScan(decodedText) {
  if (scanInProgress) return;

  scanInProgress = true;

  setMessage("scanResult", "QR terbaca. Menyimpan absensi...");

  try {
    const result = await apiGet("absen", {
      id: decodedText.trim(),
      token: sessionToken
    });

    if (result.success) {
      const nama = result.siswa?.nama || "Siswa";
      const waktu = result.waktu || "";
      const status = result.status || "";

      setMessage(
        "scanResult",
        "Absensi berhasil!\n" +
          "Nama: " + nama + "\n" +
          "Keterangan: " + status + "\n" +
          "Waktu scan: " + waktu
      );

      await stopScannerAsync();
    } else {
      setMessage(
        "scanResult",
        result.message || "Absensi gagal.",
        true
      );
    }
  } catch (error) {
    console.error(error);

    setMessage(
      "scanResult",
      "Gagal menyimpan absensi. Periksa koneksi internet.",
      true
    );
  } finally {
    scanInProgress = false;
  }
}

async function stopScannerAsync() {
  const scanner = html5QrCode;

  if (!scanner) {
    isScannerRunning = false;
    return;
  }

  html5QrCode = null;
  const wasRunning = isScannerRunning;
  isScannerRunning = false;

  if (wasRunning) {
    try {
      await scanner.stop();
    } catch (error) {
      console.warn("Scanner sudah berhenti:", error);
    }
  }

  try {
    await scanner.clear();
  } catch (error) {
    console.warn("Scanner sudah dibersihkan:", error);
  }
}

function stopScanner() {
  const scanner = html5QrCode;
  const wasRunning = isScannerRunning;

  html5QrCode = null;
  isScannerRunning = false;
  scanInProgress = false;

  if (scanner && wasRunning) {
    scanner.stop()
      .catch((error) => console.warn(error))
      .finally(() => {
        try {
          scanner.clear();
        } catch (error) {
          console.warn(error);
        }
      });
  }
}

/* =========================
   HALAMAN GURU
========================= */

async function loadGuruData() {
  if (!sessionToken || currentRole !== "GURU" || loadingGuru) {
    return;
  }

  loadingGuru = true;
  setMessage("guruStatus", "Memuat data absensi...");

  try {
    const result = await apiGet("guru", {
      token: sessionToken
    });

    if (!result.success) {
      setMessage(
        "guruStatus",
        result.message || "Gagal memuat data.",
        true
      );
      return;
    }

    const table = $("guruTable");
    if (!table) return;

    table.replaceChildren();

    (result.data || []).forEach((student, index) => {
      const tr = document.createElement("tr");

      addCell(tr, index + 1);
      addCell(tr, student.nama);
      addCell(tr, student.noAbsen);
      addCell(tr, student.waktu || "—");
      addCell(tr, student.waktuPerubahan || "—");

      const statusCell = document.createElement("td");
      const select = document.createElement("select");

      STATUS_OPTIONS.forEach((status) => {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = status;
        option.selected = student.keterangan === status;
        select.appendChild(option);
      });

      select.addEventListener("change", async () => {
        const selectedStatus = select.value;
        select.disabled = true;

        try {
          const response = await apiGet("ubahKeterangan", {
            token: sessionToken,
            id: student.id,
            keterangan: selectedStatus
          });

          if (!response.success) {
            alert(response.message || "Gagal mengubah keterangan.");
          } else {
            setMessage(
              "guruStatus",
              "Status " + student.nama +
                " berhasil diperbarui menjadi " + selectedStatus + "."
            );
          }
        } catch (error) {
          console.error(error);
          alert("Gagal terhubung ke server.");
        } finally {
          select.disabled = false;
          await loadGuruData();
        }
      });

      statusCell.appendChild(select);
      tr.appendChild(statusCell);
      table.appendChild(tr);
    });

    setMessage(
      "guruStatus",
      "Data berhasil dimuat. Waktu scan dan waktu perubahan disimpan terpisah."
    );
  } catch (error) {
    console.error(error);

    setMessage(
      "guruStatus",
      "Gagal mengambil data dari server.",
      true
    );
  } finally {
    loadingGuru = false;
  }
}

function addCell(row, value) {
  const td = document.createElement("td");
  td.textContent = value == null || value === "" ? "—" : String(value);
  row.appendChild(td);
}

/* =========================
   DASHBOARD HARIAN
========================= */

async function loadDashboard() {
  if (!sessionToken || currentRole !== "ADMIN") return;

  try {
    const result = await apiGet("dashboard", {
      token: sessionToken
    });

    if (!result.success) {
      alert(result.message || "Dashboard gagal dimuat.");
      return;
    }

    $("totalSiswa").textContent = result.total ?? 0;
    $("jumlahHadir").textContent = result.hadir ?? 0;
    $("jumlahTerlambat").textContent = result.terlambat ?? 0;
    $("jumlahWaktuPulang").textContent = result.waktuPulang ?? 0;
    $("jumlahIzin").textContent = result.izin ?? 0;
    $("jumlahSakit").textContent = result.sakit ?? 0;
    $("jumlahAlfa").textContent = result.alfa ?? 0;
    $("persentase").textContent = (result.persentase ?? 0) + "%";

    const total = Number(result.total) || 0;

    updateBar("Hadir", result.hadir, total);
    updateBar("Terlambat", result.terlambat, total);
    updateBar("WaktuPulang", result.waktuPulang, total);
    updateBar("Izin", result.izin, total);
    updateBar("Sakit", result.sakit, total);
    updateBar("Alfa", result.alfa, total);

    await loadMonthlyDashboard();
  } catch (error) {
    console.error(error);
    alert("Gagal mengambil dashboard. Periksa koneksi dan deployment.");
  }
}

function updateBar(name, count, total) {
  const value = Number(count) || 0;
  const percent = total > 0 ? (value / total) * 100 : 0;

  const bar = $("bar" + name);
  const label = $("bar" + name + "Value");

  if (bar) {
    bar.style.height = percent + "%";
  }

  if (label) {
    label.textContent = percent.toFixed(1) + "%";
  }
}

/* =========================
   DASHBOARD BULANAN
========================= */

function initMonthPicker() {
  const picker = $("bulanAbsensi");
  if (!picker) return;

  const now = new Date();

  picker.value =
    now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2, "0");

  // Jangan izinkan pemilihan bulan yang formatnya tidak sesuai.
  picker.max = picker.value;
}

async function loadMonthlyDashboard() {
  if (!sessionToken || currentRole !== "ADMIN") return;

  const picker = $("bulanAbsensi");

  if (!picker || !picker.value) {
    setMessage("statusBulanan", "Pilih bulan terlebih dahulu.", true);
    return;
  }

  const parts = picker.value.split("-");
  const tahun = Number(parts[0]);
  const bulan = Number(parts[1]);

  setMessage("statusBulanan", "Memuat rekap kehadiran bulanan...");

  try {
    const result = await apiGet("dashboardBulanan", {
      token: sessionToken,
      bulan: bulan,
      tahun: tahun
    });

    if (!result.success) {
      setMessage(
        "statusBulanan",
        result.message || "Gagal memuat data bulanan.",
        true
      );
      return;
    }

    const hadir = Number(result.hadir) || 0;
    const izin = Number(result.izin) || 0;
    const sakit = Number(result.sakit) || 0;
    const alfa = Number(result.alfa) || 0;

    const total = Number(result.totalEvaluasi) || 0;

    const persenHadir = Number(result.persenHadir) || 0;
    const persenIzin = Number(result.persenIzin) || 0;
    const persenSakit = Number(result.persenSakit) || 0;
    const persenAlfa = Number(result.persenAlfa) || 0;

    const donut = $("monthlyDonut");

    if (donut) {
      if (total > 0) {
        const p1 = persenHadir;
        const p2 = p1 + persenIzin;
        const p3 = p2 + persenSakit;

        donut.style.background =
          "conic-gradient(" +
          "#31e69b 0% " + p1 + "%, " +
          "#65b8ff " + p1 + "% " + p2 + "%, " +
          "#ff9e8d " + p2 + "% " + p3 + "%, " +
          "#ff6e83 " + p3 + "% 100%)";
      } else {
        donut.style.background = "#263b54";
      }
    }

    $("monthlyCenterValue").textContent =
      persenHadir.toFixed(1) + "%";

    $("monthlyHadirCount").textContent = hadir;
    $("monthlyIzinCount").textContent = izin;
    $("monthlySakitCount").textContent = sakit;
    $("monthlyAlfaCount").textContent = alfa;

    $("monthlyHadirPercent").textContent =
      persenHadir.toFixed(1) + "%";

    $("monthlyIzinPercent").textContent =
      persenIzin.toFixed(1) + "%";

    $("monthlySakitPercent").textContent =
      persenSakit.toFixed(1) + "%";

    $("monthlyAlfaPercent").textContent =
      persenAlfa.toFixed(1) + "%";

    $("monthlyTotal").textContent = total;
    $("monthlyDays").textContent = result.jumlahHariTercatat || 0;

    if (total > 0) {
      setMessage(
        "statusBulanan",
        "Rekap " + picker.value +
          " berhasil dimuat. Total " + total +
          " catatan siswa-hari dari " +
          result.jumlahHariTercatat +
          " tanggal yang tercatat."
      );
    } else {
      setMessage(
        "statusBulanan",
        "Belum ada catatan absensi pada bulan yang dipilih."
      );
    }
  } catch (error) {
    console.error(error);

    setMessage(
      "statusBulanan",
      "Gagal memuat rekap bulanan. Periksa URL dan deployment Apps Script.",
      true
    );
  }
}

/* =========================
   SAAT HALAMAN DIBUKA
========================= */

window.addEventListener("DOMContentLoaded", () => {
  showPage("homePage");
  initMonthPicker();

  const monthPicker = $("bulanAbsensi");

  if (monthPicker) {
    monthPicker.addEventListener("change", loadMonthlyDashboard);
  }

  const passwordInput = $("password");

  if (passwordInput) {
    passwordInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        loginAdmin();
      }
    });
  }
});