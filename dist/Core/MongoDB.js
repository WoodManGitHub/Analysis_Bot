"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoDB = exports.ERR_DB_NOT_INIT = void 0;
const events_1 = require("events");
const mongodb_1 = require("mongodb");
exports.ERR_DB_NOT_INIT = Error('MongoDB is not initialized');
class MongoDB extends events_1.EventEmitter {
    client;
    constructor(config) {
        super();
        const dbConfig = config.database;
        mongodb_1.MongoClient.connect(dbConfig.host, { useNewUrlParser: true, useUnifiedTopology: true }).then(client => {
            console.log('[MongoDB] Connected successfully to server');
            this.client = client.db(dbConfig.name);
            this.emit('connect', this.client);
        });
    }
}
exports.MongoDB = MongoDB;
//# sourceMappingURL=MongoDB.js.map