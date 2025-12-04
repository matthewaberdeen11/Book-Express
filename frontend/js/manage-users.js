// ==================== MANAGE USERS MODULE ====================

let currentEditingUserId = null;

// Initialize manage users page
document.addEventListener('DOMContentLoaded', async function() {
    const user = await checkAuth();
    if (!user) {
        window.location.href = '/Book-Express/frontend/login.html';
        return;
    }
    
    // Check if user has permission to manage users
    if (user.role !== 'admin' && user.role !== 'manager') {
        window.location.href = '/Book-Express/frontend/dashboard.html';
        return;
    }
    
    initializeManageUsers(user);
    setupNavigation();
    setupSidebarToggle();
    loadUsers();
});

// Initialize manage users
function initializeManageUsers(user) {
    const firstLetter = user.username ? user.username.charAt(0).toUpperCase() : 'U';
    const role = user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User';
    
    document.getElementById('userInitial').textContent = firstLetter;
    document.getElementById('userName').textContent = user.username;
    document.getElementById('userRole').textContent = role;
}

function setupNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    
    menuItems.forEach(item => {
        if (item.classList.contains('logout')) {
            return;
        }
        
        item.addEventListener('click', function(e) {
            if (this.getAttribute('href')) {
                window.location.href = this.getAttribute('href');
            }
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
    
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.sidebar') && !e.target.closest('.sidebar-toggle')) {
            closeSidebarMobile();
        }
    });
    
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
    
    if (window.innerWidth <= 768) {
        sidebar.classList.add('collapsed');
        container.classList.remove('sidebar-open');
    }
}

// ==================== USER MANAGEMENT ====================

// Load all users
function loadUsers() {
    fetch('../backend/api/user_management.php?action=list')
        .then(async response => {
            const text = await response.text();
            try { return JSON.parse(text); } catch (e) { return { success: false, error: 'Invalid response' }; }
        })
        .then(data => {
            if (data.success && data.users) {
                displayUsers(data.users);
            } else {
                showError('Failed to load users: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Error loading users:', error);
            showError('Error loading users');
        });
}

// Display users in table
function displayUsers(users) {
    const tbody = document.getElementById('usersBody');
    
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px;">No users found</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${escapeHtml(user.username)}</td>
            <td>${escapeHtml(user.email)}</td>
            <td><span class="role-badge ${user.role}">${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span></td>
            <td>${formatLastSignIn(user.last_login)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action btn-edit" onclick="openEditUserModal(${user.id}, '${escapeHtml(user.username)}', '${escapeHtml(user.email)}', '${user.role}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-action btn-delete" onclick="deleteUser(${user.id}, '${escapeHtml(user.username)}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Format last sign in time
function formatLastSignIn(timestamp) {
    if (!timestamp) {
        return '<span style="color: var(--text-secondary);">Never</span>';
    }
    const date = new Date(timestamp);
    return date.toLocaleString();
}

// Open add user modal
function openAddUserModal() {
    currentEditingUserId = null;
    document.getElementById('modalTitle').textContent = 'Add User';
    document.getElementById('passwordNote').textContent = '*';
    document.getElementById('password').setAttribute('required', 'required');
    document.getElementById('userForm').reset();
    document.getElementById('userModal').classList.add('active');
}

// Open edit user modal
function openEditUserModal(id, username, email, role) {
    currentEditingUserId = id;
    document.getElementById('modalTitle').textContent = 'Edit User';
    document.getElementById('passwordNote').textContent = '(leave blank to keep current)';
    document.getElementById('password').removeAttribute('required');
    document.getElementById('username').value = username;
    document.getElementById('email').value = email;
    document.getElementById('password').value = '';
    document.getElementById('role').value = role;
    document.getElementById('userModal').classList.add('active');
}

// Close user modal
function closeUserModal() {
    document.getElementById('userModal').classList.remove('active');
    document.getElementById('userForm').reset();
    currentEditingUserId = null;
}

// Handle user form submission
async function handleSubmitUser(event) {
    event.preventDefault();
    
    const formData = {
        username: document.getElementById('username').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        role: document.getElementById('role').value
    };
    
    if (currentEditingUserId) {
        // Edit user
        formData.id = currentEditingUserId;
        await updateUser(formData);
    } else {
        // Add new user
        await addUser(formData);
    }
}

// Add new user
async function addUser(userData) {
    try {
        const response = await fetch('../backend/api/user_management.php?action=add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        
        const data = await parseJsonOrText(response);
        
        if (data.success) {
            showSuccess('User added successfully');
            closeUserModal();
            loadUsers();
        } else {
            showError(data.error || 'Failed to add user');
        }
    } catch (error) {
        console.error('Error adding user:', error);
        showError('Error adding user: ' + error.message);
    }
}

// Update user
async function updateUser(userData) {
    try {
        const response = await fetch('../backend/api/user_management.php?action=edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        
        const data = await parseJsonOrText(response);
        
        if (data.success) {
            showSuccess('User updated successfully');
            closeUserModal();
            loadUsers();
        } else {
            showError(data.error || 'Failed to update user');
        }
    } catch (error) {
        console.error('Error updating user:', error);
        showError('Error updating user: ' + error.message);
    }
}

// Delete user
async function deleteUser(id, username) {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
        return;
    }
    
    try {
        const response = await fetch('../backend/api/user_management.php?action=delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
        });
        
        const data = await parseJsonOrText(response);
        
        if (data.success) {
            showSuccess('User deleted successfully');
            loadUsers();
        } else {
            showError(data.error || 'Failed to delete user');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showError('Error deleting user: ' + error.message);
    }
}

// ==================== MESSAGE FUNCTIONS ====================

function showError(message) {
    const container = document.getElementById('messageContainer');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    container.innerHTML = '';
    container.appendChild(errorDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => errorDiv.remove(), 5000);
}

function showSuccess(message) {
    const container = document.getElementById('messageContainer');
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    container.innerHTML = '';
    container.appendChild(successDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => successDiv.remove(), 5000);
}

// ==================== UTILITY FUNCTIONS ====================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function parseJsonOrText(response) {
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    if (contentType.includes('application/json')) {
        try { return JSON.parse(text); } catch (e) { return { success: false, error: 'Invalid JSON response' }; }
    }
    try { return JSON.parse(text); } catch (e) { return { success: false, error: text }; }
}

// ==================== LOGOUT FUNCTION ====================

async function logout() {
    try {
        const response = await fetch('/Book-Express/backend/api/logout.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const text = await response.text();
        let data;
        try { data = JSON.parse(text); } catch (e) { data = { success: false, error: text }; }
        
        if (data.success) {
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

// Check authentication
async function checkAuth() {
    try {
        const response = await fetch('/Book-Express/backend/api/user.php');
        const data = await response.json();
        
        if (!data.success || !data.user) {
            window.location.href = '/Book-Express/frontend/login.html';
            return null;
        }
        
        return data.user;
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/Book-Express/frontend/login.html';
        return null;
    }
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('userModal');
    if (event.target === modal) {
        closeUserModal();
    }
});
