import cors from 'cors';
import { CommandClient } from 'eris';
import { Application, NextFunction, Request, Response } from 'express';
import express from 'express';
import helmet from 'helmet';
import { getStatusCode, ReasonPhrases, StatusCodes } from 'http-status-codes';
import moment from 'moment';
import fetch from 'node-fetch';
import schedule from 'node-schedule';
import SunCalc from 'suncalc';
import { parse, URLSearchParams } from 'url';
import { Core } from '..';
import { CacheManager } from '../Core/CacheManager';
import { ITime, TimeManager } from '../Core/TimeManager';

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
        const host = process.env.HOST || 'localhost';
        this.server.listen(port, host, () => {
            console.log(`[Web] Ready! Port: ${host}`);
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
            next(new Error(ReasonPhrases.BAD_REQUEST));
        }
        next();
    }

    private async errorHandler() {
        this.server.use((err: Error, req: Request, res: Response, next: NextFunction) => {
            if (err.message) {
                res.status(getStatusCode(err.message)).json({
                    error: err.message
                });
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
        this.server.get('/api/custom/:serverID', this.route(this.getCustomTime));
        this.server.get('/api/verify/:token', this.route(this.reCaptcha));
        this.server.get('*', this.route(this.errorURL));
    }

    private async errorURL(req: Request, res: Response) {
        throw new Error(ReasonPhrases.NOT_FOUND);
    }

    private async reCaptcha(req: Request, res: Response) {
        if (!req.params.token) {
            res.status(StatusCodes.UNAUTHORIZED).json({ error: 'Invalid token' });
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
                res.status(StatusCodes.OK).json({ data });
            });
        }
    }

    private async getDay(req: Request, res: Response) {
        const dayTimeCache: [] = JSON.parse(await this.cacheManager.get(`${req.params.serverID}-Day`));

        if (dayTimeCache !== null) {
            res.status(StatusCodes.OK).json({ data: dayTimeCache });
        } else {
            const startTime = new Date().setHours(0, 0, 0, 0) / 1000;
            const endTime = this.getNowTime();
            const dayTime = await this.timeManager.get(req.params.serverID, startTime, endTime);

            this.processData(dayTime, req.params.serverID, startTime, undefined).then(data => {
                res.status(StatusCodes.OK).json({ data });
            });
        }
    }

    private async getWeek(req: Request, res: Response) {
        const weekTimeCache: [] = JSON.parse(await this.cacheManager.get(`${req.params.serverID}-Week`));

        if (weekTimeCache !== null) {
            res.status(StatusCodes.OK).json({ data: weekTimeCache});
        } else {
            const time = new Date();
            const midnight = time.setHours(0, 0, 0, 0) / 1000;
            const day = time.getDay() === 0 ? 7 : time.getDay();
            const startTime = (midnight - (day - 1) * ONE_DAY_SECONDS);
            const endTime = this.getNowTime();
            const weekTime = await this.timeManager.get(req.params.serverID, startTime, endTime);

            this.processData(weekTime, req.params.serverID, startTime, endTime).then(data => {
                res.status(StatusCodes.OK).json({ data });
            });
        }
    }

    private async getCustomTime(req: Request, res: Response) {
        const startTime: number = parseInt(req.query.start as string, 10);
        let endTime: number = parseInt(req.query.end as string, 10) + ONE_DAY_SECONDS;
        const now = this.getNowTime();

        if (endTime > now) endTime = now;

        if (!isNaN(startTime) && !isNaN(endTime) && startTime < endTime) {
            const customTime = await this.timeManager.get(req.params.serverID, startTime, endTime);

            this.processData(customTime, req.params.serverID, startTime, endTime).then(data => {
                res.status(StatusCodes.OK).json({ data });
            });
        } else {
            throw new Error(ReasonPhrases.BAD_REQUEST);
        }
    }

    private async processData(raw: ITime[], serverID: string, startTime: number | undefined, endTime: number | undefined) {
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
                    const now = ((endTime !== undefined) ? moment.unix(endTime) : moment()).format('YYYY-MM-DD HH:mm:ss');

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
        const end = Math.round(Date.now() / 1000);

        for (; time < end; time += ONE_DAY_SECONDS) {
            const date = new Date(time * 1000);
            const sunLight = SunCalc.getTimes(date, 25.034276, 121.561696);
            const sunRise = moment(sunLight.sunrise).format('YYYY-MM-DD HH:mm:ss');
            const sunSet = moment(sunLight.sunset).format('YYYY-MM-DD HH:mm:ss');
            dataSets.push({ content: '', start: sunRise, end: sunSet, type: 'background', className: 'sun'});
        }

        return {
            properties: {
                startTime: moment.unix((startTime !== undefined) ? startTime : raw[0].timeStamp).format('YYYY-MM-DD HH:mm:ss'),
                endTime: moment.unix((endTime !== undefined) ? endTime : end).format('YYYY-MM-DD HH:mm:ss')
            },
            groups,
            dataSets
        };
    }

    private async refreshDayCache() {
        const serverID = await this.timeManager.getDataByKeyword('serverID');
        const startTime = new Date().setHours(0, 0, 0, 0) / 1000;
        const endTime = this.getNowTime();
        const cacheTTL = this.config.cacheDayTTL * 60;

        serverID.forEach(async id => {
            const cacheDay = await this.timeManager.get(id, startTime, endTime);

            if (cacheDay.length !== 0) {
                await this.processData(cacheDay, id, startTime, undefined).then(async data => {
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
            const endTime = this.getNowTime();
            const cacheTTL = (8 - day) * ONE_DAY_SECONDS;

            serverID.forEach(async id => {
                const cacheWeek = await this.timeManager.get(id, startTime, endTime);

                if (cacheWeek.length !== 0) {
                    await this.processData(cacheWeek, id, startTime, endTime).then(async data => {
                        const value = JSON.stringify(data);
                        this.cacheManager.set(`${id}-Week`, value, cacheTTL);
                    });
                }
            });
        });
    }

    private getNowTime() {
        return Math.floor(Date.now() / 1000);
    }
}
