-- Synchronize is_favourite in inventory table with favourites table
-- Update all inventory items to mark their is_favourite status based on favourites table

-- First, reset all is_favourite to false
UPDATE inventory SET is_favourite = false;

-- Then, update items that exist in favourites table
UPDATE inventory i
SET is_favourite = true
WHERE EXISTS (
    SELECT 1 FROM favourites f WHERE f.item_id = i.item_id
);
