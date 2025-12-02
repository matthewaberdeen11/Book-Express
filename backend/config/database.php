<?php
// Database connection configuration
// Load from environment variables or use defaults

$db_host = getenv('DB_HOST') ?: 'localhost';
$db_port = getenv('DB_PORT') ?: '3306';
$db_name = getenv('DB_NAME') ?: 'book_express';
$db_user = getenv('DB_USER') ?: 'root';
$db_password = getenv('DB_PASSWORD') ?: '';


function get_db_connection() {
    global $db_host, $db_port, $db_name, $db_user, $db_password;
    try {
        $db = new PDO(
            "mysql:host=$db_host;port=$db_port;dbname=$db_name",
            $db_user,
            $db_password,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]
        );
        return $db;
    } catch (PDOException $e) {
        die('Database connection failed: ' . $e->getMessage());
    }
}
