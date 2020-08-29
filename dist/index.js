"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const path_1 = require("path");
const Bot_1 = require("./Component/Bot");
const Web_1 = require("./Component/Web");
const CacheManager_1 = require("./Core/CacheManager");
const MongoDB_1 = require("./Core/MongoDB");
const RankManager_1 = require("./Core/RankManager");
const Redis_1 = require("./Core/Redis");
const TimeManager_1 = require("./Core/TimeManager");
class Core extends events_1.EventEmitter {
    constructor() {
        super();
        this.config = require(path_1.resolve('config.json'));
        this.database = new MongoDB_1.MongoDB(this.config);
        this.cache = new Redis_1.Redis(this.config);
        this.TimeManager = new TimeManager_1.TimeManager(this);
        this.RankManager = new RankManager_1.RankManager(this);
        this.CacheManager = new CacheManager_1.CacheManager(this);
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