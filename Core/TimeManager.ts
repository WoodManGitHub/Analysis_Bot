import { Collection, ObjectID } from "mongodb";
import { Core } from "..";
import { ERR_DB_NOT_INIT } from "./MongoDB";

export interface ITime {
    _id?: ObjectID;
    serverID?: string;
    userID?: string;
    activities?: { time: number, type: string }[];
}

export class TimeManager {
    private database?: Collection<ITime>;

    constructor(core: Core) {
        core.on('ready', () => {
            if (!core.database.client) throw Error('Database client not init');

            this.database = core.database.client.collection('time');
            this.database.createIndex({ serverID: 1, userID: 1 });
        });
    }

    public async create(serverID: string, userID: string, activities: Object | undefined) {
        if (!this.database) throw ERR_DB_NOT_INIT;

        return (await this.database.insertOne({
            serverID,
            userID,
            activities
        } as ITime)).ops[0] as ITime;
    }
}
