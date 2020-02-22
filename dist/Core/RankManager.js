"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MongoDB_1 = require("./MongoDB");
class RankManager {
    constructor(core) {
        core.on('ready', () => {
            if (!core.database.client)
                throw Error('Database client not init');
            this.database = core.database.client.collection('rank');
            this.database.createIndex({ serverID: 1 });
        });
    }
    async create(serverID, channelID, rankDisplay) {
        if (!this.database)
            throw MongoDB_1.ERR_DB_NOT_INIT;
        return (await this.database.insertOne({
            serverID,
            channelID,
            rankDisplay
        })).ops[0];
    }
    async get(serverID) {
        if (!this.database)
            throw MongoDB_1.ERR_DB_NOT_INIT;
        return this.database.find({ serverID }).toArray();
    }
    async getAll() {
        if (!this.database)
            throw MongoDB_1.ERR_DB_NOT_INIT;
        return this.database.find({}).toArray();
    }
    async update(serverID, channelID, rankDisplay) {
        if (!this.database)
            throw MongoDB_1.ERR_DB_NOT_INIT;
        return (await this.database.findOneAndUpdate({ serverID }, { $set: { serverID, channelID, rankDisplay } }, { upsert: true })).value;
    }
}
exports.RankManager = RankManager;
//# sourceMappingURL=RankManager.js.map