const { Blockchain } = require("../src/core/blockchain");

const attackerChain = new Blockchain();

// Lower the difficulty to demonstrate how a weaker competing chain can grow faster.
attackerChain.difficulty = 1;

console.log("🚨 Attacker mining fast...");

for (let i = 0; i < 10; i++) {
    attackerChain.minePendingTransactions("attacker");
}

console.log("Attacker chain length:", attackerChain.chain.length);
