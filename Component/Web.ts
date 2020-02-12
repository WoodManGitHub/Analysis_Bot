import cors from 'cors';
import { CommandClient } from 'eris';
import { Application, NextFunction, Request, Response } from 'express';
import express from 'express';
import moment from 'moment';
import { Core } from '..';
// tslint:disable-next-line: ordered-imports
import { TimeManager, ITime } from '../Core/TimeManager';

const ERR_BAD_REQUEST = '400 Bad request!';
const ERR_FORBIDDEN = '400 Forbidden!';
const ERR_NOT_FOUND = '404 Not found!';

export class Web {
    private config: any;
    private server: Application;
    private timeManager: TimeManager;
    private Bot: CommandClient;

    constructor(core: Core) {
        this.config = core.config.web;
        this.timeManager = core.TimeManager;
        if (core.bot != null || core.bot !== undefined) {
            this.Bot = core.bot!;
        } else {
            throw new Error('Discord Client not defined');
        }

        this.server = express();

        this.middlewares();
        this.registerRoutes();
        this.errorHandler();
        this.server.listen(this.config.port, () => {
            console.log('[Web] Ready!');
        });
    }

    private async middlewares() {
        this.server.use(express.json());
        this.server.use(cors({ origin: this.config.origin }));
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
        this.server.get('/', (req: Request, res: Response) => res.send('Analysis Bot Web Server'));
        this.server.get('/day/:serverID', this.route(this.getDay));
        this.server.get('/month/:serverID', this.route(this.getMonth));
        this.server.get('/all/:serverID', this.route(this.getAll));
    }

    private async getDay(req: Request, res: Response) {
        const startTime = new Date().setHours(0, 0, 0, 0) / 1000;
        const endTime = startTime + 86400;
        const dayTime = await this.timeManager.get(req.params.serverID, startTime, endTime);

        this.processData(dayTime, req.params.serverID).then(data => {
            res.json({ msg: 'OK', data });
        });
    }

    private async getMonth(req: Request, res: Response) {
        const time = new Date();
        const year = time.getFullYear();
        const month = time.getMonth() + 1;
        const startTime = new Date(year, month, 0).setDate(1) / 1000;
        const endTime = new Date(year, month, 0).getTime() / 1000;
        const monthTime = await this.timeManager.get(req.params.serverID, startTime, endTime);

        this.processData(monthTime, req.params.serverID).then(data => {
            res.json({ msg: 'OK', data });
        });
    }

    private async getAll(req: Request, res: Response) {
        const allTime = await this.timeManager.getAll(req.params.serverID);

        this.processData(allTime, req.params.serverID).then(data => {
            res.json({ msg: 'OK', data });
        });
    }

    private async processData(raw: ITime[], serverID: string) {
        const dataRaw: { [key: string]: Array<{ time: string, type: string }> } = {};
        const data: Array<{ measure: string, avater: string, categories: { [key: string]: { color: string } }, data: string[][] }> = [];

        for (const item of raw) {
            if (dataRaw[item.userID] === undefined) dataRaw[item.userID] = [];
            dataRaw[item.userID].push({
                time: moment.unix(item.timeStrap).format('YYYY-MM-DD HH:mm:ss'),
                type: item.type
            });
        }

        for (const key of Object.keys(dataRaw)) {
            if (dataRaw[key] === undefined) return;

            const rawData = dataRaw[key];
            const user = (await this.Bot.getRESTGuildMember(serverID, key));
            const tempData: string[][] = [];
            let lastActivity: { time: string, type: string } | undefined;

            for (const activity of rawData) {
                if (lastActivity === undefined) {
                    lastActivity = activity;
                    continue;
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
                                tempData.push([lastActivity.time, 'Offline', activity.time]);
                                break;
                            }
                            case 'afk': {
                                tempData.push([lastActivity.time, 'AFK', activity.time]);
                                break;
                            }
                            case 'back': {
                                keepLastActivity = true;
                                break;
                            }
                            default: {
                                tempData.push([lastActivity.time, 'Unknown', activity.time]);
                                break;
                            }
                        }
                        break;
                    }
                    case 'leave': {
                        switch (lastActivity.type) {
                            case 'join': {
                                tempData.push([lastActivity.time, 'Online', activity.time]);
                                break;
                            }
                            case 'leave': {
                                keepLastActivity = true;
                                break;
                            }
                            case 'afk': {
                                tempData.push([lastActivity.time, 'AFK', activity.time]);
                                break;
                            }
                            case 'back': {
                                tempData.push([lastActivity.time, 'Online', activity.time]);
                                break;
                            }
                            default: {
                                tempData.push([lastActivity.time, 'Unknown', activity.time]);
                                break;
                            }
                        }
                        break;
                    }
                    case 'afk': {
                        switch (lastActivity.type) {
                            case 'join': {
                                tempData.push([lastActivity.time, 'Online', activity.time]);
                                break;
                            }
                            case 'leave': {
                                tempData.push([lastActivity.time, 'Offline', activity.time]);
                                break;
                            }
                            case 'afk': {
                                keepLastActivity = true;
                                break;
                            }
                            case 'back': {
                                tempData.push([lastActivity.time, 'Online', activity.time]);
                                break;
                            }
                            default: {
                                tempData.push([lastActivity.time, 'Unknown', activity.time]);
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
                                tempData.push([lastActivity.time, 'Offline', activity.time]);
                                break;
                            }
                            case 'afk': {
                                tempData.push([lastActivity.time, 'AFK', activity.time]);
                                break;
                            }
                            case 'back': {
                                keepLastActivity = true;
                                break;
                            }
                            default: {
                                tempData.push([lastActivity.time, 'Unknown', activity.time]);
                                break;
                            }
                        }
                        break;
                    }
                    default: {
                        tempData.push([lastActivity.time, 'Unknown', activity.time]);
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
                        tempData.push([lastActivity.time, 'Online', now]);
                        break;
                    }
                    case 'leave': {
                        tempData.push([lastActivity.time, 'Offline', now]);
                        break;
                    }
                    case 'afk': {
                        tempData.push([lastActivity.time, 'AFK', now]);
                        break;
                    }
                    case 'back': {
                        tempData.push([lastActivity.time, 'Online', now]);
                        break;
                    }
                    default: {
                        break;
                    }
                }
            }

            data.push({
                measure: user.nick ? user.nick : user.username,
                avater: user.avatarURL,
                categories: {
                    Online: { color: 'green' },
                    Offline: { color: 'red' },
                    AFK: { color: '#606060' },
                    Unknown: { color: '#ba9500' }
                },
                data: tempData
            });
        }

        return data;
    }
}
