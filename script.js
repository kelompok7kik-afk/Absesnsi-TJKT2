const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxZ5Z0HLad_1EaAUmoQBzX8QTTPK3hjQQ540RnPBfO_cjoPuDS8SOrvuBs-gqrY8UPi/exec";


let scanner = null;
let scanProcessing = false;


/* =====================================================
   PAGE NAVIGATION
===================================================== */

function hideAllPages() {

  document
    .querySelectorAll(".page")
    .forEach(function(page) {

      page.style.display = "none";

    });

}


function showHomePage() {

  stopScanner();

  hideAllPages();

  const page =
    document.getElementById("homePage");

  if (page) {

    page.style.display = "flex";

  }

}


function showStudentPage() {

  stopScanner();

  hideAllPages();

  const page =
    document.getElementById("studentPage");

  if (page) {

    page.style.display = "block";

  }

  const result =
    document.getElementById("scanResult");

  if (result) {

    result.innerHTML =
      "⏳ Menyalakan kamera...";

  }

  setTimeout(function() {

    startScanner();

  }, 300);

}


function showRolePage() {

  stopScanner();

  hideAllPages();

  const page =
    document.getElementById("rolePage");

  if (page) {

    page.style.display = "block";

  }

}


function showGuruPage() {

  stopScanner();

  hideAllPages();

  const page =
    document.getElementById("guruPage");

  if (page) {

    page.style.display = "block";

  }

  loadGuruData();

}


function showLoginPage() {

  stopScanner();

  hideAllPages();

  const page =
    document.getElementById("loginPage");

  if (page) {

    page.style.display = "block";

  }

  const username =
    document.getElementById("username");

  if (username) {

    setTimeout(function() {

      username.focus();

    }, 100);

  }

}


function showAdminPage() {

  stopScanner();

  hideAllPages();

  const page =
    document.getElementById("adminPage");

  if (page) {

    page.style.display = "block";

  }

  loadDashboard();

}


function goHome() {

  showHomePage();

}


function goBackToRole() {

  showRolePage();

}


/* =====================================================
   QR SCANNER
===================================================== */

function startScanner() {

  const reader =
    document.getElementById("reader");


  if (!reader) {

    return;

  }


  if (
    typeof Html5Qrcode ===
    "undefined"
  ) {

    tampilkanErrorKamera(
      new Error(
        "Library QR Scanner belum berhasil dimuat."
      )
    );

    return;

  }


  scanProcessing = false;

  reader.innerHTML = "";


  Html5Qrcode
    .getCameras()

    .then(function(cameras) {

      console.log(
        "Kamera ditemukan:",
        cameras
      );


      if (
        !cameras ||
        cameras.length === 0
      ) {

        throw new Error(
          "Kamera tidak ditemukan pada perangkat."
        );

      }


      let cameraId =
        cameras[0].id;


      /*
       * Cari kamera belakang
       */

      for (
        let i = 0;
        i < cameras.length;
        i++
      ) {

        const label =
          String(
            cameras[i].label || ""
          ).toLowerCase();


        if (
          label.includes("back") ||
          label.includes("rear") ||
          label.includes("environment") ||
          label.includes("belakang")
        ) {

          cameraId =
            cameras[i].id;

          break;

        }

      }


      scanner =
        new Html5Qrcode(
          "reader"
        );


      return scanner.start(

        cameraId,

        {
          fps: 10,

          qrbox: {
            width: 250,
            height: 250
          }
        },

        function(decodedText) {

          if (scanProcessing) {

            return;

          }

          scanProcessing = true;

          console.log(
            "QR terbaca:",
            decodedText
          );


          prosesQR(decodedText);

        },

        function(errorMessage) {

          // Tidak perlu menampilkan
          // error scanning setiap frame.

        }

      );

    })

    .then(function() {

      console.log(
        "Kamera berhasil dinyalakan."
      );

    })

    .catch(function(error) {

      console.error(
        "Camera error:",
        error
      );

      scanner = null;

      tampilkanErrorKamera(
        error
      );

    });

}


/* =====================================================
   CAMERA ERROR
===================================================== */

function tampilkanErrorKamera(error) {

  const result =
    document.getElementById(
      "scanResult"
    );


  if (!result) {

    return;

  }


  let pesan =
    "❌ Kamera tidak dapat digunakan.";


  if (
    error &&
    error.message
  ) {

    pesan +=
      "<br><br><small>" +
      escapeHtml(
        error.message
      ) +
      "</small>";

  }


  result.innerHTML =
    pesan;

}


/* =====================================================
   STOP CAMERA
===================================================== */

function stopScanner() {

  scanProcessing = false;


  if (!scanner) {

    return;

  }


  const currentScanner =
    scanner;


  scanner = null;


  currentScanner
    .stop()

    .then(function() {

      try {

        currentScanner.clear();

      } catch (error) {

        console.warn(
          "Scanner clear:",
          error
        );

      }

    })

    .catch(function(error) {

      console.warn(
        "Scanner stop:",
        error
      );


      try {

        currentScanner.clear();

      } catch (e) {}

    });

}


/* =====================================================
   PROSES QR
===================================================== */

function prosesQR(id) {

  stopScanner();


  const result =
    document.getElementById(
      "scanResult"
    );


  if (result) {

    result.innerHTML =
      "⏳ Memproses absensi...";

  }


  const url =
    SCRIPT_URL +
    "?action=absen&id=" +
    encodeURIComponent(id);


  fetch(url, {

    method: "GET",

    cache: "no-store"

  })

  .then(function(response) {

    if (!response.ok) {

      throw new Error(
        "Server mengembalikan status " +
        response.status
      );

    }


    return response.json();

  })

  .then(function(data) {

    if (!result) {

      return;

    }


    if (data.success) {

      result.innerHTML =

        "✅ <strong>" +
        escapeHtml(
          data.message
        ) +
        "</strong>" +

        "<br><br>" +

        "Nama: " +
        escapeHtml(
          data.siswa.nama
        ) +

        "<br>" +

        "No Absen: " +
        escapeHtml(
          data.siswa.noAbsen
        ) +

        "<br>" +

        "Waktu: " +
        escapeHtml(
          data.waktu
        ) +

        "<br><br>" +

        '<button class="btn primary" onclick="restartScanner()">' +
        "📷 Scan Lagi" +
        "</button>";

    }

    else {

      let tambahan = "";


      if (data.waktu) {

        tambahan =
          "<br>Waktu: " +
          escapeHtml(
            data.waktu
          );

      }


      result.innerHTML =

        "❌ " +
        escapeHtml(
          data.message ||
          "Absensi gagal."
        ) +

        tambahan +

        "<br><br>" +

        '<button class="btn primary" onclick="restartScanner()">' +
        "📷 Coba Lagi" +
        "</button>";

    }

  })

  .catch(function(error) {

    console.error(
      "Absensi error:",
      error
    );


    if (result) {

      result.innerHTML =

        "❌ Gagal terhubung ke server." +

        "<br><small>" +

        escapeHtml(
          error.message || ""
        ) +

        "</small>" +

        "<br><br>" +

        '<button class="btn primary" onclick="restartScanner()">' +
        "📷 Coba Lagi" +
        "</button>";

    }

  });

}


/* =====================================================
   RESTART SCANNER
===================================================== */

function restartScanner() {

  const result =
    document.getElementById(
      "scanResult"
    );


  if (result) {

    result.innerHTML =
      "⏳ Menyalakan kamera...";

  }


  stopScanner();


  setTimeout(function() {

    startScanner();

  }, 300);

}


/* =====================================================
   DATA GURU
===================================================== */

function loadGuruData() {

  const status =
    document.getElementById(
      "guruStatus"
    );


  const table =
    document.getElementById(
      "guruTable"
    );


  if (status) {

    status.innerHTML =
      "⏳ Memuat data absensi...";

  }


  fetch(
    SCRIPT_URL +
    "?action=guru",
    {
      method: "GET",
      cache: "no-store"
    }
  )

  .then(function(response) {

    if (!response.ok) {

      throw new Error(
        "Server mengembalikan status " +
        response.status
      );

    }


    return response.json();

  })

  .then(function(data) {

    if (!data.success) {

      if (status) {

        status.innerHTML =
          "❌ " +
          escapeHtml(
            data.message ||
            "Gagal mengambil data."
          );

      }

      return;

    }


    if (status) {

      status.innerHTML =
        "✅ Data absensi berhasil dimuat.";

    }


    if (!table) {

      return;

    }


    table.innerHTML = "";


    if (
      !data.data ||
      data.data.length === 0
    ) {

      table.innerHTML =
        "<tr>" +
        "<td colspan='4'>" +
        "Belum ada data absensi." +
        "</td>" +
        "</tr>";

      return;

    }


    data.data.forEach(
      function(row, index) {

        const tr =
          document.createElement(
            "tr"
          );


        const nama =
          row.nama || "";


        const noAbsen =
          row.noAbsen || "";


        const waktu =
          row.waktu || "";


        tr.innerHTML =

          "<td>" +
          (index + 1) +
          "</td>" +

          "<td>" +
          escapeHtml(nama) +
          "</td>" +

          "<td>" +
          escapeHtml(noAbsen) +
          "</td>" +

          "<td>" +
          escapeHtml(waktu) +
          "</td>";


        table.appendChild(tr);

      }
    );

  })

  .catch(function(error) {

    console.error(
      "Guru error:",
      error
    );


    if (status) {

      status.innerHTML =
        "❌ Gagal mengambil data dari Google Sheets.";

    }

  });

}


/* =====================================================
   LOGIN ADMIN
===================================================== */

function loginAdmin() {

  const usernameElement =
    document.getElementById(
      "username"
    );


  const passwordElement =
    document.getElementById(
      "password"
    );


  const message =
    document.getElementById(
      "loginMessage"
    );


  if (
    !usernameElement ||
    !passwordElement
  ) {

    return;

  }


  const username =
    usernameElement.value.trim();


  const password =
    passwordElement.value.trim();


  if (
    !username ||
    !password
  ) {

    if (message) {

      message.innerHTML =
        "⚠️ Username dan password harus diisi.";

    }

    return;

  }


  if (message) {

    message.innerHTML =
      "⏳ Memeriksa akun...";

  }


  const url =
    SCRIPT_URL +
    "?action=login" +
    "&username=" +
    encodeURIComponent(username) +
    "&password=" +
    encodeURIComponent(password);


  fetch(url, {

    method: "GET",

    cache: "no-store"

  })

  .then(function(response) {

    if (!response.ok) {

      throw new Error(
        "Server mengembalikan status " +
        response.status
      );

    }


    return response.json();

  })

  .then(function(data) {

    if (data.success) {

      if (
        data.role === "ADMIN"
      ) {

        usernameElement.value = "";

        passwordElement.value = "";

        if (message) {

          message.innerHTML = "";

        }

        showAdminPage();

      }

      else {

        if (message) {

          message.innerHTML =
            "❌ Akun ini bukan akun admin.";

        }

      }

    }

    else {

      if (message) {

        message.innerHTML =
          "❌ Username atau password salah.";

      }

    }

  })

  .catch(function(error) {

    console.error(
      "Login error:",
      error
    );


    if (message) {

      message.innerHTML =
        "❌ Terjadi kesalahan koneksi.";

    }

  });

}


/* =====================================================
   LOGOUT ADMIN
===================================================== */

function logoutAdmin() {

  showRolePage();

}


/* =====================================================
   DASHBOARD ADMIN
===================================================== */

function loadDashboard() {

  fetch(

    SCRIPT_URL +
    "?action=dashboard",

    {
      method: "GET",
      cache: "no-store"
    }

  )

  .then(function(response) {

    if (!response.ok) {

      throw new Error(
        "Server mengembalikan status " +
        response.status
      );

    }


    return response.json();

  })

  .then(function(data) {

    if (!data.success) {

      console.error(
        "Dashboard:",
        data.message
      );

      return;

    }


    const total =
      document.getElementById(
        "totalSiswa"
      );


    const hadir =
      document.getElementById(
        "jumlahHadir"
      );


    const tidakHadir =
      document.getElementById(
        "jumlahTidakHadir"
      );


    const persentase =
      document.getElementById(
        "persentase"
      );


    if (total) {

      total.innerText =
        data.total;

    }


    if (hadir) {

      hadir.innerText =
        data.hadir;

    }


    if (tidakHadir) {

      tidakHadir.innerText =
        data.tidakHadir;

    }


    if (persentase) {

      persentase.innerText =
        data.persentase +
        "%";

    }


    const jumlahSiswa =
      Number(data.total) || 0;


    const jumlahHadir =
      Number(data.hadir) || 0;


    const jumlahTidakHadir =
      Number(data.tidakHadir) || 0;


    const hadirPercent =
      jumlahSiswa > 0

        ? (
            jumlahHadir /
            jumlahSiswa
          ) * 100

        : 0;


    const tidakHadirPercent =
      jumlahSiswa > 0

        ? (
            jumlahTidakHadir /
            jumlahSiswa
          ) * 100

        : 0;


    const barHadir =
      document.getElementById(
        "barHadir"
      );


    const barTidakHadir =
      document.getElementById(
        "barTidakHadir"
      );


    const barHadirValue =
      document.getElementById(
        "barHadirValue"
      );


    const barTidakHadirValue =
      document.getElementById(
        "barTidakHadirValue"
      );


    if (barHadir) {

      barHadir.style.height =
        hadirPercent +
        "%";

    }


    if (barTidakHadir) {

      barTidakHadir.style.height =
        tidakHadirPercent +
        "%";

    }


    if (barHadirValue) {

      barHadirValue.innerText =
        Math.round(
          hadirPercent
        ) +
        "%";

    }


    if (barTidakHadirValue) {

      barTidakHadirValue.innerText =
        Math.round(
          tidakHadirPercent
        ) +
        "%";

    }

  })

  .catch(function(error) {

    console.error(
      "Dashboard error:",
      error
    );

  });

}


/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeHtml(value) {

  return String(
    value == null
      ? ""
      : value
  )

  .replace(
    /&/g,
    "&amp;"
  )

  .replace(
    /</g,
    "&lt;"
  )

  .replace(
    />/g,
    "&gt;"
  )

  .replace(
    /"/g,
    "&quot;"
  )

  .replace(
    /'/g,
    "&#039;"
  );

}


/* =====================================================
   START WEBSITE
===================================================== */

document.addEventListener(
  "DOMContentLoaded",
  function() {

    hideAllPages();


    const homePage =
      document.getElementById(
        "homePage"
      );


    if (homePage) {

      homePage.style.display =
        "flex";

    }


    console.log(
      "Frontend absensi berhasil dimuat."
    );

  }
);