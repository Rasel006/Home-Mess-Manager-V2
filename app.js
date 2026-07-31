import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, push, remove, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// FIREBASE CONFIGURATION
const firebaseConfig = {
  authDomain: "home-mess-manager-c4ad7.firebaseapp.com",
  databaseURL: "https://home-mess-manager-c4ad7-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "home-mess-manager-c4ad7",
  storageBucket: "home-mess-manager-c4ad7.appspot.com"
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
// AUTO LOGIN CHECK ON APP LOAD (For index.html)
// ------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  const savedUser = localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser");
  const isIndexPage = window.location.pathname.includes("index.html") || window.location.pathname.endsWith("/");

  if (savedUser && isIndexPage) {
    const currentUser = JSON.parse(savedUser);
    if (currentUser.role === "admin") {
      window.location.href = "admin.html";
    } else {
      window.location.href = "member.html";
    }
  }
});

// Global Notification Fetcher & UI Toggle
function initNotifications() {
  const bellBtn = document.getElementById("bell-icon-btn");
  const dropdown = document.getElementById("notif-dropdown");
  
  if (bellBtn && dropdown) {
    bellBtn.onclick = (e) => {
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
    };
    window.onclick = () => { dropdown.style.display = "none"; };
    dropdown.onclick = (e) => { e.stopPropagation(); };
  }

  onValue(ref(db, "notifications"), (snapshot) => {
    const listEl = document.getElementById("notification-list");
    const badgeEl = document.getElementById("notif-badge");
    if (!listEl) return;

    if (!snapshot.exists()) {
      listEl.innerHTML = `<small style="color: #64748b;">No new notifications.</small>`;
      if (badgeEl) badgeEl.style.display = "none";
      return;
    }

    const data = snapshot.val();
    let html = "";
    let count = 0;

    Object.values(data).reverse().forEach(item => {
      count++;
      html += `<div style="padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 0.82rem;">
        <strong>${item.title}</strong>
        <p style="margin: 2px 0; color: #334155;">${item.message}</p>
        <span style="font-size: 0.7rem; color: #94a3b8;">${item.time}</span>
      </div>`;
    });

    listEl.innerHTML = html;
    if (badgeEl) {
      badgeEl.textContent = count;
      badgeEl.style.display = "inline-block";
    }
  });
}

function sendNotification(title, message) {
  push(ref(db, "notifications"), {
    title: title,
    message: message,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });
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
    const rememberMe = document.getElementById("remember-me").checked;
    const errorMsg = document.getElementById("error-msg");

    const username = userSelect.value;
    const inputPin = pinInput.value.trim();
    const role = userSelect.options[userSelect.selectedIndex].getAttribute("data-role");

    errorMsg.textContent = "Verifying...";

    let storedPin = "1234";
    let pinRefPath = role === "admin" ? "users/Rizu/pin" : `users/${username}/pin`;
    let defaultPin = role === "admin" ? "Admin123" : "1234";

    try {
      const pinSnap = await get(ref(db, pinRefPath));
      if (pinSnap.exists()) {
        storedPin = pinSnap.val();
      } else {
        await set(ref(db, pinRefPath), defaultPin);
        storedPin = defaultPin;
      }

      if (inputPin === storedPin) {
        const userData = JSON.stringify({ name: username, role: role });
        
        if (rememberMe) {
          localStorage.setItem("currentUser", userData);
        } else {
          sessionStorage.setItem("currentUser", userData);
        }

        window.location.href = role === "admin" ? "admin.html" : "member.html";
      } else {
        errorMsg.textContent = role === "admin" ? "Invalid Admin PIN!" : "Incorrect PIN! Default is 1234.";
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
  initNotifications();
  const currentUser = JSON.parse(localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser"));
  
  if (!currentUser) {
    window.location.href = "index.html";
  } else {
    welcomeName.textContent = `Hi, ${currentUser.name}! 👋`;
  }

  const todayStr = getTodayDateStr();
  const currentDateEl = document.getElementById("current-date");
  if (currentDateEl) currentDateEl.textContent = todayStr;

  // Deposit Request Submit
  const depositForm = document.getElementById("deposit-form");
  if (depositForm) {
    depositForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const amount = Number(document.getElementById("deposit-amount").value);
      if (amount <= 0) return;

      push(ref(db, "pending_requests"), {
        type: "deposit",
        userName: currentUser.name,
        amount: amount,
        date: todayStr
      }).then(() => {
        sendNotification("New Deposit Request", `${currentUser.name} requested a deposit of ৳${amount}`);
        alert("Deposit request sent to Admin for approval!");
        depositForm.reset();
      });
    });
  }

  // Bazar Request Submit
  const memberBazarForm = document.getElementById("member-bazar-form");
  if (memberBazarForm) {
    memberBazarForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const item = document.getElementById("member-bazar-item").value;
      const amount = Number(document.getElementById("member-bazar-amount").value);

      push(ref(db, "pending_requests"), {
        type: "bazar",
        userName: currentUser.name,
        item: item,
        amount: amount,
        date: todayStr
      }).then(() => {
        sendNotification("New Bazar Expense", `${currentUser.name} submitted bazar: ${item} (৳${amount})`);
        alert("Bazar expense request sent to Admin for approval!");
        memberBazarForm.reset();
      });
    });
  }

  // Real-time Pending List
  onValue(ref(db, "pending_requests"), (snapshot) => {
    const listEl = document.getElementById("member-pending-list");
    if (!listEl) return;

    if (!snapshot.exists()) {
      listEl.innerHTML = `<li style="color: #64748b;">No pending requests.</li>`;
      return;
    }

    const data = snapshot.val();
    let html = "";
    Object.values(data).forEach(req => {
      if (req.userName === currentUser.name) {
        const desc = req.type === "deposit" 
          ? `Deposit: ৳${req.amount}` 
          : `Bazar: ${req.item} (৳${req.amount})`;
        html += `<li style="margin-bottom: 6px; padding: 6px; background: #fff; border-radius: 4px; border: 1px solid #cbd5e1;">
          ${desc} <span class="pending-tag">⏳ Pending Approval</span>
        </li>`;
      }
    });

    listEl.innerHTML = html || `<li style="color: #64748b;">No pending requests.</li>`;
  });

  async function calculateUserFinancials() {
    const now = new Date();
    const targetYear = now.getFullYear();
    const targetMonth = now.getMonth() + 1;

    let userMeals = 0;
    let totalMessMeals = 0;
    let totalMessBazar = 0;
    let userDeposit = 0;

    const depositSnap = await get(ref(db, `deposits/${currentUser.name}`));
    if (depositSnap.exists()) {
      const deposits = depositSnap.val();
      Object.values(deposits).forEach(d => { userDeposit += (d.amount || 0); });
    }

    const mealsSnap = await get(ref(db, "meals"));
    if (mealsSnap.exists()) {
      const allMeals = mealsSnap.val();
      Object.keys(allMeals).forEach(dateStr => {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime()) && d.getFullYear() === targetYear && (d.getMonth() + 1) === targetMonth) {
          Object.keys(allMeals[dateStr]).forEach(mem => {
            const sum = (allMeals[dateStr][mem].lunch || 0) + (allMeals[dateStr][mem].dinner || 0);
            totalMessMeals += sum;
            if (mem === currentUser.name) { userMeals += sum; }
          });
        }
      });
    }

    const bazarSnap = await get(ref(db, "bazar"));
    if (bazarSnap.exists()) {
      const allBazar = bazarSnap.val();
      Object.keys(allBazar).forEach(dateStr => {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime()) && d.getFullYear() === targetYear && (d.getMonth() + 1) === targetMonth) {
          Object.values(allBazar[dateStr]).forEach(b => { totalMessBazar += (b.amount || 0); });
        }
      });
    }

    const mealRate = totalMessMeals > 0 ? (totalMessBazar / totalMessMeals) : 0;
    const userTotalCost = userMeals * mealRate;
    const dueAmount = userTotalCost - userDeposit;

    const messBazarEl = document.getElementById("mess-total-bazar");
    const messMealsEl = document.getElementById("mess-total-meals");
    const mealRateEl = document.getElementById("current-meal-rate");
    
    const userMealsEl = document.getElementById("user-total-meals");
    const userCostEl = document.getElementById("user-total-cost");
    const depositEl = document.getElementById("user-total-deposit");
    const dueEl = document.getElementById("user-due-status");

    if (messBazarEl) messBazarEl.textContent = `${totalMessBazar} Tk`;
    if (messMealsEl) messMealsEl.textContent = totalMessMeals;
    if (mealRateEl) mealRateEl.textContent = `${mealRate.toFixed(2)} Tk`;

    if (userMealsEl) userMealsEl.textContent = userMeals;
    if (userCostEl) userCostEl.textContent = `${userTotalCost.toFixed(2)} Tk`;
    if (depositEl) depositEl.textContent = `${userDeposit} Tk`;

    if (dueEl) {
      if (dueAmount > 0) {
        dueEl.style.color = "#dc2626";
        dueEl.textContent = `${dueAmount.toFixed(2)} Tk (Due)`;
      } else {
        dueEl.style.color = "#16a34a";
        dueEl.textContent = `${Math.abs(dueAmount).toFixed(2)} Tk (Get Money)`;
      }
    }
  }

  calculateUserFinancials();

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
  let isEditingMode = true; 
  let isSubmitted = false;

  const lunchVal = document.getElementById("lunch-val");
  const dinnerVal = document.getElementById("dinner-val");
  const saveBtn = document.getElementById("save-meal-btn");
  const editBtn = document.getElementById("edit-meal-btn");
  const saveMsg = document.getElementById("save-msg");

  const lunchPlus = document.getElementById("lunch-plus");
  const lunchMinus = document.getElementById("lunch-minus");
  const dinnerPlus = document.getElementById("dinner-plus");
  const dinnerMinus = document.getElementById("dinner-minus");

  function isLunchCutoffPassed() { return new Date().getHours() >= 12; }
  function isDinnerCutoffPassed() { return new Date().getHours() >= 20; }

  function updateUIState() {
    const lunchLocked = isLunchCutoffPassed();
    const dinnerLocked = isDinnerCutoffPassed();

    if (lunchPlus) lunchPlus.disabled = lunchLocked || !isEditingMode;
    if (lunchMinus) lunchMinus.disabled = lunchLocked || !isEditingMode;
    if (dinnerPlus) dinnerPlus.disabled = dinnerLocked || !isEditingMode;
    if (dinnerMinus) dinnerMinus.disabled = dinnerLocked || !isEditingMode;

    if (lunchLocked && dinnerLocked) {
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.style.backgroundColor = "#94a3b8";
        saveBtn.style.display = "block";
        saveBtn.style.width = "100%";
        saveBtn.textContent = "🔒 Meals Locked For Today";
      }
      if (editBtn) editBtn.style.display = "none";
      if (saveMsg) {
        saveMsg.style.color = "#ef4444";
        saveMsg.textContent = "Cutoff passed. Contact Admin for changes.";
      }
    } else {
      if (isSubmitted && !isEditingMode) {
        if (saveBtn) {
          saveBtn.style.display = "block";
          saveBtn.style.flex = "1";
          saveBtn.disabled = true;
          saveBtn.style.backgroundColor = "#16a34a";
          saveBtn.textContent = "✓ Meal Saved";
        }
        if (editBtn) editBtn.style.display = "inline-block";
      } else {
        if (saveBtn) {
          saveBtn.style.display = "block";
          saveBtn.style.flex = "1";
          saveBtn.disabled = false;
          saveBtn.style.backgroundColor = "#2563eb";
          saveBtn.textContent = isSubmitted ? "Update Meal" : "Save Meal";
        }
        if (editBtn) editBtn.style.display = "none";
      }
    }
  }

  if (lunchPlus) lunchPlus.onclick = () => { if (!isLunchCutoffPassed() && isEditingMode) { lunchCount++; if (lunchVal) lunchVal.textContent = lunchCount; } };
  if (lunchMinus) lunchMinus.onclick = () => { if (!isLunchCutoffPassed() && isEditingMode && lunchCount > 0) { lunchCount--; if (lunchVal) lunchVal.textContent = lunchCount; } };
  if (dinnerPlus) dinnerPlus.onclick = () => { if (!isDinnerCutoffPassed() && isEditingMode) { dinnerCount++; if (dinnerVal) dinnerVal.textContent = dinnerCount; } };
  if (dinnerMinus) dinnerMinus.onclick = () => { if (!isDinnerCutoffPassed() && isEditingMode && dinnerCount > 0) { dinnerCount--; if (dinnerVal) dinnerVal.textContent = dinnerCount; } };

  if (editBtn) {
    editBtn.onclick = () => { isEditingMode = true; updateUIState(); };
  }

  if (saveBtn) {
    saveBtn.onclick = () => {
      if (isLunchCutoffPassed() && isDinnerCutoffPassed()) return;

      set(ref(db, `meals/${todayStr}/${currentUser.name}`), {
        lunch: lunchCount,
        dinner: dinnerCount,
        submitted: true
      })
      .then(() => {
        isSubmitted = true;
        isEditingMode = false;
        if (saveMsg) {
          saveMsg.style.color = "#16a34a";
          saveMsg.textContent = "Saved successfully!";
          setTimeout(() => { if (saveMsg) saveMsg.textContent = ""; }, 2500);
        }
        updateUIState();
        calculateUserFinancials();
      });
    };
  }

  onValue(ref(db, `meals/${todayStr}`), (snapshot) => {
    const data = snapshot.val() || {};
    const boardBody = document.getElementById("board-body");
    let totalLunch = 0, totalDinner = 0, rowsHtml = "";

    if (data[currentUser.name]) {
      lunchCount = data[currentUser.name].lunch || 0;
      dinnerCount = data[currentUser.name].dinner || 0;
      isSubmitted = data[currentUser.name].submitted || false;

      if (lunchVal) lunchVal.textContent = lunchCount;
      if (dinnerVal) dinnerVal.textContent = dinnerCount;
    }

    updateUIState();

    MEMBERS_LIST.forEach((name) => {
      const meal = data[name] || { lunch: 0, dinner: 0 };
      totalLunch += (meal.lunch || 0);
      totalDinner += (meal.dinner || 0);

      rowsHtml += `<tr ${name === currentUser.name ? 'class="highlight-user"' : ''}>
        <td>${name} ${name === 'Rizu' ? '(Admin)' : ''}</td>
        <td>${meal.lunch}</td>
        <td>${meal.dinner}</td>
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

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      localStorage.removeItem("currentUser");
      sessionStorage.removeItem("currentUser");
      window.location.href = "index.html";
    };
  }
}

// ------------------------------------
// 3. ADMIN PANEL LOGIC (admin.html)
// ------------------------------------
const bazarForm = document.getElementById("bazar-form");
if (bazarForm) {
  initNotifications();
  const currentUser = JSON.parse(localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser"));
  if (!currentUser || currentUser.role !== "admin") {
    window.location.href = "index.html";
  }

  const todayStr = getTodayDateStr();
  const bazarDate = document.getElementById("bazar-date");
  if (bazarDate) bazarDate.value = todayStr;

  const currentDateEl = document.getElementById("current-date");
  if (currentDateEl) currentDateEl.textContent = todayStr;

  // Admin Own Meal Control State & Handlers
  let adminLunch = 0;
  let adminDinner = 0;
  const adminLunchVal = document.getElementById("lunch-val");
  const adminDinnerVal = document.getElementById("dinner-val");
  const adminLunchPlus = document.getElementById("lunch-plus");
  const adminLunchMinus = document.getElementById("lunch-minus");
  const adminDinnerPlus = document.getElementById("dinner-plus");
  const adminDinnerMinus = document.getElementById("dinner-minus");
  const saveAdminMealBtn = document.getElementById("save-meal-btn");

  if (adminLunchPlus) adminLunchPlus.onclick = () => { adminLunch++; if (adminLunchVal) adminLunchVal.textContent = adminLunch; };
  if (adminLunchMinus) adminLunchMinus.onclick = () => { if (adminLunch > 0) adminLunch--; if (adminLunchVal) adminLunchVal.textContent = adminLunch; };
  if (adminDinnerPlus) adminDinnerPlus.onclick = () => { adminDinner++; if (adminDinnerVal) adminDinnerVal.textContent = adminDinner; };
  if (adminDinnerMinus) adminDinnerMinus.onclick = () => { if (adminDinner > 0) adminDinner--; if (adminDinnerVal) adminDinnerVal.textContent = adminDinner; };

  if (saveAdminMealBtn) {
    saveAdminMealBtn.onclick = () => {
      set(ref(db, `meals/${todayStr}/Rizu`), {
        lunch: adminLunch,
        dinner: adminDinner,
        submitted: true
      }).then(() => {
        alert("Your meal updated successfully!");
      });
    };
  }

  // Live Board & Instant Edit Handler (Direct +/- buttons in table for all members including Admin)
  window.changeMeal = async (name, type, delta) => {
    const mealSnap = await get(ref(db, `meals/${todayStr}/${name}`));
    let currentData = mealSnap.exists() ? mealSnap.val() : { lunch: 0, dinner: 0, submitted: true };
    
    if (type === 'lunch') {
      currentData.lunch = Math.max(0, (currentData.lunch || 0) + delta);
    } else if (type === 'dinner') {
      currentData.dinner = Math.max(0, (currentData.dinner || 0) + delta);
    }
    currentData.submitted = true;

    await set(ref(db, `meals/${todayStr}/${name}`), currentData);
  };

  // Load Live Board & Admin Meal initial values from Firebase
  onValue(ref(db, `meals/${todayStr}`), (snapshot) => {
    const data = snapshot.val() || {};
    const boardBody = document.getElementById("board-body");
    let totalLunch = 0, totalDinner = 0, rowsHtml = "";

    // Sync Admin Meal Top Section if data exists
    if (data["Rizu"]) {
      adminLunch = data["Rizu"].lunch || 0;
      adminDinner = data["Rizu"].dinner || 0;
      if (adminLunchVal) adminLunchVal.textContent = adminLunch;
      if (adminDinnerVal) adminDinnerVal.textContent = adminDinner;
    }

    MEMBERS_LIST.forEach((name) => {
      const meal = data[name] || { lunch: 0, dinner: 0 };
      totalLunch += (meal.lunch || 0);
      totalDinner += (meal.dinner || 0);

      rowsHtml += `<tr>
        <td>${name} ${name === 'Rizu' ? '(Admin)' : ''}</td>
        <td>
          <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
            <button onclick="changeMeal('${name}', 'lunch', -1)" style="padding: 2px 6px; cursor: pointer;">-</button>
            <span style="min-width: 15px; text-align: center;">${meal.lunch}</span>
            <button onclick="changeMeal('${name}', 'lunch', 1)" style="padding: 2px 6px; cursor: pointer;">+</button>
          </div>
        </td>
        <td>
          <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
            <button onclick="changeMeal('${name}', 'dinner', -1)" style="padding: 2px 6px; cursor: pointer;">-</button>
            <span style="min-width: 15px; text-align: center;">${meal.dinner}</span>
            <button onclick="changeMeal('${name}', 'dinner', 1)" style="padding: 2px 6px; cursor: pointer;">+</button>
          </div>
        </td>
        <td><span style="color: #16a34a; font-size: 0.8rem; font-weight: bold;">⚡ Live Edit</span></td>
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

  // Admin Notification Broadcast Form Handler
  const adminNotifForm = document.getElementById("admin-notification-form");
  if (adminNotifForm) {
    adminNotifForm.onsubmit = (e) => {
      e.preventDefault();
      const title = document.getElementById("admin-notif-title").value.trim();
      const message = document.getElementById("admin-notif-msg").value.trim();
      if (!title || !message) return;

      sendNotification(title, message);
      alert("Notification broadcasted successfully to all members!");
      adminNotifForm.reset();
    };
  }

  // Pending Requests Listener
  onValue(ref(db, "pending_requests"), (snapshot) => {
    const approvalList = document.getElementById("approval-list");
    const countEl = document.getElementById("pending-count");
    if (!approvalList) return;

    if (!snapshot.exists()) {
      approvalList.innerHTML = `<p style="color: #64748b; font-size: 0.85rem;">No pending requests at the moment.</p>`;
      if (countEl) countEl.textContent = "0";
      return;
    }

    const data = snapshot.val();
    const keys = Object.keys(data);
    if (countEl) countEl.textContent = keys.length;

    let html = "";
    keys.forEach(key => {
      const req = data[key];
      const desc = req.type === "deposit"
        ? `💵 <strong>${req.userName}</strong> requested Deposit: <strong>৳${req.amount}</strong>`
        : `🛒 <strong>${req.userName}</strong> submitted Bazar: <strong>${req.item} (৳${req.amount})</strong>`;

      html += `<div style="background: #fff; padding: 8px 12px; border-radius: 6px; border: 1px solid #fde68a; margin-bottom: 8px;">
        <div style="font-size: 0.85rem; color: #1e293b;">${desc}</div>
        <div class="action-btn-group">
          <button class="btn-approve" onclick="approveRequest('${key}')">✓ Approve</button>
          <button class="btn-reject" onclick="rejectRequest('${key}')">✗ Reject</button>
        </div>
      </div>`;
    });

    approvalList.innerHTML = html;
  });

  window.approveRequest = async (key) => {
    const snap = await get(ref(db, `pending_requests/${key}`));
    if (!snap.exists()) return;

    const req = snap.val();
    if (req.type === "deposit") {
      await push(ref(db, `deposits/${req.userName}`), { amount: req.amount, date: req.date });
      sendNotification("Deposit Approved", `${req.userName}'s deposit of ৳${req.amount} was approved.`);
    } else if (req.type === "bazar") {
      await push(ref(db, `bazar/${req.date}`), { item: req.item, amount: req.amount, addedBy: req.userName });
      sendNotification("Bazar Approved", `${req.userName}'s bazar (${req.item} - ৳${req.amount}) was approved.`);
    }

    await remove(ref(db, `pending_requests/${key}`));
    const monthSelect = document.getElementById("month-select");
    if (monthSelect && monthSelect.value) loadMonthlyData(monthSelect.value);
  };

  window.rejectRequest = async (key) => {
    const snap = await get(ref(db, `pending_requests/${key}`));
    if (snap.exists()) {
      const req = snap.val();
      sendNotification("Request Rejected", `${req.userName}'s ${req.type} request was rejected.`);
    }
    await remove(ref(db, `pending_requests/${key}`));
  };

  // Direct Deposit Entry
  const adminDepositForm = document.getElementById("admin-deposit-form");
  if (adminDepositForm) {
    adminDepositForm.onsubmit = async (e) => {
      e.preventDefault();
      const user = document.getElementById("admin-deposit-user").value;
      const amount = Number(document.getElementById("admin-deposit-amount").value);
      if (!user || amount <= 0) return;

      await push(ref(db, `deposits/${user}`), { amount: amount, date: todayStr });
      sendNotification("Direct Deposit Added", `Admin added ৳${amount} deposit for ${user}`);
      alert("Deposit added successfully!");
      adminDepositForm.reset();
    };
  }

  // Direct Bazar Entry
  bazarForm.onsubmit = async (e) => {
    e.preventDefault();
    const item = document.getElementById("bazar-item").value;
    const amount = Number(document.getElementById("bazar-amount").value);
    const date = bazarDate.value || todayStr;

    await push(ref(db, `bazar/${date}`), { item: item, amount: amount, addedBy: "Rizu (Admin)" });
    sendNotification("New Bazar Entry", `Bazar recorded: ${item} (৳${amount})`);
    alert("Bazar saved successfully!");
    bazarForm.reset();
  };

  // Monthly Settlement Overview Logic
  const monthSelect = document.getElementById("month-select");
  const currentYearMonth = todayStr.substring(0, 7); // "YYYY-MM"
  if (monthSelect) {
    monthSelect.value = currentYearMonth;
    monthSelect.onchange = (e) => loadMonthlyData(e.target.value);
    loadMonthlyData(currentYearMonth);
  }

  async function loadMonthlyData(yearMonth) {
    const [targetYear, targetMonth] = yearMonth.split("-").map(Number);
    let totalMessMeals = 0;
    let totalMessBazar = 0;
    const memberStats = {};

    MEMBERS_LIST.forEach(name => {
      memberStats[name] = { meals: 0, deposit: 0, totalCost: 0 };
    });

    // Fetch Deposits
    for (const name of MEMBERS_LIST) {
      const depSnap = await get(ref(db, `deposits/${name}`));
      if (depSnap.exists()) {
        Object.values(depSnap.val()).forEach(d => {
          if (d.date && d.date.startsWith(yearMonth)) {
            memberStats[name].deposit += (d.amount || 0);
          }
        });
      }
    }

    // Fetch Meals
    const mealsSnap = await get(ref(db, "meals"));
    if (mealsSnap.exists()) {
      const allMeals = mealsSnap.val();
      Object.keys(allMeals).forEach(dateStr => {
        if (dateStr.startsWith(yearMonth)) {
          Object.keys(allMeals[dateStr]).forEach(mem => {
            if (memberStats[mem]) {
              const sum = (allMeals[dateStr][mem].lunch || 0) + (allMeals[dateStr][mem].dinner || 0);
              memberStats[mem].meals += sum;
              totalMessMeals += sum;
            }
          });
        }
      });
    }

    // Fetch Bazar
    const bazarSnap = await get(ref(db, "bazar"));
    if (bazarSnap.exists()) {
      const allBazar = bazarSnap.val();
      Object.keys(allBazar).forEach(dateStr => {
        if (dateStr.startsWith(yearMonth)) {
          Object.values(allBazar[dateStr]).forEach(b => {
            totalMessBazar += (b.amount || 0);
          });
        }
      });
    }

    const mealRate = totalMessMeals > 0 ? (totalMessBazar / totalMessMeals) : 0;

    // Update General Monthly Overview Display
    document.getElementById("monthly-total-meals").textContent = totalMessMeals;
    document.getElementById("monthly-total-bazar").textContent = `${totalMessBazar} Tk`;
    document.getElementById("calculated-meal-rate").textContent = `${mealRate.toFixed(2)} Tk`;

    // Update Admin Own Financial Overview Display (3rd Image Design Box Sync)
    const adminName = "Rizu"; // Admin username
    const adminStats = memberStats[adminName] || { meals: 0, deposit: 0, totalCost: 0 };
    adminStats.totalCost = adminStats.meals * mealRate;
    const adminDue = adminStats.totalCost - adminStats.deposit;

    const adminOwnTotalBazar = document.getElementById("admin-own-total-bazar");
    const adminOwnTotalMeals = document.getElementById("admin-own-total-meals");
    const adminOwnMealRate = document.getElementById("admin-own-meal-rate");
    const adminMyTotalMeals = document.getElementById("admin-my-total-meals");
    const adminMyTotalCost = document.getElementById("admin-my-total-cost");
    const adminMyDeposit = document.getElementById("admin-my-deposit");
    const adminMyBalanceStatus = document.getElementById("admin-my-balance-status");

    if (adminOwnTotalBazar) adminOwnTotalBazar.textContent = `${totalMessBazar} Tk`;
    if (adminOwnTotalMeals) adminOwnTotalMeals.textContent = totalMessMeals;
    if (adminOwnMealRate) adminOwnMealRate.textContent = `${mealRate.toFixed(2)} Tk`;
    if (adminMyTotalMeals) adminMyTotalMeals.textContent = adminStats.meals;
    if (adminMyTotalCost) adminMyTotalCost.textContent = `${adminStats.totalCost.toFixed(2)} Tk`;
    if (adminMyDeposit) adminMyDeposit.textContent = `${adminStats.deposit} Tk`;

    if (adminMyBalanceStatus) {
      if (adminDue > 0) {
        adminMyBalanceStatus.style.color = "#dc2626";
        adminMyBalanceStatus.textContent = `${adminDue.toFixed(2)} Tk (Due)`;
      } else {
        adminMyBalanceStatus.style.color = "#16a34a";
        adminMyBalanceStatus.textContent = `${Math.abs(adminDue).toFixed(2)} Tk (Get Money)`;
      }
    }

    let settlementHtml = "";
    MEMBERS_LIST.forEach(name => {
      const stats = memberStats[name];
      stats.totalCost = stats.meals * mealRate;
      const due = stats.totalCost - stats.deposit;
      const statusText = due > 0 ? `<span style="color: #dc2626;">Due: ৳${due.toFixed(2)}</span>` : `<span style="color: #16a34a;">Advance: ৳${Math.abs(due).toFixed(2)}</span>`;

      settlementHtml += `<tr>
        <td>${name}</td>
        <td>${stats.meals}</td>
        <td>৳${stats.deposit}</td>
        <td>৳${stats.totalCost.toFixed(2)}</td>
        <td>${statusText}</td>
      </tr>`;
    });

    const settlementBody = document.getElementById("settlement-board-body");
    if (settlementBody) settlementBody.innerHTML = settlementHtml;

    // Copy Summary Button for Messenger
    const copyBtn = document.getElementById("copy-summary-btn");
    if (copyBtn) {
      copyBtn.onclick = () => {
        let summaryText = `📊 *Home Mess Summary (${yearMonth})* 📊\n`;
        summaryText = summaryText + `----------------------------------\n`;
        summaryText = summaryText + `🛒 Total Bazar: ৳${totalMessBazar}\n`;
        summaryText = summaryText + `🍽️ Total Meals: ${totalMessMeals}\n`;
        summaryText = summaryText + `⭐ Meal Rate: ৳${mealRate.toFixed(2)}\n`;
        summaryText = summaryText + `----------------------------------\n\n`;

        MEMBERS_LIST.forEach(name => {
          const st = memberStats[name];
          const due = st.totalCost - st.deposit;
          summaryText = summaryText + `👤 *${name}*\n`;
          summaryText = summaryText + `- Meals: ${st.meals}\n`;
          summaryText = summaryText + `- Deposit: ৳${st.deposit}\n`;
          summaryText = summaryText + `- Cost: ৳${st.totalCost.toFixed(2)}\n`;
          summaryText = summaryText + `👉 ${due > 0 ? `Due: ৳${due.toFixed(2)}` : `Advance: ৳${Math.abs(due).toFixed(2)}`}\n\n`;
        });

        navigator.clipboard.writeText(summaryText).then(() => {
          alert("Summary copied to clipboard! You can paste it on Messenger.");
        });
      };
    }
  }

  // Admin PIN Update
  const updateAdminPinBtn = document.getElementById("update-admin-pin-btn");
  if (updateAdminPinBtn) {
    updateAdminPinBtn.onclick = () => {
      const newPin = document.getElementById("new-admin-pin-input").value.trim();
      const msgEl = document.getElementById("admin-pin-msg");

      if (newPin.length < 4) {
        msgEl.style.color = "#ef4444";
        msgEl.textContent = "PIN must be at least 4 characters.";
        return;
      }

      set(ref(db, "users/Rizu/pin"), newPin).then(() => {
        msgEl.style.color = "#16a34a";
        msgEl.textContent = "Admin PIN updated successfully!";
        document.getElementById("new-admin-pin-input").value = "";
        setTimeout(() => msgEl.textContent = "", 3000);
      });
    };
  }

  const adminLogoutBtn = document.getElementById("logout-btn");
  if (adminLogoutBtn) {
    adminLogoutBtn.onclick = () => {
      localStorage.removeItem("currentUser");
      sessionStorage.removeItem("currentUser");
      window.location.href = "index.html";
    };
  }
}

// ------------------------------------
// 4. HISTORY PAGE LOGIC (history.html)
// ------------------------------------
const historyDateSelect = document.getElementById("history-date-select");
if (historyDateSelect) {
  initNotifications();
  const currentUser = JSON.parse(localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser"));
  if (!currentUser) {
    window.location.href = "index.html";
  }

  const backBtn = document.getElementById("back-btn");
  if (backBtn) {
    backBtn.href = currentUser.role === "admin" ? "admin.html" : "member.html";
  }

  async function loadHistoryDates() {
    const datesSet = new Set();

    const mealsSnap = await get(ref(db, "meals"));
    if (mealsSnap.exists()) {
      Object.keys(mealsSnap.val()).forEach(dateStr => datesSet.add(dateStr));
    }

    const bazarSnap = await get(ref(db, "bazar"));
    if (bazarSnap.exists()) {
      Object.keys(bazarSnap.val()).forEach(dateStr => datesSet.add(dateStr));
    }

    const sortedDates = Array.from(datesSet).sort().reverse();
    const todayStr = getTodayDateStr();

    let optionsHtml = "";
    if (sortedDates.length === 0) {
      optionsHtml = `<option value="">No history available</option>`;
    } else {
      sortedDates.forEach(dateStr => {
        const selected = dateStr === todayStr ? "selected" : "";
        optionsHtml += `<option value="${dateStr}" ${selected}>${dateStr}</option>`;
      });
    }

    historyDateSelect.innerHTML = optionsHtml;
    
    const initialDate = historyDateSelect.value || todayStr;
    if (initialDate) loadHistoryDataForDate(initialDate);
  }

  historyDateSelect.onchange = (e) => {
    loadHistoryDataForDate(e.target.value);
  };

  async function loadHistoryDataForDate(dateStr) {
    const dateLabel = document.getElementById("selected-date-label");
    const boardBody = document.getElementById("history-board-body");
    const bazarList = document.getElementById("history-bazar-list");

    if (dateLabel) dateLabel.textContent = dateStr;

    const mealsSnap = await get(ref(db, `meals/${dateStr}`));
    const mealsData = mealsSnap.exists() ? mealsSnap.val() : {};

    let rowsHtml = "";
    MEMBERS_LIST.forEach(name => {
      const meal = mealsData[name] || { lunch: 0, dinner: 0 };
      const totalMeal = (meal.lunch || 0) + (meal.dinner || 0);

      rowsHtml += `<tr>
        <td>${name}</td>
        <td>${meal.lunch}</td>
        <td>${meal.dinner}</td>
        <td><strong>${totalMeal}</strong></td>
      </tr>`;
    });
    if (boardBody) boardBody.innerHTML = rowsHtml;

    const bazarSnap = await get(ref(db, `bazar/${dateStr}`));
    if (!bazarSnap.exists()) {
      bazarList.innerHTML = `<li style="color: #64748b; padding: 4px 0;">No bazar expenses recorded on this date.</li>`;
    } else {
      let bazarHtml = "";
      const bazarData = bazarSnap.val();
      Object.values(bazarData).forEach(b => {
        bazarHtml += `<li style="padding: 6px 0; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between;">
          <span>🛒 ${b.item} <small style="color: #64748b;">(by ${b.addedBy || 'Admin'})</small></span>
          <strong>৳${b.amount}</strong>
        </li>`;
      });
      bazarList.innerHTML = bazarHtml;
    }
  }

  loadHistoryDates();
}
