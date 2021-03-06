import { EventEmitter } from 'events';
import { Db, MongoClient } from 'mongodb';

export const ERR_DB_NOT_INIT = Error('MongoDB is not initialized');

// tslint:disable-next-line:interface-name
export declare interface MongoDB {
    on(event: 'connect', listen: (database: Db) => void): this;
}

export class MongoDB extends EventEmitter {
    public client?: Db;

    constructor(config: any) {
        super();

        config = config.database;

        MongoClient.connect(config.host, { useNewUrlParser: true, useUnifiedTopology: true }).then(client => {
            console.log('[MongoDB] Connected successfully to server');

            this.client = client.db(config.name);

            this.emit('connect', this.client);
        });
    }
}
