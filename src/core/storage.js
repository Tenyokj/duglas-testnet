const fs = require("fs");
const path = require("path");

class NodeStorage {
    constructor(filePath) {
        this.filePath = path.resolve(filePath);
    }

    load() {
        if (!fs.existsSync(this.filePath)) {
            return null;
        }

        return JSON.parse(fs.readFileSync(this.filePath, "utf8"));
    }

    save(state) {
        const directory = path.dirname(this.filePath);
        fs.mkdirSync(directory, { recursive: true });
        fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2));
    }
}

module.exports = { NodeStorage };
