import fs from 'fs'

export function getExchanges(){
    let exchanges = []
    const exchangeModuleFiles = fs.readdirSync('/root/dev/marcobot/src/exchanges')
    for (let exchangeModuleFile of exchangeModuleFiles){
        const exchangeName = exchangeModuleFile.split('.')[0]
        exchanges.push(getExchange(exchangeName))
    }
    return exchanges
}

export function getExchange(exchangeName){
    const exchange = require(`./exchanges/${exchangeName}.js`)[exchangeName]
    return _proxifyExchange(exchange)
}

function _proxifyExchange(exchange){
    return exchange
    return new Proxy(exchange, {
        get(instance, property){
            let value = instance[property]
            if (typeof(value) ==='function'){
                
                if (value.toString().startsZith('async')){
                    return async function(...args){
                        try{
                            return await value(...args)
                        }catch(e){console.log(e)}
                    }
                }
                
                return function(...args){
                    try{
                        return value(...args)
                    }catch(e){console.log(e)}
                }
            }
        }
    })    
}
