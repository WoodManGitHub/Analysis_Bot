import { EventEmitter } from 'events';
import { RedisClient, createClient } from 'redis';
import { Config } from './Config';

export const ERR_DB_NOT_INIT = Error('Redis is not initialized');

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export declare interface Redis {
    // eslint-disable-next-line no-unused-vars
    on(event: 'connect', listen: () => void): this;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class Redis extends EventEmitter {
    public client: RedisClient;

    constructor(config: Config) {
        super();

        const redisConfig = config.cache;

        this.client = createClient({ host: redisConfig.host, port: redisConfig.port });

        this.client.on('ready', () => {
            console.log('[Redis] Connected successfully to server');

            this.emit('connect', this.client);
        });
    }
}
