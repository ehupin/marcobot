export function Market(exchange, urlLabel){
    return {
        exchange,
        urlLabel,
        baseCurrency: null,
        quoteCurrency: null,
        price: null,
        timestamp: null
    }
}
