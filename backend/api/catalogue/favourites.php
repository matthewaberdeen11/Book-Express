<?php
// Favourites management API
header('Content-Type: application/json');

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../auth/SessionManager.php';

SessionManager::init();

if (!SessionManager::isAuthenticated()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

$user = SessionManager::getUser();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    $conn = get_db_connection();
    
    if ($method === 'GET') {
        if ($action === 'list') {
            // Get all favourites with current stock
            $stmt = $conn->prepare('
                SELECT 
                    f.id,
                    f.item_id,
                    i.item_name,
                    i.quantity_on_hand as stock,
                    i.rate as price,
                    i.grade_level
                FROM favourites f
                JOIN inventory i ON f.item_id = i.item_id
                ORDER BY f.added_at DESC
                LIMIT 50
            ');
            $stmt->execute();
            $favourites = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode([
                'success' => true,
                'items' => $favourites,
                'count' => count($favourites)
            ]);
            exit;
        }
    }
    
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if ($action === 'add') {
            // Add to favourites
            if (empty($input['item_id'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'item_id is required']);
                exit;
            }
            
            $item_id = $input['item_id'];
            
            // Check if already exists
            $check_stmt = $conn->prepare('SELECT id FROM favourites WHERE item_id = ?');
            $check_stmt->execute([$item_id]);
            
            if ($check_stmt->fetch()) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Item is already in favourites']);
                exit;
            }
            
            // Start transaction
            $conn->beginTransaction();
            
            // Add to favourites
            $stmt = $conn->prepare('
                INSERT INTO favourites (item_id, added_by)
                VALUES (?, ?)
            ');
            $stmt->execute([$item_id, $user['id']]);
            
            // Update inventory is_favourite flag
            $stmt = $conn->prepare('UPDATE inventory SET is_favourite = true WHERE item_id = ?');
            $stmt->execute([$item_id]);
            
            $conn->commit();
            
            echo json_encode([
                'success' => true,
                'message' => 'Item added to favourites'
            ]);
            exit;
        }
        
        if ($action === 'remove') {
            // Remove from favourites
            if (empty($input['item_id'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'item_id is required']);
                exit;
            }
            
            $item_id = $input['item_id'];
            
            // Start transaction
            $conn->beginTransaction();
            
            $stmt = $conn->prepare('
                DELETE FROM favourites 
                WHERE item_id = ?
            ');
            $stmt->execute([$item_id]);
            
            // Update inventory is_favourite flag
            $stmt = $conn->prepare('UPDATE inventory SET is_favourite = false WHERE item_id = ?');
            $stmt->execute([$item_id]);
            
            $conn->commit();
            
            echo json_encode([
                'success' => true,
                'message' => 'Item removed from favourites'
            ]);
            exit;
        }
        
        if ($action === 'check') {
            // Check if item is in favourites
            if (empty($input['item_id'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'item_id is required']);
                exit;
            }
            
            $item_id = $input['item_id'];
            
            $stmt = $conn->prepare('
                SELECT id FROM favourites 
                WHERE item_id = ?
            ');
            $stmt->execute([$item_id]);
            
            $is_favourite = (bool)$stmt->fetch();
            
            echo json_encode([
                'success' => true,
                'is_favourite' => $is_favourite
            ]);
            exit;
        }
    }
    
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid action']);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
