import { Collection, ObjectID } from 'mongodb';
import { Core } from '..';
import { ERR_DB_NOT_INIT } from './MongoDB';

export interface ITime {
    _id: ObjectID;
    serverID: string;
    userID: string;
    timeStrap: number;
    type: string;
}

export class TimeManager {
    private database?: Collection<ITime>;

    constructor(core: Core) {
        core.on('ready', () => {
            if (!core.database.client) throw Error('Database client not init');

            this.database = core.database.client.collection('time');
            this.database.createIndex({ serverID: 1, timeStrap: 1 });
        });
    }

    // tslint:disable-next-line: ban-types
    public async create(serverID: string, userID: string, timeStrap: number, type: string) {
        if (!this.database) throw ERR_DB_NOT_INIT;

        return (await this.database.insertOne({
            serverID,
            userID,
            timeStrap,
            type
        } as ITime)).ops[0] as ITime;
    }

    public async get(serverID: string, startTime: number, endTime: number) {
        if (!this.database) throw ERR_DB_NOT_INIT;

        return this.database.find({ serverID, timeStrap: { $gte: startTime, $lt: endTime } }).toArray();
    }

    public async getAll(serverID: string) {
        if (!this.database) throw ERR_DB_NOT_INIT;

        return this.database.find({ serverID }).toArray();
    }

    public async getByUser(serverID: string, userID: string, startTime: number, endTime: number) {
        if (!this.database) throw ERR_DB_NOT_INIT;

        return this.database.find({ serverID, userID, timeStrap: { $gte: startTime, $lt: endTime } }).toArray();
    }

    public async getLastDataByUser(serverID: string, userID: string, priorTo: number) {
        if (!this.database) throw ERR_DB_NOT_INIT;

        return this.database.find({ serverID, userID, timeStrap: { $lt: priorTo } }).sort({ timeStrap: -1 }).limit(1).toArray();
    }
}
