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
    
    // Use item_id only
    $item_id = $input['item_id'] ?? null;
    $adjustment_amount = $input['adjustment_amount'] ?? null;
    $reason = $input['reason'] ?? null;
    
    //validate input - check for null/empty string, but allow 0 and negative numbers
    if (empty($item_id) || $adjustment_amount === null || $adjustment_amount === '' || empty($reason)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'item_id, adjustment_amount, and reason are required']);
        exit;
    }
    
    $adjustment = intval($adjustment_amount);
    
    // If reason is "Bulk deduct", negate the adjustment
    if ($reason === 'Bulk deduct') {
        $adjustment = -$adjustment;
    }
    
    $notes = $input['notes'] ?? '';
    
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
        'Expired/Obsolete',
        'Bulk add',
        'Bulk deduct'
    ];
    
    // Check if reason starts with "Other:" or "Bulk" (custom reason)
    if (!in_array($reason, $valid_reasons) && !preg_match('/^(Other:|Bulk)/', $reason)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid reason']);
        exit;
    }
    
    $conn = get_db_connection();
    
    // Get current stock and grade level
    $stmt = $conn->prepare('
        SELECT i.quantity_on_hand, i.item_name, i.grade_level
        FROM inventory i
        WHERE i.item_id = ?
    ');
    $stmt->execute([$item_id]);
    $current = $stmt->fetch(PDO::FETCH_ASSOC);
    
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
    
    //update inventory
    $stmt = $conn->prepare('UPDATE inventory SET quantity_on_hand = ? WHERE item_id = ?');
    $stmt->execute([$new_stock, $item_id]);
    
    // Check if we need to create/update low stock alert
    $reorder_level = 10; // default
    $stmt = $conn->prepare('SELECT reorder_level FROM inventory WHERE item_id = ?');
    $stmt->execute([$item_id]);
    $inv = $stmt->fetch();
    if ($inv && $inv['reorder_level']) {
        $reorder_level = intval($inv['reorder_level']);
    }
    
    // Create or update alert if stock is below reorder level
    if ($new_stock < $reorder_level && $new_stock > 0) {
        // Check if alert already exists
        $stmt = $conn->prepare('SELECT id FROM low_stock_alerts WHERE item_id = ? AND status = "active"');
        $stmt->execute([$item_id]);
        $existing_alert = $stmt->fetch();
        
        if (!$existing_alert) {
            // Create new alert with grade_level
            $stmt = $conn->prepare('
                INSERT INTO low_stock_alerts (item_id, grade_level, threshold, current_quantity, status, alert_created_at)
                VALUES (?, ?, ?, ?, "active", NOW())
            ');
            $stmt->execute([$item_id, $current['grade_level'], $reorder_level, $new_stock]);
        } else {
            // Update existing alert
            $stmt = $conn->prepare('UPDATE low_stock_alerts SET current_quantity = ? WHERE id = ?');
            $stmt->execute([$new_stock, $existing_alert['id']]);
        }
    } else if ($new_stock >= $reorder_level) {
        // Clear any active alerts if stock is back above reorder level
        $stmt = $conn->prepare('UPDATE low_stock_alerts SET status = "cleared", alert_cleared_at = NOW() WHERE item_id = ? AND status = "active"');
        $stmt->execute([$item_id]);
    }
    
    //log adjustment
    $stmt = $conn->prepare('
        INSERT INTO catalogue_audit_log 
        (item_id, user_id, action_type, old_value, new_value, quantity_change, adjustment_reason, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ');
    
    $stmt->execute([
        $item_id,
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
