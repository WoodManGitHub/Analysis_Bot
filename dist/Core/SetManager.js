"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetManager = void 0;
const MongoDB_1 = require("./MongoDB");
class SetManager {
    database;
    constructor(core) {
        core.on('ready', () => {
            if (!core.database.client)
                throw Error('Database client not init');
            this.database = core.database.client.collection('setting');
            this.database.createIndex({ serverID: 1 });
        });
    }
    async create(serverID, rankChannelID = '', rankDisplay = false, continuousChannelID = '', continuousDisplay = false) {
        if (!this.database)
            throw MongoDB_1.ERR_DB_NOT_INIT;
        return (await this.database.insertOne({
            serverID,
            settings: {
                rankChannelID,
                rankDisplay,
                continuousChannelID,
                continuousDisplay
            }
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
    async update(serverID, rankChannelID, rankDisplay, continuousChannelID, continuousDisplay) {
        if (!this.database)
            throw MongoDB_1.ERR_DB_NOT_INIT;
        let set = {};
        if (rankChannelID && rankDisplay !== null) {
            set = { $set: { 'settings.rankChannelID': rankChannelID, 'settings.rankDisplay': rankDisplay } };
        }
        else if (continuousChannelID && continuousDisplay !== null) {
            set = { $set: { 'settings.continuousChannelID': continuousChannelID, 'settings.continuousDisplay': continuousDisplay } };
        }
        return (await this.database.findOneAndUpdate({ serverID }, set, { upsert: true })).value;
    }
}
exports.SetManager = SetManager;
//# sourceMappingURL=SetManager.js.map