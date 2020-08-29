import { EventEmitter } from 'events';
import { createClient } from 'redis';

export const ERR_DB_NOT_INIT = Error('Redis is not initialized');

// tslint:disable-next-line: interface-name
export declare interface Redis {
    on(event: 'connect', listen: () => void): this;
}

export class Redis extends EventEmitter {
    public client: any;

    constructor(config: any) {
        super();

        config = config.cache;

        this.client = createClient({ host: config.host, port: config.port });

        this.client.on('ready', () => {
            console.log('[Redis] Connected successfully to server');

            this.emit('connect', this.client);
        });
    }
}
