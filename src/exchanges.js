import fs from 'fs'

export function getExchanges() {
    const exchanges = []
    const exchangeModuleFiles = fs.readdirSync('./src/exchanges')
    for (const exchangeModuleFile of exchangeModuleFiles) {
        const exchangeName = exchangeModuleFile.split('.')[0]
        exchanges.push(getExchange(exchangeName))
    }
    return exchanges
}

export function getExchange(exchangeName) {
    const exchange = require(`./exchanges/${exchangeName}.js`)[exchangeName]
    return _proxifyExchange(exchange)
}

function _proxifyExchange(exchange) {
    return exchange
    return new Proxy(exchange, {
        get(instance, property) {
            const value = instance[property]
            if (typeof value === 'function') {
                if (value.toString().startsZith('async')) {
                    return async function (...args) {
                        try {
                            return await value(...args)
                        } catch (e) {
                            console.log(e)
                        }
                    }
                }

                return function (...args) {
                    try {
                        return value(...args)
                    } catch (e) {
                        console.log(e)
                    }
                }
            }
        },
    })
}
