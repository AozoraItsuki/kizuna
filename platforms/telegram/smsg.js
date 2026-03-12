export default function smsg(bot, msg) {
    const m = {};

    m.id = msg.message_id;
    m.chat = msg.chat?.id;
    m.sender = msg.from?.id;
    m.fromMe = msg.from?.is_bot || false;
    m.isGroup = msg.chat?.type !== "private";

    m.type = msg.text
        ? "text"
        : msg.photo
        ? "photo"
        : msg.video
        ? "video"
        : msg.audio
        ? "audio"
        : msg.document
        ? "document"
        : msg.sticker
        ? "sticker"
        : "unknown";

    m.text = msg.text || msg.caption || "";
    m.caption = msg.caption || "";

    m.quoted = msg.reply_to_message ? smsg(bot, msg.reply_to_message) : null;

    if (["photo", "video", "audio", "document", "sticker"].includes(m.type)) {
        const file =
            msg.photo?.at(-1) ||
            msg.video ||
            msg.audio ||
            msg.document ||
            msg.sticker;

        m.media = {
            fileId: file.file_id,
            download: () => bot.downloadFile(file.file_id)
        };
    } else {
        m.media = null;
    }

    m.raw = msg;

    return m;
}
