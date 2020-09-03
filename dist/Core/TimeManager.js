"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MongoDB_1 = require("./MongoDB");
class TimeManager {
    constructor(core) {
        core.on('ready', () => {
            if (!core.database.client)
                throw Error('Database client not init');
            this.database = core.database.client.collection('time');
            this.database.createIndex({ serverID: 1, timeStamp: 1 });
        });
    }
    async create(serverID, userID, timeStamp, type) {
        if (!this.database)
            throw MongoDB_1.ERR_DB_NOT_INIT;
        return (await this.database.insertOne({
            serverID,
            userID,
            timeStamp,
            type
        })).ops[0];
    }
    async get(serverID, startTime, endTime) {
        if (!this.database)
            throw MongoDB_1.ERR_DB_NOT_INIT;
        return this.database.find({ serverID, timeStamp: { $gte: startTime, $lt: endTime } }).sort({ timeStamp: 1 }).toArray();
    }
    async getByUser(serverID, userID, startTime, endTime) {
        if (!this.database)
            throw MongoDB_1.ERR_DB_NOT_INIT;
        return this.database.find({ serverID, userID, timeStamp: { $gte: startTime, $lt: endTime } }).sort({ timeStamp: 1 }).toArray();
    }
    async getLastDataByUser(serverID, userID, priorTo) {
        if (!this.database)
            throw MongoDB_1.ERR_DB_NOT_INIT;
        return this.database.find({ serverID, userID, timeStamp: { $lt: priorTo } }).sort({ timeStamp: -1 }).limit(1).toArray();
    }
    async getDataByKeyword(keyword) {
        if (!this.database)
            throw MongoDB_1.ERR_DB_NOT_INIT;
        return this.database.distinct(keyword);
    }
}
exports.TimeManager = TimeManager;
//# sourceMappingURL=TimeManager.js.map