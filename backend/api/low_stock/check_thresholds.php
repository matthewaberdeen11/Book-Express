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
        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['book_id']) || !isset($input['threshold'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Book ID and threshold are required']);
            exit;
        }

        $bookId = $input['book_id'];
        $threshold = intval($input['threshold']);
        $applyToGradeLevel = isset($input['is_critical']) ? intval($input['is_critical']) : 0;

        //it firstly gets the item details.
        $stmt = $conn->prepare('
            SELECT
                i.id as inventory_id,
                i.book_id,
                i.item_id,
                i.item_name,
                i.quantity_on_hand,
                COALESCE(b.title, i.item_name) as title
            FROM inventory i
            LEFT JOIN books b ON i.book_id = b.id
            WHERE i.book_id = ? OR i.item_id = ?
        ');
        $stmt->execute([$bookId, $bookId]);
        $item = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$item) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Item not found']);
            exit;
        }

        $rowsUpdated = 0;

        //If "Mark For All Books At The Same Grade Level" is checked
        if ($applyToGradeLevel) {
            //Extract grade level from item_name using regex
            $itemName = $item['item_name'] ?: $item['title'];
            $gradePattern = '/Grade\s+(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|\d+)/i';

            if (preg_match($gradePattern, $itemName, $matches)) {
                $gradeText = $matches[1];

                //Map between numeric and word forms
                $gradeMap = [
                    '1' => 'one', '2' => 'two', '3' => 'three', '4' => 'four',
                    '5' => 'five', '6' => 'six', '7' => 'seven', '8' => 'eight',
                    '9' => 'nine', '10' => 'ten', '11' => 'eleven', '12' => 'twelve',
                    'one' => '1', 'two' => '2', 'three' => '3', 'four' => '4',
                    'five' => '5', 'six' => '6', 'seven' => '7', 'eight' => '8',
                    'nine' => '9', 'ten' => '10', 'eleven' => '11', 'twelve' => '12'
                ];

                $gradeLower = strtolower($gradeText);
                $alternateForm = isset($gradeMap[$gradeLower]) ? $gradeMap[$gradeLower] : null;

                //Create regex pattern that matches BOTH forms (e.g., "3" OR "three")
                if ($alternateForm) {
                    $regexPattern = 'grade[[:space:]]+(' . $gradeLower . '|' . $alternateForm . ')([^0-9a-z]|$)';
                } else {
                    $regexPattern = 'grade[[:space:]]+' . $gradeLower . '([^0-9a-z]|$)';
                }

                //Update all items with matching grade level in their item_name or title
                $stmt = $conn->prepare('
                    UPDATE inventory i
                    LEFT JOIN books b ON i.book_id = b.id
                    SET i.reorder_level = ?
                    WHERE LOWER(COALESCE(b.title, i.item_name)) REGEXP ?
                ');

                $stmt->execute([$threshold, $regexPattern]);
                $rowsUpdated = $stmt->rowCount();

                echo json_encode([
                    'success' => true,
                    'message' => "Threshold set to $threshold for $rowsUpdated items in Grade " . ucfirst($gradeLower),
                    'rows_updated' => $rowsUpdated
                ]);
            } else {
                //No grade found, just update the single item
                $stmt = $conn->prepare('UPDATE inventory SET reorder_level = ? WHERE id = ?');
                $stmt->execute([$threshold, $item['inventory_id']]);
                $rowsUpdated = $stmt->rowCount();

                echo json_encode([
                    'success' => true,
                    'message' => "Threshold set to $threshold for 1 item (no grade level detected)",
                    'rows_updated' => $rowsUpdated
                ]);
            }
        } else {
            //Just update the single item
            $stmt = $conn->prepare('UPDATE inventory SET reorder_level = ? WHERE id = ?');
            $stmt->execute([$threshold, $item['inventory_id']]);
            $rowsUpdated = $stmt->rowCount();

            if ($rowsUpdated === 0) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Failed to update threshold']);
                exit;
            }

            //Determine the correct identifier for alerts
            $itemIdentifier = $item['book_id'] ?: $item['item_id'];

            //Check if we need to create/update an alert
            if ($item['quantity_on_hand'] < $threshold) {
                //Check if alert already exists for this item
                $stmt = $conn->prepare('
                    SELECT id FROM low_stock_alerts
                    WHERE book_id = ? AND status != "resolved"
                ');
                $stmt->execute([$itemIdentifier]);
                $existingAlert = $stmt->fetch(PDO::FETCH_ASSOC);

                if (!$existingAlert) {
                    //Create new alert
                    $stmt = $conn->prepare('
                        INSERT INTO low_stock_alerts
                        (book_id, status, is_critical, created_by)
                        VALUES (?, "pending", 0, ?)
                    ');
                    $stmt->execute([
                        $itemIdentifier,
                        $user['id']
                    ]);

                    $message = 'Threshold configured and alert created';
                } else {
                    $message = 'Threshold configured and existing alert updated';
                }
            } else {
                //Stock is above threshold, resolve any existing alerts
                $stmt = $conn->prepare('
                    UPDATE low_stock_alerts
                    SET status = "resolved", last_updated = NOW()
                    WHERE book_id = ? AND status != "resolved"
                ');
                $stmt->execute([$itemIdentifier]);

                $message = 'Threshold configured successfully (stock level is adequate)';
            }

            echo json_encode([
                'success' => true,
                'message' => $message,
                'item' => $item['title'],
                'threshold' => $threshold,
                'current_stock' => $item['quantity_on_hand']
            ]);
        }

    } else {
        //GET - Run threshold check for all items
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

            //Checks if alert already exists
            $stmt = $conn->prepare('
                SELECT id FROM low_stock_alerts
                WHERE book_id = ? AND status != "resolved"
            ');
            $stmt->execute([$itemId]);
            $existingAlert = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$existingAlert) {
                //Creates new alert
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
                //if alert exists, just update last_updated
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
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
}
