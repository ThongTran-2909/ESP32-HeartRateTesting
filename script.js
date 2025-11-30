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
let currentManual = false ; //trạng thái nút nhấn 

// ============================================
// CHỨC NĂNG: Vẽ vòng tròn progress (Heart Rate & SpO2)
// ============================================
/**
 * Cập nhật vòng tròn SVG với giá trị mới
 * @param {string} id - ID của element circle cần update
 * @param {number} value - Giá trị hiện tại (ví dụ: 75 BPM)
 * @param {number} max - Giá trị tối đa (ví dụ: 150 BPM)
 * @param {boolean} colorCondition - true = đỏ (cảnh báo), false = xanh (bình thường)
 */
function updateCircle(id, value, max, colorCondition) {
  const circle = document.getElementById(id);
  const radius = 102; // Bán kính vòng tròn (tăng từ 85 lên 102)
  const circumference = 2 * Math.PI * radius; // Chu vi vòng tròn
  
  // Tính toán độ offset để vẽ progress
  const offset = circumference - (value / max) * circumference;
  
  // Áp dụng style cho vòng tròn
  circle.style.strokeDasharray = circumference;
  circle.style.strokeDashoffset = offset;
  
  // Đổi màu dựa trên điều kiện cảnh báo
  circle.style.stroke = colorCondition ? "#f44336" : "#4caf50";
}

// ============================================
// CHỨC NĂNG: Phát âm thanh cảnh báo
// ============================================
/**
 * Bật hoặc tắt âm thanh cảnh báo
 * @param {boolean} active - true = phát nhạc, false = dừng nhạc
 */
function playAlertSound(active) {
  const alertSound = document.getElementById("alert-sound");
  
  if (active) {
    // Nếu nhạc chưa phát thì phát
    if (alertSound.paused) {
      alertSound.play().catch(e => console.log("Audio play failed:", e));
    }
  } else {
    // Dừng nhạc và reset về đầu
    alertSound.pause();
    alertSound.currentTime = 0;
  }
}

// ============================================
// CHỨC NĂNG: Hiển thị thông báo cảnh báo trên đầu trang
// ============================================
/**
 * Hiển thị alert box trong 3 giây rồi tự động ẩn
 * @param {string} message - Nội dung thông báo
 */
function showAlert(message) {
  const box = document.getElementById("alert-box");
  box.textContent = message;
  box.style.display = "block";
  
  // // Clear timeout cũ nếu có (tránh conflict)
  // clearTimeout(window.alertTimeout);
  
  // // Tự động ẩn sau 3 giây
  // window.alertTimeout = setTimeout(() => {
  //   box.style.display = "none";
  // }, 3000);
}

// ============================================
// CHỨC NĂNG: Cập nhật UI Fall Detection
// ============================================
/**
 * Cập nhật giao diện Fall Detection box
 * @param {boolean} fallDetected - true = phát hiện ngã, false = bình thường
 */
function updateFallDetection(fallDetected) {
  const indicator = document.getElementById("fall-indicator");
  const text = document.getElementById("fall-text");
  const footer = document.getElementById("fall-footer");

  if (fallDetected) {
    // Trạng thái: PHÁT HIỆN NGÃ (màu đỏ, nhấp nháy)
    indicator.classList.remove("off");
    indicator.classList.add("on");
    indicator.textContent = "⚠";
    
    text.textContent = "FALL DETECTED!";
    text.classList.remove("normal");
    text.classList.add("alert");
    
    footer.textContent = "Emergency Alert Active";
    footer.style.color = "#f44336";
  } else {
    // Trạng thái: BÌNH THƯỜNG (màu xanh)
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
/**
 * Hàm trung tâm xử lý tất cả logic cập nhật UI và cảnh báo
 * @param {number} heartRate - Nhịp tim (BPM)
 * @param {number} spo2 - Độ bão hòa oxy (%)
 * @param {boolean} fallDetected - Trạng thái phát hiện ngã
 * @param {boolean} manualDetected - nút nhấn khi cảm thấy không ổn 
 */
function updateData(heartRate, spo2, fallDetected,manualDetected) {
  // Debug: In ra console để kiểm tra
  console.log("=== UPDATE DATA ===");
  console.log("Heart Rate:", heartRate);
  console.log("SpO2:", spo2);
  console.log("Fall Detected:", fallDetected);
  console.log("Manual Detected:", manualDetected);

  // ===== BƯỚC 1: Cập nhật giá trị hiển thị =====
  document.getElementById("hr-value").textContent = heartRate;
  document.getElementById("spo2-value").textContent = spo2;

  // ===== BƯỚC 2: Kiểm tra điều kiện bất thường =====
  const hrAlert = (heartRate > 100 || heartRate < 50) && heartRate > 0;  // Nhịp tim bất thường
  const spo2Alert = spo2 < 95 && spo2 > 0;                                // SpO2 thấp (bỏ qua nếu = 0)

  // Debug: In ra điều kiện cảnh báo
  console.log("HR Alert:", hrAlert, "(HR > 100 hoặc HR < 50)");
  console.log("SpO2 Alert:", spo2Alert, "(SpO2 < 95)");
  console.log("Fall Alert:", fallDetected);

  // ===== BƯỚC 3: Vẽ lại vòng tròn progress =====
  updateCircle("hr-circle", heartRate, 150, hrAlert);   // Max HR = 150
  updateCircle("spo2-circle", spo2, 100, spo2Alert);    // Max SpO2 = 100%

  // ===== BƯỚC 4: Cập nhật Fall Detection UI =====
  updateFallDetection(fallDetected);

  // ===== BƯỚC 5: Phát âm thanh nếu có bất kỳ cảnh báo nào =====
  const hasAlert = hrAlert || spo2Alert || fallDetected;
  console.log("Has Alert:", hasAlert);
  playAlertSound(hasAlert);

  // ===== BƯỚC 6: Hiển thị thông báo và lưu lịch sử =====
  const alertBox = document.getElementById("alert-box");

  if (hasAlert) {
    let alertMsg = "";
    
    // Xác định loại cảnh báo (ưu tiên Fall Detection)
    if(manualDetected){
      alertMsg ="🚨 CẢNH BÁO: Phát hiện bất thường từ người dùng !";
    }
    else if (fallDetected) {
      alertMsg = "🚨 CẢNH BÁO: Phát hiện ngã!";
    } else if (hrAlert) {
      alertMsg = `⚠️ Nhịp tim bất thường (${heartRate} BPM)`;
    } else if (spo2Alert) {
      alertMsg = `⚠️ SpO₂ thấp (${spo2}%)`;
    }
    
    console.log("Alert Message:", alertMsg);

    // Hiển thị alert box
    showAlert(alertMsg);

    // LƯU VÀO FIREBASE ALERT HISTORY
    const now = new Date();
    const timestamp = now.toLocaleString("vi-VN");      // Thời gian định dạng
    const dateValue = now.getTime();                    // Timestamp để sắp xếp
    const dateKey = now.toISOString().split("T")[0];    // Key theo ngày (YYYY-MM-DD)

    const historyRef = database.ref("AlertHistory/" + dateKey);
    historyRef.push({
      timestamp: timestamp,
      dateValue: dateValue,
      message: alertMsg,
      heartRate: heartRate,
      spo2: spo2,
      fallDetected: fallDetected
    });
    
    console.log("✅ Đã lưu vào history");
  } else {
    console.log("❌ Không có cảnh báo nào");
    alertBox.style.display = "none";
  }
  console.log("==================");
}

// ============================================
// FIREBASE LISTENERS - Lắng nghe dữ liệu realtime
// ============================================

// Reference đến các node Firebase
var heartRef = database.ref("users/user_elderly_001/sensorData/current/heartRate");
var spo2Ref = database.ref("users/user_elderly_001/sensorData/current/spo2");
var fallRef = database.ref("users/user_elderly_001/sensorData/current/fallDetected");
var manualRef = database.ref("/users/user_elderly_001/sensorData/current/manualAlert")

// ----- LISTENER: Heart Rate -----
heartRef.on("value", function(snapshot) {
  currentHR = snapshot.val() || 0;
  updateData(currentHR, currentSpO2, currentFall, currentManual);
});

// ----- LISTENER: SpO2 -----
spo2Ref.on("value", function(snapshot) {
  currentSpO2 = snapshot.val() || 0;
  updateData(currentHR, currentSpO2, currentFall, currentManual);
});

// ----- LISTENER: Fall Detection -----
fallRef.on("value", function(snapshot) {
  currentFall = snapshot.val() || false;
  updateData(currentHR, currentSpO2, currentFall, currentManual);
});

manualRef.on("value", function(snapshot) {
    currentManual = snapshot.val() || false;
    updateData(currentHR, currentSpO2, currentFall, currentManual);
}); 
// ============================================
// HIỂN THỊ LỊCH SỬ CẢNH BÁO
// ============================================
var historyList = document.getElementById("history-list");
var mainHistoryRef = database.ref("AlertHistory");

/**
 * Lắng nghe và hiển thị toàn bộ lịch sử cảnh báo
 * Sắp xếp theo ngày mới nhất lên đầu
 */
mainHistoryRef.on("value", function(snapshot) {
  historyList.innerHTML = ""; // Xóa danh sách cũ
  const dateEntries = [];

  // Thu thập tất cả các ngày có cảnh báo
  snapshot.forEach(function(dateSnap) {
    dateEntries.push({
      dateKey: dateSnap.key,
      data: dateSnap.val()
    });
  });

  // Sắp xếp theo ngày giảm dần (mới nhất lên đầu)
  dateEntries.sort((a, b) => b.dateKey.localeCompare(a.dateKey));

  // Hiển thị từng ngày
  dateEntries.forEach((day) => {
    // Header ngày
    const header = document.createElement("h3");
    const dateLabel = new Date(day.dateKey).toLocaleDateString("vi-VN");
    header.textContent = `📅 Ngày ${dateLabel}`;
    historyList.appendChild(header);

    // Sắp xếp các alert trong ngày theo thời gian giảm dần
    const alerts = Object.values(day.data).sort((a, b) => b.dateValue - a.dateValue);

    // Hiển thị từng alert
    alerts.forEach((data) => {
      const li = document.createElement("li");
      const fallBadge = data.fallDetected ? " | 🚨 <b>FALL DETECTED</b>" : "";
      
      li.innerHTML = `
        <strong>${data.timestamp}</strong><br>
        ${data.message}<br>
        ❤️ Heart Rate: <b>${data.heartRate} BPM</b> | 🩸 SpO₂: <b>${data.spo2}%</b>${fallBadge}
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
  // Xác nhận trước khi xóa
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
