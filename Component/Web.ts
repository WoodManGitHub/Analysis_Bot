import cors from 'cors';
import { CommandClient } from 'eris';
import { Application, NextFunction, Request, Response } from 'express';
import express from 'express';
import helmet from 'helmet';
import moment from 'moment';
import fetch from 'node-fetch';
import schedule from 'node-schedule';
import SunCalc from 'suncalc';
import { parse, URLSearchParams } from 'url';
import { Core } from '..';
import { CacheManager } from '../Core/CacheManager';
import { ITime, TimeManager } from '../Core/TimeManager';

const ERR_BAD_REQUEST = '400 Bad request!';
const ERR_FORBIDDEN = '400 Forbidden!';
const ERR_NOT_FOUND = '404 Not found!';
const ERR_SERVER_ERROR = '500 Internal Server Error';
const ONE_DAY_SECONDS = 86400;

export class Web {
    private config: any;
    private server: Application;
    private timeManager: TimeManager;
    private cacheManager: CacheManager;
    private Bot: CommandClient;

    constructor(core: Core) {
        this.config = core.config.web;
        this.timeManager = core.TimeManager;
        this.cacheManager = core.CacheManager;
        if (core.bot != null || core.bot !== undefined) {
            this.Bot = core.bot!;
        } else {
            throw new Error('Discord Client not defined');
        }

        this.server = express();

        this.middlewares();
        this.registerRoutes();
        this.errorHandler();
        this.cacheCorn();

        this.refreshDayCache();
        setInterval(() => this.refreshDayCache(), this.config.cacheDayTTL * 60 * 1000);

        if (this.config.devMode) {
            console.log('[Web] Dev Mode: ON');
            this.runServer(this.config.devPort);
        } else {
            this.runServer(this.config.port);
        }
    }

    private runServer(port: number) {
        this.server.listen(port, '0.0.0.0', () => {
            console.log('[Web] Ready!');
        });
    }

    private async middlewares() {
        this.server.use(express.json());
        this.server.use(cors({ origin: this.config.origin }));
        this.server.use(helmet());
        this.server.use(this.checkRequst);
    }

    private async checkRequst(req: Request, res: Response, next: NextFunction) {
        const reqURL = parse(req.url).query as string;
        const reg = /\[\w+\]/;
        if (reg.test(reqURL)) {
            next(new Error('HTTP400'));
        }
        next();
    }

    private async errorHandler() {
        this.server.use((err: Error, req: Request, res: Response, next: NextFunction) => {
            if (err.message.startsWith('HTTP400')) {
                res.status(400).json({
                    error: ERR_BAD_REQUEST
                });
            } else if (err.message.startsWith('HTTP403')) {
                res.status(403).json({
                    error: ERR_FORBIDDEN
                });
            } else if (err.message.startsWith('HTTP404')) {
                res.status(404).json({
                    error: ERR_NOT_FOUND
                });
            } else {
                res.status(500).json({
                    error: ERR_SERVER_ERROR
                });
                next(err);
            }
        });
    }

    private route(fn: (req: Request, res: Response, next: NextFunction) => Promise<void> | void) {
        return (req: Request, res: Response, next: NextFunction) => {
            const promise = fn.bind(this)(req, res, next);
            if (promise instanceof Promise) {
                promise.catch(next);
            }
        };
    }

    private async registerRoutes() {
        this.server.get('/api', (req: Request, res: Response) => res.send('Analysis Bot Web Server'));
        this.server.get('/api/day/:serverID', this.route(this.getDay));
        this.server.get('/api/week/:serverID', this.route(this.getWeek));
        this.server.get('/api/all/:serverID', this.route(this.getAll));
        this.server.get('/api/custom/:serverID', this.route(this.getCustomTime));
        this.server.get('/api/verify/:token', this.route(this.reCaptcha));
        this.server.get('*', this.route(this.errorURL));
    }

    private async errorURL(req: Request, res: Response) {
        throw new Error('HTTP404');
    }

    private async reCaptcha(req: Request, res: Response) {
        if (!req.params.token) {
            res.status(400).json({ msg: 'Invalid token' });
        } else {
            const options = new URLSearchParams({
                secret: this.config.recaptcha.secretKey,
                response: req.params.token
            });
            await fetch('https://www.google.com/recaptcha/api/siteverify', {
                method: 'POST',
                body: options
            })
            .then(response => response.json())
            .then(data => {
                res.json({ msg: 'OK', data});
            });
        }
    }

    private async getDay(req: Request, res: Response) {
        const dayTimeCache: [] = JSON.parse(await this.cacheManager.get(`${req.params.serverID}-Day`));

        if (dayTimeCache !== null) {
            res.json({ msg: 'OK', data: dayTimeCache });
        } else {
            const startTime = new Date().setHours(0, 0, 0, 0) / 1000;
            const endTime = startTime + ONE_DAY_SECONDS;
            const dayTime = await this.timeManager.get(req.params.serverID, startTime, endTime);

            this.processData(dayTime, req.params.serverID, startTime).then(data => {
                res.json({ msg: 'OK', data });
            });
        }
    }

    private async getWeek(req: Request, res: Response) {
        const weekTimeCache: [] = JSON.parse(await this.cacheManager.get(`${req.params.serverID}-Week`));

        if (weekTimeCache !== null) {
            res.json({ msg: 'OK', data: weekTimeCache});
        } else {
            const time = new Date();
            const midnight = time.setHours(0, 0, 0, 0) / 1000;
            const day = time.getDay() === 0 ? 7 : time.getDay();
            const startTime = (midnight - (day - 1) * ONE_DAY_SECONDS);
            const endTime = Math.floor(time.getTime() / 1000) + ONE_DAY_SECONDS;
            const weekTime = await this.timeManager.get(req.params.serverID, startTime, endTime);

            this.processData(weekTime, req.params.serverID, startTime).then(data => {
                res.json({ msg: 'OK', data });
            });
        }
    }

    private async getAll(req: Request, res: Response) {
        const allTime = await this.timeManager.getAll(req.params.serverID);

        this.processData(allTime, req.params.serverID, undefined).then(data => {
            res.json({ msg: 'OK', data });
        });
    }

    private async getCustomTime(req: Request, res: Response) {
        const startTime: number = parseInt(req.query.start as string, 10);
        const endTime: number = parseInt(req.query.end as string, 10);

        if (!isNaN(startTime) && !isNaN(endTime) && startTime < endTime) {
            const customTime = await this.timeManager.get(req.params.serverID, startTime, endTime);
            this.processData(customTime, req.params.serverID, startTime).then(data => {
                res.json({ msg: 'OK', data });
            });
        } else {
            throw new Error('HTTP400');
        }
    }

    private async processData(raw: ITime[], serverID: string, startTime: number | undefined) {
        if (raw.length === 0) return '';
        const dataRaw: { [key: string]: Array<{ time: string, type: string }> } = {};
        const groups: Array<{ id: string, content: string }> = [];
        // const dataSets: Array<{ content: string, start: string, end: string, group: string, type: string, className: string, title: string }> = [];
        const dataSets: Array<{ [key: string]: string}> = [];

        for (const item of raw) {
            if (dataRaw[item.userID] === undefined) dataRaw[item.userID] = [];
            dataRaw[item.userID].push({
                time: moment.unix(item.timeStamp).format('YYYY-MM-DD HH:mm:ss'),
                type: item.type
            });
        }

        for (const key of Object.keys(dataRaw)) {
            if (dataRaw[key] === undefined) return;

            const rawData = dataRaw[key];
            await this.Bot.getRESTGuildMember(serverID, key).then(async (user: any) => {
                const userName = user.nick ? user.nick : user.username;
                let lastActivity: { time: string, type: string } | undefined;

                for (const activity of rawData) {
                    if (lastActivity === undefined) {
                        if (startTime !== undefined) {
                            const lastData = await this.timeManager.getLastDataByUser(serverID, key, startTime);
                            if (lastData.length !== 0) {
                                lastActivity = { time: moment.unix(startTime).format('YYYY-MM-DD HH:mm:ss'), type: lastData[0].type };
                            } else {
                                lastActivity = activity;
                                continue;
                            }
                        } else {
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
                                    // tslint:disable-next-line: max-line-length
                                    dataSets.push({content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'offline', title: `Offline<br>${lastActivity.time} - ${activity.time}`});
                                    break;
                                }
                                case 'afk': {
                                    dataSets.push({content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'afk', title: `AFK<br>${lastActivity.time} - ${activity.time}`});
                                    break;
                                }
                                case 'back': {
                                    keepLastActivity = true;
                                    break;
                                }
                                default: {
                                    // tslint:disable-next-line: max-line-length
                                    dataSets.push({content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'unknown', title: `Unknown<br>${lastActivity.time} - ${activity.time}`});
                                    break;
                                }
                            }
                            break;
                        }
                        case 'leave': {
                            switch (lastActivity.type) {
                                case 'join': {
                                    dataSets.push({content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'online', title: `Online<br>${lastActivity.time} - ${activity.time}`});
                                    break;
                                }
                                case 'leave': {
                                    keepLastActivity = true;
                                    break;
                                }
                                case 'afk': {
                                    dataSets.push({content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'afk', title: `AFK<br>${lastActivity.time} - ${activity.time}`});
                                    break;
                                }
                                case 'back': {
                                    dataSets.push({content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'online', title: `Online<br>${lastActivity.time} - ${activity.time}`});
                                    break;
                                }
                                default: {
                                    // tslint:disable-next-line: max-line-length
                                    dataSets.push({content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'unknown', title: `Unknown<br>${lastActivity.time} - ${activity.time}`});
                                    break;
                                }
                            }
                            break;
                        }
                        case 'afk': {
                            switch (lastActivity.type) {
                                case 'join': {
                                    dataSets.push({content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'online', title: `Online<br>${lastActivity.time} - ${activity.time}`});
                                    break;
                                }
                                case 'leave': {
                                    // tslint:disable-next-line: max-line-length
                                    dataSets.push({content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'offline', title: `Offline<br>${lastActivity.time} - ${activity.time}`});
                                    break;
                                }
                                case 'afk': {
                                    keepLastActivity = true;
                                    break;
                                }
                                case 'back': {
                                    dataSets.push({content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'online', title: `Online<br>${lastActivity.time} - ${activity.time}`});
                                    break;
                                }
                                default: {
                                    // tslint:disable-next-line: max-line-length
                                    dataSets.push({content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'unknown', title: `Unknown<br>${lastActivity.time} - ${activity.time}`});
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
                                    // tslint:disable-next-line: max-line-length
                                    dataSets.push({content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'offline', title: `Offline<br>${lastActivity.time} - ${activity.time}`});
                                    break;
                                }
                                case 'afk': {
                                    dataSets.push({content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'afk', title: `AFK<br>${lastActivity.time} - ${activity.time}`});
                                    break;
                                }
                                case 'back': {
                                    keepLastActivity = true;
                                    break;
                                }
                                default: {
                                    // tslint:disable-next-line: max-line-length
                                    dataSets.push({content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'unknown', title: `Unknown<br>${lastActivity.time} - ${activity.time}`});
                                    break;
                                }
                            }
                            break;
                        }
                        default: {
                            dataSets.push({content: '', start: lastActivity.time, end: activity.time, group: userName, className: 'unknown', title: `Unknown<br>${lastActivity.time} - ${activity.time}`});
                            break;
                        }
                    }
                    if (!keepLastActivity) lastActivity = activity;
                }

                // last record
                if (lastActivity !== undefined) {
                    const now = moment().format('YYYY-MM-DD HH:mm:ss');

                    // tempData.push([lastActivity.time, 'Unknown', now]);
                    switch (lastActivity.type) {
                        case 'join': {
                            dataSets.push({content: '', start: lastActivity.time, end: now, group: userName, className: 'online', title: `Online<br>${lastActivity.time} - ${now}`});
                            break;
                        }
                        case 'leave': {
                            dataSets.push({content: '', start: lastActivity.time, end: now, group: userName, className: 'offline', title: `Offline<br>${lastActivity.time} - ${now}`});
                            break;
                        }
                        case 'afk': {
                            dataSets.push({content: '', start: lastActivity.time, end: now, group: userName, className: 'afk', title: `AFK<br>${lastActivity.time} - ${now}`});
                            break;
                        }
                        case 'back': {
                            dataSets.push({content: '', start: lastActivity.time, end: now, group: userName, className: 'online', title: `Online<br>${lastActivity.time} - ${now}`});
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

        // Sunrise Sunset
        let time = (startTime !== undefined) ? startTime : raw[0].timeStamp;
        const endTime = Math.round(Date.now() / 1000);

        for (; time < endTime; time += ONE_DAY_SECONDS) {
            const date = new Date(time * 1000);
            const sunLight = SunCalc.getTimes(date, 25.034276, 121.561696);
            const sunRise = moment(sunLight.sunrise).format('YYYY-MM-DD HH:mm:ss');
            const sunSet = moment(sunLight.sunset).format('YYYY-MM-DD HH:mm:ss');
            dataSets.push({ content: '', start: sunRise, end: sunSet, type: 'background', className: 'sun'});
        }

        return {
            properties: {
                startTime: moment.unix((startTime !== undefined) ? startTime : raw[0].timeStamp).format('YYYY-MM-DD HH:mm:ss'),
                endTime: moment().format('YYYY-MM-DD HH:mm:ss')
            },
            groups,
            dataSets
        };
    }

    private async refreshDayCache() {
        const serverID = await this.timeManager.getDataByKeyword('serverID');
        const startTime = new Date().setHours(0, 0, 0, 0) / 1000;
        const endTime = startTime + ONE_DAY_SECONDS;
        const cacheTTL = this.config.cacheDayTTL * 60;

        serverID.forEach(async id => {
            const cacheDay = await this.timeManager.get(id, startTime, endTime);

            if (cacheDay.length !== 0) {
                await this.processData(cacheDay, id, startTime).then(async data => {
                    const value = JSON.stringify(data);
                    this.cacheManager.set(`${id}-Day`, value, cacheTTL);
                });
            }
        });
        return this.refreshDayCache;
    }

    private async cacheCorn() {
        schedule.scheduleJob('0 0 * * *', async () => {
            const serverID = await this.timeManager.getDataByKeyword('serverID');

            const time = new Date();
            const midnight = time.setHours(0, 0, 0, 0) / 1000;
            const day = time.getDay() === 0 ? 7 : time.getDay();
            const startTime = (midnight - (day - 1) * ONE_DAY_SECONDS);
            const endTime = Math.floor(time.getTime() / 1000) + ONE_DAY_SECONDS;
            const cacheTTL = (8 - day) * ONE_DAY_SECONDS;

            serverID.forEach(async id => {
                const cacheWeek = await this.timeManager.get(id, startTime, endTime);

                if (cacheWeek.length !== 0) {
                    await this.processData(cacheWeek, id, startTime).then(async data => {
                        const value = JSON.stringify(data);
                        this.cacheManager.set(`${id}-Week`, value, cacheTTL);
                    });
                }
            });
        });
    }
}
