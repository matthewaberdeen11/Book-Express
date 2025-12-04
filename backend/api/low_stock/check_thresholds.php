<?php
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

if (!in_array($user['role'], ['admin', 'staff'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Insufficient permissions']);
    exit;
}

try {
    $conn = get_db_connection();

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Configure threshold (reorder_level) for an item
        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['book_id']) || !isset($input['threshold'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Book ID and threshold are required']);
            exit;
        }

        $bookId = $input['book_id'];
        $threshold = intval($input['threshold']);
        $isCritical = isset($input['is_critical']) ? intval($input['is_critical']) : 0;

        // Update inventory reorder_level (this IS the threshold)
        $stmt = $conn->prepare('UPDATE inventory SET reorder_level = ? WHERE book_id = ?');
        $updated = $stmt->execute([$threshold, $bookId]);

        // If no rows affected, try with item_id (for CSV items)
        if ($stmt->rowCount() === 0) {
            $stmt = $conn->prepare('UPDATE inventory SET reorder_level = ? WHERE item_id = ?');
            $stmt->execute([$threshold, $bookId]);
        }

        // Get current stock to check if alert needed
        $stmt = $conn->prepare('
            SELECT
                i.quantity_on_hand,
                COALESCE(b.title, i.item_name) as title,
                i.book_id,
                i.item_id
            FROM inventory i
            LEFT JOIN books b ON i.book_id = b.id
            WHERE i.book_id = ? OR i.item_id = ?
        ');
        $stmt->execute([$bookId, $bookId]);
        $item = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($item && $item['quantity_on_hand'] < $threshold) {
            // Determine the correct identifier
            $itemIdentifier = $item['book_id'] ?: $item['item_id'];

            // Check if alert already exists for this item
            $stmt = $conn->prepare('
                SELECT id, is_critical FROM low_stock_alerts
                WHERE book_id = ? AND status != "resolved"
            ');
            $stmt->execute([$itemIdentifier]);
            $existingAlert = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$existingAlert) {
                // Create new alert
                $stmt = $conn->prepare('
                    INSERT INTO low_stock_alerts
                    (book_id, status, is_critical, created_by)
                    VALUES (?, "pending", ?, ?)
                ');
                $stmt->execute([
                    $itemIdentifier,
                    $isCritical,
                    $user['id']
                ]);

                $message = 'Threshold configured and alert created';
            } else {
                // Update is_critical flag if needed
                if ($existingAlert['is_critical'] != $isCritical) {
                    $stmt = $conn->prepare('
                        UPDATE low_stock_alerts
                        SET is_critical = ?
                        WHERE id = ?
                    ');
                    $stmt->execute([$isCritical, $existingAlert['id']]);
                }
                $message = 'Threshold configured and alert updated';
            }
        } else {
            $message = 'Threshold configured successfully';
        }

        echo json_encode([
            'success' => true,
            'message' => $message
        ]);

    } else {
        // GET - Run threshold check for all items
        // Find all items where current stock is below reorder_level
        $stmt = $conn->prepare('
            SELECT
                COALESCE(i.book_id, i.item_id) as item_identifier,
                i.book_id,
                i.item_id,
                i.quantity_on_hand,
                i.reorder_level,
                COALESCE(b.title, i.item_name) as title,
                b.isbn
            FROM inventory i
            LEFT JOIN books b ON i.book_id = b.id
            WHERE i.reorder_level > 0
            AND i.quantity_on_hand < i.reorder_level
        ');

        $stmt->execute();
        $lowStockItems = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $alertsCreated = 0;
        $alertsUpdated = 0;

        foreach ($lowStockItems as $item) {
            $itemId = $item['book_id'] ?: $item['item_id'];

            // Check if alert already exists
            $stmt = $conn->prepare('
                SELECT id FROM low_stock_alerts
                WHERE book_id = ? AND status != "resolved"
            ');
            $stmt->execute([$itemId]);
            $existingAlert = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$existingAlert) {
                // Create new alert
                // Determine if critical: out of stock OR less than 50% of reorder level
                $isCritical = ($item['quantity_on_hand'] == 0 ||
                              $item['quantity_on_hand'] < $item['reorder_level'] * 0.5) ? 1 : 0;

                $stmt = $conn->prepare('
                    INSERT INTO low_stock_alerts
                    (book_id, status, is_critical, created_by)
                    VALUES (?, "pending", ?, ?)
                ');
                $stmt->execute([
                    $itemId,
                    $isCritical,
                    $user['id']
                ]);
                $alertsCreated++;
            } else {
                // Alert exists, just update last_updated
                $stmt = $conn->prepare('
                    UPDATE low_stock_alerts
                    SET last_updated = NOW()
                    WHERE id = ?
                ');
                $stmt->execute([$existingAlert['id']]);
                $alertsUpdated++;
            }
        }

        echo json_encode([
            'success' => true,
            'alerts_created' => $alertsCreated,
            'alerts_updated' => $alertsUpdated,
            'total_low_stock' => count($lowStockItems)
        ]);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
