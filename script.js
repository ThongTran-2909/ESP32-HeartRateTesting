// ============================================
// FIREBASE CONFIGURATION
// ============================================
var firebaseConfig = {
  apiKey: "AIzaSyAULCcxzxiS9qHxD5Qmq2O0cw3IfcvbICU",
  authDomain: "heartratemonitor-2c056.firebaseapp.com",
  databaseURL: "https://heartratemonitor-2c056-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "heartratemonitor-2c056",
  storageBucket: "heartratemonitor-2c056.firebasestorage.app",
  messagingSenderId: "717061120649",
  appId: "1:717061120649:web:c63748500b40b118d51c58"
};

// Khởi tạo Firebase
firebase.initializeApp(firebaseConfig);
var database = firebase.database();

// ============================================
// BIẾN TOÀN CỤC - Lưu trữ giá trị hiện tại
// ============================================
let currentHR = 0;        // Heart Rate hiện tại
let currentSpO2 = 0;      // SpO2 hiện tại
let currentFall = false;  // Trạng thái Fall Detection
let currentManual = false; // Trạng thái nút nhấn

// ============================================
// CHỨC NĂNG: Vẽ vòng tròn progress (Heart Rate & SpO2)
// ============================================
function updateCircle(id, value, max, colorCondition) {
  const circle = document.getElementById(id);
  const radius = 102;
  const circumference = 2 * Math.PI * radius;
  
  const offset = circumference - (value / max) * circumference;
  
  circle.style.strokeDasharray = circumference;
  circle.style.strokeDashoffset = offset;
  circle.style.stroke = colorCondition ? "#f44336" : "#4caf50";
}

// ============================================
// CHỨC NĂNG: Phát âm thanh cảnh báo
// ============================================
function playAlertSound(active) {
  const alertSound = document.getElementById("alert-sound");
  
  if (active) {
    if (alertSound.paused) {
      alertSound.play().catch(e => console.log("Audio play failed:", e));
    }
  } else {
    alertSound.pause();
    alertSound.currentTime = 0;
  }
}

// ============================================
// CHỨC NĂNG: Hiển thị thông báo cảnh báo trên đầu trang
// ============================================
function showAlert(message) {
  const box = document.getElementById("alert-box");
  box.textContent = message;
  box.style.display = "block";
}

// ============================================
// CHỨC NĂNG: Cập nhật UI Fall Detection
// ============================================
function updateFallDetection(fallDetected) {
  const indicator = document.getElementById("fall-indicator");
  const text = document.getElementById("fall-text");
  const footer = document.getElementById("fall-footer");

  if (fallDetected) {
    indicator.classList.remove("off");
    indicator.classList.add("on");
    indicator.textContent = "⚠";
    
    text.textContent = "FALL DETECTED!";
    text.classList.remove("normal");
    text.classList.add("alert");
    
    footer.textContent = "Emergency Alert Active";
    footer.style.color = "#f44336";
  } else {
    indicator.classList.remove("on");
    indicator.classList.add("off");
    indicator.textContent = "✓";
    
    text.textContent = "Normal";
    text.classList.remove("alert");
    text.classList.add("normal");
    
    footer.textContent = "System Active";
    footer.style.color = "#666";
  }
}

// ============================================
// HÀM CHÍNH: Cập nhật toàn bộ UI và xử lý cảnh báo
// ============================================
function updateData(heartRate, spo2, fallDetected, manualDetected) {
  console.log("=== UPDATE DATA ===");
  console.log("Heart Rate:", heartRate);
  console.log("SpO2:", spo2);
  console.log("Fall Detected:", fallDetected);
  console.log("Manual Detected:", manualDetected);

  // ===== BƯỚC 1: Cập nhật giá trị hiển thị =====
  document.getElementById("hr-value").textContent = heartRate;
  document.getElementById("spo2-value").textContent = spo2;

  // ===== BƯỚC 2: Kiểm tra điều kiện bất thường =====
  const hrAlert = (heartRate > 100 || heartRate < 50) && heartRate > 0;
  const spo2Alert = spo2 < 95 && spo2 > 0;

  console.log("HR Alert:", hrAlert, "(HR > 100 hoặc HR < 50)");
  console.log("SpO2 Alert:", spo2Alert, "(SpO2 < 95)");
  console.log("Fall Alert:", fallDetected);

  // ===== BƯỚC 3: Vẽ lại vòng tròn progress =====
  updateCircle("hr-circle", heartRate, 150, hrAlert);
  updateCircle("spo2-circle", spo2, 100, spo2Alert);

  // ===== BƯỚC 4: Cập nhật Fall Detection UI =====
  updateFallDetection(fallDetected);

  // ===== BƯỚC 5: Phát âm thanh nếu có bất kỳ cảnh báo nào =====
  const hasAlert = hrAlert || spo2Alert || fallDetected || manualDetected;
  console.log("Has Alert:", hasAlert);
  playAlertSound(hasAlert);

  // ===== BƯỚC 6: Hiển thị thông báo nếu có cảnh báo =====
  const alertBox = document.getElementById("alert-box");

  if (hasAlert) {
    let alertMsg = "";
    
    if (manualDetected) {
      alertMsg = "🚨 CẢNH BÁO: Phát hiện bất thường từ người dùng!";
    } else if (fallDetected) {
      alertMsg = "🚨 CẢNH BÁO: Phát hiện ngã!";
    } else if (hrAlert) {
      alertMsg = `⚠️ Nhịp tim bất thường (${heartRate} BPM)`;
    } else if (spo2Alert) {
      alertMsg = `⚠️ SpO₂ thấp (${spo2}%)`;
    }
    
    showAlert(alertMsg);
  } else {
    alertBox.style.display = "none";
  }
  
  console.log("==================");
}

// ============================================
// CHỨC NĂNG: LƯU LỊCH SỬ MỖI 20 GIÂY (LIÊN TỤC)
// ============================================
function saveToHistory() {
  const now = new Date();
  const timestamp = now.toLocaleString("vi-VN");
  const dateValue = now.getTime();
  const dateKey = now.toISOString().split("T")[0];

  // Xác định trạng thái
  const hrAlert = (currentHR > 100 || currentHR < 50) && currentHR > 0;
  const spo2Alert = currentSpO2 < 95 && currentSpO2 > 0;
  const hasAlert = hrAlert || spo2Alert || currentFall || currentManual;

  // Tạo message
  let statusMsg = "";
  if (currentManual) {
    statusMsg = "🚨 CẢNH BÁO: Phát hiện bất thường từ người dùng!";
  } else if (currentFall) {
    statusMsg = "🚨 CẢNH BÁO: Phát hiện ngã!";
  } else if (hrAlert) {
    statusMsg = `⚠️ Nhịp tim bất thường (${currentHR} BPM)`;
  } else if (spo2Alert) {
    statusMsg = `⚠️ SpO₂ thấp (${currentSpO2}%)`;
  } else {
    statusMsg = "✅ Bình thường - Hệ thống hoạt động tốt";
  }

  // Lưu vào Firebase
  const historyRef = database.ref("AlertHistory/" + dateKey);
  historyRef.push({
    timestamp: timestamp,
    dateValue: dateValue,
    message: statusMsg,
    heartRate: currentHR,
    spo2: currentSpO2,
    fallDetected: currentFall,
    manualAlert: currentManual,
    isAlert: hasAlert
  });

  console.log("✅ Đã lưu vào history:", statusMsg);
}

// ============================================
// FIREBASE LISTENERS - Lắng nghe dữ liệu realtime
// ============================================
var heartRef = database.ref("users/user_elderly_001/sensorData/current/heartRate");
var spo2Ref = database.ref("users/user_elderly_001/sensorData/current/spo2");
var fallRef = database.ref("users/user_elderly_001/sensorData/current/fallDetected");
var manualRef = database.ref("/users/user_elderly_001/sensorData/current/manualAlert");

heartRef.on("value", function(snapshot) {
  currentHR = snapshot.val() || 0;
  updateData(currentHR, currentSpO2, currentFall, currentManual);
});

spo2Ref.on("value", function(snapshot) {
  currentSpO2 = snapshot.val() || 0;
  updateData(currentHR, currentSpO2, currentFall, currentManual);
});

fallRef.on("value", function(snapshot) {
  currentFall = snapshot.val() || false;
  updateData(currentHR, currentSpO2, currentFall, currentManual);
});

manualRef.on("value", function(snapshot) {
  currentManual = snapshot.val() || false;
  updateData(currentHR, currentSpO2, currentFall, currentManual);
});

// ============================================
// PUSH LỊCH SỬ TỰ ĐỘNG MỖI 20 GIÂY
// ============================================
setInterval(saveToHistory, 20000); // 20000ms = 20 giây

// Lưu lần đầu ngay khi trang load
setTimeout(saveToHistory, 2000); // Đợi 2s để có dữ liệu từ Firebase

// ============================================
// HIỂN THỊ LỊCH SỬ CẢNH BÁO
// ============================================
var historyList = document.getElementById("history-list");
var mainHistoryRef = database.ref("AlertHistory");

mainHistoryRef.on("value", function(snapshot) {
  historyList.innerHTML = "";
  const dateEntries = [];

  snapshot.forEach(function(dateSnap) {
    dateEntries.push({
      dateKey: dateSnap.key,
      data: dateSnap.val()
    });
  });

  dateEntries.sort((a, b) => b.dateKey.localeCompare(a.dateKey));

  dateEntries.forEach((day) => {
    const header = document.createElement("h3");
    const dateLabel = new Date(day.dateKey).toLocaleDateString("vi-VN");
    header.textContent = `📅 Ngày ${dateLabel}`;
    historyList.appendChild(header);

    const alerts = Object.values(day.data).sort((a, b) => b.dateValue - a.dateValue);

    alerts.forEach((data) => {
      const li = document.createElement("li");
      const fallBadge = data.fallDetected ? " | 🚨 <b>FALL DETECTED</b>" : "";
      const manualBadge = data.manualAlert ? " | 🆘 <b>MANUAL ALERT</b>" : "";
      
      // Tô màu dựa theo trạng thái
      if (data.isAlert) {
        li.style.borderLeft = "3px solid #f44336";
        li.style.backgroundColor = "#ffebee";
      }
      
      li.innerHTML = `
        <strong>${data.timestamp}</strong><br>
        ${data.message}<br>
        ❤️ Heart Rate: <b>${data.heartRate} BPM</b> | 🩸 SpO₂: <b>${data.spo2}%</b>${fallBadge}${manualBadge}
      `;
      
      historyList.appendChild(li);
    });
  });
});

// ============================================
// NÚT ẨN/HIỆN LỊCH SỬ
// ============================================
const toggleBtn = document.getElementById("toggle-history");
const historySection = document.getElementById("history-section");
let isVisible = true;

toggleBtn.addEventListener("click", () => {
  isVisible = !isVisible;
  historySection.classList.toggle("hidden", !isVisible);
  toggleBtn.innerHTML = isVisible ? "▲ Ẩn lịch sử" : "▼ Hiện lịch sử";
});

// ============================================
// NÚT XÓA LỊCH SỬ
// ============================================
const resetBtn = document.getElementById("reset-history");

resetBtn.addEventListener("click", () => {
  if (confirm("⚠️ Bạn có chắc muốn xóa toàn bộ lịch sử cảnh báo không?")) {
    database.ref("AlertHistory").remove()
      .then(() => {
        alert("✅ Lịch sử đã được xóa!");
        historyList.innerHTML = "";
      })
      .catch((error) => {
        alert("❌ Lỗi khi xóa lịch sử: " + error.message);
      });
  }
});
