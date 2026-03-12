import { isLidUser, isPnUser } from "baileys";

export default async function smsg(conn, msg) {
    const m = {};

    let sender = msg.key.participant || msg.key.remoteJid;
    let senderLid = null;

    if (isLidUser(sender)) {
        const id = sender.split("@")[0] + "_reverse";
        const rawPn = await conn.signalRepository.lidMapping.keys.get(
            "lid-mapping",
            [id]
        );
        sender = rawPn?.[id] ? rawPn[id] + "@s.whatsapp.net" : sender;
    }

    if (isPnUser(sender)) {
        const id = sender.split("@")[0];
        const rawLid = await conn.signalRepository.lidMapping.keys.get(
            "lid-mapping",
            [id]
        );
        senderLid = rawLid?.[id] ? rawLid[id] + "@lid" : null;
    }

    m.id = msg.key.id;
    m.chat = msg.key.remoteJid;
    m.sender = sender;
    m.senderLid = senderLid;
    m.fromMe = msg.key.fromMe;
    m.isGroup = m.chat.endsWith("@g.us");

    const message = msg.message;
    const type = Object.keys(message)[0];

    m.type = type;
    m.text =
        message?.conversation ||
        message?.extendedTextMessage?.text ||
        message?.imageMessage?.caption ||
        message?.videoMessage?.caption ||
        "";

    m.quoted = null;
    m.media = null;
    m.raw = msg;

    return m;
}
