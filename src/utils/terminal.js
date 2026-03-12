import { WebSocketServer } from "ws";
import chalk from "chalk";
import url from "url";
import { config } from "#config";

const origin = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error
};

function stringify(args) {
    return args
        .map(a => {
            if (a instanceof Error) return a.stack || a.message;
            if (typeof a === "object") {
                try {
                    return JSON.stringify(a, null, 2);
                } catch {
                    return "[Object]";
                }
            }
            return String(a);
        })
        .join(" ");
}

let wss = null;

const wsConfig = config.logs?.websocket;

if (wsConfig?.enable) {
    wss = new WebSocketServer({ port: wsConfig.port });

    wss.on("connection", (ws, req) => {
        const { query } = url.parse(req.url, true);
        const token = query.token;

        if (token !== wsConfig.apiKey) {
            ws.close(1008, "Unauthorized");
            return;
        }

        ws.isAuthorized = true;
    });

    origin.log(chalk.green("[logger]"), `WS log secured on :${wsConfig.port}`);
}

function emitLog(level, payload) {
    if (!wss) return;

    const data = JSON.stringify({
        level,
        time: Date.now(),
        ...payload
    });

    for (const client of wss.clients) {
        if (
            client.readyState === client.OPEN &&
            client.isAuthorized &&
            client.bufferedAmount < 1e6
        ) {
            client.send(data);
        }
    }
}

console.log = (...args) => {
    emitLog("log", {
        source: "console",
        message: stringify(args)
    });
    origin.log(...args);
};

console.info = (...args) => {
    emitLog("info", {
        source: "console",
        message: stringify(args)
    });
    origin.info(...args);
};

console.warn = (...args) => {
    emitLog("warn", {
        source: "console",
        message: stringify(args)
    });
    origin.warn(...args);
};

console.error = (...args) => {
    emitLog("error", {
        source: "console",
        message: stringify(args)
    });
    origin.error(...args);
};

const colorMap = {
    black: chalk.black,
    red: chalk.red,
    green: chalk.green,
    yellow: chalk.yellow,
    blue: chalk.blue,
    magenta: chalk.magenta,
    cyan: chalk.cyan,
    white: chalk.white,
    gray: chalk.gray,
    redBright: chalk.redBright,
    greenBright: chalk.greenBright,
    yellowBright: chalk.yellowBright,
    blueBright: chalk.blueBright,
    magentaBright: chalk.magentaBright,
    cyanBright: chalk.cyanBright,
    whiteBright: chalk.whiteBright,
    orange: chalk.ansi256(214)
};

const terminal = {};

terminal.log = (text, type = "LOG", color = "white") => {
    const tag = `> [${type.toUpperCase()}]`;
    const paint = colorMap[color] || chalk.white;

    origin.log(paint(tag), chalk.white(text));

    emitLog("terminal", {
        source: "terminal",
        type,
        message: text
    });
};

export default terminal;

if (!global.__LOGGER_BOUND__) {
    process.on("uncaughtException", err => {
        console.error(err);
    });

    process.on("unhandledRejection", err => {
        console.error(err);
    });

    global.__LOGGER_BOUND__ = true;
}
