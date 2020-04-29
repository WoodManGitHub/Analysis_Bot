import { CommandClient, Member, Message, MessageContent, VoiceChannel } from 'eris';
import moment from 'moment';
import schedule from 'node-schedule';
import { Core } from '..';
import { RankManager } from '../Core/RankManager';
import { ITime, TimeManager } from '../Core/TimeManager';

export class Bot {
    private config: any;
    private bot: CommandClient;
    private timeManager: TimeManager;
    private rankManager: RankManager;

    constructor(core: Core) {
        this.config = core.config.bot;
        this.timeManager = core.TimeManager;
        this.rankManager = core.RankManager;

        if (!this.config.token) throw Error('Discord token missing');

        this.bot = new CommandClient(
            this.config.token,
            { restMode: true },
            { prefix: this.config.prefix }
        );

        this.bot.on('ready', () => {
            console.log('[Discord] Ready!');
            core.bot = this.bot;
            core.emit('discordReady');
            this.rankCron();
        });

        this.bot.on('voiceChannelJoin', (member: Member, newChannel: VoiceChannel) => {
            const serverID = newChannel.guild.id;
            const userID = member.id;
            const joinTimestrap = Math.round(Date.now() / 1000);
            const afkChannel = newChannel.guild.afkChannelID;

            if (member.bot) return;
            const type = (afkChannel != null) ? ((newChannel.id === afkChannel) ? 'afk' : 'join') : 'join';
            this.timeManager.create(serverID, userID, joinTimestrap, type);
        });

        this.bot.on('voiceChannelLeave', (member: Member, oldChannel: VoiceChannel) => {
            const serverID = oldChannel.guild.id;
            const userID = member.id;
            const leaveTimestrap = Math.round(Date.now() / 1000);

            if (member.bot) return;
            this.timeManager.create(serverID, userID, leaveTimestrap, 'leave');
        });

        this.bot.on('voiceChannelSwitch', (member: Member, newChannel: VoiceChannel, oldChannel: VoiceChannel) => {
            const afkChannel = newChannel.guild.afkChannelID;
            const serverID = newChannel.guild.id;
            const userID = member.id;
            const tempTimestrap = Math.round(Date.now() / 1000);

            if (member.bot) return;
            if (afkChannel === null) return;

            if (newChannel.id === afkChannel) {
                this.timeManager.create(serverID, userID, tempTimestrap, 'afk');
            } else if (oldChannel.id === afkChannel) {
                this.timeManager.create(serverID, userID, tempTimestrap, 'back');
            }
        });

        this.registerCommand();

        this.bot.connect();
    }

    private async registerCommand() {
        this.bot.registerCommand('get', this.commandGet.bind(this), {
            argsRequired: true,
            description: 'Get user online offline data.',
            guildOnly: true,
            usage: '[day|week|month] <userID>',
        });
        this.bot.registerCommand('rank', this.commandRank.bind(this), {
            argsRequired: true,
            description: 'Switch rank display.',
            guildOnly: true,
            usage: '[on|off]',
        });
    }

    private async commandGet(msg: Message, args: string[]) {
        const type = args[0];
        const userID = args[1];
        const user = (await this.bot.getRESTGuildMember(msg.member!.guild.id, userID));
        let startTime: number;
        let endTime: number;
        const oneDayTime = 24 * 60 * 60;

        switch (type) {
            case 'day':
                startTime = new Date().setHours(0, 0, 0, 0) / 1000;
                endTime = startTime + oneDayTime;
                break;
            case 'month':
                const year = new Date().getFullYear();
                const month = new Date().getMonth() + 1;
                startTime = new Date(year, month, 0).setDate(1) / 1000;
                endTime = new Date(year, month, 0).getTime() / 1000;
                break;
            case 'week':
                const midnight = new Date().setHours(0, 0, 0, 0) / 1000;
                const day = new Date().getDay();
                const monday = (midnight - (day - 1) * oneDayTime);
                const sunday = (midnight + (7 - day) * oneDayTime);
                startTime = monday;
                endTime = sunday;
                break;
        }

        const Time = await this.timeManager.getByUser(msg.member!.guild.id, userID, startTime!, endTime!);
        this.genTimeData(Time, msg.member!.guild.id, startTime!, undefined).then(async result => {
            if (result![userID] !== undefined) {
                msg.channel.createMessage(await this.genStatusMessage(user, result![userID].online, result![userID].offline, result![userID].afk));
            } else {
                const lastData = await this.timeManager.getLastDataByUser(msg.member!.guild.id, userID, startTime);
                if (lastData.length !== 0) {
                    let onlineTotal = 0;
                    let offlineTotal = 0;
                    let afkTotal = 0;
                    switch (lastData[0].type) {
                        case 'join': {
                            onlineTotal += Math.round(Date.now() / 1000) - startTime;
                            break;
                        }
                        case 'leave': {
                            offlineTotal += Math.round(Date.now() / 1000) - startTime;
                            break;
                        }
                        case 'afk': {
                            afkTotal += Math.round(Date.now() / 1000) - startTime;
                            break;
                        }
                        case 'back': {
                            onlineTotal += Math.round(Date.now() / 1000) - startTime;
                            break;
                        }
                    }
                    msg.channel.createMessage(await this.genStatusMessage(user, onlineTotal, offlineTotal, afkTotal));
                } else {
                    msg.channel.createMessage(await this.genErrorMessage('No Data', user));
                }
            }
        });
    }

    private async commandRank(msg: Message, args: string[]) {
        const serverID = msg.member!.guild.id;
        if (!(msg.member!.permission.has('manageMessages')) && !(this.config.admin.includes(msg.member!.id))) {
            msg.channel.createMessage('You do not have permission!');
            return;
        }
        switch (args[0]) {
            case 'on':
                this.rankManager.update(serverID, msg.channel.id, true);
                msg.channel.createMessage('Rank display has been turned on!\nI\'ll now send ranking every day at 0:00 to this channel.');
                break;
            case 'off':
                this.rankManager.update(serverID, msg.channel.id, false);
                msg.channel.createMessage('Rank display has been turned off!');
                break;
        }
    }

    private async genTimeData(raw: ITime[], serverID: string, startTime: number | undefined, endTime: number | undefined) {
        const dataRaw: { [key: string]: Array<{ time: string, type: string }> } = {};
        const data: { [key: string]: { online: number, offline: number, afk: number } } = {};
        let onlineTotal = 0;
        let offlineTotal = 0;
        let afkTotal = 0;

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
            let lastActivity: { time: string, type: string } | undefined;

            onlineTotal = 0;
            offlineTotal = 0;
            afkTotal = 0;

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
                                offlineTotal += moment(activity.time).diff(lastActivity.time, 'seconds');
                                break;
                            }
                            case 'afk': {
                                afkTotal += moment(activity.time).diff(lastActivity.time, 'seconds');
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
                                onlineTotal += moment(activity.time).diff(lastActivity.time, 'seconds');
                                break;
                            }
                            case 'leave': {
                                keepLastActivity = true;
                                break;
                            }
                            case 'afk': {
                                afkTotal += moment(activity.time).diff(lastActivity.time, 'seconds');
                                break;
                            }
                            case 'back': {
                                onlineTotal += moment(activity.time).diff(lastActivity.time, 'seconds');
                                break;
                            }
                        }
                        break;
                    }
                    case 'afk': {
                        switch (lastActivity.type) {
                            case 'join': {
                                onlineTotal += moment(activity.time).diff(lastActivity.time, 'seconds');
                                break;
                            }
                            case 'leave': {
                                offlineTotal += moment(activity.time).diff(lastActivity.time, 'seconds');
                                break;
                            }
                            case 'afk': {
                                keepLastActivity = true;
                                break;
                            }
                            case 'back': {
                                onlineTotal += moment(activity.time).diff(lastActivity.time, 'seconds');
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
                                offlineTotal += moment(activity.time).diff(lastActivity.time, 'seconds');
                                break;
                            }
                            case 'afk': {
                                afkTotal += moment(activity.time).diff(lastActivity.time, 'seconds');
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
                if (!keepLastActivity) lastActivity = activity;
            }

            // last record
            if (lastActivity !== undefined) {
                const now = ((endTime !== undefined) ? moment.unix(endTime) : moment()).format('YYYY-MM-DD HH:mm:ss');

                switch (lastActivity.type) {
                    case 'join': {
                        onlineTotal += moment(now).diff(lastActivity.time, 'seconds');
                        break;
                    }
                    case 'leave': {
                        offlineTotal += moment(now).diff(lastActivity.time, 'seconds');
                        break;
                    }
                    case 'afk': {
                        afkTotal += moment(now).diff(lastActivity.time, 'seconds');
                        break;
                    }
                    case 'back': {
                        onlineTotal += moment(now).diff(lastActivity.time, 'seconds');
                        break;
                    }
                }
            }
            data[key] = { online: onlineTotal, offline: offlineTotal, afk: afkTotal };
        }

        return data;
    }

    private async genErrorMessage(text: string, user: Member | undefined) {
        return {
            embed: (user === undefined) ? {
                color: 13632027,
                description: text,
                title: 'Error'
            } : {
                    color: 13632027,
                    author: {
                        name: user.nick ? user.nick : user.username,
                        icon_url: user.avatarURL
                    },
                    description: text,
                    title: 'Error'
                }
        } as MessageContent;
    }

    private async genStatusMessage(user: Member, online: number, offline: number, afk: number) {
        const fields = [];

        fields.push({ name: 'Online', value: this.getDuration(online), inline: true });
        fields.push({ name: 'Offline', value: this.getDuration(offline), inline: true });
        fields.push({ name: 'AFK', value: this.getDuration(afk), inline: true });

        return {
            embed: {
                color: 4886754,
                author: {
                    name: user.nick ? user.nick : user.username,
                    icon_url: user.avatarURL
                },
                fields,
                title: 'Status'
            }
        } as MessageContent;
    }

    private async genRankMessage(rank: Array<{ user: string, online: number }>) {
        const fields: Array<{ name: string; value: string; }> = [];

        rank.forEach(result => {
            if (result.online <= 0) return;
            fields.push({ name: `**No.${rank.indexOf(result) + 1}** (${this.getDuration(result.online)})`, value: result.user });
        });

        return {
            embed: {
                color: 4886754,
                description: `肝帝排行 - (${moment().subtract(1, 'days').format('YYYY/MM/DD')})`,
                fields,
                title: 'Rank'
            }
        } as MessageContent;
    }

    private getDuration(second: number) {
        const duration = moment.duration(second, 'seconds');
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

    private rankCron() {
        schedule.scheduleJob('0 0 * * *', async () => {
            const settings = await this.rankManager.getAll();
            settings.forEach(async setting => {
                if (setting.rankDisplay) {
                    const endTime = new Date().setHours(0, 0, 0, 0) / 1000;
                    const startTime = endTime - 86400;
                    const time = await this.timeManager.get(setting.serverID, startTime, endTime);

                    this.genTimeData(time, setting.serverID, startTime, endTime).then(async data => {
                        const dataAsArray: Array<{ user: string, online: number }> = [];

                        for (const key of Object.keys(data!)) {
                            const user = await this.bot.getRESTGuildMember(setting.serverID, key);
                            const username = user.nick ? user.nick : user.username;
                            dataAsArray.push({ user: username, online: data![key].online });
                        }
                        dataAsArray.sort((a, b) => {
                            return b.online - a.online;
                        });
                        this.bot.createMessage(setting.channelID, await this.genRankMessage(dataAsArray));
                    });
                }
            });
        });
    }
}
