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

try {
    $conn = get_db_connection();

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

    // Get all active low stock alerts
    // Join with inventory to get current stock and reorder_level (threshold)
    $stmt = $conn->prepare('
        SELECT
            lsa.id as alert_id,
            lsa.book_id,
            lsa.status,
            lsa.is_critical,
            lsa.created_at as alert_date,
            lsa.last_updated,
            COALESCE(b.title, i.item_name) as item_name,
            b.isbn,
            b.author,
            i.quantity_on_hand as current_quantity,
            i.reorder_level as threshold_value,
            i.reorder_level as threshold
        FROM low_stock_alerts lsa
        LEFT JOIN inventory i ON (
            (lsa.book_id = i.book_id AND i.book_id IS NOT NULL) OR
            (lsa.book_id = i.item_id AND i.item_id IS NOT NULL)
        )
        LEFT JOIN books b ON i.book_id = b.id
        WHERE lsa.status != "resolved"
        ORDER BY
            CASE lsa.status
                WHEN "pending" THEN 1
                WHEN "acknowledged" THEN 2
                WHEN "reorder_initiated" THEN 3
                ELSE 4
            END,
            lsa.is_critical DESC,
            lsa.created_at DESC
    ');

    $stmt->execute();
    $alerts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'alerts' => $alerts
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
