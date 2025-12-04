<?php
//update catalogue item details
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

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $source = $input['source'] ?? 'manual';
    
    // Handle CSV items differently
    if ($source === 'csv') {
        if (empty($input['item_id'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Item ID is required']);
            exit;
        }
        
        $conn = get_db_connection();
        
        // Get current inventory item details
        $stmt = $conn->prepare('SELECT * FROM inventory WHERE item_id = ? AND book_id IS NULL');
        $stmt->execute([$input['item_id']]);
        $current = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$current) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Item not found']);
            exit;
        }
        
        // Track changes for CSV items
        $changes = [];
        $update_parts = [];
        $update_values = [];
        
        // CSV items can update: item_name (title), product_type (category), rate (unit_price)
        if (isset($input['title']) && $input['title'] != $current['item_name']) {
            $update_parts[] = "item_name = ?";
            $update_values[] = $input['title'];
            $changes['item_name'] = [
                'old' => $current['item_name'],
                'new' => $input['title']
            ];
        }
        
        if (isset($input['category']) && $input['category'] != $current['product_type']) {
            $update_parts[] = "product_type = ?";
            $update_values[] = $input['category'];
            $changes['product_type'] = [
                'old' => $current['product_type'],
                'new' => $input['category']
            ];
        }
        
        if (isset($input['unit_price']) && $input['unit_price'] != $current['rate']) {
            $update_parts[] = "rate = ?";
            $update_values[] = $input['unit_price'];
            $changes['rate'] = [
                'old' => $current['rate'],
                'new' => $input['unit_price']
            ];
        }
        
        // Update inventory item if there are changes
        if (!empty($update_parts)) {
            $update_values[] = $input['item_id'];
            $sql = 'UPDATE inventory SET ' . implode(', ', $update_parts) . ' WHERE item_id = ? AND book_id IS NULL';
            $stmt = $conn->prepare($sql);
            $stmt->execute($update_values);
            
            // Log changes in audit log
            foreach ($changes as $field => $change) {
                $stmt = $conn->prepare('
                    INSERT INTO catalogue_audit_log 
                    (item_id, user_id, action_type, field_changed, old_value, new_value)
                    VALUES (?, ?, ?, ?, ?, ?)
                ');
                
                $stmt->execute([
                    $input['item_id'],
                    $user['id'],
                    'UPDATE',
                    $field,
                    $change['old'],
                    $change['new']
                ]);
            }
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'CSV item updated successfully',
            'changes' => count($changes)
        ]);
        exit;
    }
    
    // Handle manual items (existing logic)
    if (empty($input['book_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Book ID is required']);
        exit;
    }
    
    $conn = get_db_connection();
    
    //get current book details
    $stmt = $conn->prepare('SELECT * FROM books WHERE id = ?');
    $stmt->execute([$input['book_id']]);
    $current = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$current) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Book not found']);
        exit;
    }
    
    //start transaction
    $conn->beginTransaction();
    
    //track changes
    $changes = [];
    $fields_to_update = ['title', 'author', 'publisher', 'category', 'description', 'unit_price'];
    $update_parts = [];
    $update_values = [];
    
    foreach ($fields_to_update as $field) {
        if (isset($input[$field]) && $input[$field] != $current[$field]) {
            $update_parts[] = "$field = ?";
            $update_values[] = $input[$field];
            $changes[$field] = [
                'old' => $current[$field],
                'new' => $input[$field]
            ];
        }
    }
    
    //update book if there are changes
    if (!empty($update_parts)) {
        $update_values[] = $input['book_id'];
        $sql = 'UPDATE books SET ' . implode(', ', $update_parts) . ' WHERE id = ?';
        $stmt = $conn->prepare($sql);
        $stmt->execute($update_values);
        
        //log changes in audit log
        foreach ($changes as $field => $change) {
            $stmt = $conn->prepare('
                INSERT INTO catalogue_audit_log 
                (book_id, user_id, action_type, field_changed, old_value, new_value)
                VALUES (?, ?, ?, ?, ?, ?)
            ');
            
            $stmt->execute([
                $input['book_id'],
                $user['id'],
                'UPDATE',
                $field,
                $change['old'],
                $change['new']
            ]);
            
            //track price changes separately
            if ($field === 'unit_price') {
                $stmt = $conn->prepare('
                    INSERT INTO price_history (book_id, old_price, new_price, changed_by)
                    VALUES (?, ?, ?, ?)
                ');
                
                $stmt->execute([
                    $input['book_id'],
                    $change['old'],
                    $change['new'],
                    $user['id']
                ]);
            }
        }
    }
    
    //update inventory if reorder_level provided
    if (isset($input['reorder_level'])) {
        $stmt = $conn->prepare('UPDATE inventory SET reorder_level = ? WHERE book_id = ?');
        $stmt->execute([$input['reorder_level'], $input['book_id']]);
    }
    
    $conn->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Item updated successfully'
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
