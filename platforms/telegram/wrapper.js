import { registerBot } from "#src/core/runtime.js";
import TelegramBot from "node-telegram-bot-api";
import terminal from "#src/utils/terminal.js";
import smsg from "./smsg.js";

export default class TelegramWrapper {
    constructor(config, pluginManager) {
        this.config = config;
        this.pluginManager = pluginManager;
        this.platform = "telegram";
        this.bot = null;
    }

    async start(handler) {
        this.bot = new TelegramBot(this.config.token, { polling: true });
        registerBot(this.platform, this);
        terminal.log("successfully connected", "telegram", "cyan");

        const handle = async msg => {
            const m = smsg(this.bot, msg);
            this._enhance(m);
            await handler(m, this);
        };

        this.bot.on("message", handle);
        this.bot.on("edited_message", handle);

        this.bot.on("callback_query", async cq => {
            const fake = {
                message_id: cq.message.message_id,
                chat: cq.message.chat,
                from: cq.from,
                text: cq.data,
                reply_to_message: cq.message
            };

            const m = smsg(this.bot, fake);
            this._enhance(m);
            await handler(m, this);
            await this.bot.answerCallbackQuery(cq.id).catch(() => {});
        });
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

    sendMessage(chat, text, opts = {}) {
        return this.bot.sendMessage(chat, text, opts);
    }

    deleteMessage(chat, id) {
        return this.bot.deleteMessage(chat, String(id));
    }
}
