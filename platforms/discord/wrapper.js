import { Client, GatewayIntentBits } from "discord.js";
import { registerBot } from "#src/core/runtime.js";
import terminal from "#src/utils/terminal.js";
import smsg from "./smsg.js";

export default class DiscordWrapper {
    constructor(config, pluginManager) {
        this.config = config;
        this.pluginManager = pluginManager;
        this.platform = "discord";
        this.client = null;
    }

    async start(handler) {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages
            ]
        });

        this.client.on("messageCreate", async msg => {
            if (msg.author.bot) return;

            const m = smsg(msg);
            this._enhance(m);
            await handler(m, this);
        });

        await this.client.login(this.config.token);
        registerBot(this.platform, this);
        terminal.log("successfully connected", "discord", "blue");
    }

    _enhance(m) {
        m.platform = this.platform;

        const owners = this.config.owners || [];
        const owner = owners.find(o => String(o.id) === String(m.sender));

        m.isOwner = !!owner;
        m.isDev = owner?.isDeveloper ?? false;

        m.command = null;
        m.args = [];
        m.usedPrefix = null;
    }

    async sendMessage(chat, text) {
        const channel = await this.client.channels.fetch(chat);
        if (!channel) return;
        return channel.send({ content: text });
    }
}
