<?php
// import-sales.php - Import Sales_by_Item_sample.csv into sales table
// Matches item_id to books (creates if needed), then inserts sales
// Usage: Open in browser at http://localhost/Book-Express/backend/api/import-sales.php

require_once '../config/database.php';

try {
    $pdo = get_db_connection();
    $csvFile = '../../assets/Sales_by_Item_sample.csv';
    
    if (!file_exists($csvFile)) {
        die('CSV file not found: ' . $csvFile);
    }
    
    $handle = fopen($csvFile, 'r');
    if (!$handle) {
        die('Could not open CSV file');
    }
    
    // Read header
    $header = fgetcsv($handle);
    echo '<pre>';
    echo "CSV Header: " . json_encode($header) . "\n\n";
    echo "Expected columns: item_id, item_name, unit, is_combo_product, quantity_sold, amount, average_price\n\n";
    
    $inserted = 0;
    $skipped = 0;
    $bookMap = []; // Cache: item_id => book_id
    
    // Prepare statements
    $findBook = $pdo->prepare('SELECT id FROM books WHERE isbn = ? LIMIT 1');
    $createBook = $pdo->prepare('
        INSERT INTO books (isbn, title, unit_price, created_at)
        VALUES (?, ?, ?, NOW())
    ');
    $insertSale = $pdo->prepare('
        INSERT INTO sales (book_id, quantity_sold, sale_price, sale_date)
        VALUES (?, ?, ?, ?)
    ');
    
    while (($row = fgetcsv($handle)) !== false) {
        if (count($row) < 5) {
            $skipped++;
            continue;
        }
        
        // CSV columns: [0]=item_id, [1]=item_name, [4]=quantity_sold, [6]=average_price
        $itemId = trim($row[0]);
        $itemName = trim($row[1]);
        $quantitySold = intval($row[4]);
        $avgPrice = floatval($row[6] ?? 0);
        $saleDate = date('Y-m-d');
        
        try {
            // Get or create book
            $bookId = null;
            if (isset($bookMap[$itemId])) {
                $bookId = $bookMap[$itemId];
            } else {
                // Look for existing book by isbn (item_id)
                $findBook->execute([$itemId]);
                $bookRow = $findBook->fetch(PDO::FETCH_ASSOC);
                if ($bookRow) {
                    $bookId = $bookRow['id'];
                } else {
                    // Create new book
                    $createBook->execute([$itemId, $itemName, $avgPrice]);
                    $bookId = $pdo->lastInsertId();
                }
                $bookMap[$itemId] = $bookId;
            }
            
            // Insert sale
            $insertSale->execute([$bookId, $quantitySold, $avgPrice, $saleDate]);
            $inserted++;
        } catch (PDOException $e) {
            $skipped++;
            echo "Skipped row [$itemId]: " . $e->getMessage() . "\n";
        }
    }
    
    fclose($handle);
    
    echo "\n✓ Import complete!\n";
    echo "Inserted: $inserted sales rows\n";
    echo "Skipped: $skipped rows\n";
    echo "\nBooks created/matched: " . count($bookMap) . "\n";
    echo "</pre>";
    
    // Show current counts
    $result = $pdo->query('SELECT COUNT(*) as cnt FROM sales');
    $salesCount = $result->fetch(PDO::FETCH_ASSOC)['cnt'];
    $result = $pdo->query('SELECT COUNT(*) as cnt FROM books');
    $booksCount = $result->fetch(PDO::FETCH_ASSOC)['cnt'];
    echo "<p><strong>Total rows in sales table now: $salesCount</strong></p>";
    echo "<p><strong>Total books in books table now: $booksCount</strong></p>";
    echo "<p><a href='../../frontend/analytics.html'>Go to Analytics</a></p>";
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
