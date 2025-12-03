<?php
require_once __DIR__ . '/../backend/config/database.php';
try {
    $conn = get_db_connection();
    $searchQuery = 'Sample';
    $sql = "SELECT i.book_id AS item_id, b.title AS item_name, i.quantity_on_hand AS quantity, b.unit_price AS rate, b.publisher FROM inventory i JOIN books b ON i.book_id = b.id WHERE b.title LIKE ? LIMIT 10";
    $stmt = $conn->prepare($sql);
    $stmt->execute(["%$searchQuery%"]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($rows, JSON_PRETTY_PRINT) . "\n";
} catch (Exception $e) {
    echo 'Error: ' . $e->getMessage() . "\n";
}
