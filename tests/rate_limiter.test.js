const test = require("node:test");
const assert = require("node:assert/strict");
const {
    SlidingWindowRateLimiter,
    CooldownLimiter
} = require("../src/core/rate_limiter");

test("sliding window rate limiter blocks requests after the limit", () => {
    const limiter = new SlidingWindowRateLimiter(2, 1000);

    assert.equal(limiter.allow("client", 0), true);
    assert.equal(limiter.allow("client", 100), true);
    assert.equal(limiter.allow("client", 200), false);
    assert.equal(limiter.allow("client", 1200), true);
});

test("cooldown limiter blocks until cooldown expires", () => {
    const limiter = new CooldownLimiter(5000);

    assert.equal(limiter.allow("client", 0), true);
    assert.equal(limiter.allow("client", 1000), false);
    assert.equal(limiter.allow("client", 5000), true);
});

test("rate limiter usage reports remaining quota", () => {
    const limiter = new SlidingWindowRateLimiter(3, 1000);

    limiter.allow("client", 0);
    limiter.allow("client", 100);

    assert.deepEqual(limiter.getUsage("client", 200), {
        used: 2,
        limit: 3,
        remaining: 1,
        windowMs: 1000
    });
});

test("cooldown limiter reports remaining time", () => {
    const limiter = new CooldownLimiter(5000);

    limiter.allow("client", 1000);

    assert.equal(limiter.getRemainingMs("client", 4000), 2000);
    assert.equal(limiter.getRemainingMs("client", 7000), 0);
});
