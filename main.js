import { PluginManager, PluginWatcher } from "./src/core/pluginEngine.js";
import TelegramWrapper from "./platforms/telegram/wrapper.js";
import WhatsAppWrapper from "./platforms/whatsapp/wrapper.js";
import DiscordWrapper from "./platforms/discord/wrapper.js";
import { handler } from "./src/core/handler.js";
import { config } from "./config.js";
import path from "path";

async function main() {
    const pluginManager = new PluginManager();
    await pluginManager.loadAll();

    const watcher = new PluginWatcher(path.resolve("./plugins"), pluginManager);
    watcher.start();

    const platforms = [];

    if (config.platforms.telegram) {
        platforms.push(
            new TelegramWrapper(config.platforms.telegram, pluginManager)
        );
    }

    if (config.platforms.discord) {
        platforms.push(
            new DiscordWrapper(config.platforms.discord, pluginManager)
        );
    }

    if (config.platforms.whatsapp) {
        platforms.push(
            new WhatsAppWrapper(config.platforms.whatsapp, pluginManager)
        );
    }

    for (const platform of platforms) {
        await platform.start(handler);
    }
}

main().catch(console.error);
