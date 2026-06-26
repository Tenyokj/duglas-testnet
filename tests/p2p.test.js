const test = require("node:test");
const assert = require("node:assert/strict");
const { Blockchain } = require("../src/core/blockchain");
const { P2PServer } = require("../src/network/p2p");

test("p2p parser accepts valid messages", () => {
    const server = new P2PServer(new Blockchain());
    const message = server.parseMessage(JSON.stringify({
        type: "REQUEST_CHAIN"
    }));

    assert.deepEqual(message, { type: "REQUEST_CHAIN" });
});

test("p2p parser rejects invalid json", () => {
    const server = new P2PServer(new Blockchain());
    const message = server.parseMessage("{not-json");

    assert.equal(message, null);
});

test("p2p parser rejects unknown message types", () => {
    const server = new P2PServer(new Blockchain());
    const message = server.parseMessage(JSON.stringify({
        type: "HACK_THE_PLANET"
    }));

    assert.equal(message, null);
});

test("p2p parser rejects oversized messages", () => {
    const server = new P2PServer(new Blockchain());
    const hugePayload = "x".repeat(128 * 1024 + 10);
    const message = server.parseMessage(JSON.stringify({
        type: "CHAIN",
        data: hugePayload
    }));

    assert.equal(message, null);
});
