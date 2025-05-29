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
local currentBalance = tonumber(ARGV[2]) or 0
local availableBalance = tonumber(ARGV[3]) or 0
local creditLimit = tonumber(ARGV[4]) or 0
local totalFundAvailable = tonumber(ARGV[5]) or 0
local pendingTransactionAmount = tonumber(ARGV[6]) or 0
local timestamp = ARGV[7]

if redis.call('EXISTS', balanceKey) == 1 then
    return {false, "Balance already exists"}
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



return {true, {
    dbprefix = dbprefix,
    current_balance = currentBalance,
    available_balance = availableBalance,
    credit_limit = creditLimit,
    total_fund_available = totalFundAvailable,
    pending_transaction_amount = pendingTransactionAmount,
    version = 1,
    last_updated = timestamp
}}
