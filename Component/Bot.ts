import { CommandClient, Message, Member, VoiceChannel } from 'eris';
import { Core } from '..';
import { TimeManager } from '../Core/TimeManager';

export class Bot {
    private config: any;
    private bot: CommandClient;
    private timeManager: TimeManager;
    private timeStatus: { [key: string]: { [key: string]: { time: number, type: string }[] } } = {};

    constructor(core: Core) {
        this.config = core.config.bot;
        this.timeManager = core.TimeManager;

        if (!this.config.token) throw Error('Discord token missing');

        this.bot = new CommandClient(
            this.config.token,
            {},
            { prefix: this.config.prefix }
        );

        this.bot.on('ready', () => {
            console.log('[Discord] Ready!');
        });

        this.bot.on('voiceChannelJoin', (member: Member, newChannel: VoiceChannel) => {
            const serverID = newChannel.guild.id;
            const userID = member.id;
            const joinTimestrap = Math.round(Date.now() / 1000);
            const afkChannel = newChannel.guild.afkChannelID;

            if (this.config.ignoreUsers.includes(userID)) return;
            const type = (afkChannel != null) ? ((newChannel.id == afkChannel) ? 'afk' : 'join') : 'join'
            this.timeData(userID, serverID, joinTimestrap, type);
        });

        this.bot.on('voiceChannelLeave', (member: Member, oldChannel: VoiceChannel) => {
            const serverID = oldChannel.guild.id;
            const userID = member.id;
            const leaveTimestrap = Math.round(Date.now() / 1000);

            if (this.config.ignoreUsers.includes(userID)) return;
            this.timeData(userID, serverID, leaveTimestrap, 'leave').then((result) => {
                this.timeManager.create(serverID, userID, result[userID][serverID]);
                this.timeStatus[userID][serverID] = [];
            });
        });

        this.bot.on('voiceChannelSwitch', (member: Member, newChannel: VoiceChannel, oldChannel: VoiceChannel) => {
            const afkChannel = newChannel.guild.afkChannelID;
            const serverID = newChannel.guild.id;
            const userID = member.id;
            const tempTimestrap = Math.round(Date.now() / 1000);

            if (this.config.ignoreUsers.includes(userID)) return;
            if (afkChannel == null) return;

            if (newChannel.id == afkChannel) {
                this.timeData(userID, serverID, tempTimestrap, 'afk');
            } else if (oldChannel.id == afkChannel) {
                this.timeData(userID, serverID, tempTimestrap, 'back');
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
    }

    private async commandPredict(msg: Message, args: string[]) {
        msg.channel.createMessage('Test function');
    }

    private async timeData(userID: string, serverID: string, timeStrap: number, type: string) {
        if (this.timeStatus[userID] == undefined) this.timeStatus[userID] = {};
        if (this.timeStatus[userID][serverID] == undefined) this.timeStatus[userID][serverID] = [];

        this.timeStatus[userID][serverID].push({
            'time': timeStrap,
            'type': type
        });

        return this.timeStatus
    }
}
