"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
const Redis_1 = require("./Redis");
class CacheManager {
    constructor(core) {
        core.on('ready', () => {
            if (!core.cache.client)
                throw Error('Cache client not init');
            this.client = core.cache.client;
        });
    }
    async set(key, value, ttl) {
        if (!this.client)
            throw Redis_1.ERR_DB_NOT_INIT;
        await this.client.set([key, value, 'EX', ttl]);
    }
    get(key) {
        if (!this.client)
            throw Redis_1.ERR_DB_NOT_INIT;
        const getAsync = util_1.promisify(this.client.get).bind(this.client);
        return getAsync(key).then((result) => {
            return result;
        });
    }
}
exports.CacheManager = CacheManager;
//# sourceMappingURL=CacheManager.js.map