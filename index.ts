import { CommandClient } from 'eris';
import { EventEmitter } from 'events';
import { resolve } from 'path';
import { Bot } from './Component/Bot';
import { Web } from './Component/Web';
import { MongoDB } from './Core/MongoDB';
import { RankManager } from './Core/RankManager';
import { TimeManager } from './Core/TimeManager';

export class Core extends EventEmitter {
    public readonly config = require(resolve('config.json'));
    public readonly database = new MongoDB(this.config);
    public readonly TimeManager = new TimeManager(this);
    public readonly RankManager = new RankManager(this);
    public bot: CommandClient | null | undefined;

    constructor() {
        super();

        this.emit('init', this);

        // Wait DB connect
        this.database.on('connect', () => this.emit('ready'));

        this.on('ready', async () => {
            try {
                // tslint:disable-next-line:no-unused-expression
                new Bot(this);
            } catch (error) {
                console.error(error);
            }
        });

        this.on('discordReady', () => {
            try {
                // tslint:disable-next-line:no-unused-expression
                new Web(this);
            } catch (error) {
                console.error(error);
            }
        });
    }
}

// tslint:disable-next-line:no-unused-expression
new Core();
