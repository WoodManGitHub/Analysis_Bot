"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Core = void 0;
const events_1 = require("events");
const path_1 = require("path");
const Bot_1 = require("./Component/Bot");
const Web_1 = require("./Component/Web");
const CacheManager_1 = require("./Core/CacheManager");
const MongoDB_1 = require("./Core/MongoDB");
const Redis_1 = require("./Core/Redis");
const SetManager_1 = require("./Core/SetManager");
const TimeManager_1 = require("./Core/TimeManager");
class Core extends events_1.EventEmitter {
    config = require((0, path_1.resolve)('config.json'));
    database = new MongoDB_1.MongoDB(this.config);
    cache = new Redis_1.Redis(this.config);
    TimeManager = new TimeManager_1.TimeManager(this);
    CacheManager = new CacheManager_1.CacheManager(this);
    SetManager = new SetManager_1.SetManager(this);
    bot;
    constructor() {
        super();
        this.emit('init', this);
        this.checkAll([this.database, this.cache]).then(() => {
            this.emit('ready');
        });
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
    waitEvent(event) {
        return new Promise((resolve, rejects) => {
            event.on('connect', resolve);
            event.on('error', rejects);
        });
    }
    async checkAll(process) {
        const pending = [];
        process.forEach((element) => {
            pending.push(this.waitEvent(element));
        });
        await Promise.all(pending);
    }
}
exports.Core = Core;
new Core();
//# sourceMappingURL=index.js.map