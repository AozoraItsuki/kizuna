import makeWASocket, {
    useMultiFileAuthState,
    makeCacheableSignalKeyStore
} from "baileys";
import pino from "pino";
import chalk from "chalk";
import readline from "readline";
import { config } from "#config";
import { PHONENUMBER_MCC } from "#src/utils/MCC.js";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(text) {
    return new Promise(resolve => rl.question(text, resolve));
}

export async function createConnection() {
    const sessionDir = "sessions";
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const connectionOptions = {
        logger: pino({ level: "silent" }),
        printQRInTerminal: !config.platforms.whatsapp.usePairing,
        browser: ["Linux", "Chrome", ""],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(
                state.keys,
                pino({ level: "silent" })
            )
        },
        markOnlineOnConnect: true,
        customUploadHosts: [{ hostname: "mmg.whatsapp.net" }]
    };

    const conn = makeWASocket(connectionOptions);

    if (
        config.platforms.whatsapp.usePairing &&
        !conn.authState.creds.registered
    ) {
        let phoneNumber;
        const pairCode = config.platforms.whatsapp.pairingCode;

        if (config.platforms.whatsapp.number) {
            phoneNumber = config.platforms.whatsapp.number.replace(
                /[^0-9]/g,
                ""
            );
            if (
                !Object.keys(PHONENUMBER_MCC).some(v =>
                    phoneNumber.startsWith(v)
                )
            ) {
                console.log(chalk.bgRed.white("❌ Invalid country code."));
                process.exit(1);
            }
        } else {
            phoneNumber = (
                await question(
                    chalk.bgBlue.white("📞 Enter your WhatsApp number: ")
                )
            ).replace(/[^0-9]/g, "");
            if (
                !Object.keys(PHONENUMBER_MCC).some(v =>
                    phoneNumber.startsWith(v)
                )
            ) {
                console.log(chalk.bgRed.white("❌ Invalid country code."));
                phoneNumber = (
                    await question(
                        chalk.bgBlue.white("📞 Re-enter your WhatsApp number: ")
                    )
                ).replace(/[^0-9]/g, "");
            }
            rl.close();
        }

        setTimeout(async () => {
            try {
                let code = await conn.requestPairingCode(phoneNumber, pairCode);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(
                    chalk.bgGreen.black("🔐 Your Pairing Code:"),
                    chalk.bgWhite.black(` ${code} `)
                );
            } catch (err) {
                console.error(
                    chalk.red("❌ Failed to get pairing code:"),
                    err.message
                );
            }
        }, 3000);
    }

    return { conn, saveCreds, connectionOptions };
}
