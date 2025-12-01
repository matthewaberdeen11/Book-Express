// Authentication handling with AJAX

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('errorMessage');
    
    try {
        const response = await fetch('/Book-Express/backend/api/login.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            errorDiv.textContent = '';
            window.location.href = '/Book-Express/frontend/dashboard.html';
        } else {
            errorDiv.textContent = data.error || 'Login failed';
        }
    } catch (error) {
        errorDiv.textContent = 'An error occurred. Please try again.';
    }
}

// Check if user is authenticated
async function checkAuth() {
    try {
        const response = await fetch('/Book-Express/backend/api/user.php');
        const data = await response.json();
        return data.success ? data.user : null;
    } catch (error) {
        return null;
    }
}

// Logout function
async function logout() {
    try {
        await fetch('/Book-Express/backend/api/logout.php');
        window.location.href = '/Book-Express/frontend/login.html';
    } catch (error) {
        console.error('Logout failed:', error);
    }
}
