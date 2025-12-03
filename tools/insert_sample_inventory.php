<?php
// One-off script to insert a sample book and inventory row for testing/search
// Run: C:\xampp\php\php.exe tools\insert_sample_inventory.php

require_once __DIR__ . '/../backend/config/database.php';

try {
    $conn = get_db_connection();
    $conn->beginTransaction();

    // Sample data - change as needed
    $isbn = '9780000000001';
    $title = 'Sample Book Title';
    $author = 'Jane Doe';
    $publisher = 'Acme Publishers';
    $category = 'Fiction';
    $description = 'Automatically inserted sample book for testing search.';
    $unit_price = 450.00;
    $quantity = 20;
    $reorder_level = 5;

    // Insert into books
    $stmt = $conn->prepare('INSERT INTO books (isbn, title, author, publisher, category, description, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$isbn, $title, $author, $publisher, $category, $description, $unit_price]);
    $bookId = $conn->lastInsertId();

    // Insert into inventory
    $stmt = $conn->prepare('INSERT INTO inventory (book_id, quantity_on_hand, reorder_level, last_updated) VALUES (?, ?, ?, NOW())');
    $stmt->execute([$bookId, $quantity, $reorder_level]);

    $conn->commit();

    // Fetch and print the inserted joined row for verification
    $sql = "SELECT b.id AS book_id, b.isbn, b.title, b.author, b.publisher, b.unit_price, i.quantity_on_hand, i.last_updated FROM books b JOIN inventory i ON i.book_id = b.id WHERE b.id = ? LIMIT 1";
    $stmt = $conn->prepare($sql);
    $stmt->execute([$bookId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    echo "Inserted sample book and inventory:\n";
    echo json_encode($row, JSON_PRETTY_PRINT) . "\n";
    exit(0);
} catch (Exception $e) {
    if (!empty($conn) && $conn->inTransaction()) {
        $conn->rollBack();
    }
    echo "Error inserting sample data: " . $e->getMessage() . "\n";
    exit(1);
}
