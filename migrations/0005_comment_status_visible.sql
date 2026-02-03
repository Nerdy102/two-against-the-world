-- Normalize legacy comment statuses to the canonical enum set.
UPDATE comments
SET status = 'visible'
WHERE status = 'approved';
