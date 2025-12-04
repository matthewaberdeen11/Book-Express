-- Add quantity_sold tracking to inventory table
ALTER TABLE inventory ADD COLUMN quantity_sold INT DEFAULT 0 AFTER quantity_on_hand;
ALTER TABLE inventory ADD INDEX idx_quantity_sold (quantity_sold);
