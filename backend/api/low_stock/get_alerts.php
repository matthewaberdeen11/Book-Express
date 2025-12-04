<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../auth/SessionManager.php';

SessionManager::init();
if (!SessionManager::isAuthenticated()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

try {
    $conn = get_db_connection();

    $debugInfo = [
        'step' => 'starting',
        'tables_checked' => false,
        'low_stock_items_found' => 0,
        'alerts_created' => 0,
        'alerts_resolved' => 0,
        'duplicates_removed' => 0,
        'final_alerts' => 0
    ];

    // Check if requesting specific alert history
    if (isset($_GET['alert_id'])) {
        $stmt = $conn->prepare('
            SELECT
                lsh.id,
                lsh.alert_id,
                lsh.status as status_change,
                lsh.notes,
                lsh.updated_at as timestamp,
                u.username as updated_by
            FROM low_stock_history lsh
            LEFT JOIN users u ON lsh.updated_by = u.id
            WHERE lsh.alert_id = ?
            ORDER BY lsh.updated_at DESC
        ');
        $stmt->execute([$_GET['alert_id']]);
        $history = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'history' => $history
        ]);
        exit;
    }

    // verification stage: Check if tables exist
    $debugInfo['step'] = 'checking_tables';
    $tables = $conn->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    $debugInfo['available_tables'] = $tables;
    $debugInfo['has_low_stock_alerts'] = in_array('low_stock_alerts', $tables);
    $debugInfo['has_inventory'] = in_array('inventory', $tables);

    if (!$debugInfo['has_low_stock_alerts']) {
        echo json_encode([
            'success' => false,
            'error' => 'Table low_stock_alerts does not exist',
            'debug' => $debugInfo
        ]);
        exit;
    }

    $debugInfo['step'] = 'cleaning_duplicates';

    $stmt = $conn->prepare('
        DELETE lsa1 FROM low_stock_alerts lsa1
        INNER JOIN (
            SELECT book_id, MAX(id) as max_id
            FROM low_stock_alerts
            WHERE status != "resolved"
            GROUP BY book_id
            HAVING COUNT(*) > 1
        ) lsa2 ON lsa1.book_id = lsa2.book_id
        WHERE lsa1.id < lsa2.max_id
        AND lsa1.status != "resolved"
    ');
    $stmt->execute();
    $debugInfo['duplicates_removed'] = $stmt->rowCount();

    //step 1: Find ALL low stock items
    $debugInfo['step'] = 'finding_low_stock_items';

    $stmt = $conn->prepare('
        SELECT
            i.id as inventory_id,
            i.book_id,
            i.item_id,
            i.item_name,
            i.quantity_on_hand,
            i.reorder_level,
            CASE
                WHEN i.quantity_on_hand = 0 THEN 1
                WHEN i.quantity_on_hand < (i.reorder_level * 0.5) THEN 1
                ELSE 0
            END as is_critical
        FROM inventory i
        WHERE i.reorder_level IS NOT NULL
        AND i.reorder_level > 0
        AND i.quantity_on_hand < i.reorder_level
    ');

    $stmt->execute();
    $allLowStockItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $debugInfo['low_stock_items_found'] = count($allLowStockItems);
    $debugInfo['low_stock_items_sample'] = array_slice($allLowStockItems, 0, 3);

    //step  2: Create alerts for items that need them
    $debugInfo['step'] = 'creating_alerts';
    $newAlertsCreated = 0;

    foreach ($allLowStockItems as $item) {
        //Determines which identifier to use
        $identifier = null;
        if (!empty($item['book_id'])) {
            $identifier = $item['book_id'];
        } elseif (!empty($item['item_id'])) {
            $identifier = $item['item_id'];
        }

        if ($identifier === null) {
            $debugInfo['skipped_items'][] = "Inventory ID {$item['inventory_id']} has no book_id or item_id";
            continue;
        }

        //Checks if alert already exists
        $checkStmt = $conn->prepare('
            SELECT id, status FROM low_stock_alerts
            WHERE book_id = ?
            LIMIT 1
        ');
        $checkStmt->execute([$identifier]);
        $existingAlert = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (!$existingAlert) {
            // Create new alert
            try {
                $insertStmt = $conn->prepare('
                    INSERT INTO low_stock_alerts
                    (book_id, status, is_critical, created_at, last_updated)
                    VALUES (?, ?, ?, NOW(), NOW())
                ');
                $insertStmt->execute([
                    $identifier,
                    'pending',
                    $item['is_critical']
                ]);
                $newAlertsCreated++;
                $debugInfo['created_alerts'][] = [
                    'book_id' => $identifier,
                    'item_name' => $item['item_name'],
                    'quantity' => $item['quantity_on_hand'],
                    'threshold' => $item['reorder_level']
                ];
            } catch (PDOException $e) {
                $debugInfo['insert_errors'][] = $e->getMessage();
            }
        } elseif ($existingAlert['status'] === 'resolved') {
            //Reopens resolved alert
            $updateStmt = $conn->prepare('
                UPDATE low_stock_alerts
                SET status = ?, is_critical = ?, last_updated = NOW()
                WHERE id = ?
            ');
            $updateStmt->execute(['pending', $item['is_critical'], $existingAlert['id']]);
            $debugInfo['reopened_alerts'][] = $existingAlert['id'];
        }
    }

    $debugInfo['alerts_created'] = $newAlertsCreated;

    //step 3: Auto-resolve alerts for items now above threshold
    $debugInfo['step'] = 'resolving_alerts';

    $stmt = $conn->prepare('
        UPDATE low_stock_alerts lsa
        INNER JOIN inventory i ON (
            CAST(lsa.book_id AS CHAR) = CAST(i.book_id AS CHAR)
            OR CAST(lsa.book_id AS CHAR) = CAST(i.item_id AS CHAR)
        )
        SET lsa.status = "resolved",
            lsa.last_updated = NOW()
        WHERE lsa.status != "resolved"
        AND i.quantity_on_hand >= (i.reorder_level * 1.2)
    ');
    $stmt->execute();
    $debugInfo['alerts_resolved'] = $stmt->rowCount();

    //step 4: Update is_critical flag
    $debugInfo['step'] = 'updating_critical_status';

    $stmt = $conn->prepare('
        UPDATE low_stock_alerts lsa
        INNER JOIN inventory i ON (
            CAST(lsa.book_id AS CHAR) = CAST(i.book_id AS CHAR)
            OR CAST(lsa.book_id AS CHAR) = CAST(i.item_id AS CHAR)
        )
        SET lsa.is_critical = CASE
                WHEN i.quantity_on_hand = 0 THEN 1
                WHEN i.quantity_on_hand < (i.reorder_level * 0.5) THEN 1
                ELSE 0
            END,
            lsa.last_updated = NOW()
        WHERE lsa.status != "resolved"
    ');
    $stmt->execute();

    //Get all active alerts with full details (NO duplicates)
    $debugInfo['step'] = 'fetching_alerts';

    //Uses a more better query that ensures no duplicates
    $stmt = $conn->prepare('
        SELECT
            lsa.id as alert_id,
            lsa.book_id,
            lsa.status,
            lsa.is_critical,
            lsa.created_at as alert_date,
            lsa.last_updated,
            COALESCE(b.title, i.item_name, CONCAT("Item #", lsa.book_id)) as item_name,
            b.isbn,
            b.author,
            i.quantity_on_hand as current_quantity,
            i.reorder_level as threshold_value,
            i.reorder_level as threshold
        FROM low_stock_alerts lsa
        LEFT JOIN inventory i ON (
            CAST(lsa.book_id AS CHAR) = CAST(COALESCE(i.book_id, i.item_id) AS CHAR)
        )
        LEFT JOIN books b ON i.book_id = b.id
        WHERE lsa.status != "resolved"
        GROUP BY lsa.id
        ORDER BY
            CASE lsa.status
                WHEN "pending" THEN 1
                WHEN "acknowledged" THEN 2
                WHEN "reorder_initiated" THEN 3
                ELSE 4
            END,
            lsa.is_critical DESC,
            COALESCE(i.quantity_on_hand, 999) ASC
    ');

    $stmt->execute();
    $alerts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $debugInfo['final_alerts'] = count($alerts);
    $debugInfo['step'] = 'complete';

    //Also get count of all alerts (including resolved)
    $totalStmt = $conn->query('SELECT COUNT(*) FROM low_stock_alerts');
    $debugInfo['total_alerts_in_table'] = $totalStmt->fetchColumn();

    echo json_encode([
        'success' => true,
        'alerts' => $alerts,
        'count' => count($alerts),
        'debug' => $debugInfo
    ]);

} catch (Exception $e) {
    error_log("Low Stock Alerts Error: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'error_line' => $e->getLine(),
        'error_file' => $e->getFile(),
        'trace' => explode("\n", $e->getTraceAsString()),
        'debug' => $debugInfo ?? []
    ]);
}
?>
