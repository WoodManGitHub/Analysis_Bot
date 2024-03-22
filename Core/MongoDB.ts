import { EventEmitter } from 'events';
import { Db, MongoClient } from 'mongodb';
import { Config } from './Config';

export const ERR_DB_NOT_INIT = Error('MongoDB is not initialized');

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export declare interface MongoDB {
    // eslint-disable-next-line no-unused-vars
    on(event: 'connect', listen: (database: Db) => void): this;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class MongoDB extends EventEmitter {
    public client?: Db;

    constructor(config: Config) {
        super();

        const dbConfig = config.database;

        MongoClient.connect(dbConfig.host, { useNewUrlParser: true, useUnifiedTopology: true }).then(client => {
            console.log('[MongoDB] Connected successfully to server');

            this.client = client.db(dbConfig.name);

            this.emit('connect', this.client);
        });
    }
}
