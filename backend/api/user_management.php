<?php
// User management API
header('Content-Type: application/json');

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../auth/SessionManager.php';

SessionManager::init();

if (!SessionManager::isAuthenticated()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

// Only admins and managers can manage users
$user = SessionManager::getCurrentUser();
if ($user['role'] !== 'admin' && $user['role'] !== 'manager') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$action = $_GET['action'] ?? null;

try {
    $conn = get_db_connection();
    
    switch ($action) {
        case 'list':
            listUsers($conn);
            break;
        case 'add':
            addUser($conn);
            break;
        case 'edit':
            editUser($conn);
            break;
        case 'delete':
            deleteUser($conn);
            break;
        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid action']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

function listUsers($conn) {
    try {
        $stmt = $conn->prepare('
            SELECT 
                id,
                username,
                email,
                role,
                created_at,
                last_login
            FROM users
            ORDER BY created_at DESC
        ');
        $stmt->execute();
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Format the response
        $formattedUsers = array_map(function($user) {
            return [
                'id' => $user['id'],
                'username' => $user['username'],
                'email' => $user['email'],
                'role' => $user['role'],
                'created_at' => $user['created_at'],
                'last_login' => $user['last_login'],
                'status' => 'Active'
            ];
        }, $users);
        
        echo json_encode([
            'success' => true,
            'users' => $formattedUsers
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function addUser($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['username']) || !isset($input['email']) || !isset($input['password']) || !isset($input['role'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing required fields']);
        return;
    }
    
    try {
        // Check if user already exists
        $stmt = $conn->prepare('SELECT id FROM users WHERE username = ? OR email = ?');
        $stmt->execute([$input['username'], $input['email']]);
        if ($stmt->rowCount() > 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Username or email already exists']);
            return;
        }
        
        // Hash password
        $hashedPassword = password_hash($input['password'], PASSWORD_BCRYPT);
        
        // Insert new user
        $stmt = $conn->prepare('
            INSERT INTO users (username, email, password_hash, role, created_at)
            VALUES (?, ?, ?, ?, NOW())
        ');
        $stmt->execute([
            $input['username'],
            $input['email'],
            $hashedPassword,
            $input['role']
        ]);
        
        $newUserId = $conn->lastInsertId();
        
        echo json_encode([
            'success' => true,
            'message' => 'User added successfully',
            'user' => [
                'id' => $newUserId,
                'username' => $input['username'],
                'email' => $input['email'],
                'role' => $input['role']
            ]
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function editUser($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'User ID required']);
        return;
    }
    
    try {
        $updates = [];
        $params = [];
        
        if (isset($input['username'])) {
            $updates[] = 'username = ?';
            $params[] = $input['username'];
        }
        
        if (isset($input['email'])) {
            $updates[] = 'email = ?';
            $params[] = $input['email'];
        }
        
        if (isset($input['password']) && !empty($input['password'])) {
            $updates[] = 'password_hash = ?';
            $params[] = password_hash($input['password'], PASSWORD_BCRYPT);
        }
        
        if (isset($input['role'])) {
            $updates[] = 'role = ?';
            $params[] = $input['role'];
        }
        
        if (empty($updates)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'No fields to update']);
            return;
        }
        
        $params[] = $input['id'];
        $query = 'UPDATE users SET ' . implode(', ', $updates) . ' WHERE id = ?';
        
        $stmt = $conn->prepare($query);
        $stmt->execute($params);
        
        echo json_encode([
            'success' => true,
            'message' => 'User updated successfully'
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

function deleteUser($conn) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'User ID required']);
        return;
    }
    
    try {
        // Don't allow deleting the current user
        $currentUser = SessionManager::getCurrentUser();
        if ($currentUser['id'] == $input['id']) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Cannot delete your own account']);
            return;
        }
        
        $stmt = $conn->prepare('DELETE FROM users WHERE id = ?');
        $stmt->execute([$input['id']]);
        
        echo json_encode([
            'success' => true,
            'message' => 'User deleted successfully'
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}
?>
