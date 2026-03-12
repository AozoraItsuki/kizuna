import { execaCommand } from "execa";

let hikari = async (m, { conn, isDev, command, text }) => {
    if (!isDev) return;
    const cmd = " " + text.trim();
    if (!cmd) return;
    try {
        const { stdout, stderr } = await execaCommand(cmd, {
            shell: true,
            reject: false
        });

        if (stdout) conn.sendMessage(m.chat, stdout);
        if (stderr) conn.sendMessage(m.chat, stderr);
    } catch (e) {
        if (e.stdout) conn.sendMessage(m.chat, e.stdout);
        if (e.stderr) conn.sendMessage(m.chat, e.stderr);
        else conn.sendMessage(m.chat, String(e));
    }
};

hikari.customPrefix = /^\$\s?/;
hikari.command = new RegExp();
hikari.mods = true;
hikari.noParse = true;

export default hikari;
