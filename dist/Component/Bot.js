"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const eris_1 = require("eris");
const moment_1 = __importDefault(require("moment"));
class Bot {
    constructor(core) {
        this.config = core.config.bot;
        this.timeManager = core.TimeManager;
        if (!this.config.token)
            throw Error('Discord token missing');
        this.bot = new eris_1.CommandClient(this.config.token, { restMode: true }, { prefix: this.config.prefix });
        this.bot.on('ready', () => {
            console.log('[Discord] Ready!');
            core.bot = this.bot;
            core.emit('discordReady');
        });
        this.bot.on('voiceChannelJoin', (member, newChannel) => {
            const serverID = newChannel.guild.id;
            const userID = member.id;
            const joinTimestrap = Math.round(Date.now() / 1000);
            const afkChannel = newChannel.guild.afkChannelID;
            if (member.bot)
                return;
            const type = (afkChannel != null) ? ((newChannel.id === afkChannel) ? 'afk' : 'join') : 'join';
            this.timeManager.create(serverID, userID, joinTimestrap, type);
        });
        this.bot.on('voiceChannelLeave', (member, oldChannel) => {
            const serverID = oldChannel.guild.id;
            const userID = member.id;
            const leaveTimestrap = Math.round(Date.now() / 1000);
            if (member.bot)
                return;
            this.timeManager.create(serverID, userID, leaveTimestrap, 'leave');
        });
        this.bot.on('voiceChannelSwitch', (member, newChannel, oldChannel) => {
            const afkChannel = newChannel.guild.afkChannelID;
            const serverID = newChannel.guild.id;
            const userID = member.id;
            const tempTimestrap = Math.round(Date.now() / 1000);
            if (member.bot)
                return;
            if (afkChannel === null)
                return;
            if (newChannel.id === afkChannel) {
                this.timeManager.create(serverID, userID, tempTimestrap, 'afk');
            }
            else if (oldChannel.id === afkChannel) {
                this.timeManager.create(serverID, userID, tempTimestrap, 'back');
            }
        });
        this.registerCommand();
        this.bot.connect();
    }
    async registerCommand() {
        this.bot.registerCommand('predict', this.commandPredict.bind(this), {
            argsRequired: true,
            description: 'Predicting the status of user.',
            guildOnly: true,
        });
        this.bot.registerCommand('get', this.commandGet.bind(this), {
            argsRequired: true,
            description: 'Get user online offline data.',
            guildOnly: true,
            usage: '[Day|Month] <userID>',
        });
    }
    async commandPredict(msg, args) {
        msg.channel.createMessage('Test function');
    }
    async commandGet(msg, args) {
        const type = args[0];
        const userID = args[1];
        const user = (await this.bot.getRESTGuildMember(msg.member.guild.id, userID));
        const username = user.nick ? user.nick : user.username;
        let startTime;
        let endTime;
        switch (type) {
            case 'day':
                startTime = new Date().setHours(0, 0, 0, 0) / 1000;
                endTime = startTime + 86400;
                break;
            case 'month':
                const time = new Date();
                const year = time.getFullYear();
                const month = time.getMonth() + 1;
                startTime = new Date(year, month, 0).setDate(1) / 1000;
                endTime = new Date(year, month, 0).getTime() / 1000;
        }
        const Time = await this.timeManager.getByUser(msg.member.guild.id, userID, startTime, endTime);
        this.genTimeData(Time).then(async (result) => {
            msg.channel.createMessage(await this.genStatusMessage(username, result.online, result.offline, result.afk));
        });
    }
    async genTimeData(raw) {
        const dataRaw = {};
        let data;
        let onlineTotal = 0;
        let offlineTotal = 0;
        let afkTotal = 0;
        for (const item of raw) {
            if (dataRaw[item.userID] === undefined)
                dataRaw[item.userID] = [];
            dataRaw[item.userID].push({
                time: moment_1.default.unix(item.timeStrap).format('YYYY-MM-DD HH:mm:ss'),
                type: item.type
            });
        }
        for (const key of Object.keys(dataRaw)) {
            if (dataRaw[key] === undefined)
                return;
            const rawData = dataRaw[key];
            let lastActivity;
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
                                offlineTotal += moment_1.default(activity.time).diff(lastActivity.time, 'seconds');
                                break;
                            }
                            case 'afk': {
                                afkTotal += moment_1.default(activity.time).diff(lastActivity.time, 'seconds');
                                break;
                            }
                            case 'back': {
                                keepLastActivity = true;
                                break;
                            }
                        }
                        break;
                    }
                    case 'leave': {
                        switch (lastActivity.type) {
                            case 'join': {
                                onlineTotal += moment_1.default(activity.time).diff(lastActivity.time, 'seconds');
                                break;
                            }
                            case 'leave': {
                                keepLastActivity = true;
                                break;
                            }
                            case 'afk': {
                                afkTotal += moment_1.default(activity.time).diff(lastActivity.time, 'seconds');
                                break;
                            }
                            case 'back': {
                                onlineTotal += moment_1.default(activity.time).diff(lastActivity.time, 'seconds');
                                break;
                            }
                        }
                        break;
                    }
                    case 'afk': {
                        switch (lastActivity.type) {
                            case 'join': {
                                onlineTotal += moment_1.default(activity.time).diff(lastActivity.time, 'seconds');
                                break;
                            }
                            case 'leave': {
                                offlineTotal += moment_1.default(activity.time).diff(lastActivity.time, 'seconds');
                                break;
                            }
                            case 'afk': {
                                keepLastActivity = true;
                                break;
                            }
                            case 'back': {
                                onlineTotal += moment_1.default(activity.time).diff(lastActivity.time, 'seconds');
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
                                offlineTotal += moment_1.default(activity.time).diff(lastActivity.time, 'seconds');
                                break;
                            }
                            case 'afk': {
                                afkTotal += moment_1.default(activity.time).diff(lastActivity.time, 'seconds');
                                break;
                            }
                            case 'back': {
                                keepLastActivity = true;
                                break;
                            }
                        }
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
                        onlineTotal += moment_1.default(now).diff(lastActivity.time, 'seconds');
                        break;
                    }
                    case 'leave': {
                        offlineTotal += moment_1.default(now).diff(lastActivity.time, 'seconds');
                        break;
                    }
                    case 'afk': {
                        afkTotal += moment_1.default(now).diff(lastActivity.time, 'seconds');
                        break;
                    }
                    case 'back': {
                        onlineTotal += moment_1.default(now).diff(lastActivity.time, 'seconds');
                        break;
                    }
                }
            }
        }
        data = { online: onlineTotal, offline: offlineTotal, afk: afkTotal };
        return data;
    }
    async genStatusMessage(user, online, offline, afk) {
        const fields = [];
        fields.push({ name: 'Online', value: this.getDuration(online) });
        fields.push({ name: 'Offline', value: this.getDuration(offline) });
        fields.push({ name: 'AFK', value: this.getDuration(afk) });
        return {
            embed: {
                color: 4886754,
                description: user,
                fields,
                title: 'Status'
            }
        };
    }
    getDuration(second) {
        const duration = moment_1.default.duration(second, 'seconds');
        const days = duration.days().toString();
        let hours = duration.hours().toString();
        let minutes = duration.minutes().toString();
        let seconds = duration.seconds().toString();
        hours = Number(hours) < 10 ? '0' + hours : hours;
        minutes = Number(minutes) < 10 ? '0' + minutes : minutes;
        seconds = Number(seconds) < 10 ? '0' + seconds : seconds;
        const durationText = days + ':' + hours + ':' + minutes + ':' + seconds;
        return durationText;
    }
}
exports.Bot = Bot;
//# sourceMappingURL=Bot.js.map