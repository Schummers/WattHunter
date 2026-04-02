-- Floor all existing salary/bid amounts to nearest multiple of 100
-- This aligns with the new calculation formula (pts × 2000 / 12, floored to 100)

-- riders.monthly_salary
UPDATE riders
SET monthly_salary = (monthly_salary / 100) * 100
WHERE monthly_salary % 100 != 0;

-- contracts.locked_salary
UPDATE contracts
SET locked_salary = (locked_salary / 100) * 100
WHERE locked_salary % 100 != 0;

-- bids (auction_bids.amount)
UPDATE auction_bids
SET amount = (amount / 100) * 100
WHERE amount % 100 != 0;
