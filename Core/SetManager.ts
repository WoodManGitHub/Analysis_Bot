import { Collection, ObjectID } from 'mongodb';
import { Core } from '..';
import { ERR_DB_NOT_INIT } from './MongoDB';

export interface ISet {
    _id: ObjectID;
    serverID: string;
    settings: {
        rankChannelID: string;
        rankDisplay: boolean;
        continuousChannelID: string;
        continuousDisplay: boolean;
    };
}

export class SetManager {
    private database?: Collection<ISet>;

    constructor(core: Core) {
        core.on('ready', () => {
            if (!core.database.client) throw Error('Database client not init');

            this.database = core.database.client.collection('setting');
            this.database.createIndex({ serverID: 1 });
        });
    }

    public async create(serverID: string, rankChannelID: string = '', rankDisplay: boolean = false, continuousChannelID: string = '', continuousDisplay: boolean = false) {
        if (!this.database) throw ERR_DB_NOT_INIT;

        return (await this.database.insertOne({
            serverID,
            settings: {
                rankChannelID,
                rankDisplay,
                continuousChannelID,
                continuousDisplay
            }
        } as ISet)).ops[0] as ISet;
    }

    public async get(serverID: string) {
        if (!this.database) throw ERR_DB_NOT_INIT;

        return this.database.find({ serverID }).toArray();
    }

    public async getAll() {
        if (!this.database) throw ERR_DB_NOT_INIT;

        return this.database.find({}).toArray();
    }

    public async update(serverID: string, rankChannelID: string | null, rankDisplay: boolean | null, continuousChannelID: string | null, continuousDisplay: boolean | null) {
        if (!this.database) throw ERR_DB_NOT_INIT;

        let set = { };

        if (rankChannelID && rankDisplay !== null) {
            set = { $set: { 'settings.rankChannelID': rankChannelID, 'settings.rankDisplay': rankDisplay } };
        } else if (continuousChannelID && continuousDisplay !== null) {
            set = { $set: { 'settings.continuousChannelID': continuousChannelID, 'settings.continuousDisplay': continuousDisplay } };
        }

        return (await this.database.findOneAndUpdate(
            { serverID },
            set,
            { upsert: true }
        )).value;
    }
}
