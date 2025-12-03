<?php
//adjust stock with reason tracking
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

//check permissions
if (!in_array($user['role'], ['admin', 'staff'])) {
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
    if (empty($input['book_id']) || !isset($input['adjustment_amount']) || empty($input['reason'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Book ID, adjustment amount, and reason are required']);
        exit;
    }
    
    $adjustment = intval($input['adjustment_amount']);
    $reason = $input['reason'];
    $notes = $input['notes'] ?? '';
    $source = $input['source'] ?? 'manual'; // Default to manual if not specified
    
    //validate reason - accept predefined reasons
    $valid_reasons = [
        'Stock Count Discrepancy',
        'Damaged/Defective',
        'Lost/Missing',
        'Theft/Shrinkage',
        'Inventory Adjustment',
        'Return from Customer',
        'Physical Stocktake',
        'System Correction',
        'Expired/Obsolete'
    ];
    
    // Check if reason starts with "Other:" (custom reason)
    if (!in_array($reason, $valid_reasons) && !preg_match('/^Other:/', $reason)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid reason']);
        exit;
    }
    
    $conn = get_db_connection();
    
    // Get current stock based on source
    if ($source === 'csv') {
        // CSV items: query by item_id, get item_name instead of title
        $stmt = $conn->prepare('
            SELECT i.quantity_on_hand, i.item_name, i.item_id
            FROM inventory i
            WHERE i.item_id = ? AND i.book_id IS NULL
        ');
        $stmt->execute([$input['book_id']]);
        $current = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($current) {
            $current['title'] = $current['item_name'];
        }
    } else {
        // Manual items: query by book_id with books table join
        $stmt = $conn->prepare('
            SELECT i.quantity_on_hand, b.title, i.book_id
            FROM inventory i
            JOIN books b ON i.book_id = b.id
            WHERE i.book_id = ?
        ');
        $stmt->execute([$input['book_id']]);
        $current = $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    if (!$current) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Item not found']);
        exit;
    }
    
    $current_stock = intval($current['quantity_on_hand']);
    $new_stock = $current_stock + $adjustment;
    
    //prevent negative stock 
    if ($new_stock < 0) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => "Cannot reduce stock below zero. Current: $current_stock, Attempted: $adjustment"
        ]);
        exit;
    }
    
    //start transaction
    $conn->beginTransaction();
    
    //update inventory based on source
    if ($source === 'csv') {
        $stmt = $conn->prepare('UPDATE inventory SET quantity_on_hand = ? WHERE item_id = ?');
        $stmt->execute([$new_stock, $input['book_id']]);
    } else {
        $stmt = $conn->prepare('UPDATE inventory SET quantity_on_hand = ? WHERE book_id = ?');
        $stmt->execute([$new_stock, $input['book_id']]);
    }
    
    //log adjustment
    $stmt = $conn->prepare('
        INSERT INTO catalogue_audit_log 
        (book_id, user_id, action_type, old_value, new_value, quantity_change, adjustment_reason, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ');
    
    // For CSV items, book_id will be NULL, which is fine for the audit log
    $book_id_for_log = ($source === 'csv') ? null : $input['book_id'];
    
    $stmt->execute([
        $book_id_for_log,
        $user['id'],
        'ADJUST_STOCK',
        $current_stock,
        $new_stock,
        $adjustment,
        $reason,
        $notes
    ]);
    
    $conn->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Stock adjusted successfully',
        'old_stock' => $current_stock,
        'new_stock' => $new_stock
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
