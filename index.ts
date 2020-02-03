import { EventEmitter } from 'events';
import { resolve } from 'path';
import { Bot } from './Component/bot';
import { MongoDB } from './Core/MongoDB';
import { TimeManager } from './Core/TimeManager';

export class Core extends EventEmitter {
    public readonly config = require(resolve('config.json'));
    public readonly database = new MongoDB(this.config);
    public readonly TimeManager = new TimeManager(this);

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
    }
}

// tslint:disable-next-line:no-unused-expression
new Core();
