-- KEYS[1]: balance hash key
-- KEYS[2]: audit key
-- ARGV[1]: operation ID
-- ARGV[2]: timestamp
-- ARGV[3]: force (optional) - "true" to force deletion with pending transactions

local balanceKey = KEYS[1]
local auditKey = KEYS[2]
local operationId = ARGV[1]
local timestamp = ARGV[2]
local force = ARGV[3] or "false"

if redis.call('EXISTS', balanceKey) == 0 then
    return {false, "Balance not found"}
end

local version = tonumber(redis.call('HGET', balanceKey, 'version')) or 0
local pendingAmount = tonumber(redis.call('HGET', balanceKey, 'pending_transaction_amount')) or 0

-- Check if there are pending transactions and force is not enabled
if pendingAmount > 0 and force ~= "true" then
    return {false, "Cannot delete balance with pending transactions"}
end

-- Get current balance state for audit
local current = redis.call('HMGET', balanceKey,
    'current_balance', 'available_balance', 'credit_limit',
    'total_fund_available', 'pending_transaction_amount')

local currentBalance = tonumber(current[1]) or 0
local availableBalance = tonumber(current[2]) or 0
local creditLimit = tonumber(current[3]) or 0
local totalFund = tonumber(current[4]) or 0
local pending = tonumber(current[5]) or 0

-- Delete the balance
redis.call('DEL', balanceKey)

-- Add audit entry for deletion
local auditEntry = {
    operation_id = operationId,
    operation_type = force == "true" and 'balance_force_deletion' or 'balance_deletion',
    timestamp = timestamp,
    version = version,
    metadata = force == "true" and '{"action": "balance_force_reinitialization", "pending_amount_ignored": ' .. pending .. '}' or '{"action": "balance_reinitialization"}',
    previous_state = {
        current_balance = currentBalance,
        available_balance = availableBalance,
        credit_limit = creditLimit,
        total_fund_available = totalFund,
        pending_transaction_amount = pending
    },
    new_state = {
        deleted = true,
        forced = force == "true"
    }
}

redis.call('LPUSH', auditKey, cjson.encode(auditEntry))
redis.call('LTRIM', auditKey, 0, 999)

return {true, force == "true" and "Balance force deleted successfully" or "Balance deleted successfully"} 