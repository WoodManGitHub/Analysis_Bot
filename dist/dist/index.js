"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const path_1 = require("path");
const Bot_1 = require("./Component/Bot");
const Web_1 = require("./Component/Web");
const MongoDB_1 = require("./Core/MongoDB");
const TimeManager_1 = require("./Core/TimeManager");
class Core extends events_1.EventEmitter {
    constructor() {
        super();
        this.config = require(path_1.resolve('config.json'));
        this.database = new MongoDB_1.MongoDB(this.config);
        this.TimeManager = new TimeManager_1.TimeManager(this);
        this.emit('init', this);
        this.database.on('connect', () => this.emit('ready'));
        this.on('ready', async () => {
            try {
                new Bot_1.Bot(this);
            }
            catch (error) {
                console.error(error);
            }
        });
        this.on('discordReady', () => {
            try {
                new Web_1.Web(this);
            }
            catch (error) {
                console.error(error);
            }
        });
    }
}
exports.Core = Core;
new Core();
//# sourceMappingURL=index.js.map