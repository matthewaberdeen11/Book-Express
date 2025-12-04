<?php
//create new catalogue item
header('Content-Type: application/json');

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../auth/SessionManager.php';
require_once __DIR__ . '/../../utils/GradeExtractor.php';

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
    if (empty($input['item_name']) || !isset($input['rate'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Item name and price are required']);
        exit;
    }
    
    $conn = get_db_connection();
    
    // Generate item_id from item_name if not provided
    $item_id = $input['item_id'] ?? null;
    if (!$item_id) {
        $item_id = 'ITEM-' . strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $input['item_name']), 0, 10)) . '-' . time();
    }
    
    // Check for duplicate item_id
    $stmt = $conn->prepare('SELECT id FROM inventory WHERE item_id = ?');
    $stmt->execute([$item_id]);
    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'Item ID already exists']);
        exit;
    }
    
    // Extract grade level if not provided
    $grade_level = $input['grade_level'] ?? null;
    if (!$grade_level) {
        $grade_level = GradeExtractor::extractGrade($input['item_name']) ?? 'Ungraded';
    }
    
    //start transaction
    $conn->beginTransaction();
    
    //insert into inventory
    $stmt = $conn->prepare('
        INSERT INTO inventory (item_id, item_name, grade_level, rate, product_type, quantity_on_hand, reorder_level)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ');
    
    $stmt->execute([
        $item_id,
        $input['item_name'],
        $grade_level,
        $input['rate'],
        $input['product_type'] ?? 'goods',
        0,
        10
    ]);
    
    //log creation in audit log
    $stmt = $conn->prepare('
        INSERT INTO catalogue_audit_log 
        (item_id, user_id, action_type, new_value, created_at)
        VALUES (?, ?, ?, ?, NOW())
    ');
    
    $stmt->execute([
        $item_id,
        $user['id'],
        'CREATE',
        json_encode(['item_name' => $input['item_name'], 'grade_level' => $input['grade_level'], 'rate' => $input['rate']])
    ]);
    
    $conn->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Item created successfully',
        'item_id' => $item_id
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
