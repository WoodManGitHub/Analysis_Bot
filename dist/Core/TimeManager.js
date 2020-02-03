"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MongoDB_1 = require("./MongoDB");
class TimeManager {
    constructor(core) {
        core.on('ready', () => {
            if (!core.database.client)
                throw Error('Database client not init');
            this.database = core.database.client.collection('time');
            this.database.createIndex({ serverID: 1, userID: 1 });
        });
    }
    async create(serverID, userID, activities) {
        if (!this.database)
            throw MongoDB_1.ERR_DB_NOT_INIT;
        return (await this.database.insertOne({
            serverID,
            userID,
            activities
        })).ops[0];
    }
}
exports.TimeManager = TimeManager;
//# sourceMappingURL=TimeManager.js.map