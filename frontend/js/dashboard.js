// ==================== UTILITY FUNCTIONS ====================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    const user = await checkAuth();
    if (!user) {
        window.location.href = '/Book-Express/frontend/login.html';
        return;
    }
    
    // Initialize dashboard with user data
    initializeDashboard(user);
    // Load dashboard statistics
    loadDashboardData();
    // Set up navigation
    setupNavigation();
    // Set up sidebar toggle for mobile
    setupSidebarToggle();

    // Set up dashboard search bar
    setupDashboardSearch();
// ==================== DASHBOARD SEARCH ====================
function setupDashboardSearch() {
    const input = document.getElementById('dashboardSearchInput');
    const btn = document.getElementById('dashboardSearchBtn');
    const resultsDiv = document.getElementById('dashboardSearchResults');
    if (!input || !btn || !resultsDiv) return;
    console.debug('dashboard search: elements found', { input, btn, resultsDiv });
    // Ensure button acts as a button
    try { btn.type = 'button'; } catch (e) {}

    btn.addEventListener('click', searchInventory);
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchInventory();
    });

    let lastUpdate = Math.floor(Date.now() / 1000);

    async function searchInventory() {
        console.debug('dashboard search: performing search');
        const query = input.value.trim();
        if (!query) {
            resultsDiv.innerHTML = '<p style="color:#888;">Enter a search term.</p>';
            return;
        }
        resultsDiv.innerHTML = '<p style="color:#888;"><i class="fas fa-spinner fa-spin"></i> Searching...</p>';
        try {
            const response = await fetch(`../backend/api/search.php?action=search&q=${encodeURIComponent(query)}&limit=10`, { credentials: 'same-origin' });
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            if (!data.results || data.results.length === 0) {
                resultsDiv.innerHTML = '<p style="color:#888;">No items found.</p>';
                return;
            }
            let html = '<ul style="list-style:none;padding:0;">';
            data.results.forEach(item => {
                const outClass = (item.quantity === null || Number(item.quantity) <= 0) ? 'out-of-stock' : '';
                html += `<li class="dash-item ${outClass}" data-item-id="${item.item_id}" style="padding:10px 0;border-bottom:1px solid #eee;">
                    <strong>${escapeHtml(item.item_name)}</strong> <span style="color:#2196f3;">(${escapeHtml(item.item_id)})</span><br>
                    Quantity: <span class="dash-qty" data-item-id="${escapeHtml(item.item_id)}">${item.quantity}</span> | Rate: ${escapeHtml(item.rate)}</li>`;
            });
            html += '</ul>';
            resultsDiv.innerHTML = html;
            // update lastUpdate to server time if provided
            if (data.server_time) lastUpdate = data.server_time;
            // start polling for updates
            startRealtimePolling();
        } catch (err) {
            resultsDiv.innerHTML = `<p style="color:#c00;">Error: ${err.message}</p>`;
        }
    }

    // Poll for updates every 3 seconds
    let pollingId = null;
    function startRealtimePolling() {
        if (pollingId) return;
        pollingId = setInterval(fetchUpdates, 3000);
    }

    async function fetchUpdates() {
        try {
            const resp = await fetch(`../backend/api/search.php?action=getUpdates&since=${lastUpdate}&limit=50`, { credentials: 'same-origin' });
            const payload = await resp.json();
            if (payload.server_time) lastUpdate = payload.server_time;
            if (!payload.results || payload.results.length === 0) return;

            payload.results.forEach(item => {
                const selector = `[data-item-id="${item.item_id}"]`;
                const existing = resultsDiv.querySelector(selector);
                const outClass = (item.quantity === null || Number(item.quantity) <= 0) ? 'out-of-stock' : '';

                if (existing) {
                    // update quantity
                    const qtySpan = existing.querySelector('.dash-qty');
                    if (qtySpan) qtySpan.textContent = item.quantity;
                    if (outClass) existing.classList.add('out-of-stock'); else existing.classList.remove('out-of-stock');
                } else {
                    // prepend new item
                    const ul = resultsDiv.querySelector('ul');
                    const li = document.createElement('li');
                    li.className = `dash-item ${outClass}`;
                    li.setAttribute('data-item-id', item.item_id);
                    li.style.padding = '10px 0';
                    li.style.borderBottom = '1px solid #eee';
                    li.innerHTML = `<strong>${escapeHtml(item.item_name)}</strong> <span style="color:#2196f3;">(${escapeHtml(item.item_id)})</span><br>
                        Quantity: <span class="dash-qty" data-item-id="${escapeHtml(item.item_id)}">${item.quantity}</span> | Rate: ${escapeHtml(item.rate)}`;
                    if (ul) ul.insertBefore(li, ul.firstChild);
                }
            });
        } catch (err) {
            console.error('Realtime update fetch failed:', err);
        }
    }
}
});

// ==================== INITIALIZATION FUNCTIONS ====================
function initializeDashboard(user) {
    const firstLetter = user.username ? user.username.charAt(0).toUpperCase() : 'U';
    const role = user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User';
    
    // Update user profile display
    document.getElementById('userInitial').textContent = firstLetter;
    document.getElementById('userName').textContent = user.username;
    document.getElementById('userRole').textContent = role;
    // Update welcome message
    const welcomeMessage = document.getElementById('welcomeMessage');
    welcomeMessage.textContent = `Welcome back, ${user.username}! Select an option from the sidebar to manage your inventory, catalogue, imports, and more.`;
}

function setupNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // Skip default behavior for logout
            if (this.classList.contains('logout')) {
                return;
            }
            // For navigation, go to the href page
            if (this.getAttribute('href')) {
                window.location.href = this.getAttribute('href');
            }
            // Close sidebar on mobile after selection
            closeSidebarMobile();
        });
    });
}

// ==================== SIDEBAR TOGGLE ====================
function setupSidebarToggle() {
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    const container = document.querySelector('.dashboard-container');
    
    if (!toggle) return;
    
    toggle.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');
        container.classList.toggle('sidebar-open');
    });
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.sidebar') && !e.target.closest('.sidebar-toggle')) {
            closeSidebarMobile();
        }
    });
    
    // Handle window resize - ensure sidebar is visible on large screens
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            sidebar.classList.remove('collapsed');
            container.classList.remove('sidebar-open');
        }
    });
}

function closeSidebarMobile() {
    const sidebar = document.querySelector('.sidebar');
    const container = document.querySelector('.dashboard-container');
    
    // Only close on mobile screens
    if (window.innerWidth <= 768) {
        sidebar.classList.add('collapsed');
        container.classList.remove('sidebar-open');
    }
}

// ==================== DATA LOADING ====================
function loadDashboardData() {
    fetch('../backend/api/dashboard.php')
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('Error loading dashboard data:', data.error);
                return;
            }
            updateDashboardCards(data);
        })
        .catch(err => console.error('Failed to load dashboard data:', err));
}

function updateDashboardCards(data) {
    // Update total items
    document.getElementById('totalItems').textContent = data.totalItems || 0;
    
    // Update in/out of stock
    document.getElementById('stockStatus').textContent = `${data.inStock || 0} / ${data.outOfStock || 0}`;
    
    // Update low stock alerts
    document.getElementById('lowStockCount').textContent = data.lowStockCount || 0;
    
    // Update inventory value in JMD format
    const value = parseFloat(data.inventoryValue) || 0;
    const formatted = new Intl.NumberFormat('en-JM', { 
        style: 'currency', 
        currency: 'JMD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
    document.getElementById('inventoryValue').textContent = formatted;
}

// ==================== LOGOUT FUNCTION ====================
async function logout() {
    try {
        const response = await fetch('/Book-Express/backend/api/logout.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Redirect to login page
            window.location.href = '/Book-Express/frontend/login.html';
        } else {
            console.error('Logout failed:', data.error);
            alert('Logout failed. Please try again.');
        }
    } catch (error) {
        console.error('Error during logout:', error);
        alert('An error occurred during logout. Please try again.');
    }
}
