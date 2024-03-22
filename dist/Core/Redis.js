"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Redis = exports.ERR_DB_NOT_INIT = void 0;
const events_1 = require("events");
const redis_1 = require("redis");
exports.ERR_DB_NOT_INIT = Error('Redis is not initialized');
class Redis extends events_1.EventEmitter {
    client;
    constructor(config) {
        super();
        const redisConfig = config.cache;
        this.client = (0, redis_1.createClient)({ host: redisConfig.host, port: redisConfig.port });
        this.client.on('ready', () => {
            console.log('[Redis] Connected successfully to server');
            this.emit('connect', this.client);
        });
    }
}
exports.Redis = Redis;
//# sourceMappingURL=Redis.js.map