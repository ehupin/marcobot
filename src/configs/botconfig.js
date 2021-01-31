const botConfig = {
    startingExchange: 'binance',
    currency: 'btc',
    run: false,
    stop: false,
    interval: 2 * 1000,
    bestArbitragesThreshold: 10,
    ratioThreshold: 1.03,
    exitOnFailure: true,
}

export { botConfig };