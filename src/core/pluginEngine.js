import fs, { watch, existsSync, promises as fsPromises } from "fs";
import path from "path";
import { pathToFileURL } from "url";
import chalk from "chalk";
import syntaxerror from "syntax-error";

const PLUGIN_DIR = path.resolve("./plugins");

const pluginFilter = file =>
    /\.(js|ts)$/i.test(file) && !path.basename(file).startsWith(".");

export class PluginManager {
    constructor() {
        this.plugins = {};
        this.loading = new Set();
        this.maxConcurrent = 5;
    }

    getPlugins() {
        return this.plugins;
    }

    async _walk(dir) {
        const entries = await fsPromises.readdir(dir, { withFileTypes: true });
        const files = [];

        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push(...(await this._walk(full)));
            } else if (pluginFilter(full)) {
                files.push(full);
            }
        }

        return files;
    }

    async loadAll() {
        const files = await this._walk(PLUGIN_DIR);
        let ok = 0;
        let fail = 0;

        for (let i = 0; i < files.length; i += this.maxConcurrent) {
            const chunk = files.slice(i, i + this.maxConcurrent);
            const results = await Promise.allSettled(
                chunk.map(f => this.loadPlugin(f))
            );

            for (const r of results) {
                r.status === "fulfilled" ? ok++ : fail++;
            }
        }

        console.info(
            `Loaded ${chalk.green(ok)} plugins, ${chalk.red(fail)} failed`
        );
    }

    async loadPlugin(filePath) {
        if (this.loading.has(filePath)) return;
        this.loading.add(filePath);

        const name = path.relative(PLUGIN_DIR, filePath).replace(/\\/g, "/");

        try {
            const code = await fsPromises.readFile(filePath, "utf8");
            const err = syntaxerror(code, filePath, {
                sourceType: "module",
                allowAwaitOutsideFunction: true
            });

            if (err) throw err;

            const mod = await import(
                pathToFileURL(filePath).href + `?update=${Date.now()}`
            );

            const plugin = mod.default || mod;

            if (typeof plugin !== "function") {
                this.plugins[name] = plugin ?? {};
                return;
            }

            const categoryDir = path.dirname(name);
            const baseCategory =
                categoryDir === "." ? "uncategorized" : categoryDir;

            const extraCategory = Array.isArray(plugin.category)
                ? plugin.category
                : plugin.category
                ? [plugin.category]
                : [];

            plugin.category = Array.from(
                new Set([baseCategory, ...extraCategory])
            );

            plugin.format = path.extname(filePath).slice(1);

            this.plugins[name] = plugin;

            if (typeof plugin.init === "function") {
                await plugin.init();
            }
        } finally {
            this.loading.delete(filePath);
        }
    }

    async reload(filePath) {
        if (!pluginFilter(filePath)) return;

        const name = path.relative(PLUGIN_DIR, filePath).replace(/\\/g, "/");

        if (!existsSync(filePath)) {
            delete this.plugins[name];
            console.warn(`Deleted plugin: ${name}`);
            return;
        }

        console.info(`Reloading plugin: ${name}`);
        await this.loadPlugin(filePath);
    }
}

export class PluginWatcher {
    constructor(dir, manager) {
        this.dir = dir;
        this.manager = manager;
        this.debounce = new Map();
    }

    start() {
        watch(this.dir, { recursive: true }, (_e, filename) => {
            if (!filename) return;

            const full = path.join(this.dir, filename);

            clearTimeout(this.debounce.get(filename));
            this.debounce.set(
                filename,
                setTimeout(() => {
                    this.manager.reload(full);
                    this.debounce.delete(filename);
                }, 400)
            );
        });

        console.info(`📁 Watching ${this.dir} for plugin changes`);
    }
}
