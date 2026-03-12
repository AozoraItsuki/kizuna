import terminal from "#src/utils/terminal.js";
import db from "../database/index.js";
import DEFAULT_USER from "../database/default/users.json" with { type: "json" };

function resolvePrefix(text, prefixes) {
    if (!text) return null;
    if (!Array.isArray(prefixes)) prefixes = [prefixes];

    for (const p of prefixes) {
        if (p instanceof RegExp) {
            const m = p.exec(text);
            if (m && m.index === 0) return m[0];
        } else if (typeof p === "string") {
            if (text.startsWith(p)) return p;
        }
    }
    return null;
}

export async function handler(m, conn) {
    if (!m.fromMe) {
        terminal.log(
            `[${m.platform}] ${m.sender} → ${m.text ?? ""}`,
            "CHAT",
            "cyan"
        );
    }

    if (!m.text) return;

    const { isOwner, isDev, isGroup } = m;
    const plugins = conn.pluginManager.getPlugins();
    const Prefix = conn.config.prefix ?? ["!", ".", "/"];

    let user = await db.users.getUser(m.sender);

    if (!user || user._version !== DEFAULT_USER._version) {
        user = await db.users.ensureUserWithDefaults(m.sender, DEFAULT_USER);
    }

    const globalPrefix = resolvePrefix(m.text, Prefix);

    if (!globalPrefix) {
        for (const name of Object.keys(plugins)) {
            const plugin = plugins[name];
            if (!plugin || plugin.disabled || !plugin.customPrefix) continue;

            const hit = resolvePrefix(m.text, plugin.customPrefix);
            if (!hit) continue;

            const body = m.text.slice(hit.length).trim();
            if (!body) return;

            const parts = body.split(/\s+/);
            const command = parts.shift()?.toLowerCase() ?? "";
            const args = parts;

            const accept =
                plugin.command instanceof RegExp
                    ? plugin.command.test(command)
                    : Array.isArray(plugin.command)
                    ? plugin.command.includes(command)
                    : typeof plugin.command === "string"
                    ? plugin.command === command
                    : false;

            if (!accept) continue;

            if (plugin.owner && !isOwner) return;
            if (plugin.developer && !isDev) return;
            if (plugin.group && !isGroup) return;
            if (plugin.private && isGroup) return;

            m.command = command;
            m.args = args;
            m.usedPrefix = hit;
            m.user = user;

            await plugin.call(conn, m, {
                conn,
                command,
                args,
                text: body,
                user,
                isOwner,
                isDev,
                isGroup
            });

            return;
        }

        return;
    }

    const body = m.text.slice(globalPrefix.length).trim();
    if (!body) return;

    const parts = body.split(/\s+/);
    const command = parts.shift()?.toLowerCase() ?? "";
    const args = parts;

    m.command = command;
    m.args = args;
    m.usedPrefix = globalPrefix;
    m.user = user;

    for (const name of Object.keys(plugins)) {
        const plugin = plugins[name];
        if (!plugin || plugin.disabled || plugin.customPrefix) continue;

        const accept =
            plugin.command instanceof RegExp
                ? plugin.command.test(command)
                : Array.isArray(plugin.command)
                ? plugin.command.includes(command)
                : typeof plugin.command === "string"
                ? plugin.command === command
                : false;

        if (!accept) continue;

        if (plugin.owner && !isOwner) return;
        if (plugin.developer && !isDev) return;
        if (plugin.group && !isGroup) return;
        if (plugin.private && isGroup) return;

        await plugin.call(conn, m, {
            conn,
            command,
            args,
            text: args.join(" "),
            user,
            isOwner,
            isDev,
            isGroup
        });

        return;
    }
}
