"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheManager = void 0;
const util_1 = require("util");
const Redis_1 = require("./Redis");
class CacheManager {
    client;
    constructor(core) {
        core.on('ready', () => {
            if (!core.cache.client)
                throw Error('Cache client not init');
            this.client = core.cache.client;
        });
    }
    async setByTTL(key, value, ttl) {
        if (!this.client)
            throw Redis_1.ERR_DB_NOT_INIT;
        await this.client.set(key, value, 'EX', ttl);
    }
    async set(key, value) {
        if (!this.client)
            throw Redis_1.ERR_DB_NOT_INIT;
        await this.client.set(key, value);
    }
    get(key) {
        if (!this.client)
            throw Redis_1.ERR_DB_NOT_INIT;
        const getAsync = (0, util_1.promisify)(this.client.get).bind(this.client);
        return getAsync(key).then((result) => {
            return result;
        });
    }
    async incr(key) {
        if (!this.client)
            throw Redis_1.ERR_DB_NOT_INIT;
        await this.client.INCR(key);
    }
}
exports.CacheManager = CacheManager;
//# sourceMappingURL=CacheManager.js.map