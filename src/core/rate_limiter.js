class SlidingWindowRateLimiter {
    constructor(limit, windowMs) {
        this.limit = limit;
        this.windowMs = windowMs;
        this.requests = new Map();
    }

    allow(key, now = Date.now()) {
        const timestamps = this.requests.get(key) ?? [];
        const freshTimestamps = timestamps.filter(
            timestamp => now - timestamp < this.windowMs
        );

        if (freshTimestamps.length >= this.limit) {
            this.requests.set(key, freshTimestamps);
            return false;
        }

        freshTimestamps.push(now);
        this.requests.set(key, freshTimestamps);
        return true;
    }

    getUsage(key, now = Date.now()) {
        const timestamps = this.requests.get(key) ?? [];
        const freshTimestamps = timestamps.filter(
            timestamp => now - timestamp < this.windowMs
        );

        this.requests.set(key, freshTimestamps);

        return {
            used: freshTimestamps.length,
            limit: this.limit,
            remaining: Math.max(0, this.limit - freshTimestamps.length),
            windowMs: this.windowMs
        };
    }
}

class CooldownLimiter {
    constructor(cooldownMs) {
        this.cooldownMs = cooldownMs;
        this.nextAllowedAt = new Map();
    }

    allow(key, now = Date.now()) {
        const nextAllowed = this.nextAllowedAt.get(key) ?? 0;

        if (now < nextAllowed) {
            return false;
        }

        this.nextAllowedAt.set(key, now + this.cooldownMs);
        return true;
    }

    getRemainingMs(key, now = Date.now()) {
        const nextAllowed = this.nextAllowedAt.get(key) ?? 0;
        return Math.max(0, nextAllowed - now);
    }
}

module.exports = {
    SlidingWindowRateLimiter,
    CooldownLimiter
};
