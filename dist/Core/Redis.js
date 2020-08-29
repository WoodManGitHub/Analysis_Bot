"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const redis_1 = require("redis");
exports.ERR_DB_NOT_INIT = Error('Redis is not initialized');
class Redis extends events_1.EventEmitter {
    constructor(config) {
        super();
        config = config.cache;
        this.client = redis_1.createClient({ host: config.host, port: config.port });
        this.client.on('ready', () => {
            console.log('[Redis] Connected successfully to server');
            this.emit('connect', this.client);
        });
    }
}
exports.Redis = Redis;
//# sourceMappingURL=Redis.js.map