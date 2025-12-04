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
    // Load dashboard statistics and chart
    loadDashboardData();
    // Set up navigation
    setupNavigation();
    // Set up sidebar toggle for mobile
    setupSidebarToggle();
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
    
    //Handle window resize by ensuring sidebar is visible on large screens
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

// ==================== FAVOURITES LOADING ====================
function loadFavourites() {
    fetch('../backend/api/catalogue/favourites.php?action=list')
        .then(async response => {
            const data = await parseJsonOrText(response);
            if (data && data.success) {
                displayFavourites(data.items);
            } else {
                console.error('Error loading favourites:', data.error || data);
            }
        })
        .catch(error => console.error('Error loading favourites:', error));
}

function displayFavourites(items) {
    const container = document.getElementById('favouritesList');
    if (!container) return;
    
    if (!items || items.length === 0) {
        container.innerHTML = '<p style="color: #8b92ad; text-align: center; padding: 10px;">No favourites yet. Add items from the inventory to get started.</p>';
        return;
    }
    
    let html = '';
    items.forEach(item => {
        const outOfStock = item.stock === 0 ? ' out-of-stock' : '';
        const stockDisplay = item.stock === 0 ? 'Out of Stock' : `Stock: ${item.stock}`;
        html += `
            <div class="favourite-item${outOfStock}">
                <div class="favourite-info">
                    <p class="favourite-title">${escapeHtml(item.title || item.item_name)}</p>
                    <p class="favourite-stock">${stockDisplay}</p>
                </div>
                <button class="btn-favourite-remove" data-book-id="${item.book_id || ''}" data-item-id="${item.item_id || ''}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    });
    container.innerHTML = html;
}

function removeFavourite(bookId, itemId, button) {
    const data = {};
    if (bookId) data.book_id = bookId;
    if (itemId) data.item_id = itemId;
    
    // Get the card element to remove it immediately
    const cardElement = button.closest('.favourite-item');
    
    fetch('../backend/api/catalogue/favourites.php?action=remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(async response => {
            const data = await parseJsonOrText(response);
            if (data && data.success) {
                // Remove the card immediately with fade-out animation
                if (cardElement) {
                    cardElement.style.opacity = '0';
                    cardElement.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        cardElement.remove();
                    }, 300);
                }
            } else {
                console.error('Error removing favourite:', data.error || data);
            }
        })
        .catch(error => console.error('Error:', error));
}

// Event delegation to handle favourite remove button click
document.addEventListener('click', function(event) {
    const btn = event.target.closest('.btn-favourite-remove');
    if (btn) {
        const bookId = btn.dataset.bookId || '';
        const itemId = btn.dataset.itemId || '';
        removeFavourite(bookId, itemId, btn);
    }
});

// Helper to parse JSON responses safely even if server returns HTML error pages
async function parseJsonOrText(response) {
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    if (contentType.includes('application/json')) {
        try {
            return JSON.parse(text);
        } catch (e) {
            return { success: false, error: 'Invalid JSON response' };
        }
    }
    // If not JSON, attempt JSON parse; otherwise return text as error
    try {
        return JSON.parse(text);
    } catch (e) {
        return { success: false, error: text };
    }
}

function viewFavouriteItem(bookId, itemId) {
    // Navigate to catalogue page for now
    window.location.href = 'catalogue.html';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== DATA LOADING ====================
function loadDashboardData() {
    loadFavourites();
    
    fetch('../backend/api/dashboard/analytics.php?metric=overview')
        .then(async response => {
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('Invalid JSON response:', text);
                return { success: false, error: 'Invalid response' };
            }
        })
        .then(data => {
            if (data.error || !data.success) {
                console.error('Error loading dashboard data:', data.error);
                return;
            }
            updateDashboardCards(data);
        })
        .catch(err => console.error('Failed to load dashboard data:', err));
}

function updateDashboardCards(response) {
    if (!response.success || !response.data || !response.data.overview) {
        console.error('Invalid response structure:', response);
        return;
    }
    
    const data = response.data.overview;
    
    // Update total items
    document.getElementById('totalItems').textContent = data.total_items || 0;
    
    // Update in/out of stock
    document.getElementById('stockStatus').textContent = `${data.in_stock || 0} / ${data.out_of_stock || 0}`;
    
    // Update low stock alerts
    document.getElementById('lowStockCount').textContent = data.low_stock_alerts || 0;
    
    // Update inventory value in JMD format
    const value = parseFloat(data.total_value) || 0;
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
        
        const text = await response.text();
        let data;
        try { data = JSON.parse(text); } catch (e) { data = { success: false, error: text }; }
        
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
