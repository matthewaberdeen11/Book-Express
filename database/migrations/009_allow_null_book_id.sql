-- Allow NULL book_id for CSV imports that don't have book references
ALTER TABLE inventory MODIFY book_id INT NULL;
