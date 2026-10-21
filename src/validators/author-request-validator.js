function validReason(value) { return typeof value === 'string' && Array.from(value.trim()).length >= 1 && Array.from(value.trim()).length <= 1000; }
module.exports={validReason};
