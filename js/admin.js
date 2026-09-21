const firebaseConfig = window.firebaseConfig;
const db = window.db;
const auth = window.auth;

function adminGoogleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => Swal.fire('Failed', err.message, 'error'));
}

function adminLogin() {
    const email = document.getElementById('admin-email').value;
    const pass = document.getElementById('admin-pass').value;
    if(!email || !pass) return Swal.fire('Error', 'Empty Credentials', 'warning');
    auth.signInWithEmailAndPassword(email, pass).catch(err => Swal.fire('Failed', err.message, 'error'));
}
const ADMIN_EMAILS = ['sorkarporosh6@gmail.com', 'prachurjosorkarporosh@gmail.com'];

function checkAdminAccess(user) {
    if (!user) return false;
    const email = (user.email || '').toLowerCase().trim();
    return ADMIN_EMAILS.includes(email);
}

auth.onAuthStateChanged(user => {
    if(user) {
        const isEmailAdmin = checkAdminAccess(user);
        
        // If email matches hardcoded admin emails, grant immediate access and sync doc
        if(isEmailAdmin) {
            document.getElementById('login-sec').classList.add('hidden');
            document.getElementById('admin-panel').classList.remove('hidden');
            
            // Ensure document exists in admins collection for security rules
            db.collection("admins").doc(user.uid).set({
                email: user.email,
                role: 'admin',
                grantedAt: new Date()
            }, { merge: true }).catch(e => console.log('Admin registration sync:', e));

            loadAllData();
            return;
        }

        // Otherwise check admins collection
        db.collection("admins").doc(user.uid).get().then(doc => {
            if(doc.exists) {
                document.getElementById('login-sec').classList.add('hidden');
                document.getElementById('admin-panel').classList.remove('hidden');
                loadAllData();
            } else {
                cleanupListeners();
                auth.signOut().then(() => {
                    Swal.fire({
                        icon: 'error',
                        title: 'Access Denied',
                        text: 'This account (' + user.email + ') does not have admin permissions.'
                    });
                });
            }
        }).catch(err => {
            console.error('Admin check error:', err);
            cleanupListeners();
            auth.signOut().then(() => {
                Swal.fire('Error', 'Unauthorized admin account or permission issue', 'error');
            });
        });
    } else {
        cleanupListeners();
        document.getElementById('login-sec').classList.remove('hidden');
        document.getElementById('admin-panel').classList.add('hidden');
    }
});
function logout() { 
    cleanupListeners();
    auth.signOut().then(() => location.reload()); 
}

function nav(tabName) {
    if(tabName !== 'games') closeProductManager();
    ['deposits', 'user-orders', 'users', 'games', 'banners', 'tutorials', 'settings'].forEach(t => {
        document.getElementById('view-' + t).classList.add('hidden');
        const btn = document.getElementById('btn-' + t);
        if(btn) { btn.classList.remove('nav-active', 'text-pink-600'); btn.classList.add('text-gray-400'); }
    });
    document.getElementById('view-' + tabName).classList.remove('hidden');
    const activeBtn = document.getElementById('btn-' + tabName);
    activeBtn.classList.add('nav-active', 'text-pink-600');
    activeBtn.classList.remove('text-gray-400');
    activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

// Track listeners to unsubscribe when logged out or re-authenticating
const activeUnsubscribers = [];
function cleanupListeners() {
    while (activeUnsubscribers.length > 0) {
        try {
            const unsub = activeUnsubscribers.pop();
            if (typeof unsub === 'function') unsub();
        } catch (e) {
            console.warn('Error unsubscribing:', e);
        }
    }
}

function loadAllData() { 
    cleanupListeners();
    fetchDeposits(); 
    fetchUserOrders(); 
    fetchUsers(); 
    fetchGames(); 
    fetchBanners(); 
    fetchTutorials(); 
    fetchSettings(); 
}

// --- DEPOSITS ---
function fetchDeposits() {
    const unsub = db.collection("deposits").where("status", "==", "pending").onSnapshot(snapshot => {
        const list = document.getElementById('deposit-list');
        list.innerHTML = "";
        document.getElementById('count-pending-dep').innerText = snapshot.size;
        if(snapshot.empty) { list.innerHTML = `<div class="text-center py-10 opacity-50"><p>No Requests</p></div>`; return; }
        
        let deps = [];
        snapshot.forEach(doc => deps.push({id: doc.id, ...doc.data()}));
        deps.sort((a,b) => b.date - a.date); 

        deps.forEach(data => {
            list.innerHTML += `
            <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div class="flex justify-between items-start mb-2">
                    <div><p class="text-[10px] font-bold uppercase text-gray-400">${data.method || 'Bkash/Nagad'}</p><h4 class="font-bold text-lg text-gray-800">৳ ${data.amount}</h4></div>
                    <span class="bg-gray-100 px-2 py-1 rounded text-[10px] font-mono font-bold">${data.trxId || data.trx_id}</span>
                </div>
                <p class="text-xs text-gray-500 mb-3">${data.userEmail || data.userId}</p>
                <div class="grid grid-cols-2 gap-3">
                    <button onclick="rejectDeposit('${data.id}')" class="bg-red-50 text-red-500 py-2 rounded-lg text-xs font-bold">REJECT</button>
                    <button onclick="approveDeposit('${data.id}', '${data.userId}', ${data.amount})" class="bg-green-500 text-white py-2 rounded-lg text-xs font-bold shadow-md">APPROVE</button>
                </div>
            </div>`;
        });
    }, err => {
        console.warn("fetchDeposits listener status:", err.message);
        const list = document.getElementById('deposit-list');
        if(list) list.innerHTML = `<div class="text-center py-8 text-xs text-gray-400">Waiting for deposit permissions...</div>`;
    });
    activeUnsubscribers.push(unsub);
}
function approveDeposit(docId, userId, amount) {
    Swal.fire({ title: 'Approve?', text: `Adding ৳${amount}`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes' }).then((res) => {
        if (res.isConfirmed) {
            const userRef = db.collection('users').doc(userId);
            db.runTransaction(async (t) => {
                const doc = await t.get(userRef);
                const newBal = (doc.exists ? doc.data().balance : 0) + parseInt(amount);
                t.update(userRef, { balance: newBal });
                t.update(db.collection('deposits').doc(docId), { status: "approved" });
            }).then(() => Swal.fire('Success', 'Balance Added', 'success'));
        }
    });
}
function rejectDeposit(docId) { if(confirm("Reject this?")) db.collection("deposits").doc(docId).update({ status: "rejected" }); }

// --- ORDERS ---
function fetchUserOrders() {
    const unsub = db.collection("orders").where("status", "==", "pending").onSnapshot(snapshot => {
        const list = document.getElementById('user-orders-list');
        list.innerHTML = "";
        document.getElementById('count-pending-ord').innerText = snapshot.size;

        if(snapshot.empty) { list.innerHTML = `<div class="text-center py-10 opacity-50"><p>No Pending Orders</p></div>`; return; }

        let orders = [];
        snapshot.forEach(doc => orders.push({id: doc.id, ...doc.data()}));
        
        orders.sort((a, b) => {
            let dateA = a.date && a.date.toDate ? a.date.toDate() : new Date(a.date);
            let dateB = b.date && b.date.toDate ? b.date.toDate() : new Date(b.date);
            return dateB - dateA;
        });

        orders.forEach(d => {
            list.innerHTML += `
            <div class="bg-white p-4 rounded-xl shadow-sm border border-l-4 border-l-pink-500 border-gray-100">
                <div class="flex justify-between items-start mb-1">
                    <h4 class="font-bold text-sm text-gray-800">${d.productName}</h4>
                    <span class="font-bold text-pink-600 text-sm">৳${d.price}</span>
                </div>
                <p class="text-xs text-gray-500 mb-2 font-bold">${d.gameName}</p>
                <div class="bg-gray-100 p-2 rounded mb-3">
                    <p class="text-[10px] text-gray-400 uppercase">Player ID / UID</p>
                    <p class="font-mono font-bold text-lg select-all">${d.playerId}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="refundOrder('${d.id}', '${d.userId}', ${d.price})" class="flex-1 bg-red-50 text-red-500 py-2 rounded text-xs font-bold">Refund</button>
                    <button onclick="completeOrder('${d.id}')" class="flex-1 bg-green-600 text-white py-2 rounded text-xs font-bold shadow">Complete</button>
                </div>
            </div>`;
        });
    }, err => {
        console.warn("fetchUserOrders listener status:", err.message);
        const list = document.getElementById('user-orders-list');
        if(list) list.innerHTML = `<div class="text-center py-8 text-xs text-gray-400">Waiting for orders permissions...</div>`;
    });
    activeUnsubscribers.push(unsub);
}
function completeOrder(docId) {
    Swal.fire({ title: 'Mark Success?', icon: 'question', showCancelButton: true, confirmButtonText: 'Yes' }).then(res => {
        if(res.isConfirmed) db.collection("orders").doc(docId).update({ status: "success" }).then(()=>Swal.fire('Done', 'Order Completed', 'success'));
    });
}
function refundOrder(docId, userId, amount) {
    Swal.fire({ title: 'Refund Order?', text: `User will get back ৳${amount}`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Yes, Refund' }).then(res => {
        if(res.isConfirmed) {
            const userRef = db.collection('users').doc(userId);
            db.runTransaction(async (t) => {
                const doc = await t.get(userRef);
                const newBal = (doc.exists ? doc.data().balance : 0) + parseInt(amount);
                t.update(userRef, { balance: newBal });
                t.update(db.collection('orders').doc(docId), { status: "refunded" });
            }).then(() => Swal.fire('Refunded', 'Money returned to user', 'success'));
        }
    });
}

// --- USERS SECTION (NEW) ---
let allUsers = []; 
function fetchUsers() {
    const unsub = db.collection("users").onSnapshot(snap => {
        allUsers = [];
        snap.forEach(doc => { allUsers.push({ id: doc.id, ...doc.data() }); });
        renderUsers(allUsers);
    }, err => {
        console.warn("fetchUsers listener:", err.message);
    });
    activeUnsubscribers.push(unsub);
}
function renderUsers(usersArray) {
    const list = document.getElementById('users-list');
    list.innerHTML = "";
    if(usersArray.length === 0) { list.innerHTML = `<div class="text-center py-5 text-gray-400 text-sm">No users found.</div>`; return; }
    
    usersArray.forEach(u => {
        list.innerHTML += `
        <div class="bg-white p-3 rounded-xl border border-gray-100 flex justify-between items-center shadow-sm">
            <div class="min-w-0">
                <p class="font-bold text-sm text-gray-800 truncate">${u.email || 'No Email'}</p>
                <p class="text-xs text-pink-500 font-bold">Balance: ৳${u.balance || 0}</p>
            </div>
            <button onclick="viewUserDetails('${u.id}')" class="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-pink-50 hover:text-pink-600 transition">View</button>
        </div>`;
    });
}
function searchUser() {
    const q = document.getElementById('user-search').value.toLowerCase();
    const filtered = allUsers.filter(u => (u.email && u.email.toLowerCase().includes(q)) || (u.id && u.id.toLowerCase().includes(q)));
    renderUsers(filtered);
}

// User Details Modal Logic
let currentViewUserId = null;
function viewUserDetails(uid) {
    currentViewUserId = uid;
    const user = allUsers.find(u => u.id === uid);
    if(!user) return;

    document.getElementById('modal-user-email').innerText = user.email || 'No Email';
    document.getElementById('modal-user-id').innerText = user.id;
    document.getElementById('modal-user-bal').innerText = user.balance || 0;
    document.getElementById('balance-amount').value = "";
    document.getElementById('modal-user-orders').innerText = "...";

    // Show Modal
    document.getElementById('user-modal').classList.remove('hidden');

    // Count Total Completed Orders
    db.collection("orders").where("userId", "==", uid).where("status", "==", "success").get().then(snap => {
        document.getElementById('modal-user-orders').innerText = snap.size;
    }).catch(err => console.warn("Order count err:", err.message));
}
function closeUserModal() {
    document.getElementById('user-modal').classList.add('hidden');
    currentViewUserId = null;
}
function updateUserBalance() {
    const amount = parseInt(document.getElementById('balance-amount').value);
    if(!amount || !currentViewUserId) return;

    const userRef = db.collection('users').doc(currentViewUserId);
    db.runTransaction(async (t) => {
        const doc = await t.get(userRef);
        const currentBal = doc.exists ? (doc.data().balance || 0) : 0;
        const newBal = currentBal + amount;
        t.update(userRef, { balance: newBal });
    }).then(() => {
        Swal.fire({ toast: true, icon: 'success', title: 'Balance Updated', position: 'top', showConfirmButton: false, timer: 1500 });
        document.getElementById('balance-amount').value = "";
        const oldBal = parseInt(document.getElementById('modal-user-bal').innerText);
        document.getElementById('modal-user-bal').innerText = oldBal + amount;
    }).catch(e => Swal.fire('Error', e.message, 'error'));
}


// --- GAMES & PRODUCTS ---
let currentEditingGameId = null;
function fetchGames() {
    const unsub = db.collection("services").onSnapshot(snap => {
        const grid = document.getElementById('games-grid');
        grid.innerHTML = "";
        if(snap.empty) { grid.innerHTML = `<div class="text-center py-8 text-gray-400">No games found.</div>`; return; }
        snap.forEach(doc => {
            const d = doc.data();
            grid.innerHTML += `
            <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
                <img src="${d.image}" class="w-14 h-14 rounded-lg object-cover bg-gray-50 border">
                <div class="flex-1 min-w-0"><h4 class="font-bold text-sm text-gray-800 truncate">${d.name}</h4><p class="text-[10px] text-gray-400 truncate">${d.rules || 'Player ID Required'}</p></div>
                <div class="flex flex-col gap-2">
                    <button onclick="manageProducts('${doc.id}', '${d.name}')" class="bg-pink-50 text-pink-600 px-3 py-1.5 rounded-lg text-[10px] font-bold">Manage <i class="fas fa-chevron-right ml-1"></i></button>
                    <button onclick="deleteGame('${doc.id}')" class="text-red-400 text-[10px] font-bold text-right px-1">Delete</button>
                </div>
            </div>`;
        });
    }, err => {
        console.warn("fetchGames listener:", err.message);
    });
    activeUnsubscribers.push(unsub);
}
function addGame() {
    const name = document.getElementById('new-game-name').value;
    const img = document.getElementById('new-game-img').value;
    const rules = document.getElementById('new-game-rules').value;
    if(!name || !img) return Swal.fire('Missing Info', 'Game Name and Image URL are required', 'warning');
    db.collection("services").add({ name, image: img, rules: rules || "Enter Player ID" })
    .then(() => {
        document.getElementById('new-game-name').value = ""; document.getElementById('new-game-img').value = ""; document.getElementById('new-game-rules').value = "";
        Swal.fire({toast: true, icon: 'success', title: 'Game Added', position: 'top-end', showConfirmButton: false, timer: 1500});
    });
}
function deleteGame(id) { Swal.fire({ title: 'Delete Game?', text: "This deletes all products inside it!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Delete' }).then((res) => { if(res.isConfirmed) db.collection("services").doc(id).delete(); }); }

let productSub = null;
function manageProducts(gameId, gameName) {
    currentEditingGameId = gameId;
    document.getElementById('games-main-view').classList.add('hidden');
    document.getElementById('products-manager-view').classList.remove('hidden');
    document.getElementById('pm-game-title').innerText = gameName;
    fetchProducts(gameId);
}
function closeProductManager() { 
    if (typeof productSub === 'function') {
        productSub();
        productSub = null;
    }
    currentEditingGameId = null; 
    document.getElementById('products-manager-view').classList.add('hidden'); 
    document.getElementById('games-main-view').classList.remove('hidden'); 
}
function fetchProducts(gameId) {
    if (typeof productSub === 'function') {
        productSub();
        productSub = null;
    }
    productSub = db.collection("services").doc(gameId).collection("products").orderBy('price', 'asc').onSnapshot(snap => {
        const list = document.getElementById('products-list');
        list.innerHTML = "";
        if(snap.empty) { list.innerHTML = `<div class="text-center py-5 opacity-50"><p class="text-xs text-gray-500">No products added yet.</p></div>`; return; }
        snap.forEach(doc => {
            const p = doc.data();
            list.innerHTML += `
            <div class="bg-white p-3 rounded-xl border border-gray-100 flex justify-between items-center shadow-sm">
                <div><p class="text-sm font-bold text-gray-800">${p.name}</p><p class="text-xs font-medium text-pink-600">Price: ৳ ${p.price}</p></div>
                <button onclick="db.collection('services').doc('${gameId}').collection('products').doc('${doc.id}').delete()" class="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center"><i class="fas fa-trash-alt text-xs"></i></button>
            </div>`;
        });
    }, err => {
        console.warn("fetchProducts listener:", err.message);
    });
}
function addProduct() {
    if(!currentEditingGameId) return;
    const name = document.getElementById('prod-name').value;
    const price = document.getElementById('prod-price').value;
    if(!name || !price) return Swal.fire('Error', 'Fill all fields', 'warning');
    db.collection("services").doc(currentEditingGameId).collection("products").add({ name, price: parseInt(price) })
    .then(() => { document.getElementById('prod-name').value = ""; document.getElementById('prod-price').value = ""; Swal.fire({toast: true, icon: 'success', title: 'Product Added', position: 'top', showConfirmButton: false, timer: 1000}); });
}

// --- BANNERS ---
function fetchBanners() {
    const unsub = db.collection("banners").onSnapshot(snap => {
        const list = document.getElementById('banners-list'); list.innerHTML = "";
        snap.forEach(doc => { list.innerHTML += `<div class="relative h-24 rounded-lg overflow-hidden bg-gray-100 border"><img src="${doc.data().image}" class="w-full h-full object-cover"><button onclick="db.collection('banners').doc('${doc.id}').delete()" class="absolute top-2 right-2 bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs"><i class="fas fa-times"></i></button></div>`; });
    }, err => {
        console.warn("fetchBanners listener:", err.message);
    });
    activeUnsubscribers.push(unsub);
}
function addBanner() { const url = document.getElementById('new-banner-url').value; if(url) db.collection("banners").add({ image: url }).then(() => document.getElementById('new-banner-url').value = ""); }

// --- TUTORIALS ---
function fetchTutorials() {
    const unsub = db.collection("tutorials").onSnapshot(snap => {
        const list = document.getElementById('tutorials-list'); list.innerHTML = "";
        snap.forEach(doc => {
            const d = doc.data();
            list.innerHTML += `<div class="flex gap-3 bg-white p-2 rounded-lg border relative"><img src="${d.thumbnail}" class="w-16 h-10 object-cover rounded bg-gray-200"><div class="overflow-hidden"><p class="text-xs font-bold truncate">${d.title}</p></div><button onclick="db.collection('tutorials').doc('${doc.id}').delete()" class="absolute right-2 top-2 text-red-400"><i class="fas fa-trash"></i></button></div>`;
        });
    }, err => {
        console.warn("fetchTutorials listener:", err.message);
    });
    activeUnsubscribers.push(unsub);
}
function addTutorial() {
    const title = document.getElementById('tut-title').value; const thumb = document.getElementById('tut-thumb').value; const link = document.getElementById('tut-link').value;
    if(title && link) db.collection("tutorials").add({ title, thumbnail: thumb || '', link }).then(()=>{ Swal.fire({toast:true, icon:'success', title:'Added'}); document.getElementById('tut-title').value = ""; });
}

// --- SETTINGS ---
function fetchSettings() {
    const unsub1 = db.collection("admin").doc("payment").onSnapshot(d => {
        if(d.exists) {
            document.getElementById('set-bkash').value = d.data().bkash || "";
            document.getElementById('set-nagad').value = d.data().nagad || "";
            document.getElementById('set-rocket').value = d.data().rocket || "";
        }
    }, err => {
        console.warn("admin payment settings listener:", err.message);
    });
    activeUnsubscribers.push(unsub1);

    const unsub2 = db.collection("settings").doc("general").onSnapshot(d => {
        if(d.exists) {
            const data = d.data();
            document.getElementById('set-notice').value = data.notice || "";
            document.getElementById('set-app-link').value = data.appLink || "";
            document.getElementById('set-telegram').value = data.telegram || "";
            document.getElementById('set-whatsapp').value = data.whatsapp || "";
            document.getElementById('set-fb').value = data.facebook || "";
            document.getElementById('set-insta').value = data.instagram || "";
            document.getElementById('set-yt').value = data.youtube || "";
        }
    }, err => {
        console.warn("settings general listener:", err.message);
    });
    activeUnsubscribers.push(unsub2);
}

function savePayment() {
    db.collection("admin").doc("payment").set({
        bkash: document.getElementById('set-bkash').value,
        nagad: document.getElementById('set-nagad').value,
        rocket: document.getElementById('set-rocket').value
    }, { merge: true }).then(() => Swal.fire('Payment Numbers Saved', '', 'success'));
}

function saveConfig() {
    db.collection("settings").doc("general").set({
        notice: document.getElementById('set-notice').value,
        appLink: document.getElementById('set-app-link').value,
        telegram: document.getElementById('set-telegram').value,
        whatsapp: document.getElementById('set-whatsapp').value,
        facebook: document.getElementById('set-fb').value,
        instagram: document.getElementById('set-insta').value,
        youtube: document.getElementById('set-yt').value
    }, { merge: true }).then(() => Swal.fire('Config Saved', 'App Link & Socials updated', 'success'));
}