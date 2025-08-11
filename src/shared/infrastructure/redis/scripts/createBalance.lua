-- KEYS[1]: balance hash key
-- ARGV[1]: dbprefix
-- ARGV[2]: current_balance
-- ARGV[3]: available_balance
-- ARGV[4]: credit_limit
-- ARGV[5]: total_fund_available
-- ARGV[6]: pending_transaction_amount
-- ARGV[7]: timestamp

local balanceKey = KEYS[1]
local dbprefix = ARGV[1]
local currentBalance = tonumber(ARGV[2])
local availableBalance = tonumber(ARGV[3])
local creditLimit = tonumber(ARGV[4])
local totalFundAvailable = tonumber(ARGV[5])
local pendingTransactionAmount = tonumber(ARGV[6])
local timestamp = ARGV[7]

-- Validate that all numbers were parsed correctly
if currentBalance == nil then currentBalance = 0 end
if availableBalance == nil then availableBalance = 0 end
if creditLimit == nil then creditLimit = 0 end
if totalFundAvailable == nil then totalFundAvailable = 0 end
if pendingTransactionAmount == nil then pendingTransactionAmount = 0 end

-- For balance reset, delete existing balance if it exists
if redis.call('EXISTS', balanceKey) == 1 then
    redis.call('DEL', balanceKey)
end
redis.call('HMSET', balanceKey,
    'dbprefix', dbprefix,
    'current_balance', currentBalance,
    'available_balance', availableBalance,
    'credit_limit', creditLimit,
    'total_fund_available', totalFundAvailable,
    'pending_transaction_amount', pendingTransactionAmount,
    'version', 1,
    'last_updated', timestamp)



-- Return using simple array approach that works with ioredis
return {1, {
    dbprefix,
    tostring(currentBalance),
    tostring(availableBalance),
    tostring(creditLimit),
    tostring(totalFundAvailable),
    tostring(pendingTransactionAmount),
    "1",
    timestamp
}}
