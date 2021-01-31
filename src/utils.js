export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function isAsync(fn) {
    return fn.constructor.name === 'AsyncFunction';
}