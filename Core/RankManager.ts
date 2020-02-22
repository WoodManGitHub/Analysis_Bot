import { Collection, ObjectID } from 'mongodb';
import { Core } from '..';
import { ERR_DB_NOT_INIT } from './MongoDB';

export interface IRank {
    _id: ObjectID;
    serverID: string;
    channelID: string;
    rankDisplay: boolean;
}

export class RankManager {
    private database?: Collection<IRank>;

    constructor(core: Core) {
        core.on('ready', () => {
            if (!core.database.client) throw Error('Database client not init');

            this.database = core.database.client.collection('rank');
            this.database.createIndex({ serverID: 1 });
        });
    }

    // tslint:disable-next-line: ban-types
    public async create(serverID: string, channelID: string, rankDisplay: boolean) {
        if (!this.database) throw ERR_DB_NOT_INIT;

        return (await this.database.insertOne({
            serverID,
            channelID,
            rankDisplay
        } as IRank)).ops[0] as IRank;
    }

    public async get(serverID: string) {
        if (!this.database) throw ERR_DB_NOT_INIT;

        return this.database.find({ serverID }).toArray();
    }

    public async getAll() {
        if (!this.database) throw ERR_DB_NOT_INIT;

        return this.database.find({}).toArray();
    }

    public async update(serverID: string, channelID: string, rankDisplay: boolean) {
        if (!this.database) throw ERR_DB_NOT_INIT;

        return (await this.database.findOneAndUpdate(
            { serverID },
            { $set: { serverID, channelID, rankDisplay } },
            { upsert: true }
        )).value;
    }
}
