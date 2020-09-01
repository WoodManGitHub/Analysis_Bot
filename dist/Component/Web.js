"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const http_status_codes_1 = require("http-status-codes");
const moment_1 = __importDefault(require("moment"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const node_schedule_1 = __importDefault(require("node-schedule"));
const suncalc_1 = __importDefault(require("suncalc"));
const url_1 = require("url");
const ONE_DAY_SECONDS = 86400;
class Web {
    constructor(core) {
        this.config = core.config.web;
        this.timeManager = core.TimeManager;
        this.cacheManager = core.CacheManager;
        if (core.bot != null || core.bot !== undefined) {
            this.Bot = core.bot;
        }
        else {
            throw new Error('Discord Client not defined');
        }
        this.server = express_1.default();
        this.middlewares();
        this.registerRoutes();
        this.errorHandler();
        this.cacheCorn();
        this.refreshDayCache();
        setInterval(() => this.refreshDayCache(), this.config.cacheDayTTL * 60 * 1000);
        if (this.config.devMode) {
            console.log('[Web] Dev Mode: ON');
            this.runServer(this.config.devPort);
        }
        else {
            this.runServer(this.config.port);
        }
    }
    runServer(port) {
        this.server.listen(port, '0.0.0.0', () => {
            console.log('[Web] Ready!');
        });
    }
    async middlewares() {
        this.server.use(express_1.default.json());
        this.server.use(cors_1.default({ origin: this.config.origin }));
        this.server.use(helmet_1.default());
        this.server.use(this.checkRequst);
    }
    async checkRequst(req, res, next) {
        const reqURL = url_1.parse(req.url).query;
        const reg = /\[\w+\]/;
        if (reg.test(reqURL)) {
            next(new Error(http_status_codes_1.ReasonPhrases.BAD_REQUEST));
        }
        next();
    }
    async errorHandler() {
        this.server.use((err, req, res, next) => {
            if (err.message) {
                res.status(http_status_codes_1.getStatusCode(err.message)).json({
                    error: err.message
                });
            }
        });
    }
    route(fn) {
        return (req, res, next) => {
            const promise = fn.bind(this)(req, res, next);
            if (promise instanceof Promise) {
                promise.catch(next);
            }
        };
    }
    async registerRoutes() {
        this.server.get('/api', (req, res) => res.send('Analysis Bot Web Server'));
        this.server.get('/api/day/:serverID', this.route(this.getDay));
        this.server.get('/api/week/:serverID', this.route(this.getWeek));
        this.server.get('/api/all/:serverID', this.route(this.getAll));
        this.server.get('/api/custom/:serverID', this.route(this.getCustomTime));
        this.server.get('/api/verify/:token', this.route(this.reCaptcha));
        this.server.get('*', this.route(this.errorURL));
    }
    async errorURL(req, res) {
        throw new Error(http_status_codes_1.ReasonPhrases.NOT_FOUND);
    }
    async reCaptcha(req, res) {
        if (!req.params.token) {
            res.status(http_status_codes_1.StatusCodes.UNAUTHORIZED).json({ error: 'Invalid token' });
        }
        else {
            const options = new url_1.URLSearchParams({
                secret: this.config.recaptcha.secretKey,
                response: req.params.token
            });
            await node_fetch_1.default('https://www.google.com/recaptcha/api/siteverify', {
                method: 'POST',
                body: options
            })
                .then(response => response.json())
                .then(data => {
                res.status(http_status_codes_1.StatusCodes.OK).json({ data });
            });
        }
    }
    async getDay(req, res) {
        const dayTimeCache = JSON.parse(await this.cacheManager.get(`${req.params.serverID}-Day`));
        if (dayTimeCache !== null) {
            res.status(http_status_codes_1.StatusCodes.OK).json({ data: dayTimeCache });
        }
        else {
            const startTime = new Date().setHours(0, 0, 0, 0) / 1000;
            const endTime = startTime + ONE_DAY_SECONDS;
            const dayTime = await this.timeManager.get(req.params.serverID, startTime, endTime);
            this.processData(dayTime, req.params.serverID, startTime).then(data => {
                res.status(http_status_codes_1.StatusCodes.OK).json({ data });
            });
        }
    }
    async getWeek(req, res) {
        const weekTimeCache = JSON.parse(await this.cacheManager.get(`${req.params.serverID}-Week`));
        if (weekTimeCache !== null) {
            res.status(http_status_codes_1.StatusCodes.OK).json({ data: weekTimeCache });
        }
        else {
            const time = new Date();
            const midnight = time.setHours(0, 0, 0, 0) / 1000;
            const day = time.getDay() === 0 ? 7 : time.getDay();
            const startTime = (midnight - (day - 1) * ONE_DAY_SECONDS);
            const endTime = Math.floor(time.getTime() / 1000) + ONE_DAY_SECONDS;
            const weekTime = await this.timeManager.get(req.params.serverID, startTime, endTime);
            this.processData(weekTime, req.params.serverID, startTime).then(data => {
                res.status(http_status_codes_1.StatusCodes.OK).json({ data });
            });
        }
    }
    async getAll(req, res) {
        const allTime = await this.timeManager.getAll(req.params.serverID);
        this.processData(allTime, req.params.serverID, undefined).then(data => {
            res.json({ msg: 'OK', data });
        });
    }
    async getCustomTime(req, res) {
        const startTime = parseInt(req.query.start, 10);
        const endTime = parseInt(req.query.end, 10);
        if (!isNaN(startTime) && !isNaN(endTime) && startTime < endTime) {
            const customTime = await this.timeManager.get(req.params.serverID, startTime, endTime);
            this.processData(customTime, req.params.serverID, startTime).then(data => {
                res.status(http_status_codes_1.StatusCodes.OK).json({ data });
            });
        }
        else {
            throw new Error(http_status_codes_1.ReasonPhrases.BAD_REQUEST);
        }
    }
    async processData(raw, serverID, startTime) {
        if (raw.length === 0)
            return '';
        const dataRaw = {};
        const groups = [];
        const dataSets = [];
        for (const item of raw) {
            if (dataRaw[item.userID] === undefined)
                dataRaw[item.userID] = [];
            dataRaw[item.userID].push({
                time: moment_1.default.unix(item.timeStamp).format('YYYY-MM-DD HH:mm:ss'),
                type: item.type
            });
        }
        for (const key of Object.keys(dataRaw)) {
            if (dataRaw[key] === undefined)
                return;
            const rawData = dataRaw[key];
            await this.Bot.getRESTGuildMember(serverID, key).then(async (user) => {
                const userName = user.nick ? user.nick : user.username;
                let lastActivity;
                for (const activity of rawData) {
                    if (lastActivity === undefined) {
                        if (startTime !== undefined) {
                            const lastData = await this.timeManager.getLastDataByUser(serverID, key, startTime);
                            if (lastData.length !== 0) {
                                lastActivity = { time: moment_1.default.unix(startTime).format('YYYY-MM-DD HH:mm:ss'), type: lastData[0].type };
                            }
                            else {
                                lastActivity = activity;
                                continue;
                            }
                        }
                        else {
                            lastActivity = activity;
                            continue;
                        }
                    }
                    let keepLastActivity = false;
                    switch (activity.type) {
                        case 'join': {
                            switch (lastActivity.type) {
                                case 'join': {
                                    keepLastActivity = true;
                                    break;
                                }
                                case 'leave': {
                                    dataSets.push({ content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'offline', title: `Offline<br>${lastActivity.time} - ${activity.time}` });
                                    break;
                                }
                                case 'afk': {
                                    dataSets.push({ content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'afk', title: `AFK<br>${lastActivity.time} - ${activity.time}` });
                                    break;
                                }
                                case 'back': {
                                    keepLastActivity = true;
                                    break;
                                }
                                default: {
                                    dataSets.push({ content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'unknown', title: `Unknown<br>${lastActivity.time} - ${activity.time}` });
                                    break;
                                }
                            }
                            break;
                        }
                        case 'leave': {
                            switch (lastActivity.type) {
                                case 'join': {
                                    dataSets.push({ content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'online', title: `Online<br>${lastActivity.time} - ${activity.time}` });
                                    break;
                                }
                                case 'leave': {
                                    keepLastActivity = true;
                                    break;
                                }
                                case 'afk': {
                                    dataSets.push({ content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'afk', title: `AFK<br>${lastActivity.time} - ${activity.time}` });
                                    break;
                                }
                                case 'back': {
                                    dataSets.push({ content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'online', title: `Online<br>${lastActivity.time} - ${activity.time}` });
                                    break;
                                }
                                default: {
                                    dataSets.push({ content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'unknown', title: `Unknown<br>${lastActivity.time} - ${activity.time}` });
                                    break;
                                }
                            }
                            break;
                        }
                        case 'afk': {
                            switch (lastActivity.type) {
                                case 'join': {
                                    dataSets.push({ content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'online', title: `Online<br>${lastActivity.time} - ${activity.time}` });
                                    break;
                                }
                                case 'leave': {
                                    dataSets.push({ content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'offline', title: `Offline<br>${lastActivity.time} - ${activity.time}` });
                                    break;
                                }
                                case 'afk': {
                                    keepLastActivity = true;
                                    break;
                                }
                                case 'back': {
                                    dataSets.push({ content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'online', title: `Online<br>${lastActivity.time} - ${activity.time}` });
                                    break;
                                }
                                default: {
                                    dataSets.push({ content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'unknown', title: `Unknown<br>${lastActivity.time} - ${activity.time}` });
                                    break;
                                }
                            }
                            break;
                        }
                        case 'back': {
                            switch (lastActivity.type) {
                                case 'join': {
                                    keepLastActivity = true;
                                    break;
                                }
                                case 'leave': {
                                    dataSets.push({ content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'offline', title: `Offline<br>${lastActivity.time} - ${activity.time}` });
                                    break;
                                }
                                case 'afk': {
                                    dataSets.push({ content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'afk', title: `AFK<br>${lastActivity.time} - ${activity.time}` });
                                    break;
                                }
                                case 'back': {
                                    keepLastActivity = true;
                                    break;
                                }
                                default: {
                                    dataSets.push({ content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'unknown', title: `Unknown<br>${lastActivity.time} - ${activity.time}` });
                                    break;
                                }
                            }
                            break;
                        }
                        default: {
                            dataSets.push({ content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'unknown', title: `Unknown<br>${lastActivity.time} - ${activity.time}` });
                            break;
                        }
                    }
                    if (!keepLastActivity)
                        lastActivity = activity;
                }
                if (lastActivity !== undefined) {
                    const now = moment_1.default().format('YYYY-MM-DD HH:mm:ss');
                    switch (lastActivity.type) {
                        case 'join': {
                            dataSets.push({ content: '', start: lastActivity.time, end: now, group: userName, className: 'online', title: `Online<br>${lastActivity.time} - ${now}` });
                            break;
                        }
                        case 'leave': {
                            dataSets.push({ content: '', start: lastActivity.time, end: now, group: userName, className: 'offline', title: `Offline<br>${lastActivity.time} - ${now}` });
                            break;
                        }
                        case 'afk': {
                            dataSets.push({ content: '', start: lastActivity.time, end: now, group: userName, className: 'afk', title: `AFK<br>${lastActivity.time} - ${now}` });
                            break;
                        }
                        case 'back': {
                            dataSets.push({ content: '', start: lastActivity.time, end: now, group: userName, className: 'online', title: `Online<br>${lastActivity.time} - ${now}` });
                            break;
                        }
                        default: {
                            break;
                        }
                    }
                }
                groups.push({
                    id: userName,
                    content: `<img class="avatar" src="${user.avatarURL}" /><span class="name">${(user.nick ? user.nick : user.username).substr(0, 20)}</span>`
                });
            }).catch(err => {
                return;
            });
        }
        let time = (startTime !== undefined) ? startTime : raw[0].timeStamp;
        const endTime = Math.round(Date.now() / 1000);
        for (; time < endTime; time += ONE_DAY_SECONDS) {
            const date = new Date(time * 1000);
            const sunLight = suncalc_1.default.getTimes(date, 25.034276, 121.561696);
            const sunRise = moment_1.default(sunLight.sunrise).format('YYYY-MM-DD HH:mm:ss');
            const sunSet = moment_1.default(sunLight.sunset).format('YYYY-MM-DD HH:mm:ss');
            dataSets.push({ content: '', start: sunRise, end: sunSet, type: 'background', className: 'sun' });
        }
        return {
            properties: {
                startTime: moment_1.default.unix((startTime !== undefined) ? startTime : raw[0].timeStamp).format('YYYY-MM-DD HH:mm:ss'),
                endTime: moment_1.default().format('YYYY-MM-DD HH:mm:ss')
            },
            groups,
            dataSets
        };
    }
    async refreshDayCache() {
        const serverID = await this.timeManager.getDataByKeyword('serverID');
        const startTime = new Date().setHours(0, 0, 0, 0) / 1000;
        const endTime = startTime + ONE_DAY_SECONDS;
        const cacheTTL = this.config.cacheDayTTL * 60;
        serverID.forEach(async (id) => {
            const cacheDay = await this.timeManager.get(id, startTime, endTime);
            if (cacheDay.length !== 0) {
                await this.processData(cacheDay, id, startTime).then(async (data) => {
                    const value = JSON.stringify(data);
                    this.cacheManager.set(`${id}-Day`, value, cacheTTL);
                });
            }
        });
        return this.refreshDayCache;
    }
    async cacheCorn() {
        node_schedule_1.default.scheduleJob('0 0 * * *', async () => {
            const serverID = await this.timeManager.getDataByKeyword('serverID');
            const time = new Date();
            const midnight = time.setHours(0, 0, 0, 0) / 1000;
            const day = time.getDay() === 0 ? 7 : time.getDay();
            const startTime = (midnight - (day - 1) * ONE_DAY_SECONDS);
            const endTime = Math.floor(time.getTime() / 1000) + ONE_DAY_SECONDS;
            const cacheTTL = (8 - day) * ONE_DAY_SECONDS;
            serverID.forEach(async (id) => {
                const cacheWeek = await this.timeManager.get(id, startTime, endTime);
                if (cacheWeek.length !== 0) {
                    await this.processData(cacheWeek, id, startTime).then(async (data) => {
                        const value = JSON.stringify(data);
                        this.cacheManager.set(`${id}-Week`, value, cacheTTL);
                    });
                }
            });
        });
    }
}
exports.Web = Web;
//# sourceMappingURL=Web.js.map