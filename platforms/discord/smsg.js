export default function smsg(msg) {
    return {
        id: msg.id,
        chat: msg.channelId,
        sender: msg.author.id,
        fromMe: msg.author.bot,
        isGroup: !!msg.guild,
        text: msg.content || "",
        quoted: null,
        media: null,
        raw: msg
    };
}
