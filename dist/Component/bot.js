"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const eris_1 = require("eris");
class Bot {
    constructor(core) {
        this.timeStatus = {};
        this.config = core.config.bot;
        this.timeManager = core.TimeManager;
        if (!this.config.token)
            throw Error('Discord token missing');
        this.bot = new eris_1.CommandClient(this.config.token, {}, { prefix: this.config.prefix });
        this.bot.on('ready', () => {
            console.log('[Discord] Ready!');
        });
        this.bot.on('voiceChannelJoin', (member, newChannel) => {
            const serverID = newChannel.guild.id;
            const userID = member.id;
            const joinTimestrap = Math.round(Date.now() / 1000);
            const afkChannel = newChannel.guild.afkChannelID;
            if (this.config.ignoreUsers.includes(userID))
                return;
            const type = (afkChannel != null) ? ((newChannel.id == afkChannel) ? 'afk' : 'join') : 'join';
            this.timeData(userID, serverID, joinTimestrap, type);
        });
        this.bot.on('voiceChannelLeave', (member, oldChannel) => {
            const serverID = oldChannel.guild.id;
            const userID = member.id;
            const leaveTimestrap = Math.round(Date.now() / 1000);
            if (this.config.ignoreUsers.includes(userID))
                return;
            this.timeData(userID, serverID, leaveTimestrap, 'leave').then((result) => {
                this.timeManager.create(serverID, userID, result[userID][serverID]);
                this.timeStatus[userID][serverID] = [];
            });
        });
        this.bot.on('voiceChannelSwitch', (member, newChannel, oldChannel) => {
            const afkChannel = newChannel.guild.afkChannelID;
            const serverID = newChannel.guild.id;
            const userID = member.id;
            const tempTimestrap = Math.round(Date.now() / 1000);
            if (this.config.ignoreUsers.includes(userID))
                return;
            if (afkChannel == null)
                return;
            if (newChannel.id == afkChannel) {
                this.timeData(userID, serverID, tempTimestrap, 'afk');
            }
            else if (oldChannel.id == afkChannel) {
                this.timeData(userID, serverID, tempTimestrap, 'back');
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
    }
    async commandPredict(msg, args) {
        msg.channel.createMessage('Test function');
    }
    async timeData(userID, serverID, timeStrap, type) {
        if (this.timeStatus[userID] == undefined)
            this.timeStatus[userID] = {};
        if (this.timeStatus[userID][serverID] == undefined)
            this.timeStatus[userID][serverID] = [];
        this.timeStatus[userID][serverID].push({
            'time': timeStrap,
            'type': type
        });
        return this.timeStatus;
    }
}
exports.Bot = Bot;
//# sourceMappingURL=bot.js.map