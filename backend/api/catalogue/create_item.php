<?php
//create new catalogue item
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

//check permissions (admin, manager or staff only)
if (!in_array($user['role'], ['admin', 'staff', 'manager'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Insufficient permissions']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    
    //validate input
    if (empty($input['isbn']) || empty($input['title']) || !isset($input['unit_price'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ISBN, title, and unit_price are required']);
        exit;
    }
    
    $conn = get_db_connection();
    
    //check for duplicate ISBN
    $stmt = $conn->prepare('SELECT id FROM books WHERE isbn = ?');
    $stmt->execute([$input['isbn']]);
    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'ISBN already exists']);
        exit;
    }
    
    //start transaction
    $conn->beginTransaction();
    
    //insert book
    $stmt = $conn->prepare('
        INSERT INTO books (isbn, title, author, publisher, category, description, unit_price)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ');
    
    $stmt->execute([
        $input['isbn'],
        $input['title'],
        $input['author'] ?? null,
        $input['publisher'] ?? null,
        $input['category'] ?? null,
        $input['description'] ?? null,
        $input['unit_price']
    ]);
    
    $book_id = $conn->lastInsertId();
    
    //create inventory record
    $initial_quantity = max(0, intval($input['initial_quantity'] ?? 0));
    $reorder_level = intval($input['reorder_level'] ?? 10);
    
    // Generate item_id from ISBN (used for CSV imports and tracking)
    $item_id = strtoupper(str_replace('-', '', $input['isbn'])); // Remove dashes from ISBN
    
    $stmt = $conn->prepare('
        INSERT INTO inventory (book_id, item_id, item_name, quantity_on_hand, reorder_level)
        VALUES (?, ?, ?, ?, ?)
    ');
    
    $stmt->execute([$book_id, $item_id, $input['title'], $initial_quantity, $reorder_level]);
    
    //log creation in audit log
    $stmt = $conn->prepare('
        INSERT INTO catalogue_audit_log 
        (book_id, user_id, action_type, new_value, quantity_change)
        VALUES (?, ?, ?, ?, ?)
    ');
    
    $stmt->execute([
        $book_id,
        $user['id'],
        'CREATE',
        json_encode($input),
        $initial_quantity
    ]);
    
    $conn->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Item created successfully',
        'book_id' => $book_id
    ]);
    
} catch (Exception $e) {
    if (isset($conn)) {
        $conn->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
