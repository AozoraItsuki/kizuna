import smsg from "./smsg.js";
import { DisconnectReason } from "baileys";
import terminal from "#src/utils/terminal.js";
import { createConnection } from "./connection.js";
import { registerBot } from "#src/core/runtime.js";

export default class WhatsAppWrapper {
    constructor(config, pluginManager) {
        this.config = config;
        this.pluginManager = pluginManager;
        this.platform = "whatsapp";
        this.conn = null;
    }

    async start(handler) {
        const { conn, saveCreds } = await createConnection();
        this.conn = conn;

        registerBot(this.platform, this);

        conn.ev.on("creds.update", saveCreds);

        conn.ev.on("connection.update", async update => {
            const { connection, lastDisconnect } = update;

            if (connection === "open") {
                terminal.log("successfully connected", "whatsapp", "green");
                return;
            }

            if (connection === "close") {
                const reason = lastDisconnect?.error?.output?.statusCode;

                if (reason === DisconnectReason.restartRequired) {
                    await this.start(handler);
                    return;
                }
            }
        });

        conn.ev.on("messages.upsert", async ({ messages, type }) => {
            if (type !== "notify") return;

            for (const msg of messages) {
                if (!msg.message) continue;

                const m = await smsg(conn, msg);
                this._enhance(m);
                await handler(m, this);
            }
        });
    }

    _enhance(m) {
        m.platform = this.platform;

        const owners = this.config.owners || [];
        const owner = owners.find(o => o.id === m.sender);

        m.isOwner = !!owner;
        m.isDev = owner?.isDeveloper ?? false;

        m.command = null;
        m.args = [];
        m.usedPrefix = null;
    }

    async sendMessage(chat, text) {
        return this.conn.sendMessage(chat, { text });
    }
}
