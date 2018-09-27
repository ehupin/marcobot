import fs from 'fs'

export function getExchanges(){
    let exchanges = []
    const exchangeModuleFiles = fs.readdirSync('exchanges')
    for (let exchangeModuleFile of exchangeModuleFiles){
        const exchangeName = exchangeModuleFile.split('.')[0]
        const exchange = require(`../exchanges/${exchangeModuleFile}`)[exchangeName]
        exchanges.push(exchange)
    }
    return exchanges
}