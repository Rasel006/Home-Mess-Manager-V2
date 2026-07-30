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
      try {
        const adminPinSnap = await get(ref(db, "users/Rizu/pin"));
        let storedAdminPin = "Admin123";

        if (adminPinSnap.exists()) {
          storedAdminPin = adminPinSnap.val();
        } else {
          await set(ref(db, "users/Rizu/pin"), "Admin123");
        }

        if (inputPin === storedAdminPin) {
          sessionStorage.setItem("currentUser", JSON.stringify({ name: username, role: "admin" }));
          window.location.href = "admin.html";
        } else {
          errorMsg.textContent = "Invalid Admin PIN!";
        }
      } catch (err) {
        errorMsg.textContent = "Admin Login error: " + err.message;
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

  // Deposit Request Submit (Pending)
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
        alert("Deposit request sent to Admin for approval!");
        depositForm.reset();
      });
    });
  }

  // Bazar Request Submit (Pending)
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
        alert("Bazar expense request sent to Admin for approval!");
        memberBazarForm.reset();
      });
    });
  }

  // Real-time Pending List for User
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
      Object.values(deposits).forEach(d => {
        userDeposit += (d.amount || 0);
      });
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
            if (mem === currentUser.name) {
              userMeals += sum;
            }
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
          Object.values(allBazar[dateStr]).forEach(b => {
            totalMessBazar += (b.amount || 0);
          });
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
        saveMsg.textContent = "Cutoff passed (Lunch: 12 PM, Dinner: 8 PM). Contact Admin (Rizu) for changes.";
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

      let msg = "";
      if (lunchLocked) msg += "Lunch locked (past 12 PM). ";
      if (dinnerLocked) msg += "Dinner locked (past 8 PM). ";
      if (saveMsg) {
        saveMsg.style.color = "#d97706";
        saveMsg.textContent = msg;
      }
    }
  }

  if (lunchPlus) lunchPlus.onclick = () => { if (!isLunchCutoffPassed() && isEditingMode) { lunchCount++; if (lunchVal) lunchVal.textContent = lunchCount; } };
  if (lunchMinus) lunchMinus.onclick = () => { if (!isLunchCutoffPassed() && isEditingMode && lunchCount > 0) { lunchCount--; if (lunchVal) lunchVal.textContent = lunchCount; } };
  if (dinnerPlus) dinnerPlus.onclick = () => { if (!isDinnerCutoffPassed() && isEditingMode) { dinnerCount++; if (dinnerVal) dinnerVal.textContent = dinnerCount; } };
  if (dinnerMinus) dinnerMinus.onclick = () => { if (!isDinnerCutoffPassed() && isEditingMode && dinnerCount > 0) { dinnerCount--; if (dinnerVal) dinnerVal.textContent = dinnerCount; } };

  if (editBtn) {
    editBtn.onclick = () => {
      isEditingMode = true;
      updateUIState();
    };
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
        })
        .catch(err => {
          if (saveMsg) {
            saveMsg.style.color = "#ef4444";
            saveMsg.textContent = err.message;
          }
        });
    };
  }

  onValue(ref(db, `meals/${todayStr}`), (snapshot) => {
    const data = snapshot.val() || {};
    const boardBody = document.getElementById("board-body");
    let rowsHtml = "";

    if (data[currentUser.name]) {
      lunchCount = data[currentUser.name].lunch || 0;
      dinnerCount = data[currentUser.name].dinner || 0;
      isSubmitted = data[currentUser.name].submitted || false;

      if (isSubmitted && isEditingMode === true && !saveBtn.onclick) {
        isEditingMode = false;
      }

      if (lunchVal) lunchVal.textContent = lunchCount;
      if (dinnerVal) dinnerVal.textContent = dinnerCount;
    }

    updateUIState();

    MEMBERS_LIST.forEach((name) => {
      const meal = data[name] || { lunch: 0, dinner: 0 };
      rowsHtml += `<tr ${name === currentUser.name ? 'class="highlight-user"' : ''}>
        <td>${name} ${name === 'Rizu' ? '(Admin)' : ''}</td>
        <td>${meal.lunch}</td>
        <td>${meal.dinner}</td>
      </tr>`;
    });

    if (boardBody) boardBody.innerHTML = rowsHtml;
  });

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.onclick = () => {
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
  const monthSelect = document.getElementById("month-select");
  const bazarDate = document.getElementById("bazar-date");
  const todayStr = getTodayDateStr();

  const currentDateEl = document.getElementById("current-date");
  if (currentDateEl) currentDateEl.textContent = todayStr;

  // Real-time Pending Approvals Processing
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
    } else if (req.type === "bazar") {
      await push(ref(db, `bazar/${req.date}`), { item: req.item, amount: req.amount, addedBy: req.userName });
    }

    await remove(ref(db, `pending_requests/${key}`));
    loadMonthlyData(monthSelect.value);
  };

  window.rejectRequest = async (key) => {
    await remove(ref(db, `pending_requests/${key}`));
  };

  let adminLunchCount = 0;
  let adminDinnerCount = 0;
  const lunchVal = document.getElementById("lunch-val");
  const dinnerVal = document.getElementById("dinner-val");

  if (lunchVal && dinnerVal) {
    const lunchPlus = document.getElementById("lunch-plus");
    const lunchMinus = document.getElementById("lunch-minus");
    const dinnerPlus = document.getElementById("dinner-plus");
    const dinnerMinus = document.getElementById("dinner-minus");
    const saveMealBtn = document.getElementById("save-meal-btn");

    if (lunchPlus) lunchPlus.onclick = () => { adminLunchCount++; lunchVal.textContent = adminLunchCount; };
    if (lunchMinus) lunchMinus.onclick = () => { if (adminLunchCount > 0) adminLunchCount--; lunchVal.textContent = adminLunchCount; };
    if (dinnerPlus) dinnerPlus.onclick = () => { adminDinnerCount++; dinnerVal.textContent = adminDinnerCount; };
    if (dinnerMinus) dinnerMinus.onclick = () => { if (adminDinnerCount > 0) adminDinnerCount--; dinnerVal.textContent = adminDinnerCount; };

    if (saveMealBtn) {
      saveMealBtn.onclick = () => {
        const saveMsg = document.getElementById("save-msg");
        set(ref(db, `meals/${todayStr}/Rizu`), { lunch: adminLunchCount, dinner: adminDinnerCount, submitted: true })
          .then(() => {
            if (saveMsg) {
              saveMsg.style.color = "#16a34a";
              saveMsg.textContent = "Admin meal saved successfully!";
              setTimeout(() => saveMsg.textContent = "", 2500);
            }
            loadMonthlyData(monthSelect.value);
          })
          .catch(err => {
            if (saveMsg) {
              saveMsg.style.color = "#ef4444";
              saveMsg.textContent = err.message;
            }
          });
      };
    }
  }

  const adminDepositForm = document.getElementById("admin-deposit-form");
  if (adminDepositForm) {
    adminDepositForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const memberName = document.getElementById("admin-deposit-user").value;
      const amount = Number(document.getElementById("admin-deposit-amount").value);

      if (!memberName || amount <= 0) return;

      push(ref(db, `deposits/${memberName}`), {
        amount: amount,
        date: todayStr
      }).then(() => {
        alert(`Deposit of ${amount} Tk added for ${memberName}!`);
        adminDepositForm.reset();
        loadMonthlyData(monthSelect.value);
      });
    });
  }

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
        if (lunchVal) lunchVal.textContent = adminLunchCount;
        if (dinnerVal) dinnerVal.textContent = adminDinnerCount;
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

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (monthSelect) monthSelect.value = currentMonthStr;
  if (bazarDate) bazarDate.value = todayStr;

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
    if (!selectedYearMonth) return;

    const [targetYear, targetMonth] = selectedYearMonth.split("-").map(Number);

    let totalMeals = 0;
    let totalBazar = 0;
    const memberMealCounts = {};
    const memberDeposits = {};
    MEMBERS_LIST.forEach(m => {
      memberMealCounts[m] = 0;
      memberDeposits[m] = 0;
    });

    const depositSnap = await get(ref(db, "deposits"));
    if (depositSnap.exists()) {
      const allDeposits = depositSnap.val();
      Object.keys(allDeposits).forEach(mem => {
        if (memberDeposits[mem] !== undefined) {
          Object.values(allDeposits[mem]).forEach(d => {
            memberDeposits[mem] += (d.amount || 0);
          });
        }
      });
    }

    const mealsSnap = await get(ref(db, "meals"));
    if (mealsSnap.exists()) {
      const allMeals = mealsSnap.val();
      Object.keys(allMeals).forEach(dateStr => {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime()) && d.getFullYear() === targetYear && (d.getMonth() + 1) === targetMonth) {
          Object.keys(allMeals[dateStr]).forEach(mem => {
            const mData = allMeals[dateStr][mem];
            const sum = (mData.lunch || 0) + (mData.dinner || 0);
            if (memberMealCounts[mem] !== undefined) memberMealCounts[mem] += sum;
            totalMeals += sum;
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
          Object.keys(allBazar[dateStr]).forEach(key => {
            totalBazar += (allBazar[dateStr][key].amount || 0);
          });
        }
      });
    }

    const mealRate = totalMeals > 0 ? (totalBazar / totalMeals) : 0;

    const totMealsEl = document.getElementById("monthly-total-meals");
    const totBazarEl = document.getElementById("monthly-total-bazar");
    const mealRateEl = document.getElementById("calculated-meal-rate");

    if (totMealsEl) totMealsEl.textContent = totalMeals;
    if (totBazarEl) totBazarEl.textContent = `${totalBazar} Tk`;
    if (mealRateEl) mealRateEl.textContent = `${mealRate.toFixed(2)} Tk`;

    const board = document.getElementById("settlement-board-body");
    if (board) {
      let html = "";
      MEMBERS_LIST.forEach(m => {
        const meals = memberMealCounts[m];
        const cost = (meals * mealRate);
        const deposit = memberDeposits[m] || 0;
        const due = cost - deposit;

        let statusText = due > 0 
          ? `<span style="color: #dc2626; font-weight: bold;">${due.toFixed(2)} Tk Due</span>` 
          : `<span style="color: #16a34a; font-weight: bold;">${Math.abs(due).toFixed(2)} Tk Adv</span>`;

        html += `<tr>
          <td>${m} ${m === 'Rizu' ? '(Admin)' : ''}</td>
          <td>${meals}</td>
          <td>${deposit} Tk</td>
          <td>${cost.toFixed(2)} Tk</td>
          <td>${statusText}</td>
        </tr>`;
      });
      board.innerHTML = html;
    }

    const copyBtn = document.getElementById("copy-summary-btn");
    if (copyBtn) {
      copyBtn.onclick = () => {
        let msg = `📢 Monthly Mess Summary (${selectedYearMonth})\n`;
        msg += `----------------------------------\n`;
        msg += `🥣 Total Meals: ${totalMeals}\n`;
        msg += `🛒 Total Bazar: ৳${totalBazar}\n`;
        msg += `💡 Meal Rate: ৳${mealRate.toFixed(2)}\n\n`;
        msg += `Member Status:\n`;

        MEMBERS_LIST.forEach(m => {
          const meals = memberMealCounts[m];
          const cost = (meals * mealRate);
          const deposit = memberDeposits[m] || 0;
          const due = cost - deposit;

          if (due > 0) {
            msg += `• ${m}: ৳${due.toFixed(2)} (Due)\n`;
          } else {
            msg += `• ${m}: ৳${Math.abs(due).toFixed(2)} (Get Back)\n`;
          }
        });

        msg += `----------------------------------\n`;
        msg += `Please clear your dues on time!`;

        navigator.clipboard.writeText(msg).then(() => {
          alert("Monthly summary copied to clipboard! Ready to paste into Messenger.");
        });
      };
    }
  }

  if (monthSelect) {
    monthSelect.addEventListener("change", (e) => loadMonthlyData(e.target.value));
  }
  loadMonthlyData(currentMonthStr);

  const updateAdminPinBtn = document.getElementById("update-admin-pin-btn");
  if (updateAdminPinBtn) {
    updateAdminPinBtn.onclick = () => {
      const newPin = document.getElementById("new-admin-pin-input").value.trim();
      const pinMsg = document.getElementById("admin-pin-msg");

      if (newPin.length < 4) {
        pinMsg.style.color = "#ef4444";
        pinMsg.textContent = "Admin PIN must be at least 4 characters.";
        return;
      }

      set(ref(db, "users/Rizu/pin"), newPin)
        .then(() => {
          pinMsg.style.color = "#16a34a";
          pinMsg.textContent = "Admin PIN updated successfully!";
          document.getElementById("new-admin-pin-input").value = "";
          setTimeout(() => pinMsg.textContent = "", 3000);
        })
        .catch(err => {
          pinMsg.style.color = "#ef4444";
          pinMsg.textContent = err.message;
        });
    };
  }

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      sessionStorage.removeItem("currentUser");
      window.location.href = "index.html";
    };
  }
}

// ------------------------------------
// 4. DAILY HISTORY LOGIC (history.html)
// ------------------------------------
const historyDateSelect = document.getElementById("history-date-select");
if (historyDateSelect) {
  const backBtn = document.getElementById("back-btn");
  const selectedDateLabel = document.getElementById("selected-date-label");
  const historyBoardBody = document.getElementById("history-board-body");
  const historyBazarList = document.getElementById("history-bazar-list");

  if (backBtn) {
    backBtn.onclick = (e) => {
      e.preventDefault();
      const currentUser = JSON.parse(sessionStorage.getItem("currentUser"));
      if (currentUser && currentUser.role === "admin") {
        window.location.href = "admin.html";
      } else {
        window.location.href = "member.html";
      }
    };
  }

  async function loadHistoryForDate(targetDate) {
    if (!targetDate) {
      if (selectedDateLabel) selectedDateLabel.textContent = "--";
      if (historyBoardBody) historyBoardBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #64748b;">Please select a date.</td></tr>`;
      if (historyBazarList) historyBazarList.innerHTML = `<li>No date selected.</li>`;
      return;
    }

    if (selectedDateLabel) selectedDateLabel.textContent = targetDate;

    try {
      const mealsSnap = await get(ref(db, `meals/${targetDate}`));
      const mealsData = mealsSnap.exists() ? mealsSnap.val() : {};

      let tableHtml = "";
      MEMBERS_LIST.forEach((name) => {
        const m = mealsData[name] || { lunch: 0, dinner: 0 };
        const total = (m.lunch || 0) + (m.dinner || 0);
        tableHtml += `<tr>
          <td><strong>${name}</strong> ${name === 'Rizu' ? '(Admin)' : ''}</td>
          <td>${m.lunch || 0}</td>
          <td>${m.dinner || 0}</td>
          <td><strong>${total}</strong></td>
        </tr>`;
      });
      if (historyBoardBody) historyBoardBody.innerHTML = tableHtml;

      const bazarSnap = await get(ref(db, `bazar/${targetDate}`));
      if (bazarSnap.exists()) {
        const bazarData = bazarSnap.val();
        let bazarHtml = "";
        Object.values(bazarData).forEach(b => {
          bazarHtml += `<li style="padding: 4px 0; border-bottom: 1px dashed #e2e8f0;">
            🛒 <strong>${b.item}</strong> - ৳${b.amount} ${b.addedBy ? `(by ${b.addedBy})` : ''}
          </li>`;
        });
        if (historyBazarList) historyBazarList.innerHTML = bazarHtml;
      } else {
        if (historyBazarList) historyBazarList.innerHTML = `<li style="color: #64748b;">No bazar expenses logged for this date.</li>`;
      }
    } catch (err) {
      if (historyBoardBody) historyBoardBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #dc2626;">Error loading data: ${err.message}</td></tr>`;
    }
  }

  async function populateAvailableDates() {
    try {
      const datesSet = new Set();
      const today = getTodayDateStr();
      datesSet.add(today);

      const mealsSnap = await get(ref(db, "meals"));
      if (mealsSnap.exists()) {
        Object.keys(mealsSnap.val()).forEach(d => datesSet.add(d));
      }

      const bazarSnap = await get(ref(db, "bazar"));
      if (bazarSnap.exists()) {
        Object.keys(bazarSnap.val()).forEach(d => datesSet.add(d));
      }

      const sortedDates = Array.from(datesSet).sort().reverse();

      let optionsHtml = "";
      sortedDates.forEach(d => {
        optionsHtml += `<option value="${d}">${d} ${d === today ? '(Today)' : ''}</option>`;
      });

      historyDateSelect.innerHTML = optionsHtml;
      loadHistoryForDate(sortedDates[0]);
    } catch (err) {
      historyDateSelect.innerHTML = `<option value="">Error fetching dates</option>`;
      if (historyBoardBody) historyBoardBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #dc2626;">Failed to connect to Firebase.</td></tr>`;
    }
  }

  historyDateSelect.addEventListener("change", (e) => {
    loadHistoryForDate(e.target.value);
  });

  populateAvailableDates();
}
