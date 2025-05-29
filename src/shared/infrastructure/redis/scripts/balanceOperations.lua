-- KEYS[1]: balance hash key
-- KEYS[2]: operation log key
-- KEYS[3]: lock key
-- ARGV[1]: operation type
-- ARGV[2]: amount
-- ARGV[3]: operation ID
-- ARGV[4]: timestamp
-- ARGV[5]: expected version
-- ARGV[6]: metadata

local balanceKey = KEYS[1]
local auditKey = KEYS[2]
local lockKey = KEYS[3]

local operationType = ARGV[1]
local amount = tonumber(ARGV[2])
local operationId = ARGV[3]
local timestamp = ARGV[4]
local expectedVersion = tonumber(ARGV[5])
local metadata = ARGV[6] or "{}"

-- Check if balance exists
if redis.call('EXISTS', balanceKey) == 0 then
    return {false, "Balance not found"}
end

-- Get current balance data
local currentBalance = redis.call('HMGET', balanceKey,
    'current_balance', 'available_balance', 'credit_limit',
    'total_fund_available', 'pending_transaction_amount', 'version')

local current = tonumber(currentBalance[1]) or 0
local available = tonumber(currentBalance[2]) or 0
local creditLimit = tonumber(currentBalance[3]) or 0
local totalFund = tonumber(currentBalance[4]) or 0
local pending = tonumber(currentBalance[5]) or 0
local version = tonumber(currentBalance[6]) or 0

-- Check version for optimistic locking
if expectedVersion ~= -1 and version ~= expectedVersion then
    return {false, "Version mismatch", version}
end

-- Calculate new values based on operation type
local newCurrent = current
local newAvailable = available
local newTotalFund = totalFund
local newPending = pending

if operationType == "progress_payment" then
    -- Check if sufficient funds available
    if available < amount then
        return {false, "Insufficient available balance", available}
    end
    newAvailable = available - amount
    newTotalFund = totalFund - amount
    newPending = pending + amount

elseif operationType == "reverse_payment" then
    newAvailable = available + amount
    newTotalFund = totalFund + amount
    newPending = pending - amount

elseif operationType == "complete_payment" then
    -- Check if sufficient pending amount
    if pending < amount then
        return {false, "Insufficient pending amount", pending}
    end
    newCurrent = current - amount
    newPending = pending - amount

elseif operationType == "refund_payment" then
    -- Check if sufficient pending amount
    if pending < amount then
        return {false, "Insufficient pending amount", pending}
    end
    newCurrent = current + amount
    newAvailable = available + amount
    newTotalFund = totalFund + amount
    newPending = pending - amount

else
    return {false, "Invalid operation type"}
end

-- Validate new values
if newCurrent < 0 or newAvailable < 0 or newTotalFund < 0 or newPending < 0 then
    return {false, "Operation would result in negative balance"}
end

-- Update balance with new version
local newVersion = version + 1
redis.call('HMSET', balanceKey,
    'current_balance', newCurrent,
    'available_balance', newAvailable,
    'total_fund_available', newTotalFund,
    'pending_transaction_amount', newPending,
    'version', newVersion,
    'last_updated', timestamp)

-- Log the operation
local auditEntry = {
    operation_id = operationId,
    operation_type = operationType,
    amount = amount,
    timestamp = timestamp,
    previous_version = version,
    new_version = newVersion,
    metadata = metadata,
    previous_state = {
        current_balance = current,
        available_balance = available,
        total_fund_available = totalFund,
        pending_transaction_amount = pending
    },
    new_state = {
        current_balance = newCurrent,
        available_balance = newAvailable,
        total_fund_available = newTotalFund,
        pending_transaction_amount = newPending
    }
}

redis.call('LPUSH', auditKey, cjson.encode(auditEntry))
redis.call('LTRIM', auditKey, 0, 999) -- Keep last 1000 operations

-- Return success with new balance
return {true, {
    current_balance = newCurrent,
    available_balance = newAvailable,
    credit_limit = creditLimit,
    total_fund_available = newTotalFund,
    pending_transaction_amount = newPending,
    version = newVersion,
    last_updated = timestamp
}}
