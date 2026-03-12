const runtime = {
    bots: new Map()
};

export function registerBot(platform, instance) {
    runtime.bots.set(platform, {
        platform,
        instance,
        startedAt: Date.now()
    });
}

export function unregisterBot(platform) {
    runtime.bots.delete(platform);
}

export function getBots() {
    return Array.from(runtime.bots.values());
}

export function hasBot(platform) {
    return runtime.bots.has(platform);
}

export function getBot(platform) {
    return runtime.bots.get(platform)?.instance || null;
}
