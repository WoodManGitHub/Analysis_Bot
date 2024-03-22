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
import { Config } from './Core/Config';

export class Core extends EventEmitter {
    public readonly config: Config = require(resolve('config.json'));
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

        this.on('ready', async() => {
            try {
                new Bot(this);
            } catch (error) {
                console.error(error);
            }
        });

        this.on('discordReady', () => {
            try {
                new Web(this);
            } catch (error) {
                console.error(error);
            }
        });
    }

    private waitEvent(event: EventEmitter) {
        return new Promise((resolve, rejects) => {
            event.on('connect', resolve);
            event.on('error', rejects);
        });
    }

    private async checkAll(process: EventEmitter[]) {
        const pending: Promise<unknown>[] = [];

        process.forEach((element: EventEmitter) => {
            pending.push(this.waitEvent(element));
        });

        await Promise.all(pending);
    }
}

new Core();
