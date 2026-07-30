import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, push, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// YOUR FIREBASE CONFIGURATION (Updated with Singapore Region URL)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "home-mess-manager-c4ad7.firebaseapp.com",
  databaseURL: "https://home-mess-manager-c4ad7-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "home-mess-manager-c4ad7",
  storageBucket: "home-mess-manager-c4ad7.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const MEMBERS_LIST = ["Rizu", "Jim", "Maruf", "Arafat", "Shawon", "Tanvir", "Sourov"];

function getTodayDateStr() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ------------------------------------
// 1. LOGIN LOGIC (index.html)
// ------------------------------------
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userSelect = document.getElementById("user-select");
    const pinInput = document.getElementById("pin-input");
    const errorMsg = document.getElementById("error-msg");

    const username = userSelect.value;
    const inputPin = pinInput.value.trim();
    const role = userSelect.options[userSelect.selectedIndex].getAttribute("data-role");

    errorMsg.textContent = "Verifying...";

    if (role === "admin") {
      if (inputPin === "Admin123") {
        sessionStorage.setItem("currentUser", JSON.stringify({ name: username, role: "admin" }));
        window.location.href = "admin.html";
      } else {
        errorMsg.textContent = "Invalid Admin PIN!";
      }
      return;
    }

    try {
      const userPinSnap = await get(ref(db, `users/${username}/pin`));
      let storedPin = "1234";

      if (userPinSnap.exists()) {
        storedPin = userPinSnap.val();
      } else {
        await set(ref(db, `users/${username}/pin`), "1234");
      }

      if (inputPin === storedPin) {
        sessionStorage.setItem("currentUser", JSON.stringify({ name: username, role: "member" }));
        window.location.href = "member.html";
      } else {
        errorMsg.textContent = "Incorrect PIN! Default is 1234.";
      }
    } catch (err) {
      errorMsg.textContent = "Login error: " + err.message;
    }
  });
}

// ------------------------------------
// 2. MEMBER DASHBOARD LOGIC (member.html)
// ------------------------------------
const welcomeName = document.getElementById("welcome-name");
if (welcomeName) {
  const currentUser = JSON.parse(sessionStorage.getItem("currentUser"));
  if (!currentUser) {
    window.location.href = "index.html";
  } else {
    welcomeName.textContent = `Hi, ${currentUser.name}! 👋`;
  }

  const todayStr = getTodayDateStr();
  const currentDateEl = document.getElementById("current-date");
  if (currentDateEl) currentDateEl.textContent = todayStr;

  // PIN Update
  const updatePinBtn = document.getElementById("update-pin-btn");
  if (updatePinBtn) {
    updatePinBtn.onclick = () => {
      const newPin = document.getElementById("new-pin-input").value.trim();
      const pinMsg = document.getElementById("pin-msg");

      if (newPin.length < 4) {
        pinMsg.style.color = "#ef4444";
        pinMsg.textContent = "PIN must be at least 4 characters.";
        return;
      }

      set(ref(db, `users/${currentUser.name}/pin`), newPin)
        .then(() => {
          pinMsg.style.color = "#16a34a";
          pinMsg.textContent = "PIN updated successfully!";
          document.getElementById("new-pin-input").value = "";
          setTimeout(() => pinMsg.textContent = "", 3000);
        })
        .catch(err => {
          pinMsg.style.color = "#ef4444";
          pinMsg.textContent = err.message;
        });
    };
  }

  let lunchCount = 0;
  let dinnerCount = 0;
  let isLocked = false;

  const lunchVal = document.getElementById("lunch-val");
  const dinnerVal = document.getElementById("dinner-val");
  const saveBtn = document.getElementById("save-meal-btn");
  const saveMsg = document.getElementById("save-msg");

  const lunchPlus = document.getElementById("lunch-plus");
  const lunchMinus = document.getElementById("lunch-minus");
  const dinnerPlus = document.getElementById("dinner-plus");
  const dinnerMinus = document.getElementById("dinner-minus");

  lunchPlus.onclick = () => { if (!isLocked) { lunchCount++; lunchVal.textContent = lunchCount; } };
  lunchMinus.onclick = () => { if (!isLocked && lunchCount > 0) { lunchCount--; lunchVal.textContent = lunchCount; } };
  dinnerPlus.onclick = () => { if (!isLocked) { dinnerCount++; dinnerVal.textContent = dinnerCount; } };
  dinnerMinus.onclick = () => { if (!isLocked && dinnerCount > 0) { dinnerCount--; dinnerVal.textContent = dinnerCount; } };

  saveBtn.onclick = () => {
    if (isLocked) return;

    set(ref(db, `meals/${todayStr}/${currentUser.name}`), {
      lunch: lunchCount,
      dinner: dinnerCount,
      submitted: true
    })
      .then(() => {
        saveMsg.style.color = "#16a34a";
        saveMsg.textContent = "Saved successfully! Input locked.";
      })
      .catch(err => {
        saveMsg.style.color = "#ef4444";
        saveMsg.textContent = err.message;
      });
  };

  // Real-time updates & Lock verification
  onValue(ref(db, `meals/${todayStr}`), (snapshot) => {
    const data = snapshot.val() || {};
    const boardBody = document.getElementById("board-body");
    let totalLunch = 0, totalDinner = 0, rowsHtml = "";

    if (data[currentUser.name] && data[currentUser.name].submitted) {
      isLocked = true;
      lunchCount = data[currentUser.name].lunch;
      dinnerCount = data[currentUser.name].dinner;
      lunchVal.textContent = lunchCount;
      dinnerVal.textContent = dinnerCount;

      saveBtn.disabled = true;
      saveBtn.style.backgroundColor = "#94a3b8";
      saveBtn.style.cursor = "not-allowed";
      saveBtn.textContent = "🔒 Meal Locked For Today";
      saveMsg.style.color = "#ef4444";
      saveMsg.textContent = "Locked. Contact Admin (Rizu) to make edits.";
    }

    MEMBERS_LIST.forEach((name) => {
      const meal = data[name] || { lunch: 0, dinner: 0 };
      totalLunch += meal.lunch;
      totalDinner += meal.dinner;

      rowsHtml += `<tr ${name === currentUser.name ? 'class="highlight-user"' : ''}>
        <td>${name} ${name === 'Rizu' ? '(Admin)' : ''}</td>
        <td>${meal.lunch}</td>
        <td>${meal.dinner}</td>
      </tr>`;
    });

    if (boardBody) boardBody.innerHTML = rowsHtml;
    document.getElementById("total-lunch").textContent = totalLunch;
    document.getElementById("total-dinner").textContent = totalDinner;
    document.getElementById("total-day").textContent = totalLunch + totalDinner;
  });

  document.getElementById("logout-btn").onclick = () => {
    sessionStorage.removeItem("currentUser");
    window.location.href = "index.html";
  };
}

// ------------------------------------
// 3. ADMIN PANEL LOGIC (admin.html)
// ------------------------------------
const bazarForm = document.getElementById("bazar-form");
if (bazarForm) {
  const monthSelect = document.getElementById("month-select");
  const bazarDate = document.getElementById("bazar-date");
  const todayStr = getTodayDateStr();

  const currentDateEl = document.getElementById("current-date");
  if (currentDateEl) currentDateEl.textContent = todayStr;

  let adminLunchCount = 0;
  let adminDinnerCount = 0;
  const lunchVal = document.getElementById("lunch-val");
  const dinnerVal = document.getElementById("dinner-val");

  if (lunchVal && dinnerVal) {
    document.getElementById("lunch-plus").onclick = () => { adminLunchCount++; lunchVal.textContent = adminLunchCount; };
    document.getElementById("lunch-minus").onclick = () => { if (adminLunchCount > 0) adminLunchCount--; lunchVal.textContent = adminLunchCount; };
    document.getElementById("dinner-plus").onclick = () => { adminDinnerCount++; dinnerVal.textContent = adminDinnerCount; };
    document.getElementById("dinner-minus").onclick = () => { if (adminDinnerCount > 0) adminDinnerCount--; dinnerVal.textContent = adminDinnerCount; };

    document.getElementById("save-meal-btn").onclick = () => {
      const saveMsg = document.getElementById("save-msg");
      set(ref(db, `meals/${todayStr}/Rizu`), { lunch: adminLunchCount, dinner: adminDinnerCount, submitted: true })
        .then(() => {
          saveMsg.style.color = "#16a34a";
          saveMsg.textContent = "Admin meal saved successfully!";
          setTimeout(() => saveMsg.textContent = "", 2500);
          loadMonthlyData(monthSelect.value);
        })
        .catch(err => {
          saveMsg.style.color = "#ef4444";
          saveMsg.textContent = err.message;
        });
    };
  }

  // Global update function accessible by inline buttons for Admin
  window.updateMemberMeal = (memberName, mealType, change) => {
    const memberRef = ref(db, `meals/${todayStr}/${memberName}`);
    get(memberRef).then((snapshot) => {
      const currentData = snapshot.val() || { lunch: 0, dinner: 0, submitted: true };
      let newCount = (currentData[mealType] || 0) + change;
      if (newCount < 0) newCount = 0;

      set(memberRef, {
        ...currentData,
        [mealType]: newCount,
        submitted: true
      });
    });
  };

  // Real-Time Board for Admin with Direct Controls
  onValue(ref(db, `meals/${todayStr}`), (snapshot) => {
    const data = snapshot.val() || {};
    const boardBody = document.getElementById("board-body");
    let totalLunch = 0, totalDinner = 0, rowsHtml = "";

    MEMBERS_LIST.forEach((name) => {
      const meal = data[name] || { lunch: 0, dinner: 0 };
      totalLunch += meal.lunch;
      totalDinner += meal.dinner;

      if (name === "Rizu" && snapshot.exists() && data["Rizu"]) {
        adminLunchCount = meal.lunch;
        adminDinnerCount = meal.dinner;
        lunchVal.textContent = adminLunchCount;
        dinnerVal.textContent = adminDinnerCount;
      }

      rowsHtml += `<tr ${name === 'Rizu' ? 'class="highlight-user"' : ''}>
        <td><strong>${name}</strong> ${name === 'Rizu' ? '(Admin)' : ''}</td>
        <td>
          <button class="btn-sm" onclick="updateMemberMeal('${name}', 'lunch', -1)">-</button>
          <span style="margin: 0 6px; font-weight: bold;">${meal.lunch}</span>
          <button class="btn-sm" onclick="updateMemberMeal('${name}', 'lunch', 1)">+</button>
        </td>
        <td>
          <button class="btn-sm" onclick="updateMemberMeal('${name}', 'dinner', -1)">-</button>
          <span style="margin: 0 6px; font-weight: bold;">${meal.dinner}</span>
          <button class="btn-sm" onclick="updateMemberMeal('${name}', 'dinner', 1)">+</button>
        </td>
        <td>
          <span style="font-size: 0.8rem; color: #16a34a;">⚡ Live Edit</span>
        </td>
      </tr>`;
    });

    if (boardBody) boardBody.innerHTML = rowsHtml;
    const totalLunchEl = document.getElementById("total-lunch");
    const totalDinnerEl = document.getElementById("total-dinner");
    const totalDayEl = document.getElementById("total-day");

    if (totalLunchEl) totalLunchEl.textContent = totalLunch;
    if (totalDinnerEl) totalDinnerEl.textContent = totalDinner;
    if (totalDayEl) totalDayEl.textContent = totalLunch + totalDinner;
  });

  // Default month setup
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (monthSelect) {
    monthSelect.value = currentMonthStr;
  }
  if (bazarDate) {
    bazarDate.value = todayStr;
  }

  bazarForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const item = document.getElementById("bazar-item").value;
    const amount = Number(document.getElementById("bazar-amount").value);
    const date = bazarDate.value;

    push(ref(db, `bazar/${date}`), { item, amount })
      .then(() => {
        alert("Bazar expense added!");
        bazarForm.reset();
        bazarDate.value = getTodayDateStr();
        loadMonthlyData(monthSelect.value);
      });
  });

  async function loadMonthlyData(selectedYearMonth) {
    if (!selectedYearMonth) {
      document.getElementById("monthly-total-meals").textContent = "0";
      document.getElementById("monthly-total-bazar").textContent = "0 Tk";
      document.getElementById("calculated-meal-rate").textContent = "0.00 Tk";
      const board = document.getElementById("settlement-board-body");
      if (board) board.innerHTML = `<tr><td colspan="3">Select a month to calculate...</td></tr>`;
      return;
    }

    // Split target "YYYY-MM" into numbers
    const [targetYear, targetMonth] = selectedYearMonth.split("-").map(Number);

    let totalMeals = 0;
    let totalBazar = 0;
    const memberMealCounts = {};
    MEMBERS_LIST.forEach(m => memberMealCounts[m] = 0);

    // 1. Fetch & calculate Meals for target month
    const mealsSnap = await get(ref(db, "meals"));
    if (mealsSnap.exists()) {
      const allMeals = mealsSnap.val();
      Object.keys(allMeals).forEach(dateStr => {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime()) && d.getFullYear() === targetYear && (d.getMonth() + 1) === targetMonth) {
          Object.keys(allMeals[dateStr]).forEach(mem => {
            const mData = allMeals[dateStr][mem];
            const sum = (mData.lunch || 0) + (mData.dinner || 0);
            if (memberMealCounts[mem] !== undefined) {
              memberMealCounts[mem] += sum;
            }
            totalMeals += sum;
          });
        }
      });
    }

    // 2. Fetch & calculate Bazar for target month
    const bazarSnap = await get(ref(db, "bazar"));
    if (bazarSnap.exists()) {
      const allBazar = bazarSnap.val();
      Object.keys(allBazar).forEach(dateStr => {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime()) && d.getFullYear() === targetYear && (d.getMonth() + 1) === targetMonth) {
          Object.keys(allBazar[dateStr]).forEach(key => {
            totalBazar += (allBazar[dateStr][key].amount || 0);
          });
        }
      });
    }

    const mealRate = totalMeals > 0 ? (totalBazar / totalMeals) : 0;

    document.getElementById("monthly-total-meals").textContent = totalMeals;
    document.getElementById("monthly-total-bazar").textContent = `${totalBazar} Tk`;
    document.getElementById("calculated-meal-rate").textContent = `${mealRate.toFixed(2)} Tk`;

    const board = document.getElementById("settlement-board-body");
    if (board) {
      let html = "";
      MEMBERS_LIST.forEach(m => {
        const meals = memberMealCounts[m];
        const cost = (meals * mealRate).toFixed(2);
        html += `<tr><td>${m} ${m === 'Rizu' ? '(Admin)' : ''}</td><td>${meals}</td><td>${cost} Tk</td></tr>`;
      });
      board.innerHTML = html;
    }
  }

  monthSelect.addEventListener("change", (e) => loadMonthlyData(e.target.value));
  loadMonthlyData(currentMonthStr);

  document.getElementById("logout-btn").onclick = () => {
    sessionStorage.removeItem("currentUser");
    window.location.href = "index.html";
  };
}

// ------------------------------------
// 4. HISTORY LOGIC (history.html)
// ------------------------------------
const historyDateInput = document.getElementById("history-date");
if (historyDateInput) {
  const todayStr = getTodayDateStr();
  historyDateInput.value = todayStr;

  function fetchHistory(dateStr) {
    document.getElementById("selected-history-date").textContent = dateStr;
    get(ref(db, `meals/${dateStr}`)).then(snapshot => {
      const data = snapshot.val() || {};
      const body = document.getElementById("history-board-body");
      let html = "";

      MEMBERS_LIST.forEach(m => {
        const meal = data[m] || { lunch: 0, dinner: 0 };
        const sum = meal.lunch + meal.dinner;
        html += `<tr><td>${m} ${m === 'Rizu' ? '(Admin)' : ''}</td><td>${meal.lunch}</td><td>${meal.dinner}</td><td><strong>${sum}</strong></td></tr>`;
      });
      body.innerHTML = html;
    });
  }

  historyDateInput.addEventListener("change", (e) => fetchHistory(e.target.value));
  fetchHistory(todayStr);
}
