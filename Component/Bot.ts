import { CommandClient, Member, Message, MessageContent, VoiceChannel } from 'eris';
import moment from 'moment';
import { Core } from '..';
import { ITime, TimeManager } from '../Core/TimeManager';

export class Bot {
    private config: any;
    private bot: CommandClient;
    private timeManager: TimeManager;

    constructor(core: Core) {
        this.config = core.config.bot;
        this.timeManager = core.TimeManager;

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

    private async commandPredict(msg: Message, args: string[]) {
        msg.channel.createMessage('Test function');
    }

    private async commandGet(msg: Message, args: string[]) {
        const type = args[0];
        const userID = args[1];
        const user = (await this.bot.getRESTGuildMember(msg.member!.guild.id, userID));
        const username = user.nick ? user.nick : user.username;
        let startTime: number;
        let endTime: number;

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

        const Time = await this.timeManager.getByUser(msg.member!.guild.id, userID, startTime!, endTime!);
        this.genTimeData(Time).then(async result => {
            msg.channel.createMessage(await this.genStatusMessage(username, result!.online, result!.offline, result!.afk));
        });
    }

    private async genTimeData(raw: ITime[]) {
        const dataRaw: { [key: string]: Array<{ time: string, type: string }> } = {};
        let data: { online: number, offline: number, afk: number } | undefined;
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
                const now = moment().format('YYYY-MM-DD HH:mm:ss');

                // tempData.push([lastActivity.time, 'Unknown', now]);
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
        }

        data = { online: onlineTotal, offline: offlineTotal, afk: afkTotal };

        return data;
    }

    private async genStatusMessage(user: string, online: number, offline: number, afk: number) {
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
}
