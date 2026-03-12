import { getBots } from "#src/core/runtime.js";

const handler = async (m, { conn, args, command }) => {
    const bots = getBots();

    const text = bots
        .map(b => `- ${b.platform} (uptime ${Date.now() - b.startedAt}ms)`)
        .join("\n");

    await conn.sendMessage(m.chat, `Active bots:\n${text}`);
};

handler.command = "status";

export default handler;
