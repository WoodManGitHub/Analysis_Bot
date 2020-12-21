import { CommandClient } from 'eris';
import { EventEmitter } from 'events';
import { resolve } from 'path';
import { Bot } from './Component/Bot';
import { Web } from './Component/Web';
import { CacheManager } from './Core/CacheManager';
import { MongoDB } from './Core/MongoDB';
import { Redis } from './Core/Redis';
import { SetManager } from './Core/SetManager';
import { TimeManager } from './Core/TimeManager';

export class Core extends EventEmitter {
    public readonly config = require(resolve('config.json'));
    public readonly database = new MongoDB(this.config);
    public readonly cache = new Redis(this.config);
    public readonly TimeManager = new TimeManager(this);
    public readonly CacheManager = new CacheManager(this);
    public readonly SetManager = new SetManager(this);
    public bot: CommandClient | null | undefined;

    constructor() {
        super();

        this.emit('init', this);

        // Wait DB and Cache connect
        this.checkAll([this.database, this.cache]).then(() => {
            this.emit('ready');
        });

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

    private waitEvent(event: EventEmitter) {
        // tslint:disable-next-line: no-shadowed-variable
        return new Promise((resolve, rejects) => {
            event.on('connect', resolve);
            event.on('error', rejects);
        });
    }

    private async checkAll(process: any[]) {
        const pending: any[] = [];

        process.forEach((element: any) => {
            pending.push(this.waitEvent(element));
        });

        await Promise.all(pending);
    }
}

// tslint:disable-next-line:no-unused-expression
new Core();
