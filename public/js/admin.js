// KIDS-CAN ADMIN DASHBOARD V2 ENGINE
// Handles Authentication, RBAC, Analytics, and Content Management

// STATE
let currentUser = null;
let userRole = null;
let activeTab = 'dashboard';
let isHandlingSession = false;
let trafficChartInstance = null;
let donationChartInstance = null;
let currentAbout = { mission: '', mission_extended: '', gallery: [] };

// 1. INITIALIZATION & AUTH
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Admin Dashboard: Initializing...");
    const overlay = document.getElementById('loading-overlay');
    
    // Fail-safe timer: Remove overlay after 10 seconds no matter what
    setTimeout(() => {
        if (overlay && !overlay.classList.contains('hidden')) {
            console.warn("Fail-safe: Removing loading overlay after timeout.");
            overlay.classList.add('hidden');
        }
    }, 10000);

    try {
        // Safety Check for Supabase
        let retries = 0;
        while (!window.supabaseClient && retries < 5) {
            console.warn(`Waiting for Supabase client... (Attempt ${retries + 1}/5)`);
            await new Promise(r => setTimeout(r, 1000));
            retries++;
        }

        if (!window.supabaseClient) {
            throw new Error("Supabase client could not be initialized. Please check your internet connection.");
        }

        console.log("Admin Dashboard: Supabase Ready.");
        setupRealtime();

        console.log("Admin Dashboard: Checking session...");
        const { data: { session: initialSession }, error: authError } = await window.supabaseClient.auth.getSession();
        
        if (authError) throw authError;

        if (initialSession) {
            console.log("Admin Dashboard: Session found, handling...");
            await handleSession(initialSession);
        } else {
            console.log("Admin Dashboard: No session, showing login.");
            document.getElementById('loginModal').classList.remove('hidden');
        }

        // Auth Change Listener
        window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
            console.log("Auth Event:", event);
            if (session) {
                if (!currentUser && !isHandlingSession) {
                    await handleSession(session);
                }
            } else {
                currentUser = null;
                userRole = null;
                isHandlingSession = false;
                document.getElementById('loginModal').classList.remove('hidden');
                document.getElementById('dashboardLayout').classList.add('hidden');
            }
        });

        setupDragDrop('imageDropZone', 'imageInput', 'imagePreview', 'imageUrl');
        setupDragDrop('videoDropZone', 'videoInput', 'videoPreview', 'videoUrl');
        setupDragDrop('heroImageDropZone', 'heroImageInput', 'heroImagePreview', 'heroImageUrl');

    } catch (err) {
        console.error("DIAGNOSTIC - INIT ERROR:", err);
        if (overlay) {
            overlay.innerHTML = `<div style="padding: 2rem; text-align: center;">
                <h3 style="color: #ef4444;">Dashboard Connection Error</h3>
                <p style="margin: 1rem 0; color: #64748b;">${err.message}</p>
                <button onclick="location.reload()" class="btn btn-primary">Retry Connection</button>
            </div>`;
        }
    } finally {
        // Force hide overlay if we aren't in a critical error state
        if (overlay) overlay.classList.add('hidden');
    }
});

async function handleSession(session) {
    if (!session || isHandlingSession) return;
    isHandlingSession = true;
    console.log("Auth Process: Session Detected", session.user.email);
    currentUser = session.user;

    // --- UI TRANSITION (CRITICAL) ---
    const modal = document.getElementById('loginModal');
    const layout = document.getElementById('dashboardLayout');
    const overlay = document.getElementById('loading-overlay');

    if (modal) modal.classList.add('hidden');
    if (layout) layout.classList.remove('hidden');
    if (overlay) overlay.classList.add('hidden');

    // Reset login button state
    const btn = document.querySelector('#authForm button[type="submit"]');
    if (btn) {
        btn.innerHTML = 'Sign In to Dashboard';
        btn.disabled = false;
    }

    // --- DATA LOADING ---
    try {
        console.log("Auth Process: Fetching user profile...");
        const { data, error } = await window.supabaseClient
            .from('admin_users')
            .select('role')
            .eq('email', currentUser.email)
            .maybeSingle();

        userRole = (data && data.role) ? data.role : 'analytics_viewer';
        console.log("Auth Process: Role assigned as", userRole);
    } catch (err) {
        console.warn("Auth Process: Database role check failed, defaulting to viewer.");
        userRole = 'analytics_viewer';
    } finally {
        if (overlay) overlay.classList.add('hidden');
    }

    // Refresh UI Components
    const nameEl = document.getElementById('headerUserName');
    const roleEl = document.getElementById('headerUserRole');
    const avatarEl = document.getElementById('headerAvatar');

    if (nameEl) nameEl.innerText = currentUser.email.split('@')[0];
    if (roleEl) roleEl.innerText = formatRole(userRole);
    if (avatarEl) avatarEl.innerText = currentUser.email[0].toUpperCase();

    try {
        applyRBAC();
        loadNotifications();
        showTab('dashboard');
    } catch (uiErr) {
        console.error("UI Initialization Error:", uiErr);
    }
}

// 1.5 RBAC ENFORCEMENT
function applyRBAC() {
    console.log("Applying RBAC for role:", userRole);

    // Default: Hide all sensitive management tabs for viewers
    const restrictedItems = {
        'analytics_viewer': ['heroes', 'teams', 'donors', 'events', 'about', 'content', 'staff', 'logs', 'applications', 'contacts'],
        'content_admin': ['donors', 'finance', 'staff', 'logs', 'applications'],
        'finance_admin': ['heroes', 'events', 'about', 'content', 'staff', 'contacts'],
        'super_admin': []
    };

    const toHide = restrictedItems[userRole] || restrictedItems['analytics_viewer'];

    // Hide Sidebar Nav Items
    document.querySelectorAll('.sidebar .nav-item').forEach(item => {
        const id = item.id.replace('nav-', '');
        if (toHide.includes(id)) {
            item.style.display = 'none';
        } else {
            item.style.display = 'flex';
        }
    });

    // Handle specific dashboard actions
    if (userRole === 'analytics_viewer') {
        document.querySelectorAll('.btn-admin-only').forEach(btn => btn.style.display = 'none');
    }
}

// 2. REAL-TIME SUBSCRIPTIONS
function setupRealtime() {
    // Listen for new notifications
    window.supabaseClient
        .channel('admin-notifications')
        .on('postgres_changes', { event: 'INSERT', table: 'admin_notifications', schema: 'public' }, payload => {
            showTopNotification(payload.new);
            loadNotifications();
        })
        .subscribe();

    // Listen for new teams
    window.supabaseClient
        .channel('new-teams')
        .on('postgres_changes', { event: 'INSERT', table: 'teams', schema: 'public' }, payload => {
            if (activeTab === 'dashboard' || activeTab === 'teams') loadTabData(activeTab);
            createNotificationRecord('New Team Registered', `${payload.new.team_name} has just registered!`, 'registration');
        })
        .subscribe();

    // Listen for new donations
    window.supabaseClient
        .channel('new-donations')
        .on('postgres_changes', { event: 'INSERT', table: 'donors', schema: 'public' }, payload => {
            if (activeTab === 'dashboard' || activeTab === 'donors') loadTabData(activeTab);
            createNotificationRecord('New Donation Received', `A donation of R ${payload.new.amount} was received from ${payload.new.donor_name}.`, 'donation');
            if (payload.new.hero_id) updateHeroFunds(payload.new.hero_id, payload.new.amount);
        })
        .subscribe();
    // Listen for new applications
    window.supabaseClient
        .channel('new-applications')
        .on('postgres_changes', { event: 'INSERT', table: 'applications', schema: 'public' }, payload => {
            if (activeTab === 'dashboard' || activeTab === 'applications') loadTabData(activeTab);
            createNotificationRecord('New Application', `A new request for ${payload.new.assistance_type} was submitted for ${payload.new.child_name}.`, 'registration');
        })
        .subscribe();
}

async function createNotificationRecord(title, message, type) {
    await window.supabaseClient.from('admin_notifications').insert([{ title, message, type }]);
}

async function logAction(action, details = "") {
    if (!currentUser) return;
    await window.supabaseClient.from('activity_logs').insert([{
        user_email: currentUser.email,
        action: action,
        details: details
    }]);
}

function showTopNotification(notif) {
    const toast = document.createElement('div');
    toast.className = 'realtime-toast';
    toast.style = "position: fixed; top: 20px; right: 20px; background: white; padding: 1rem; border-radius: 1rem; box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 9999; display: flex; align-items: center; gap: 1rem; border-left: 4px solid var(--primary); transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55); transform: translateX(120%);";
    toast.innerHTML = `
        <i class="fas ${notif.type === 'donation' ? 'fa-hand-holding-heart' : 'fa-users'}" style="color: var(--primary); font-size: 1.5rem;"></i>
        <div>
            <div style="font-weight: 700; font-size: 0.9rem;">${notif.title}</div>
            <div style="font-size: 0.8rem; color: var(--text-sub);">${notif.message}</div>
        </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.transform = 'translateX(0)'; }, 100);
    setTimeout(() => {
        toast.style.transform = 'translateX(120%)';
        setTimeout(() => toast.remove(), 500);
    }, 6000);
}

async function updateHeroFunds(heroId, amount) {
    const { data: hero } = await window.supabaseClient.from('heroes').select('amount_raised, fundraising_goal').eq('id', heroId).single();
    if (hero) {
        const newTotal = parseFloat(hero.amount_raised || 0) + parseFloat(amount);
        const status = newTotal >= (hero.fundraising_goal || 0) ? 'Funded' : 'Active';
        await window.supabaseClient.from('heroes').update({ amount_raised: newTotal, status: status }).eq('id', heroId);
    }
}

// 3. NAVIGATION & TABS
function showTab(tabName) {
    activeTab = tabName;
    document.querySelectorAll('[id^="tab-"]').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`tab-${tabName}`);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.sidebar .nav-item').forEach(el => el.classList.remove('active'));
    const navItem = document.getElementById(`nav-${tabName}`);
    if (navItem) navItem.classList.add('active');

    loadTabData(tabName);
}

function loadTabData(tabName) {
    switch (tabName) {
        case 'dashboard':
            loadDashboardStats();
            loadLogs('dashboardActivityBody', 5);
            break;
        case 'analytics': loadAnalytics(); break;
        case 'heroes': loadHeroes(); break;
        case 'teams': loadTeams(); break;
        case 'donors': loadDonors(); break;
        case 'events': loadEvents(); break;
        case 'about': loadAbout(); break;
        case 'content': loadContent(); break;
        case 'staff': loadStaff(); break;
        case 'applications': loadApplications(); break;
        case 'contacts': loadContacts(); break;
        case 'logs': loadLogs('logsTableBody', 50); break;
    }
}

// 4. ANALYTICS & DASHBOARD STATS
async function loadDashboardStats() {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // A. TRAFFIC STATS
        const { data: views } = await window.supabaseClient.from('page_views').select('*').gte('viewed_at', thirtyDaysAgo.toISOString());
        const visitCount = views ? views.length : 0;
        document.getElementById('stat-visits').innerText = visitCount;

        // B. DONATION STATS
        const { data: donations } = await window.supabaseClient.from('donors').select('amount, email, method, created_at');
        const donationTotal = donations ? donations.reduce((sum, d) => sum + parseFloat(d.amount), 0) : 0;
        document.getElementById('stat-donations').innerText = `R ${donationTotal.toLocaleString()}`;

        // C. TEAMS STATS
        const { count: teamCount } = await window.supabaseClient.from('teams').select('*', { count: 'exact', head: true });
        document.getElementById('stat-teams').innerText = teamCount || 0;

        // D. HERO STATS
        const { data: heroes } = await window.supabaseClient.from('heroes').select('status');
        const fundedCount = heroes ? heroes.filter(h => h.status === 'Funded').length : 0;
        document.getElementById('stat-heroes').innerText = heroes ? heroes.length : 0;

        // E. ADVANCED CALCULATIONS
        const donorUids = new Set(donations?.map(d => d.email));
        const conversionRate = visitCount > 0 ? ((donorUids.size / visitCount) * 100).toFixed(1) : 0;
        const avgDonation = donations?.length > 0 ? (donationTotal / donations.length).toFixed(2) : 0;

        if (document.getElementById('stat-conversion')) document.getElementById('stat-conversion').innerText = `${conversionRate}%`;
        if (document.getElementById('stat-avg-donation')) document.getElementById('stat-avg-donation').innerText = `R ${avgDonation}`;
        if (document.getElementById('stat-funded-kids')) document.getElementById('stat-funded-kids').innerText = fundedCount;

        renderDashboardCharts(views, donations);

    } catch (err) {
        console.error("Stats Error:", err);
    }
}

async function renderDashboardCharts(views, donations) {
    try {
        if (typeof Chart === 'undefined') {
            console.error("Chart.js not loaded. Skipping chart rendering.");
            return;
        }
        const trafficCtx = document.getElementById('dashboardTrafficChart')?.getContext('2d');
        if (!trafficCtx) return;
        
        // ... (rest of the chart logic)
    const dailyCounts = {};
    const last30Days = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        last30Days.push(label);
        dailyCounts[label] = 0;
    }
    if (views) {
        views.forEach(v => {
            const d = new Date(v.viewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (dailyCounts[d] !== undefined) dailyCounts[d]++;
        });
    }

    if (trafficChartInstance) trafficChartInstance.destroy();
    trafficChartInstance = new Chart(trafficCtx, {
        type: 'line',
        data: {
            labels: last30Days,
            datasets: [{
                label: 'Visitors',
                data: last30Days.map(l => dailyCounts[l]),
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true }, x: { grid: { display: false } } }
        }
    });

    const sourcesCtx = document.getElementById('donationSourcesChart').getContext('2d');
    const methods = { 'GivePulse': 0, 'EFT': 0, 'Stripe': 0, 'Other': 0 };
    if (donations) {
        donations.forEach(d => {
            const m = d.method || 'Other';
            if (methods[m] !== undefined) methods[m] += parseFloat(d.amount);
            else methods['Other'] += parseFloat(d.amount);
        });
    }

    if (donationChartInstance) donationChartInstance.destroy();
    donationChartInstance = new Chart(sourcesCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(methods),
            datasets: [{
                data: Object.values(methods),
                backgroundColor: ['#2563eb', '#f59e0b', '#10b981', '#64748b'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: { legend: { position: 'bottom' } }
        }
    });
    } catch (err) {
        console.error("Chart Rendering Error:", err);
    }
}

// 5. NOTIFICATIONS
async function loadNotifications() {
    const { data: notifs } = await window.supabaseClient.from('admin_notifications').select('*').order('created_at', { ascending: false }).limit(10);
    const unreadCount = notifs ? notifs.filter(n => !n.is_read).length : 0;
    const badge = document.querySelector('.notification-badge');
    if (badge) {
        badge.innerText = unreadCount;
        badge.style.display = unreadCount > 0 ? 'block' : 'none';
    }
}

async function markNotificationsAsRead() {
    await window.supabaseClient.from('admin_notifications').update({ is_read: true }).eq('is_read', false);
    loadNotifications();
}

// 6. MANAGEMENT MODULES
async function loadHeroes() {
    const { data: heroes } = await window.supabaseClient.from('heroes').select('*').order('created_at', { ascending: false });
    const tbody = document.getElementById('heroesTableBody');
    tbody.innerHTML = '';
    (heroes || []).forEach(hero => {
        tbody.innerHTML += `
            <tr>
                <td><img src="${hero.image_url || 'hero-center-logo.jpg'}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;"></td>
                <td style="font-weight: 600;">${hero.name}</td>
                <td>${hero.age || ''} • ${hero.diagnosis || ''}</td>
                <td><span class="status-badge status-${hero.status?.toLowerCase() || 'active'}">${hero.status || 'Active'}</span></td>
                <td>R ${(hero.amount_raised || 0).toLocaleString()}</td>
                <td>
                    <button class="btn btn-outline btn-icon" onclick="openHeroModal(${JSON.stringify(hero).replace(/"/g, '&quot;')})" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-outline btn-icon" onclick="deleteHero(${hero.id})"><i class="fas fa-trash text-danger"></i></button>
                </td>
            </tr>
        `;
    });
}

async function loadTeams() {
    const { data: teams } = await window.supabaseClient.from('teams').select('*').order('created_at', { ascending: false });
    const tbody = document.getElementById('teamsTableBody');
    tbody.innerHTML = '';
    (teams || []).forEach(team => {
        tbody.innerHTML += `
            <tr>
                <td style="font-weight: 600;">${team.team_name}</td>
                <td>${team.captain_name}</td>
                <td>${team.members_count || 2}</td>
                <td><span class="status-badge status-${team.payment_status?.toLowerCase() === 'paid' ? 'active' : 'pending'}">${team.payment_status}</span></td>
                <td>${new Date(team.created_at).toLocaleDateString()}</td>
                <td><button class="btn btn-outline btn-icon" onclick="deleteTeam(${team.id})"><i class="fas fa-trash text-danger"></i></button></td>
            </tr>
        `;
    });
}

async function loadDonors() {
    const { data: donors } = await window.supabaseClient.from('donors').select('*, heroes(name)').order('created_at', { ascending: false });
    const tbody = document.getElementById('donorTableBody');
    tbody.innerHTML = '';
    (donors || []).forEach(donor => {
        tbody.innerHTML += `
            <tr>
                <td style="font-weight: 600;">${donor.donor_name}</td>
                <td style="color: var(--success); font-weight: 600;">R ${parseFloat(donor.amount).toLocaleString()}</td>
                <td>${new Date(donor.created_at).toLocaleDateString()}</td>
                <td>${donor.method}</td>
                <td>${donor.heroes?.name || 'General'}</td>
            </tr>
        `;
    });
}

async function loadEvents() {
    const { data: events } = await window.supabaseClient.from('events').select('*').order('date', { ascending: true });
    const tbody = document.getElementById('eventsTableBody');
    tbody.innerHTML = '';
    (events || []).forEach(event => {
        const isPast = new Date(event.date) < new Date();
        tbody.innerHTML += `
            <tr>
                <td style="font-weight: 600;">${event.title}</td>
                <td>${new Date(event.date).toLocaleDateString()}</td>
                <td>${event.location}</td>
                <td><span class="status-badge ${isPast ? 'status-completed' : 'status-pending'}">${isPast ? 'Past' : 'Upcoming'}</span></td>
                <td><button class="btn btn-outline btn-icon" onclick="deleteEvent(${event.id})"><i class="fas fa-trash text-danger"></i></button></td>
            </tr>
        `;
    });
}

async function loadApplications() {
    const { data: apps } = await window.supabaseClient.from('applications').select('*').order('created_at', { ascending: false });
    const tbody = document.getElementById('appsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    (apps || []).forEach(app => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${app.child_name}</strong><br><small>${app.guardian_name}</small></td>
                <td>${app.assistance_type}</td>
                <td>${new Date(app.created_at).toLocaleDateString()}</td>
                <td><span class="status-badge status-${app.status.toLowerCase()}">${app.status}</span></td>
                <td>
                    <button class="btn btn-outline btn-icon" onclick="updateAppStatus(${app.id}, 'Approved')" title="Approve"><i class="fas fa-check text-success"></i></button>
                    <button class="btn btn-outline btn-icon" onclick="updateAppStatus(${app.id}, 'Rejected')" title="Reject"><i class="fas fa-times text-danger"></i></button>
                </td>
            </tr>
        `;
    });
}

async function loadContacts() {
    const { data: msgs } = await window.supabaseClient.from('contacts').select('*').order('created_at', { ascending: false });
    const tbody = document.getElementById('contactsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    (msgs || []).forEach(msg => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${msg.name}</strong><br><small>${msg.email}</small></td>
                <td>${msg.subject}</td>
                <td>${new Date(msg.created_at).toLocaleDateString()}</td>
                <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${msg.message}">${msg.message}</td>
                <td><button class="btn btn-outline btn-icon" onclick="deleteContact(${msg.id})"><i class="fas fa-trash text-danger"></i></button></td>
            </tr>
        `;
    });
}

async function updateAppStatus(id, status) {
    const { error } = await window.supabaseClient.from('applications').update({ status }).eq('id', id);
    if (error) alert(error.message);
    else {
        loadApplications();
        logAction(`Updated Application ${id}`, `Status set to ${status}`);
    }
}

async function deleteContact(id) {
    if (confirm("Delete this message?")) {
        await window.supabaseClient.from('contacts').delete().eq('id', id);
        loadContacts();
        logAction("Deleted Contact Message", `ID: ${id}`);
    }
}

// 7. CONTENT & ABOUT resources
async function loadAbout() {
    const { data } = await window.supabaseClient.from('about_page').select('*').limit(1).single();
    currentAbout = data || { mission: '', mission_extended: '', gallery: [] };
    document.querySelector('[name="mission"]').value = currentAbout.mission || '';
    document.querySelector('[name="missionExtended"]').value = currentAbout.mission_extended || '';
    renderAdminGallery();
}

async function saveAbout() {
    const formData = new FormData(document.getElementById('aboutForm'));
    const payload = { mission: formData.get('mission'), mission_extended: formData.get('missionExtended'), gallery: currentAbout.gallery };
    const { error } = await window.supabaseClient.from('about_page').upsert([{ id: currentAbout.id, ...payload }]);
    if (error) alert(error.message);
    else {
        alert("Changes published!");
        logAction("Updated About Page", "Modified mission/story");
    }
}

function renderAdminGallery() {
    const grid = document.getElementById('adminGalleryGrid');
    if (!grid) return;
    grid.innerHTML = '';
    (currentAbout.gallery || []).forEach((item, index) => {
        grid.innerHTML += `
            <div style="position: relative; aspect-ratio: 1; border-radius: 0.5rem; overflow: hidden; box-shadow: var(--shadow);">
                <img src="${item.url}" style="width: 100%; height: 100%; object-fit: cover;">
                <button onclick="removeGalleryImage(${index})" style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.5); color: white; border: none; border-radius: 4px; cursor: pointer;">&times;</button>
            </div>
        `;
    });
}

// 8. UTILS
async function loadLogs(targetId, limit = 50) {
    const { data } = await window.supabaseClient.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(limit);
    const tbody = document.getElementById(targetId);
    if (!tbody) return;
    tbody.innerHTML = '';
    (data || []).forEach(log => {
        tbody.innerHTML += `<tr><td style="font-size: 0.8rem; color: var(--text-sub);">${new Date(log.created_at).toLocaleString()}</td><td style="font-weight: 500;">${log.user_email.split('@')[0]}</td><td>${log.action}</td>${targetId === 'logsTableBody' ? `<td>${log.details || ''}</td>` : ''}</tr>`;
    });
}

function formatRole(role) { return role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); }
async function deleteHero(id) { if (confirm('Delete hero?')) { await window.supabaseClient.from('heroes').delete().eq('id', id); loadHeroes(); logAction("Deleted Hero", `ID: ${id}`); } }
async function deleteEvent(id) { if (confirm('Cancel event?')) { await window.supabaseClient.from('events').delete().eq('id', id); loadEvents(); logAction("Cancelled Event", `ID: ${id}`); } }
async function deleteTeam(id) { if (confirm('Remove team?')) { await window.supabaseClient.from('teams').delete().eq('id', id); loadTeams(); logAction("Removed Team", `ID: ${id}`); } }
async function deleteStaff(id) { if (confirm('Remove staff member?')) { await window.supabaseClient.from('admin_users').delete().eq('id', id); loadStaff(); logAction("Removed Staff", `ID: ${id}`); } }
async function editContent(key) { alert("Use the Visual Editor on the public pages to edit this content for a better experience!"); }
function removeGalleryImage(index) {
    if (confirm("Remove image?")) {
        currentAbout.gallery.splice(index, 1);
        renderAdminGallery();
    }
}
function openHeroModal(hero = null) { 
    const modal = document.getElementById('heroModal');
    const form = document.getElementById('addHeroForm');
    const title = modal.querySelector('h2');
    const submitBtn = form.querySelector('button[type="submit"]');

    if (hero) {
        title.innerText = "Edit Brave Warrior";
        submitBtn.innerText = "Update Story";
        form.name.value = hero.name;
        form.age.value = hero.age || '';
        form.diagnosis.value = hero.diagnosis || '';
        form.story.value = hero.story || '';
        form.image_url.value = hero.image_url || '';
        document.getElementById('heroImagePreview').innerHTML = hero.image_url ? `<img src="${hero.image_url}" style="height: 60px; border-radius: 4px; margin-top: 8px;">` : '';
        form.dataset.heroId = hero.id;
    } else {
        title.innerText = "Add Brave Warrior";
        submitBtn.innerText = "Publish Story";
        form.reset();
        document.getElementById('heroImagePreview').innerHTML = '';
        delete form.dataset.heroId;
    }
    modal.classList.remove('hidden'); 
}
function closeHeroModal() { document.getElementById('heroModal').classList.add('hidden'); }
function openEventModal() { document.getElementById('eventModal').classList.remove('hidden'); }
function closeEventModal() { document.getElementById('eventModal').classList.add('hidden'); }
async function logout() { if (confirm("Log out?")) { await window.supabaseClient.auth.signOut(); location.reload(); } }

async function handleAuth(e) {
    if (e) e.preventDefault();
    console.log("Auth Process: Login Attempt Started");

    const btn = document.querySelector('#authForm button[type="submit"]');
    const originalText = btn.innerHTML;
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    const errorEl = document.getElementById('loginError');

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
    btn.disabled = true;
    errorEl.textContent = '';

    try {
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;

        console.log("Auth Process: Sign-in command successful");

        // Safety Fallback: If onAuthStateChange doesn't fire, we trigger session handler manually
        if (data.session) {
            await handleSession(data.session);
        }
    } catch (err) {
        console.error("Auth Process: Login failed", err);
        errorEl.textContent = err.message;
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function toggleAuthMode() {
    alert("Support for password resets and signup requests is currently restricted to administrators. Please contact your system admin for access.");
}

function setupDragDrop(zoneId, inputId, previewId, hiddenInputId) {
    const zone = document.getElementById(zoneId);
    if (!zone) return;
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.style.borderColor = '#2563eb'; });
    zone.addEventListener('dragleave', () => { zone.style.borderColor = '#e2e8f0'; });
    zone.addEventListener('drop', (e) => { e.preventDefault(); const files = e.dataTransfer.files; if (files.length) uploadToStorage(files[0], document.getElementById(previewId), document.getElementById(hiddenInputId)); });
}

async function uploadToStorage(file, preview, hidden) {
    preview.innerHTML = "Uploading...";
    const path = `media/${Date.now()}-${file.name}`;
    const { data, error } = await window.supabaseClient.storage.from('media').upload(path, file);
    if (error) { alert(error.message); return; }
    const { data: { publicUrl } } = window.supabaseClient.storage.from('media').getPublicUrl(path);
    hidden.value = publicUrl;
    preview.innerHTML = `<img src="${publicUrl}" style="height: 60px; border-radius: 4px; margin-top: 8px;">`;
}

async function loadStaff() {
    const { data: staff } = await window.supabaseClient.from('admin_users').select('*').order('created_at', { ascending: false });
    const tbody = document.getElementById('staffTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    (staff || []).forEach(member => {
        tbody.innerHTML += `
            <tr>
                <td style="font-weight: 600;">${member.email}</td>
                <td><span class="status-badge">${formatRole(member.role)}</span></td>
                <td>${new Date(member.created_at).toLocaleDateString()}</td>
                <td><button class="btn btn-outline btn-icon" onclick="deleteStaff('${member.id}')"><i class="fas fa-trash text-danger"></i></button></td>
            </tr>
        `;
    });
}

function openAddStaffModal() { document.getElementById('addStaffModal').classList.remove('hidden'); }
function closeAddStaffModal() { document.getElementById('addStaffModal').classList.add('hidden'); }

async function addStaff(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const email = formData.get('email');
    const password = formData.get('password');
    const role = formData.get('role');

    try {
        // 1. Create User in Auth
        const { data: authData, error: authError } = await window.supabaseClient.auth.signUp({
            email, password
        });
        if (authError) throw authError;

        // 2. Create User in admin_users table
        const { error: dbError } = await window.supabaseClient.from('admin_users').insert([{
            id: authData.user.id,
            email: email,
            role: role,
            status: 'active'
        }]);
        if (dbError) throw dbError;

        alert("Staff member invited successfully!");
        form.reset();
        closeAddStaffModal();
        loadStaff();
        logAction("Invited Staff", `Email: ${email}`);
    } catch (err) {
        alert(err.message);
    }
}

async function handleHeroSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const name = formData.get('name');
    const heroId = form.dataset.heroId;

    const payload = {
        name: name,
        age: formData.get('age'),
        diagnosis: formData.get('diagnosis'),
        story: formData.get('story'),
        image_url: formData.get('image_url'),
        status: 'Active'
    };

    let result;
    if (heroId) {
        result = await window.supabaseClient.from('heroes').update(payload).eq('id', heroId);
    } else {
        result = await window.supabaseClient.from('heroes').insert([payload]);
    }

    if (result.error) {
        alert(result.error.message);
    } else {
        alert(heroId ? "Hero updated successfully!" : "Hero added successfully!");
        form.reset();
        document.getElementById('heroImagePreview').innerHTML = '';
        closeHeroModal();
        loadHeroes();
        logAction(heroId ? "Updated Hero" : "Added Hero", name);
    }
}

async function handleEventSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const title = formData.get('title');
    const payload = {
        title: title,
        date: formData.get('date'),
        location: formData.get('location'),
        description: formData.get('description'),
        image_url: formData.get('image_url'),
        video_url: formData.get('video_url')
    };

    const { error } = await window.supabaseClient.from('events').insert([payload]);
    if (error) alert(error.message);
    else {
        alert("Event created!");
        form.reset();
        closeEventModal();
        loadEvents();
        logAction("Created Event", title);
    }
}

async function loadAnalytics() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: views } = await window.supabaseClient.from('page_views').select('*').gte('viewed_at', thirtyDaysAgo.toISOString());
    const tbody = document.getElementById('topPagesBody');
    if (!tbody) return;

    const pathCounts = {};
    (views || []).forEach(v => {
        pathCounts[v.path] = (pathCounts[v.path] || 0) + 1;
    });

    tbody.innerHTML = '';
    Object.entries(pathCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([path, count]) => {
            tbody.innerHTML += `
            <tr>
                <td style="font-weight: 600;">${path}</td>
                <td>${count}</td>
                <td>${(count / 30).toFixed(1)}</td>
            </tr>
        `;
        });
}

async function loadContent() {
    const { data: content } = await window.supabaseClient.from('site_content').select('*').order('key', { ascending: true });
    const tbody = document.getElementById('contentTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    (content || []).forEach(item => {
        tbody.innerHTML += `
            <tr>
                <td style="font-weight: 600;">${item.key}</td>
                <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.content}</td>
                <td>${item.type}</td>
                <td><button class="btn btn-outline btn-icon" onclick="editContent('${item.key}')"><i class="fas fa-edit"></i></button></td>
            </tr>
        `;
    });
}

// 9. EXPORT & TRACKING
async function exportAllData() {
    console.log("Exporting data...");
    const { data: teams } = await window.supabaseClient.from('teams').select('*');
    const { data: donors } = await window.supabaseClient.from('donors').select('*');

    if (!teams || !donors) { alert("No data to export"); return; }

    let csvContent = "Table,ID,Name/Title,Amount/Details,Date\n";
    teams.forEach(t => { csvContent += `Team,${t.id},"${t.team_name}","Members: ${t.members_count}",${t.created_at}\n`; });
    donors.forEach(d => { csvContent += `Donor,${d.id},"${d.donor_name}","R ${d.amount}",${d.created_at}\n`; });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `kidscan_data_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Silent Page View Tracker (To be included on public pages)
async function trackPageView() {
    const path = window.location.pathname;
    await window.supabaseClient.from('page_views').insert([{ path: path, user_agent: navigator.userAgent }]);
}
// 10. UTILITIES
function formatRole(role) {
    if (!role) return 'Staff';
    return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

async function deleteHero(id) {
    if (!confirm("Are you sure? This will remove this hero from the website.")) return;
    const { error } = await window.supabaseClient.from('heroes').delete().eq('id', id);
    if (error) alert(error.message);
    else { loadHeroes(); logAction("Deleted Hero", `ID: ${id}`); }
}

async function deleteTeam(id) {
    if (!confirm("Remove this team registration?")) return;
    const { error } = await window.supabaseClient.from('teams').delete().eq('id', id);
    if (error) alert(error.message);
    else { loadTeams(); logAction("Deleted Team", `ID: ${id}`); }
}

async function deleteStaff(id) {
    if (!confirm("Revoke dashboard access for this user?")) return;
    const { error } = await window.supabaseClient.from('admin_users').delete().eq('id', id);
    if (error) alert(error.message);
    else { loadStaff(); logAction("Deleted Staff Member", `ID: ${id}`); }
}

async function deleteDonor(id) {
    if (!confirm("Delete this donation record?")) return;
    const { error } = await window.supabaseClient.from('donors').delete().eq('id', id);
    if (error) alert(error.message);
    else { loadDonors(); logAction("Deleted Donor Record", `ID: ${id}`); }
}

async function deleteApplication(id) {
    if (!confirm("Delete this assistance request?")) return;
    const { error } = await window.supabaseClient.from('applications').delete().eq('id', id);
    if (error) alert(error.message);
    else { loadApplications(); logAction("Deleted Application", `ID: ${id}`); }
}

async function deleteContact(id) {
    if (!confirm("Archive/Delete this message?")) return;
    const { error } = await window.supabaseClient.from('contacts').delete().eq('id', id);
    if (error) alert(error.message);
    else { loadContacts(); logAction("Deleted Message", `ID: ${id}`); }
}
