import { promisify } from 'util';
import { Core } from '..';
import { ERR_DB_NOT_INIT } from './Redis';

export class CacheManager {
    private client: any;
    constructor(core: Core) {
        core.on('ready', () => {
            if (!core.cache.client) throw Error('Cache client not init');

            this.client = core.cache.client;
        });
    }

    public async set(key: string, value: string, ttl: number) {
        if (!this.client) throw ERR_DB_NOT_INIT;

        await this.client.set([key, value, 'EX', ttl]);
    }

    public get(key: string) {
        if (!this.client) throw ERR_DB_NOT_INIT;

        const getAsync = promisify(this.client.get).bind(this.client);

        return getAsync(key).then((result: any) => {
            return result;
        });
    }
}
