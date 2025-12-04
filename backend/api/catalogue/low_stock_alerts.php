<?php
// Low stock alerts management
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
            // Get all active low stock alerts
            $grade_level = $_GET['grade_level'] ?? '';
            $date_range = $_GET['date_range'] ?? ''; // 'today', 'week', 'month'
            
            $where = "WHERE lsa.status = 'active'";
            $params = [];
            
            if (!empty($grade_level)) {
                $where .= " AND i.grade_level LIKE ?";
                $params[] = "%$grade_level%";
            }
            
            if (!empty($date_range)) {
                $days = $date_range === 'today' ? 1 : ($date_range === 'week' ? 7 : 30);
                $where .= " AND DATE(lsa.alert_created_at) >= DATE_SUB(NOW(), INTERVAL $days DAY)";
            }
            
            $sql = "
                SELECT 
                    lsa.id,
                    lsa.item_id,
                    i.item_name,
                    i.grade_level,
                    lsa.threshold,
                    lsa.current_quantity,
                    lsa.status,
                    lsa.alert_created_at,
                    u.username as acknowledged_by
                FROM low_stock_alerts lsa
                JOIN inventory i ON lsa.item_id = i.item_id
                LEFT JOIN users u ON lsa.acknowledged_by = u.id
                $where
                ORDER BY lsa.alert_created_at DESC
            ";
            
            $stmt = $conn->prepare($sql);
            $stmt->execute($params);
            
            $alerts = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode([
                'success' => true,
                'alerts' => $alerts,
                'count' => count($alerts)
            ]);
            exit;
        }
    }
    
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if ($action === 'acknowledge') {
            if (empty($input['alert_id'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'alert_id is required']);
                exit;
            }
            
            $stmt = $conn->prepare('
                UPDATE low_stock_alerts 
                SET status = ?, acknowledged_by = ?, acknowledged_at = NOW()
                WHERE id = ?
            ');
            $stmt->execute(['acknowledged', $user['id'], $input['alert_id']]);
            
            echo json_encode([
                'success' => true,
                'message' => 'Alert acknowledged'
            ]);
            exit;
        }
        
        if ($action === 'mark_reorder') {
            if (empty($input['alert_id'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'alert_id is required']);
                exit;
            }
            
            $stmt = $conn->prepare('
                UPDATE low_stock_alerts 
                SET status = ?, acknowledged_by = ?, acknowledged_at = NOW()
                WHERE id = ?
            ');
            $stmt->execute(['reorder_initiated', $user['id'], $input['alert_id']]);
            
            echo json_encode([
                'success' => true,
                'message' => 'Reorder initiated'
            ]);
            exit;
        }
        
        if ($action === 'set_threshold') {
            if (empty($input['item_id'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'item_id is required']);
                exit;
            }
            
            if (empty($input['threshold']) || $input['threshold'] < 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Valid threshold is required']);
                exit;
            }
            
            // Update reorder level in inventory
            $stmt = $conn->prepare('UPDATE inventory SET reorder_level = ? WHERE item_id = ?');
            $stmt->execute([$input['threshold'], $input['item_id']]);
            
            echo json_encode([
                'success' => true,
                'message' => 'Threshold set successfully'
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
