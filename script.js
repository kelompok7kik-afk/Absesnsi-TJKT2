
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxZ5Z0HLad_1EaAUmoQBzX8QTTPK3hjQQ540RnPBfO_cjoPuDS8SOrvuBs-gqrY8UPi/exec";

let currentRole = "";
let loginPurpose = "";
let sessionToken = "";
let html5QrCode = null;
let isScannerRunning = false;

const $ = (id) => document.getElementById(id);

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
  $("loginMessage").textContent = "";

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
    redirect: "follow"
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
    const result = await apiGet("login", { username, password });

    if (!result.success || !result.token) {
      setMessage(
        "loginMessage",
        result.message || "Login gagal.",
        true
      );
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
      setMessage("loginMessage", "Akun tidak diizinkan melakukan scan.", true);
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
      "Tidak dapat terhubung ke server. Periksa URL Apps Script dan deployment.",
      true
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "LOGIN";
    }
  }
}

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
    stopScanner();

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
    setMessage("scanResult", "Kamera aktif. Arahkan ke QR Code siswa.");
  } catch (error) {
    console.error(error);
    setMessage(
      "scanResult",
      "Kamera gagal dibuka. Izinkan akses kamera dan buka website melalui HTTPS.",
      true
    );
  }
}

let scanInProgress = false;

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
        "Absensi berhasil!\nNama: " + nama +
        "\nKeterangan: " + status +
        "\nWaktu: " + waktu
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
  if (!html5QrCode || !isScannerRunning) return;

  try {
    await html5QrCode.stop();
    await html5QrCode.clear();
  } catch (error) {
    console.warn(error);
  }

  isScannerRunning = false;
  html5QrCode = null;
}

function stopScanner() {
  if (html5QrCode && isScannerRunning) {
    html5QrCode.stop()
      .then(() => html5QrCode.clear())
      .catch((error) => console.warn(error));
  }

  isScannerRunning = false;
  html5QrCode = null;
  scanInProgress = false;
}

async function loadGuruData() {
  if (!sessionToken || currentRole !== "GURU") return;

  setMessage("guruStatus", "Memuat data absensi...");

  try {
    const result = await apiGet("guru", { token: sessionToken });

    if (!result.success) {
      setMessage("guruStatus", result.message || "Gagal memuat data.", true);
      return;
    }

    const table = $("guruTable");
    table.replaceChildren();

    (result.data || []).forEach((student, index) => {
      const tr = document.createElement("tr");

      addCell(tr, index + 1);
      addCell(tr, student.nama);
      addCell(tr, student.noAbsen);
      addCell(tr, student.waktu || "—");

      const statusCell = document.createElement("td");
      const select = document.createElement("select");

      [
        "Hadir",
        "Terlambat",
        "Waktu pulang",
        "Izin",
        "Sakit",
        "Alfa"
      ].forEach((status) => {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = status;
        option.selected = student.keterangan === status;
        select.appendChild(option);
      });

      select.addEventListener("change", async () => {
        select.disabled = true;

        try {
          const response = await apiGet("ubahKeterangan", {
            token: sessionToken,
            id: student.id,
            keterangan: select.value
          });

          if (!response.success) {
            alert(response.message || "Gagal mengubah keterangan.");
            await loadGuruData();
          }
        } catch (error) {
          alert("Gagal terhubung ke server.");
          await loadGuruData();
        } finally {
          select.disabled = false;
        }
      });

      statusCell.appendChild(select);
      tr.appendChild(statusCell);
      table.appendChild(tr);
    });

    setMessage(
      "guruStatus",
      "Data berhasil dimuat. Ubah keterangan melalui pilihan di tabel."
    );
  } catch (error) {
    console.error(error);
    setMessage("guruStatus", "Gagal mengambil data dari server.", true);
  }
}

function addCell(row, value) {
  const td = document.createElement("td");
  td.textContent = value == null ? "" : String(value);
  row.appendChild(td);
}

async function loadDashboard() {
  if (!sessionToken || currentRole !== "ADMIN") return;

  try {
    const result = await apiGet("dashboard", { token: sessionToken });

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

  if (bar) bar.style.height = Math.max(percent, value > 0 ? 4 : 0) + "%";
  if (label) label.textContent = percent.toFixed(1) + "%";
}

function logoutAdmin() {
  goHome();
}

window.addEventListener("DOMContentLoaded", () => {
  showPage("homePage");
});
