// --- AUTH & ROUTING SYSTEM ---
const Auth = {
  state: {
    currentRole: null, 
    user: null, 
    tempPhone: null,
    mockUid: null,
  },

  // 1. ROUTER: Called on every page load
  async initRouter() {
    const path = window.location.pathname;
    const page = path.split("/").pop(); // 'index.html', 'platform.html', etc.

    // A. Check Persistence First (Local Storage)
    const storedUid = localStorage.getItem("messmate_uid");
    
    if (storedUid) {
        console.log("[Router] Found Persisted UID:", storedUid);
        this.fetchUserAndHandlePage(storedUid, page);
    } else {
        // B. Fallback to Firebase Auth Listener
        auth.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                console.log("[Router] Firebase User Detected:", firebaseUser.uid);
                localStorage.setItem("messmate_uid", firebaseUser.uid); 
                this.fetchUserAndHandlePage(firebaseUser.uid, page);
            } else {
                 this.handleNoAuth(page);
            }
        });
    }
  },

  // 2. FETCH USER & DECIDE ACTION
  async fetchUserAndHandlePage(uid, page) {
    try {
        // Fetch fresh data
        const doc = await db.collection("users").doc(uid).get();
        
        if (doc.exists) {
            this.state.user = doc.data();
            const user = this.state.user;
            console.log("[Router] User Loaded:", user.name, user.role);

            // --- REDIRECT LOGIC ---
            
            // I. If on Login Page -> Send to Dashboard
            if (page === "index.html" || page === "") {
                if (user.role === "owner") {
                    window.location.href = "owner_dashboard.html";
                } else {
                    if (user.currentMessId) {
                        window.location.href = "member_dashboard.html";
                    } else {
                        window.location.href = "platform.html";
                    }
                }
                return;
            }

            // II. If on Platform (Discovery)
            if (page === "platform.html") {
                if (user.role === "owner") { window.location.href = "owner_dashboard.html"; return; }
                if (user.currentMessId) { window.location.href = "member_dashboard.html"; return; }
                
                // Allow Access
                updateNavbar(user);
                loadDiscoveryCanteens();
            }

            // III. If on Member Dashboard
            if (page === "member_dashboard.html") {
                if (user.role === "owner") { window.location.href = "owner_dashboard.html"; return; }
                if (!user.currentMessId) { window.location.href = "platform.html"; return; }
                
                // Allow Access
                updateNavbar(user);
                initMemberDashboard(user);
            }

            // IV. If on Owner Dashboard
            if (page === "owner_dashboard.html") {
                if (user.role === "member") { window.location.href = "member_dashboard.html"; return; }
                
                // Allow Access
                updateNavbar(user);
                initOwnerDashboard(user);
            }

        } else {
            // ID exists but no data? Registration needed.
            console.warn("[Router] User ID exists but no profile.");
            if (page !== "index.html" && page !== "") window.location.href = "index.html";
        }
    } catch (e) {
        console.error("[Router] Error fetching user:", e);
        // If offline and can't fetch, we might want to stay put or show error
        // For now, let's assume if fetch fails, we stay to avoid loops, but show alert
    }
  },

  handleNoAuth(page) {
    console.log("[Router] No Auth detected.");
    if (page !== "index.html" && page !== "") {
        window.location.href = "index.html";
    } else {
        // On Login Page: Show Role Selection
        this.renderRoleSelection();
    }
  },

  // --- UI FOR INDEX.HTML ---
  renderRoleSelection() {
    if (!document.getElementById("step-role-select")) return;
    document.getElementById("auth-view").classList.remove("hidden");
    document.getElementById("step-role-select").classList.remove("hidden");
    document.getElementById("step-login").classList.add("hidden");
    document.getElementById("step-register-member").classList.add("hidden");
    document.getElementById("step-register-owner").classList.add("hidden");
  },

  showLoginScreen(role) {
    this.state.currentRole = role;
    document.getElementById("step-role-select").classList.add("hidden");
    document.getElementById("step-login").classList.remove("hidden");
    document.getElementById("login-title").innerText = role === 'member' ? "Member Login" : "Owner Login";
    document.getElementById("login-email").value = "";
    document.getElementById("login-password").value = "";
    document.getElementById("auth-error").classList.add("hidden");
  },

  showRegistrationForm(userEmail) {
    document.getElementById("step-login").classList.add("hidden");
    if (this.state.currentRole === "member") {
        document.getElementById("step-register-member").classList.remove("hidden");
        if(userEmail) document.getElementById("reg-mem-email").value = userEmail;
    } else {
        document.getElementById("step-register-owner").classList.remove("hidden");
        if(userEmail) document.getElementById("reg-own-email").value = userEmail;
    }
  },
};

// --- MOBILE NAVIGATION LOGIC ---

// OWNER TABS
function switchOwnerTab(tabName) {
    // Check width? If user clicks button, they are likely in mobile view (since buttons are hidden on desktop)
    // So distinct check might not be needed if buttons are hidden.
    
    // Hide all tabs
    document.querySelectorAll('#dashboard-content .mobile-tab-content').forEach(el => {
        el.classList.add('hidden');
        // Fallback for specificity issues (e.g. grid vs hidden)
        el.style.display = 'none'; 
    });
    
    // Show selected
    const target = document.getElementById(`tab-owner-${tabName}`);
    if(target) {
        target.classList.remove('hidden');
        target.style.display = ''; // Clear inline style to let CSS take over (or set block/grid if needed?)
        // If it was grid, clearing display might let it revert to css grid.
        // If css has hidden, we removed it.
        // If css has grid, it shows as grid.
    }
    
    // Update Icons
    document.querySelectorAll('[id^="nav-owner-"]').forEach(btn => {
        btn.classList.remove('text-orange-600');
        btn.classList.add('text-slate-400');
    });
    const activeBtn = document.getElementById(`nav-owner-${tabName}`);
    if(activeBtn) {
        activeBtn.classList.remove('text-slate-400');
        activeBtn.classList.add('text-orange-600');
    }
}

// MEMBER TABS
function switchMemberTab(tabName) {
    // Hide all
    document.querySelectorAll('#dashboard-content .mobile-tab-content').forEach(el => {
        el.classList.add('hidden');
        el.style.display = 'none';
    });
    
    // Show selected
    const target = document.getElementById(`tab-member-${tabName}`);
    if(target) {
        target.classList.remove('hidden');
        target.style.display = ''; // Reset to CSS default (block/grid)
    }
    
    // Update Icons
    document.querySelectorAll('[id^="nav-member-"]').forEach(btn => {
        btn.classList.remove('text-orange-600');
        btn.classList.add('text-slate-400');
    });
    const activeBtn = document.getElementById(`nav-member-${tabName}`);
    if(activeBtn) {
        activeBtn.classList.remove('text-slate-400');
        activeBtn.classList.add('text-orange-600');
    }
}

// --- GLOBAL HELPERS ---

function updateNavbar(user) {
    const nameEl = document.getElementById("user-display-name");
    if (nameEl) nameEl.innerText = user.name;
    const roleEl = document.getElementById("user-display-role");
    if (roleEl) roleEl.innerText = user.role;
}

function logout() {
    auth.signOut().then(() => {
        localStorage.removeItem("messmate_uid");
        window.location.href = "index.html";
    });
}

function startAuthFlow(role) { Auth.showLoginScreen(role); }
function goBackToRoleSelect() { Auth.renderRoleSelection(); }

// --- AUTH ACTIONS (GOOGLE, EMAIL) ---

function getCurrentUid() {
    return localStorage.getItem("messmate_uid") || (auth.currentUser ? auth.currentUser.uid : Auth.state.mockUid);
}

function handleAuthSuccess(user, isSignUp) {
    localStorage.setItem("messmate_uid", user.uid);
    Auth.state.tempPhone = user.phoneNumber || null; // Might be null for email/google
    
    // Check if user exists in Firestore
    db.collection("users").doc(user.uid).get().then((doc) => {
        if (doc.exists) {
            // Existing user -> Router will handle redirect on reload
            location.reload(); 
        } else {
            // New user -> Show Registration Form based on selected role
            if (Auth.state.currentRole) {
                Auth.showRegistrationForm(user.email);
            } else {
                Auth.renderRoleSelection();
            }
        }
    }).catch(err => {
        console.error("Error fetching user data:", err);
        showAuthError("Error verifying account status.");
    });
}

function showAuthError(msg) {
    const errorEl = document.getElementById("auth-error");
    if (errorEl) {
        errorEl.innerText = msg;
        errorEl.classList.remove("hidden");
    } else {
        alert(msg);
    }
}

function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then((result) => {
            handleAuthSuccess(result.user, false);
        })
        .catch((error) => {
            console.error("Google Sign-In Error:", error);
            showAuthError(error.message);
        });
}

function signInWithEmail() {
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    
    if (!email || !password) {
        showAuthError("Please enter email and password.");
        return;
    }

    const btn = document.getElementById("btn-signin-email");
    const originalText = btn.innerText;
    btn.innerText = "Signing In...";
    btn.disabled = true;

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            handleAuthSuccess(userCredential.user, false);
        })
        .catch((error) => {
            console.error("Email Sign-In Error:", error);
            showAuthError(error.message);
            btn.innerText = originalText;
            btn.disabled = false;
        });
}

function signUpWithEmail() {
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    
    if (!email || !password) {
        showAuthError("Please enter email and password.");
        return;
    }

    const btn = document.getElementById("btn-signup-email");
    const originalText = btn.innerText;
    btn.innerText = "Creating Account...";
    btn.disabled = true;

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            handleAuthSuccess(userCredential.user, true);
        })
        .catch((error) => {
            console.error("Email Sign-Up Error:", error);
            showAuthError(error.message);
            btn.innerText = originalText;
            btn.disabled = false;
        });
}

function completeMemberRegistration() {
    const uid = getCurrentUid();
    if(!uid) { showAuthError("Authentication lost. Please try logging in again."); return; }
    
    const name = document.getElementById("reg-mem-name").value;
    const email = document.getElementById("reg-mem-email").value;
    const occupation = document.getElementById("reg-mem-occupation").value;
    const whatsapp = document.getElementById("reg-mem-whatsapp").value;
    const location = document.getElementById("reg-mem-location").value;
    const genderEl = document.querySelector('input[name="mem-gender"]:checked');
    
    if (!name || !email || !occupation || !whatsapp || !location || !genderEl) { alert("Fill all fields"); return; }
    
    // Auth.state.tempPhone may be null now
    const phone = Auth.state.tempPhone || "";
    
    const userData = { uid, name, email, occupation, whatsapp, location, gender: genderEl.value, role: 'member', phone: phone, holidays: [], currentMessId: null };
    saveUserAndLoad(userData);
}

function completeOwnerRegistration() {
    const uid = getCurrentUid();
    if(!uid) { showAuthError("Authentication lost. Please try logging in again."); return; }
    
    const canteenName = document.getElementById("reg-own-canteen").value;
    const ownerName = document.getElementById("reg-own-name").value;
    const email = document.getElementById("reg-own-email").value;
    const price = document.getElementById("reg-own-price").value;
    const area = document.getElementById("reg-own-area").value;
    const city = document.getElementById("reg-own-city").value;
    const district = document.getElementById("reg-own-district").value;
    const state = document.getElementById("reg-own-state").value;
    const pincode = document.getElementById("reg-own-pincode").value;

    if (!canteenName || !ownerName || !price) { alert("Fill all fields"); return; }

    const phone = Auth.state.tempPhone || "";

    const userData = { uid, name: ownerName, canteenName, email, role: 'owner', phone: phone, subscriptionPrice: price, address: { area, city, district, state, pincode }, locationString: `${area}, ${city}` };
    saveUserAndLoad(userData);
}

function saveUserAndLoad(userData) {
    db.collection("users").doc(userData.uid).set(userData)
    .then(() => {
        Auth.state.user = userData;
        location.reload(); // Reload to let Router handle redirection
    })
    .catch((e) => alert("Error: " + e));
}

// --- PAGE: PLATFORM (DISCOVERY) ---

function loadDiscoveryCanteens() {
    const list = document.getElementById("discovery-list");
    if(!list) return;

    db.collection("users").where("role", "==", "owner").get()
    .then(snapshot => {
        const canteens = [];
        snapshot.forEach(doc => {
            // CRITICAL FIX: Ensure UID is ID
            const data = doc.data();
            canteens.push({ ...data, uid: doc.id });
        });
        window.allDiscoveryCanteens = canteens;
        displayDiscoveryList(canteens);
    });
}

function displayDiscoveryList(canteens) {
    const list = document.getElementById("discovery-list");
    if(!list) return;

    if (canteens.length === 0) { list.innerHTML = `<div class="col-span-full text-center">No canteens found.</div>`; return; }

    list.innerHTML = canteens.map(c => `
        <div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow border border-slate-100 flex flex-col h-full">
            <div class="h-32 bg-orange-100 flex items-center justify-center text-4xl">🏪</div>
            <div class="p-6 flex-grow flex flex-col">
                <div class="flex-grow">
                    <h3 class="font-bold text-xl text-slate-800 mb-1">${c.canteenName}</h3>
                    <p class="text-slate-500 text-sm mb-4">📍 ${c.locationString}</p>
                </div>
                <div class="border-t border-slate-100 pt-4 flex justify-between items-center mt-auto">
                    <div>
                        <span class="text-2xl font-bold text-slate-800">₹${c.subscriptionPrice || 'N/A'}</span>
                        <span class="text-xs text-slate-400">/month</span>
                    </div>
                    <button onclick="joinMess('${c.uid}', '${c.canteenName}')" class="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-6 rounded-lg transition-colors">Join</button>
                </div>
            </div>
        </div>
    `).join("");
}

function filterDiscoveryList(query) {
    if (!window.allDiscoveryCanteens) return;
    const lower = query.toLowerCase();
    const filtered = window.allDiscoveryCanteens.filter(c => (c.canteenName || "").toLowerCase().includes(lower) || (c.locationString || "").toLowerCase().includes(lower));
    displayDiscoveryList(filtered);
}

function joinMess(ownerUid, canteenName) {
    if(!ownerUid || ownerUid === 'undefined') {
        alert("System Error: Canteen ID is missing. Please refresh and try again.");
        return;
    }
    if (!confirm(`Subscribe to ${canteenName}?`)) return;
    const user = Auth.state.user;
    db.collection("users").doc(user.uid).update({ currentMessId: ownerUid, joinedDate: firebase.firestore.FieldValue.serverTimestamp() })
    .then(() => {
        alert("Joined!");
        location.reload(); // Will redirect to Dashboard
    });
}

// --- PAGE: MEMBER DASHBOARD ---

// --- PAGE: MEMBER DASHBOARD ---

// --- SETTINGS UI ---
function toggleSettings() {
    const d = document.getElementById("settings-dropdown");
    if(d) d.classList.toggle("hidden");
}

// Close Dropdown on click outside
window.addEventListener('click', function(e) {
    const btn = document.querySelector('button[onclick="toggleSettings()"]');
    const dropdown = document.getElementById("settings-dropdown");
    if (btn && dropdown && !btn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add("hidden");
    }
});

// --- PAGE: MEMBER DASHBOARD ---

function initMemberDashboard(user) {
    // 1. QR Code
    const qrContainer = document.getElementById("qrcode");
    if (qrContainer) {
        qrContainer.innerHTML = "";
        // Larger QR Code as requested (200x200)
        new QRCode(qrContainer, { text: user.uid, width: 200, height: 200, colorDark: "#ea580c", colorLight: "#ffffff" });
    }
    const uidDisplay = document.getElementById("uid-display");
    if(uidDisplay) uidDisplay.innerText = user.uid.substring(0, 8) + "...";

    // 2. Calendar & Preferences
    // We need Owner's Weekly Menu to render the calendar correctly
    if(user.currentMessId) {
        db.collection("users").doc(user.currentMessId).get().then(doc => {
            if(doc.exists) {
                const ownerData = doc.data();
                window.currentMessOwnerData = ownerData; // Store for optimistic updates
                
                // Set Mess Name in Header
                const messNameEl = document.getElementById("nav-canteen-name");
                if(messNameEl) messNameEl.innerText = ownerData.canteenName || "My Mess";

                initMemberCalendar(user, ownerData);
            }
        });
    } else {
        const messNameEl = document.getElementById("nav-canteen-name");
        if(messNameEl) messNameEl.innerText = "Not Connected";
    }
    
    // 3. History
    loadMemberHistory(user.uid);
    
    // 4. Setup Inputs
    setupBulkLeaveInputs();
    
    // 5. Mobile Tab Init
    if(window.innerWidth < 768) {
        switchMemberTab('qr');
    }
}

function getLocalDate() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function initMemberCalendar(user, owner) {
  const grid = document.getElementById("calendar-grid");
  if (!grid) return;
  grid.innerHTML = "<p class='col-span-7 text-center text-slate-400 py-8'>Loading calendar...</p>";
  
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); 
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = getLocalDate();

  // Ensure prefs exist
  const prefs = user.futurePreferences || {}; // { "2024-05-20": "Fast" }
  // Backwards compat for "holidays" (treat as "Off")
  if(user.holidays && user.holidays.length) {
      user.holidays.forEach(h => { if(!prefs[h]) prefs[h] = "Off"; });
  }

  // Update Month Header
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const headerEl = document.getElementById("calendar-month-year");
  if(headerEl) headerEl.innerText = `${monthNames[month]} ${year}`;

  // Fetch Daily Menus for the month
  // Construct IDs: uid_YYYY-MM-DD
  const requests = [];
  for(let i=1; i<=daysInMonth; i++) {
        const dayStr = String(i).padStart(2, '0');
        const monthStr = String(month + 1).padStart(2, '0');
        const dateStr = `${year}-${monthStr}-${dayStr}`;
        const docId = `${owner.uid}_${dateStr}`;
        requests.push(db.collection("dailyMenus").doc(docId).get());
  }

  Promise.all(requests).then(snapshots => {
      const dailyMenus = {};
      snapshots.forEach(doc => {
          if(doc.exists) dailyMenus[doc.data().date] = doc.data();
      });
      
      grid.innerHTML = ""; // Clear loading

      for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, month, i); // Accurate Date Obj
        const dayStr = String(i).padStart(2, '0');
        const monthStr = String(month + 1).padStart(2, '0');
        const dateStr = `${year}-${monthStr}-${dayStr}`;
        
        // Determine Menu Logic
        const menu = dailyMenus[dateStr];
        
        // Default Logic Helper
        const getDefault = (mealType) => {
            if(!menu || !menu[mealType]) return "Veg"; // Safe Default
            const m = menu[mealType];
            if(m.off && m.off.available) return "Off";
            // If Off is NOT available, check others
            // Order of precedence for default display if no user pref:
            // Since we don't know what owner "intended" as default, we pick first available safe option.
            // Usually Veg. If Veg not available, check NonVeg?
            if(m.veg && m.veg.available) return "Veg";
            if(m.nonveg && m.nonveg.available) return "NonVeg";
            if(m.fast && m.fast.available) return "Fast";
            return "Veg"; // Final Fallback
        };

        const defLunch = getDefault('lunch');
        const defDinner = getDefault('dinner');

        // User Preference?
        let userPref = prefs[dateStr]; 
        if (typeof userPref === 'string') userPref = { lunch: userPref, dinner: userPref };
        userPref = userPref || {};

        const finalLunch = userPref.lunch || defLunch;
        const finalDinner = userPref.dinner || defDinner;

        // Helper for Modern Pill Styling
        const getPillStyle = (type) => {
            if (type === "NonVeg") return "bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-200";
            if (type === "Fast") return "bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200";
            if (type === "Off") return "bg-slate-100 text-slate-400 hover:bg-slate-200 border border-slate-200 decoration-slate-400 line-through decoration-2";
            if (type === "Veg") return "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200"; 
            return "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100"; // Fallback
        };

        const getDotStyle = (type) => {
            if (type === "NonVeg") return "bg-red-500";
            if (type === "Veg") return "bg-green-500";
            if (type === "Fast") return "bg-yellow-500";
            if (type === "Off") return "bg-slate-400";
            return "bg-blue-500";
        };

        const lStyle = getPillStyle(finalLunch);
        const dStyle = getPillStyle(finalDinner);
        
        const lDot = getDotStyle(finalLunch);
        const dDot = getDotStyle(finalDinner);
    
        // Container: Card Style
        const cell = document.createElement("div");
        
        // Highlight Today
        let containerClass = "flex flex-col p-1 md:p-1.5 rounded-xl md:rounded-2xl border transition-all hover:shadow-md h-16 md:h-24 justify-between bg-white";
        if (dateStr === todayStr) {
            containerClass += " border-indigo-500 shadow-md ring-1 ring-indigo-500";
        } else {
            containerClass += " border-slate-100";
        }
        
        const isPast = d < new Date(now.setHours(0,0,0,0));

        cell.className = containerClass;

        // 1. Date Header
        const dateDiv = document.createElement("div");
        dateDiv.className = "text-center";
        // Fade the number if past (lighter gray), normal if future
        const numClass = isPast ? "text-slate-300" : "text-slate-600";
        dateDiv.innerHTML = `<span class="text-xs font-bold ${numClass} block">${i}</span>`;
        cell.appendChild(dateDiv);
        
        // 2. Pills Container
        const pillsDiv = document.createElement("div");
        pillsDiv.className = "flex flex-grow items-center justify-between gap-1"; // Horizontal flex
        
        // Lunch Button
        const btnL = document.createElement("button");
        btnL.className = `w-full h-full flex items-center justify-center relative rounded transition-colors ${lStyle}`;
        btnL.innerHTML = `<span class="text-[10px] font-bold">L</span>${userPref.lunch ? `<span class="absolute top-0 right-0 -mt-1 -mr-1 w-2 h-2 rounded-full border border-white ${lDot}"></span>` : ''}`;
        
        // Dinner Button
        const btnD = document.createElement("button");
        btnD.className = `w-full h-full flex items-center justify-center relative rounded transition-colors ${dStyle}`;
        btnD.innerHTML = `<span class="text-[10px] font-bold">D</span>${userPref.dinner ? `<span class="absolute top-0 right-0 -mt-1 -mr-1 w-2 h-2 rounded-full border border-white ${dDot}"></span>` : ''}`;

        // Common Click Handler: Open Combined Modal from ANYWHERE in the cell
        if(!isPast) {
            const handler = (e) => {
                e.stopPropagation(); // Prevent bubbling if nested
                openPrefModal(dateStr, finalLunch, finalDinner);
            };
            btnL.onclick = handler;
            btnD.onclick = handler;
            pillsDiv.onclick = handler;
            pillsDiv.style.cursor = 'pointer';
            cell.onclick = handler; // Make whole cell clickable
            cell.style.cursor = 'pointer';
        }

        pillsDiv.appendChild(btnL);
        // pillsDiv.appendChild(div); // Removed divider
        pillsDiv.appendChild(btnD);
        
        cell.appendChild(pillsDiv);
        grid.appendChild(cell);
      }
  }).catch(err => {
      console.error(err);
      grid.innerHTML = "<p class='col-span-7 text-center text-red-500 py-8'>Error loading calendar.</p>";
  });
}

// --- PREFERENCE MODAL LOGIC (COMBINED) ---

let currentModalDate = "";
let currentModalPrefs = { lunch: "", dinner: "" };
let currentDailyMenu = null; // Store daily menu for validation

function openPrefModal(dateStr, currentLunch, currentDinner) {
    currentModalDate = dateStr;
    // Ensure we have valid strings
    currentLunch = currentLunch || "";
    currentDinner = currentDinner || "";
    currentModalPrefs = { lunch: currentLunch, dinner: currentDinner };
    
    // UI Update
    const displayDate = new Date(dateStr).toDateString();
    const dateEl = document.getElementById("pref-date-display");
    if(dateEl) dateEl.innerText = displayDate;
    
    // Fetch Daily Menu for this date
    const uid = localStorage.getItem("messmate_uid");
    // We need ownerUid. Assuming user object is loaded or stored somewhere. 
    // Actually, we can't easily get ownerUid here without looking at Auth.state or passing it.
    // Auth.state.user contains 'currentMessId' which is the ownerUid.
    
    const ownerUid = Auth.state.user.currentMessId;
    if(ownerUid) {
        const docId = `${ownerUid}_${dateStr}`;
        db.collection("dailyMenus").doc(docId).get().then(doc => {
            currentDailyMenu = doc.exists ? doc.data() : null;
            updateModalSelectionUI('lunch', currentLunch);
            updateModalSelectionUI('dinner', currentDinner);
            
            // Show modal AFTER data load (or update UI after load)
            const modal = document.getElementById("pref-modal");
            if(modal) {
                modal.classList.remove("hidden");
                 const panel = modal.querySelector('div');
                if(panel) {
                    panel.classList.remove('scale-95', 'opacity-0');
                    panel.classList.add('scale-100', 'opacity-100');
                }
            }
        });
    } else {
        // Fallback if no owner (shouldn't happen for active member)
        currentDailyMenu = null;
        updateModalSelectionUI('lunch', currentLunch);
        updateModalSelectionUI('dinner', currentDinner);
        document.getElementById("pref-modal").classList.remove("hidden");
    }
}

function closePrefModal() {
    const modal = document.getElementById("pref-modal");
    if(!modal) return;
    const panel = modal.querySelector('div');
    
    if(panel) {
        panel.classList.remove('scale-100', 'opacity-100');
        panel.classList.add('scale-95', 'opacity-0');
    }
    
    setTimeout(() => {
        modal.classList.add("hidden");
    }, 200);
}

function selectModalPref(meal, type) {
    // Check availability
    // Always allow 'Off' and 'Fast' regardless of owner settings
    if (type === 'Off' || type === 'Fast') {
        // Allowed
    } else if(currentDailyMenu && currentDailyMenu[meal]) {
         const mData = currentDailyMenu[meal];
         // New Structure Check
         if(mData[type.toLowerCase()]) { // 'Veg' -> 'veg'
             if(!mData[type.toLowerCase()].available) return; // Ignore click if unavailable
         }
         // If key doesn't exist? (e.g. only veg is set). 
         // If we are here, it's Veg or NonVeg.
         // If owner didn't specify, we might want to restrict NonVeg?
         // Existing logic: "If no override, Veg is available. Others blocked."
    } else {
        // No override exists. Default: Only Veg allowed.
        if(type !== 'Veg') {
             return; 
        }
    }
    
    currentModalPrefs[meal] = type;
    updateModalSelectionUI(meal, type);
}

function updateModalSelectionUI(meal, selectedType) {
    // 1. Reset all buttons for this meal
    const buttons = document.querySelectorAll(`.pref-btn-${meal}`);
    
    // Check Availability Logic
    const menuForMeal = currentDailyMenu ? currentDailyMenu[meal] : null;

    buttons.forEach(btn => {
        const type = btn.id.split('-')[2]; // btn-lunch-Veg -> Veg
        const typeKey = type.toLowerCase();
        
        // Reset classes
        btn.classList.remove("bg-slate-800", "text-white", "border-slate-800", "shadow-md", "opacity-50", "cursor-not-allowed");
        btn.classList.add("border-slate-200", "text-slate-800", "bg-white", "hover:bg-slate-50");
        btn.disabled = false;
        
        // Remove old description if any
        const oldDesc = btn.querySelector('.menu-desc');
        if(oldDesc) oldDesc.remove();

        // Check Availability
        let isAvailable = true;
        let desc = "";
        
        if (type === 'Off' || type === 'Fast') {
            isAvailable = true; // Always can set Off or Fast
        } else {
            if (menuForMeal && menuForMeal[typeKey]) {
                isAvailable = menuForMeal[typeKey].available;
                desc = menuForMeal[typeKey].items;
                // If the mess is marked as Off (Closed), force unavailable?
                // Actually, if Owner says 'Off' is available, it doesn't mean others are NOT available (unless they unchecked them).
                // Owners usually uncheck Veg/NonVeg if Off is checked, but let's rely on the specific flags.
            } else {
                 // No override. Default: Veg is available. Others not.
                 if(type !== 'Veg') isAvailable = false;
            }
        }
        
        if (!isAvailable) {
            btn.classList.add("opacity-50", "cursor-not-allowed", "bg-slate-100");
            btn.classList.remove("hover:bg-slate-50", "bg-white");
            btn.disabled = true;
        } else {
             // Add Description Badge if exists
             if(desc) {
                 btn.innerHTML = `${type} <div class="menu-desc text-[9px] font-normal opacity-80 truncate max-w-full">${desc}</div>`;
             } else {
                 btn.innerHTML = type; 
             }
        }
    });

    // 2. Highlight Selected (if available)
    if(selectedType) {
        const btn = document.getElementById(`btn-${meal}-${selectedType}`);
        if(btn && !btn.disabled) {
            btn.classList.remove("border-slate-200", "text-slate-800", "bg-white", "hover:bg-slate-50");
            btn.classList.add("bg-slate-800", "text-white", "border-slate-800", "shadow-md");
        } 
    }
}

function saveCombinedPreferences() {
    if(!currentModalDate) return;
    
    // 1. Optimistic Update
    const user = Auth.state.user; 
    if(!user.futurePreferences) user.futurePreferences = {};
    user.futurePreferences[currentModalDate] = currentModalPrefs;
    
    // Close Modal immediately
    closePrefModal();
    
    // Re-render Calendar immediately if we have owner data
    if(window.currentMessOwnerData) {
        initMemberCalendar(user, window.currentMessOwnerData);
    }
    
    // 2. Database Update (Background)
    const uid = user.uid;
    const userRef = db.collection("users").doc(uid);
    const updateData = {};
    updateData[`futurePreferences.${currentModalDate}`] = currentModalPrefs;
    
    userRef.update(updateData).then(() => {
        showToast("Preferences Saved! ✅");
        // No need to re-fetch/re-render, we did it optimistically.
    }).catch(err => {
        console.error(err);
        showToast("Error saving: " + err.message);
        // If error, maybe revert UI? But for now simple is fine.
    });
}


function saveBulkLeave() {
    const start = document.getElementById("bulk-start").value;
    const end = document.getElementById("bulk-end").value;
    const todayStr = getLocalDate();
    
    if(!start || !end) { alert("Select Start and End dates"); return; }
    if(start < todayStr) { alert("Cannot mark leave for past dates. Please select a future date."); return; }
    if(start > end) { alert("Start date must be before End date"); return; }
    
    const user = Auth.state.user;
    const prefs = user.futurePreferences || {};
    
    let curr = new Date(start);
    const last = new Date(end);
    
    while(curr <= last) {
        const year = curr.getFullYear();
        const month = String(curr.getMonth() + 1).padStart(2, '0');
        const day = String(curr.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        // Mark BOTH lunch and dinner as Off
        prefs[dateStr] = { lunch: "Off", dinner: "Off" };
        curr.setDate(curr.getDate() + 1);
    }
    
    db.collection("users").doc(user.uid).update({ futurePreferences: prefs })
    .then(() => {
        alert("✅ Bulk Leave Apply!");
        initMemberDashboard(Auth.state.user);
    });
}

// Add UI helper to set min date for inputs
function setupBulkLeaveInputs() {
    const todayStr = getLocalDate();
    const startIn = document.getElementById("bulk-start");
    const endIn = document.getElementById("bulk-end");
    if(startIn) startIn.min = todayStr;
    if(endIn) endIn.min = todayStr;
}

function loadMemberHistory(uid) {
  const historyList = document.getElementById("history-container");
  if(!historyList) return;
  historyList.innerHTML = `<p class="text-center text-slate-400">Loading...</p>`;
  
  db.collection("attendance").where("uid", "==", uid).orderBy("timestamp", "desc").limit(5).get()
  .then((querySnapshot) => {
      if (querySnapshot.empty) { historyList.innerHTML = `<p class="text-slate-400 text-sm text-center italic">No meals scanned yet.</p>`; return; }
      let html = `<div class="space-y-3">`;
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const date = data.timestamp ? data.timestamp.toDate() : new Date();
        html += `<div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div class="flex items-center gap-3">
                        <div class="bg-green-100 text-green-600 p-2 rounded-full">${data.meal === "Lunch" ? "☀️" : "🌙"}</div>
                        <div><p class="font-bold text-slate-700">${data.meal}</p><p class="text-xs text-slate-500">${date.toLocaleDateString()}</p></div>
                    </div>
                    <div class="text-right"><span class="block text-xs text-green-600">Verified</span></div>
                </div>`;
      });
      historyList.innerHTML = html + `</div>`;
  });
}

function leaveMess() {
    if(!confirm("Leave Mess?")) return;
    db.collection("users").doc(Auth.state.user.uid).update({ currentMessId: null })
    .then(() => location.reload());
}

// --- PAGE: OWNER DASHBOARD ---

// Global State for Owner Dashboard
let globalOwnerMembers = [];
let currentStatsDate = ""; // YYYY-MM-DD
let globalStatsMenu = null; // Menu object for the specific currentStatsDate

function initOwnerDashboard(owner) {
    console.log("initOwnerDashboard called for:", owner.canteenName);
    currentMenuOwner = owner; // CRITICAL FIX: Ensure global is set
    
    // 1. Live Feed
    loadLiveFeed();
    
    // 2. Init Menu Management
    initMenuManagement(owner);
    
    // 3. Set Header Name
    const headerName = document.getElementById("header-canteen-name");
    if(headerName) headerName.innerText = owner.canteenName || "My Mess";

    // 4. Start Member Listener
    const membersLoading = document.getElementById("member-list-container");
    if(membersLoading) membersLoading.innerHTML = "<p class='text-center text-slate-400 py-8'>Loading members...</p>";

    // Filter only by MESS ID (avoid composite index issues)
    db.collection("users").where("currentMessId", "==", owner.uid).onSnapshot(snapshot => {
         globalOwnerMembers = [];
         snapshot.forEach(doc => {
             const data = doc.data();
             // DEBUG: Log found user
             console.log(`Found User: ${data.name || data.email} (Role: ${data.role})`);
             
             // Relaxed check: If role is member OR missing (assume member if linked)
             if(!data.role || data.role === 'member') {
                 globalOwnerMembers.push(data);
             } else {
                 console.log(`Skipped non-member: ${data.role}`);
             }
         });
         console.log("Member Snapshot: Loaded", globalOwnerMembers.length, "members");
         
         if(globalOwnerMembers.length === 0) {
             if(membersLoading) membersLoading.innerHTML = "<p class='text-center text-slate-400 py-8'>No members found linked to this mess.</p>";
         }
         if(currentStatsDate) {
             recalculateOwnerStats();
         } else {
             setStatsDate('today');
         }
    }, err => {
        console.error("Member listener error:", err);
        if(membersLoading) membersLoading.innerHTML = "<p class='text-center text-red-400 py-8'>Error loading members.</p>";
    });

    // Initialize Mobile View if needed
    if(window.innerWidth < 768) {
        switchOwnerTab('stats');
    }
}

// --- DATE SELECTION LOGIC ---

function setStatsDate(mode) {
    const d = new Date();
    if(mode === 'tomorrow') {
        d.setDate(d.getDate() + 1);
    }
    const dateStr = d.toISOString().split('T')[0];
    onStatsDateChange(dateStr);
}

function onStatsDateChange(dateStr) {
    if(!dateStr) return;
    currentStatsDate = dateStr;
    
    // 1. Update Date Picker UI
    const picker = document.getElementById("stats-date-picker");
    if(picker) picker.value = dateStr;
    
    // 2. Update Display Text
    const dateObj = new Date(dateStr);
    const options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
    const label = document.getElementById("stats-current-date-display");
    if(label) label.innerText = dateObj.toLocaleDateString('default', options);
    
    // 3. Update Buttons State
    const todayStr = getLocalDate();
    const d = new Date(); d.setDate(d.getDate() + 1);
    const tmrwStr = d.toISOString().split('T')[0];
    
    const btnToday = document.getElementById("btn-stats-today");
    const btnTmrw = document.getElementById("btn-stats-tmrw");
    
    const setActive = (btn, yes) => {
        if(!btn) return;
        if(yes) {
            btn.classList.add("bg-orange-100", "text-orange-700", "border-orange-200");
            btn.classList.remove("bg-white", "text-slate-800", "text-slate-500", "border-slate-200");
        } else {
             btn.classList.remove("bg-orange-100", "text-orange-700", "border-orange-200");
             btn.classList.add("bg-white", "text-slate-500", "border-slate-200");
        }
    }
    
    setActive(btnToday, dateStr === todayStr);
    setActive(btnTmrw, dateStr === tmrwStr);
    
    // 4. Fetch Menu & Recalc
    loadStatsForDate(dateStr);
}

function loadStatsForDate(dateStr) {
    if(!currentMenuOwner) {
        console.error("loadStatsForDate: No currentMenuOwner set!");
        return;
    }
    
    const docId = `${currentMenuOwner.uid}_${dateStr}`;
    console.log("Fetching Stats Menu for:", docId);
    
    db.collection("dailyMenus").doc(docId).get().then(doc => {
        globalStatsMenu = doc.exists ? doc.data() : null;
        recalculateOwnerStats();
    }).catch(err => {
        console.error("Error fetching stats menu:", err);
        globalStatsMenu = null;
        recalculateOwnerStats();
    });
}

function recalculateOwnerStats() {
    if(!currentStatsDate || !currentMenuOwner) return;
    
    const owner = currentMenuOwner;
    const members = globalOwnerMembers || [];
    const dailyMenu = globalStatsMenu; // The menu for currentStatsDate
    
    const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    
    // Default Menu Logic
    const d = new Date(currentStatsDate);
    let dayIndex = d.getDay() - 1; if(dayIndex === -1) dayIndex = 6;
    const dayName = DAYS[dayIndex];
    const defMenu = (owner.weeklyMenu && owner.weeklyMenu[dayName]) || { lunch: "Veg", dinner: "Veg" };
    const defLunch = defMenu.lunch || "Veg";
    const defDinner = defMenu.dinner || "Veg";
    
    // Helper: Effective Meal
    const getEffectiveMeal = (prefType, mealKey, menu, defaultType) => {
        // 1. Owner Override: OFF
        if(menu && menu[mealKey] && menu[mealKey].off && menu[mealKey].off.available) return "Off";
        
        // 2. User User Override
        if(prefType === "Off") return "Off";
        if(prefType === "Fast") return "Fast";
        
        // 3. Availability
        if(menu && menu[mealKey]) {
            if(prefType === "NonVeg" && !menu[mealKey].nonveg.available) return "Veg";
        }
        
        return prefType || defaultType;
    };
    
    // Calculate Counts
    let counts = { Veg: { L: 0, D: 0 }, NonVeg: { L: 0, D: 0 }, Fast: { L: 0, D: 0 }, Off: { L: 0, D: 0 } };
    
    members.forEach(m => {
        let pref = m.futurePreferences ? m.futurePreferences[currentStatsDate] : null;
        if (typeof pref === 'string') pref = { lunch: pref, dinner: pref };
        pref = pref || {};
        
        // Holiday Check
        if (m.holidays && m.holidays.includes(currentStatsDate)) {
             counts.Off.L++; counts.Off.D++;
             m._effectiveL = "Off"; m._effectiveD = "Off";
             return;
        }
        
        const l = getEffectiveMeal(pref.lunch, 'lunch', dailyMenu, defLunch);
        const d = getEffectiveMeal(pref.dinner, 'dinner', dailyMenu, defDinner);
        
        m._effectiveL = l; 
        m._effectiveD = d;
        
        if(counts[l]) counts[l].L++; else counts.Veg.L++;
        if(counts[d]) counts[d].D++; else counts.Veg.D++;
    });
    
    const lunchExpected = members.length - counts.Off.L;
    const dinnerExpected = members.length - counts.Off.D;
    
    // Update UI Elements
    
    // Expecting
    const setTxt = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
    setTxt("stat-expected-lunch", lunchExpected);
    setTxt("stat-expected-dinner", dinnerExpected);
    
    // Detailed Counts
    setTxt("count-veg-l", counts.Veg.L); setTxt("count-veg-d", counts.Veg.D);
    setTxt("count-nonveg-l", counts.NonVeg.L); setTxt("count-nonveg-d", counts.NonVeg.D);
    setTxt("count-fast-l", counts.Fast.L); setTxt("count-fast-d", counts.Fast.D);
    setTxt("count-off-l", counts.Off.L); setTxt("count-off-d", counts.Off.D);
    
    // Headers
    // (We removed the "Expecting Today" label text dynamic update since the date is now top-level)
    const lblExp = document.getElementById("label-expecting");
    if(lblExp) lblExp.innerText = "Expecting"; // Static label is fine now
    
    // Render Member List
    renderMemberList(members, currentStatsDate);
}

// (Original renderOwnerStats is deleted as logic is moved to recalc)
function renderOwnerStats() {
    // Legacy Stub if called elsewhere, but we replaced calls in init
}

// --- MEMBER MANAGEMENT ---

function promptAddMember() {
    if(!currentMenuOwner) return;
    
    const phone = prompt("Enter Member's Phone Number (with +91):", "+91");
    if(!phone || phone.length < 10) return;
    
    const loading = document.getElementById("member-list-container");
    // Show temp loading
    
    // Search for user by phone
    db.collection("users").where("phone", "==", phone).get()
    .then(snap => {
        if(snap.empty) {
            alert("❌ User not found with this phone number.\nAsk them to sign up first.");
            return;
        }
        
        let memberDoc = null;
        snap.forEach(d => memberDoc = d); // Get first match
        
        if(memberDoc) {
            const memData = memberDoc.data();
            if(memData.currentMessId === currentMenuOwner.uid) {
                alert("⚠️ This user is already added to your mess.");
                return;
            }
            
            // LINK THEM
            db.collection("users").doc(memberDoc.id).update({
                currentMessId: currentMenuOwner.uid,
                role: "member" // Ensure role is set
            }).then(() => {
                alert(`✅ Automatically linked ${memData.name} to your mess!`);
                // The listener will auto-update the UI
            });
        }
    })
    .catch(err => {
        console.error(err);
        alert("Error searching for user: " + err.message);
    });
}

let currentStatsMode = 'today'; // 'today' or 'tomorrow'

function setStatsMode(mode) {
    currentStatsMode = mode;
    renderOwnerStats();
}

function renderOwnerStats() {
    if(!window.ownerStats) return;
    
    const data = window.ownerStats[currentStatsMode];
    if(!data) return;
    
    const labelSuffix = currentStatsMode === 'today' ? "Today" : "Tomorrow";
    
    // 1. Update Buttons
    const btnToday = document.getElementById("btn-mode-today");
    const btnTmrw = document.getElementById("btn-mode-tomorrow");
    
    if(currentStatsMode === 'today') {
        btnToday.classList.remove("text-slate-500", "bg-transparent");
        btnToday.classList.add("bg-white", "text-slate-800", "shadow-sm");
        
        btnTmrw.classList.add("text-slate-500", "bg-transparent");
        btnTmrw.classList.remove("bg-white", "text-slate-800", "shadow-sm");
    } else {
        btnTmrw.classList.remove("text-slate-500", "bg-transparent");
        btnTmrw.classList.add("bg-white", "text-slate-800", "shadow-sm");
        
        btnToday.classList.add("text-slate-500", "bg-transparent");
        btnToday.classList.remove("bg-white", "text-slate-800", "shadow-sm");
    }
    
    // 2. Update Titles
    if(document.getElementById("label-expecting")) document.getElementById("label-expecting").innerText = `Expecting ${labelSuffix}`;
    if(document.getElementById("label-preferences")) document.getElementById("label-preferences").innerText = `🍽️ Meal Preferences (${labelSuffix})`;
    if(document.getElementById("label-leave-title")) document.getElementById("label-leave-title").innerText = `On Leave (${labelSuffix})`;
    
    // 3. Update Expecting
    if(document.getElementById("stat-expected-lunch")) document.getElementById("stat-expected-lunch").innerText = data.expected.L;
    if(document.getElementById("stat-expected-dinner")) document.getElementById("stat-expected-dinner").innerText = data.expected.D;
    
    // 4. Update Detailed Counts
    const c = data.counts;
    const set = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
    
    set("count-veg-l", c.Veg.L); set("count-veg-d", c.Veg.D);
    set("count-nonveg-l", c.NonVeg.L); set("count-nonveg-d", c.NonVeg.D);
    set("count-fast-l", c.Fast.L); set("count-fast-d", c.Fast.D);
    set("count-off-l", c.Off.L); set("count-off-d", c.Off.D);
    
    // 5. Update Leave Total
    if(document.getElementById("stat-leave")) document.getElementById("stat-leave").innerText = data.leave;
}

function renderMemberList(members, today) {
    const container = document.getElementById("member-list-container");
    if(!container) return;
    if(members.length === 0) { container.innerHTML = `<p class="p-4 text-center text-slate-400">No members.</p>`; return; }
    
    container.innerHTML = `
        <table class="w-full text-sm text-left">
             <thead class="text-xs text-slate-400 uppercase bg-slate-50 border-b border-slate-100">
                <tr>
                    <th class="px-6 py-3">Member</th>
                    <th class="px-6 py-3 text-center">Days Attended</th>
                    <th class="px-6 py-3 text-right">Today (L / D)</th>
                </tr>
             </thead>
             <tbody class="divide-y divide-slate-100">
                ${members.map(m => {
                    // Start with calculated effective types if available, else fallback
                    let lType = m._effectiveL || "Veg";
                    let dType = m._effectiveD || "Veg";
                    
                    const getBadge = (t) => {
                        if(t === "Veg") return `<span class="text-green-600 font-bold text-xs bg-green-50 px-1 rounded">V</span>`;
                        if(t === "NonVeg") return `<span class="text-red-600 font-bold text-xs bg-red-50 px-1 rounded">NV</span>`;
                        if(t === "Fast") return `<span class="text-yellow-600 font-bold text-xs bg-yellow-50 px-1 rounded">F</span>`;
                        if(t === "Off") return `<span class="text-slate-400 font-bold text-xs bg-slate-100 px-1 rounded line-through">Off</span>`;
                        return t;
                    }

                    return `
                    <tr class="hover:bg-slate-50">
                        <td class="px-6 py-4 font-medium">
                            <div class="text-slate-800 font-bold">${m.name}</div>
                            <div class="text-xs text-slate-400">${m.location || 'Unknown'}</div>
                        </td>
                        <td class="px-6 py-4 text-center">
                            <span class="bg-blue-100 text-blue-700 py-1 px-3 rounded-full font-bold text-xs">${m.attendanceCount || 0}</span>
                        </td>
                        <td class="px-6 py-4 text-right">
                           <div class="flex justify-end gap-2">
                                ${getBadge(lType)}
                                <span class="text-slate-300">|</span>
                                ${getBadge(dType)}
                           </div>
                        </td>
                    </tr>
                `}).join("")}
            </tbody>
        </table>
    `;
}

function loadLiveFeed() {
    const feed = document.getElementById("live-feed-container");
    if(!feed) return;
    const todayStr = getLocalDate();
    
    db.collection("attendance").where("date", "==", todayStr).orderBy("timestamp", "desc").limit(10).onSnapshot(snapshot => {
        if(snapshot.empty) { feed.innerHTML = `<p class="text-slate-400 text-sm text-center">No scans today.</p>`; return; }
        feed.innerHTML = snapshot.docs.map(doc => {
            const d = doc.data();
            const time = d.timestamp ? d.timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "";
            return `<div class="flex justify-between items-center p-3 hover:bg-slate-50 rounded border-b border-slate-50 last:border-0">
                <div>
                    <span class="block font-bold text-sm text-slate-700">${d.name}</span>
                    <span class="text-xs text-slate-400">${d.meal}</span>
                </div>
                <span class="text-xs font-mono text-slate-400">${time}</span>
            </div>`;
        }).join("");
    }, error => {
        console.error("Live Feed Error:", error);
        if(error.code === 'failed-precondition') {
             feed.innerHTML = `<p class="text-red-500 text-xs text-center p-2">⚠️ Missing Index. Check Console.</p>`;
        } else {
             feed.innerHTML = `<p class="text-red-500 text-xs text-center p-2">Error loading feed.</p>`;
        }
    });
}

// Scanner Logic (Global)
let html5QrCode;
let currentCameraId = null;
let cameras = [];
let isScanning = false;

function startScanner() {
  document.getElementById("scanner-modal").classList.remove("hidden");
  
  // AGGRESSIVE CLEANUP: Stop any existing instance first
  const startLogic = () => {
       if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");
  
      Html5Qrcode.getCameras().then(devices => {
          if (devices && devices.length) {
              cameras = devices;
              if(!currentCameraId) currentCameraId = devices[devices.length-1].id;
              runCamera(currentCameraId);
          } else {
              alert("No camera found");
              document.getElementById("scanner-modal").classList.add("hidden");
          }
      }).catch(err => {
          console.error("Error getting cameras", err);
          alert("Error accessing camera: " + err);
          document.getElementById("scanner-modal").classList.add("hidden");
      });
  };

  if(html5QrCode && (html5QrCode.isScanning || isScanning)) {
      console.log("Cleanup existing scanner...");
      stopScanner().then(() => {
          // Small delay to ensure resource release
          setTimeout(startLogic, 300); 
      });
  } else {
      startLogic();
  }
}

function runCamera(id) {
    if(isScanning) return; // Prevent double start
    isScanning = true;
    
    html5QrCode.start(id, { fps: 10, qrbox: 250 }, (decoded) => {
        // SUCCESS
        stopScanner().then(() => {
             handleScan(decoded);
        });
    }).catch(err => {
        isScanning = false;
        console.error("Start Error:", err);
        // If NotReadableError, maybe retrying or showing specific message?
        if(err.name === "NotReadableError") {
             alert("Camera is busy or not accessible. Please ensure no other app is using it and try again.");
             stopScanner();
        } else {
             alert("Camera Start Failed: " + err);
             stopScanner();
        }
    });
}

function switchCamera() {
    if(!cameras || cameras.length < 2) {
        alert("Only one camera available.");
        return;
    }
    
    // Find next camera
    const idx = cameras.findIndex(c => c.id === currentCameraId);
    const nextIdx = (idx + 1) % cameras.length;
    currentCameraId = cameras[nextIdx].id;
    
    // Stop and Restart
    if(html5QrCode && isScanning) {
        html5QrCode.stop().then(() => {
            isScanning = false;
            runCamera(currentCameraId);
        }).catch(err => {
            console.error("Stop error during switch:", err);
            isScanning = false;
            // Try to force start anyway?
            runCamera(currentCameraId);
        });
    } else {
        runCamera(currentCameraId);
    }
}

function stopScanner() {
    const modal = document.getElementById("scanner-modal");
    if(modal) modal.classList.add("hidden");
    
    return new Promise((resolve) => {
        if(html5QrCode && isScanning) {
            html5QrCode.stop().then(() => {
                html5QrCode.clear();
                isScanning = false;
                resolve();
            }).catch(err => {
                console.error("Stop Error:", err);
                isScanning = false; // Force reset state
                resolve();
            });
        } else {
            resolve();
        }
    });
}

function handleScan(uid) {
    const now = new Date();
    const hour = now.getHours();
    
    // --- MEAL LOGIC ---
    // Relaxed timings for demo/testing purposes
    // You can tighten these later: Lunch (12-15), Dinner (19-22)
    let meal = "Unknown";
    if (hour >= 11 && hour < 16) meal = "Lunch"; 
    else if (hour >= 18 && hour < 23) meal = "Dinner";
    else { 
        // Allow Override for Demo
        if(confirm(`⚠️ It is ${hour}:00. Strictly speaking, it's not meal time.\n\nMark as LUNCH? (Cancel for Dinner)`)) {
            meal = "Lunch";
        } else {
            meal = "Dinner";
        }
    }
    
    const today = getLocalDate();

    db.collection("users").doc(uid).get().then(doc => {
        if(!doc.exists) { alert("Invalid Member QR"); return; }
        const member = doc.data();
        
        // 1. Check Subscription
        if(member.currentMessId !== Auth.state.user.uid) { 
            alert(`❌ ACCESS DENIED\n\n${member.name} is not a member of your mess.`); 
            return; 
        }
        
         // 2. Check Leave
        let pref = member.futurePreferences ? member.futurePreferences[today] : null;
        
        // Legacy Support
        if (typeof pref === 'string') pref = { lunch: pref, dinner: pref };
        pref = pref || {};

        const mealPref = pref[meal.toLowerCase()]; // 'lunch' or 'dinner'
        const isOff = mealPref === "Off" || (member.holidays && member.holidays.includes(today));
        
        if(isOff) { 
            if(!confirm(`⚠️ WARNING: ${member.name} is marked as ON LEAVE for ${meal.toUpperCase()}.\n\nAllow entry anyway?`)) return; 
        }
        
        // 3. Mark Attendance
        const attId = `${uid}_${today}_${meal}`;
        
        db.collection("attendance").doc(attId).get().then(att => {
            if(att.exists) {
                alert(`🛑 ALREADY SCANNED\n\n${member.name} has already eaten ${meal} today.`);
            } else {
                // Atomic: Create Attendance + Increment Counter
                const batch = db.batch();
                
                const attRef = db.collection("attendance").doc(attId);
                batch.set(attRef, {
                    uid, 
                    name: member.name, 
                    meal, 
                    date: today, 
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(), 
                    status: "Present"
                });
                
                const userRef = db.collection("users").doc(uid);
                batch.update(userRef, {
                    attendanceCount: firebase.firestore.FieldValue.increment(1)
                });
                
                batch.commit().then(() => {
                    // Success UI
                    alert(`✅ APPROVED: ${member.name}\nMeal: ${meal}\nTotal Visits: ${(member.attendanceCount || 0) + 1}`);
                }).catch(e => alert("Error saving: " + e));
            }
        });
    });
}

function downloadReport() {
    // Basic Excel Download
    db.collection("attendance").orderBy("timestamp", "desc").get().then((snap) => {
        if(snap.empty) { alert("No data"); return; }
        const data = snap.docs.map(d => {
            const v = d.data();
            return {
                Date: v.date,
                Time: v.timestamp?.toDate().toLocaleTimeString(),
                Name: v.name,
                Meal: v.meal,
                Status: v.status
            };
        });
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Attendance");
        XLSX.writeFile(wb, "MessOverview.xlsx");
    });
}


// 4. AUTO-START (MUST BE AT THE END)
document.addEventListener("DOMContentLoaded", () => {
    if(Auth && Auth.initRouter) Auth.initRouter();
});

// --- MENU MANAGEMENT (UNIFIED VIEW) ---
let currentMenuOwner = null;
let menuViewMode = 'week'; // 'week' or 'month'
let menuRefDate = new Date(); // Anchor date (start of week OR current month)

function initMenuManagement(owner) {
    currentMenuOwner = owner;
    menuViewMode = 'week';
    menuRefDate = new Date(); // Start with today
    // Align ref date to start of week if in week mode
    const day = menuRefDate.getDay();
    menuRefDate.setDate(menuRefDate.getDate() - day);
    
    renderMenuView();
}

function setMenuView(mode) {
    menuViewMode = mode;
    
    // Update Toggle UI
    const btnWeek = document.getElementById("btn-view-week");
    const btnMonth = document.getElementById("btn-view-month");
    
    if(mode === 'week') {
        btnWeek.classList.remove("text-slate-500", "hover:text-slate-700");
        btnWeek.classList.add("bg-white", "text-slate-800", "shadow-sm");
        
        btnMonth.classList.add("text-slate-500", "hover:text-slate-700");
        btnMonth.classList.remove("bg-white", "text-slate-800", "shadow-sm");
        
        // Reset Ref to current week
        const today = new Date();
        const day = today.getDay();
        menuRefDate = new Date(today);
        menuRefDate.setDate(today.getDate() - day);
        
        // Scroll Container: Remove Height constraint
        document.getElementById("menu-view-scroll-container").style.maxHeight = '';
    } else {
        btnMonth.classList.remove("text-slate-500", "hover:text-slate-700");
        btnMonth.classList.add("bg-white", "text-slate-800", "shadow-sm");
        
        btnWeek.classList.add("text-slate-500", "hover:text-slate-700");
        btnWeek.classList.remove("bg-white", "text-slate-800", "shadow-sm");
        
        // Reset Ref to current month (1st)
        const today = new Date();
        menuRefDate = new Date(today.getFullYear(), today.getMonth(), 1);

        // Scroll Container: Add Height constraint (e.g. 400px or so)
        document.getElementById("menu-view-scroll-container").style.maxHeight = '400px';
    }
    
    renderMenuView();
}

function changeMenuRange(delta) {
    if (menuViewMode === 'week') {
        // Shift by 7 days
        menuRefDate.setDate(menuRefDate.getDate() + (delta * 7));
    } else {
        // Shift by 1 month
        menuRefDate.setMonth(menuRefDate.getMonth() + delta);
    }
    renderMenuView();
}

function getMenuDatesAndLabel() {
    const datesToRender = [];
    let rangeLabel = "";
    
    if (menuViewMode === 'week') {
        const start = new Date(menuRefDate);
        const end = new Date(menuRefDate);
        end.setDate(end.getDate() + 6);
        
        const f = (d) => `${d.getDate()} ${d.toLocaleString('default', {month:'short'})}`;
        rangeLabel = `${f(start)} - ${f(end)}`;
        
        for(let i=0; i<7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            datesToRender.push(d);
        }
    } else {
        const year = menuRefDate.getFullYear();
        const month = menuRefDate.getMonth();
        const monthName = menuRefDate.toLocaleString('default', {month:'long'});
        rangeLabel = `${monthName} ${year}`;
        
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for(let i=1; i<=daysInMonth; i++) {
            datesToRender.push(new Date(year, month, i));
        }
    }
    return { dates: datesToRender, label: rangeLabel };
}

function renderMenuTable(datesToRender, dataMap) {
    const container = document.getElementById("weekly-menu-container");
    if(!container) return;

    let html = `
    <table class="w-full text-sm text-left border-collapse min-w-[350px]">
        <thead class="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
            <tr>
                <th class="px-4 py-3 w-1/4 bg-slate-50">Day</th>
                <th class="px-4 py-3 w-1/3 text-center border-l border-slate-100 bg-slate-50">☀️ Lunch</th>
                <th class="px-4 py-3 w-1/3 text-center border-l border-slate-100 bg-slate-50">🌙 Dinner</th>
            </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
    `;
    
    datesToRender.forEach(d => {
            const dateStr = d.toISOString().split('T')[0];
            const dayLabel = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
            let override = dataMap[dateStr];
            
            // Helper to get badges
            const getBadges = (mealType) => {
                let v=true, n=false, f=false, o=false;
                if(override) {
                    if(override[mealType] && override[mealType].veg) {
                        v = override[mealType].veg.available;
                        n = override[mealType].nonveg.available;
                        f = override[mealType].fast.available;
                        o = override[mealType].off ? override[mealType].off.available : false;
                    } else if(override[mealType] && override[mealType].type) {
                        // Fallback
                        const t = override[mealType].type;
                        if(t==="NonVeg") { v=true; n=true; }
                        else if(t==="Fast") { v=true; f=true; } 
                        else if(t==="Off") { v=false; o=true; }
                    }
                }
                
                let badges = [];
                if(o) badges.push(`<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 line-through">Off</span>`);
                else {
                    if(v) badges.push(`<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700">Veg</span>`);
                    if(n) badges.push(`<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">NV</span>`);
                    if(f) badges.push(`<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-700">Fast</span>`);
                }
                
                if(badges.length === 0) return `<span class="text-slate-300">-</span>`;
                return `<div class="flex flex-wrap gap-1 justify-center">${badges.join('')}</div>`;
            };
            
        const isToday = dateStr === getLocalDate();
        const rowClass = isToday ? "bg-orange-50/30" : "hover:bg-slate-50";
        
        html += `
        <tr class="${rowClass} transition-colors">
            <td class="px-4 py-3 font-medium text-slate-700">
                ${dayLabel} <span class="text-xs font-normal text-slate-400 ml-1">${d.getDate()}</span>
            </td>
            
            <td class="px-2 py-3 text-center border-l border-slate-100 cursor-pointer hover:bg-slate-100" onclick="openQuickEdit('${dateStr}', 'lunch', event)">
                ${getBadges('lunch')}
            </td>
            
            <td class="px-2 py-3 text-center border-l border-slate-100 cursor-pointer hover:bg-slate-100" onclick="openQuickEdit('${dateStr}', 'dinner', event)">
                ${getBadges('dinner')}
            </td>
        </tr>
        `;
    });
    
    html += `</tbody></table>`;
    container.innerHTML = html;
}

function renderMenuView(skipFetch = false) {
    const container = document.getElementById("weekly-menu-container");
    const label = document.getElementById("menu-range-label");
    if(!container || !currentMenuOwner) return;

    const { dates, label: rangeLabel } = getMenuDatesAndLabel();
    if(label) label.innerText = rangeLabel;

    if(skipFetch) {
        // Optimistic Render
        if(!window.currentWeekOverrides) window.currentWeekOverrides = {};
        renderMenuTable(dates, window.currentWeekOverrides);
        return;
    }
    
    container.innerHTML = "<p class='text-center text-slate-400 py-4'>Loading...</p>";
    
    // Fetch Data
    const requests = dates.map(d => {
        const dateStr = d.toISOString().split('T')[0];
        const docId = `${currentMenuOwner.uid}_${dateStr}`;
        return db.collection("dailyMenus").doc(docId).get();
    });
    
    Promise.all(requests).then(snapshots => {
        const dataMap = {};
        snapshots.forEach(doc => {
            if(doc.exists) dataMap[doc.data().date] = doc.data();
        });
        window.currentWeekOverrides = dataMap; // Store for Quick Edit usage
        
        renderMenuTable(dates, dataMap);
        
    }).catch(err => {
        console.error(err);
        container.innerHTML = "<p class='text-center text-red-500 py-4'>Error loading menu</p>";
    });
}

function openQuickEdit(dateStr, mealType, event) {
    // 1. Position Popover
    const popover = document.getElementById("quick-edit-popover");
    const rect = event.target.getBoundingClientRect(); // Cell rect
    // Simple positioning: centered below the cell
    // Ideally use Popper.js, but minimal math works
    // Handle mobile overflow?
    
    // Using fixed positioning relative to viewport for simplicity if parent is body?
    // Popover is absolute. Let's make it fixed? Or check parent.
    // HTML says "absolute". If inside a relative container...
    // Let's change popover to fixed in JS or assume absolute to body
    
    // Better: Position near mouse click or element center
    // Let's use fixed to be safe against scroll
    popover.style.position = 'fixed';
    popover.style.top = (rect.bottom + 5) + 'px';
    popover.style.left = (rect.left + (rect.width/2) - 96) + 'px'; // Center 192px/2
    
    popover.classList.remove("hidden");
    
    // 2. Set Title
    document.getElementById("quick-edit-title").innerText = `Edit ${mealType} (${dateStr})`;
    
    // 3. Populate Data
    currentQuickEdit = { date: dateStr, meal: mealType };
    
    let override = window.currentWeekOverrides[dateStr];
    let v=true, n=false, f=false, o=false;
    
    if(override && override[mealType] && override[mealType].veg) {
         v = override[mealType].veg.available;
         n = override[mealType].nonveg.available;
         f = override[mealType].fast.available;
         o = override[mealType].off ? override[mealType].off.available : false;
    }
    
    document.getElementById("qe-veg").checked = v;
    document.getElementById("qe-nonveg").checked = n;
    document.getElementById("qe-fast").checked = f;
    const offEl = document.getElementById("qe-off");
    if(offEl) offEl.checked = o;
}

function closeQuickEdit() {
    document.getElementById("quick-edit-popover").classList.add("hidden");
    currentQuickEdit = null;
}

function saveQuickEdit() {
    if(!currentQuickEdit || !currentMenuOwner) return;
    
    const { date, meal } = currentQuickEdit;
    
    // Check Inputs
    const v = document.getElementById("qe-veg").checked;
    const n = document.getElementById("qe-nonveg").checked;
    const f = document.getElementById("qe-fast").checked;
    const offEl = document.getElementById("qe-off");
    const o = offEl ? offEl.checked : false;
    
    // We need to merge this with existing override or create new
    if(!window.currentWeekOverrides) window.currentWeekOverrides = {};
    let data = window.currentWeekOverrides[date] || {
        date: date,
        uid: currentMenuOwner.uid,
        lunch: { veg:{available:true}, nonveg:{available:false}, fast:{available:false}, off:{available:false} },
        dinner: { veg:{available:true}, nonveg:{available:false}, fast:{available:false}, off:{available:false} }
    };
    
    // Ensure structure exists
    if(!data.lunch) data.lunch = { veg:{available:true}, nonveg:{available:false}, fast:{available:false}, off:{available:false} };
    if(!data.dinner) data.dinner = { veg:{available:true}, nonveg:{available:false}, fast:{available:false}, off:{available:false} };
    
    // Update Specific Meal
    data[meal] = {
        veg: { available: v, items: [] },
        nonveg: { available: n, items: [] },
        fast: { available: f, items: [] },
        off: { available: o, items: [] } 
    };
    
    // --- OPTIMISTIC UPDATE ---
    // 1. Update Local State
    window.currentWeekOverrides[date] = data;
    
    // 2. Update UI Immediately
    closeQuickEdit();
    renderMenuView(true); // <--- TRUE to skip fetch
    
    // 3. Database Update (Background)
    const docId = `${currentMenuOwner.uid}_${date}`;
    db.collection("dailyMenus").doc(docId).set(data)
    .then(() => {
        // Silent success or small toast
        // showToast("Saved!"); 
    })
    .catch(e => {
         console.error(e);
         alert("Error saving: " + e);
         // Optionally revert UI here
    });
}

function saveDailyOverride() {
    const dateVal = document.getElementById("editor-date-val").value;
    const docId = `${currentMenuOwner.uid}_${dateVal}`;
    
    // Read State UI
    const getVal = (m, t) => {
        const el = document.getElementById(`chk-${m}-${t}`);
        return el ? el.classList.contains('bg-orange-500') : false;
    };
    
    const data = {
        date: dateVal,
        uid: currentMenuOwner.uid,
        lunch: {
            veg: { available: getVal('lunch','veg'), items: [] },
            nonveg: { available: getVal('lunch','nonveg'), items: [] },
            fast: { available: getVal('lunch','fast'), items: [] },
            off: { available: getVal('lunch','off'), items: [] }
        },
        dinner: {
            veg: { available: getVal('dinner','veg'), items: [] },
            nonveg: { available: getVal('dinner','nonveg'), items: [] },
            fast: { available: getVal('dinner','fast'), items: [] },
            off: { available: getVal('dinner','off'), items: [] }
        }
    };
    
    // --- OPTIMISTIC UPDATE ---
    // 1. Update Local State
    if(!window.currentWeekOverrides) window.currentWeekOverrides = {};
    window.currentWeekOverrides[dateVal] = data;
    
    // 2. Update UI Immediately
    showToast("Menu Saved!"); // Show toast immediately
    closeDailyEditor();
    renderMenuView(true); // <--- TRUE to skip fetch
    
    // 3. Database Update (Background)
    db.collection("dailyMenus").doc(docId).set(data)
    .then(() => {
        // Success
    })
    .catch(e => {
        alert("Error: " + e);
        // Revert?
    });
}


// --- UTILS ---
function showToast(msg) {
    // Simple fallback: Alert (or create a toast element if we want to be fancy)
    // For now, let's just use alert or a console log to avoid blocking, 
    // BUT the original code used it. Let's make a simple DOM toast.
    
    let toast = document.getElementById("toast-msg");
    if(!toast) {
        toast = document.createElement("div");
        toast.id = "toast-msg";
        toast.className = "fixed bottom-5 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-full shadow-lg z-[100] transition-opacity duration-300 opacity-0 pointer-events-none";
        document.body.appendChild(toast);
    }
    
    toast.innerText = msg;
    toast.classList.remove("opacity-0", "translate-y-4");
    toast.classList.add("opacity-100", "translate-y-0");
    
    setTimeout(() => {
        toast.classList.remove("opacity-100", "translate-y-0");
        toast.classList.add("opacity-0", "translate-y-4");
    }, 3000);
}

// --- SECURITY: Block Developer Tools ---
document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
});

document.addEventListener('keydown', function(e) {
    // Disable F12
    if (e.keyCode === 123) {
        e.preventDefault();
    }
    // Disable Ctrl+Shift+I (Windows) / Cmd+Opt+I (Mac)
    if (e.ctrlKey && e.shiftKey && e.keyCode === 73) {
        e.preventDefault();
    }
    // Disable Ctrl+Shift+J (Windows) / Cmd+Opt+J (Mac)
    if (e.ctrlKey && e.shiftKey && e.keyCode === 74) {
        e.preventDefault();
    }
    // Disable Ctrl+U (View Source)
    if (e.ctrlKey && e.keyCode === 85) {
        e.preventDefault();
    }
    // Disable Ctrl+Shift+C (Inspect Element)
    if (e.ctrlKey && e.shiftKey && e.keyCode === 67) {
        e.preventDefault();
    }
});

// --- PWA: Service Worker Registration & Installation ---
let deferredPrompt;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
});

function installApp() {
  if (deferredPrompt) {
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      deferredPrompt = null;
    });
  } else {
    alert("To install the app, click the 'Share' or 'Menu' (three dots) button in your browser and select 'Add to Home Screen' or 'Install App'. Note: You may need to access this site using HTTPS.");
  }
}

