import {connectDb, getArbitrageOpportunities} from './database.js'
import {updateDb} from './scripts/updateDb.js'
import {getExchange} from './exchanges.js'

async function runBot(){
    let exchange = 'binance'
    let coin = 'btc'
    let walletAmount =  0.08809875
    const db = connectDb()
    let working = false
    
    console.log('Wallet amount: ' + walletAmount)
    
    setInterval(async()=>{
        if (working){return}
        
        working = true
        
        console.log('Updating prices ...')
        await updateDb(db)
        
        console.log('Looking for arbitrages ...')
        const arbitrages = (await getArbitrageOpportunities(db, exchange, coin))
        
        if (arbitrages.length === 0){console.log('No arbitrage found.');return}
        
        console.log('Arbitrages found!')
        console.log('Selecting best arbitrage ...')
        let updatedArbitrages = {}
        for (const arbitrage of arbitrages.slice(0,10)){
            const ratio = await getArbitrageUpdatedRatio(arbitrage, walletAmount)
            updatedArbitrages[ratio] = arbitrage
        }
        const ratios  = Object.keys(updatedArbitrages).sort()
        let bestRatio = ratios[ratios.length - 1]
        const bestArbitrage = updatedArbitrages[bestRatio]
        bestRatio = Number(bestRatio)
        bestArbitrage.updatedRatio = bestRatio
        
        console.log('Best arbitrage found!')
        console.log(bestArbitrage)
        
        
        const dstWalletAmount = walletAmount * bestRatio
        console.log(`Estimated gains: +${bestRatio.toFixed(5)}% ${walletAmount} ${coin} -> ${dstWalletAmount.toFixed(8)} ${coin}`)
        walletAmount = dstWalletAmount
        
        // console.log('Wallet amount: ' + walletAmount)
        
        working = false
        
    }, 1000*2)
    
}
async function getArbitrageUpdatedRatio(arbitrage, amount){
    
    // console.log(arbitrage)
    
    const srcExchange = getExchange(arbitrage.srcExchange)
    const dstExchange = getExchange(arbitrage.dstExchange)
    
    const srcTradeOutput = await getTradingOutput(srcExchange,arbitrage, 'src', amount)        
    // console.log(srcTradeOutput)
    const srcWithdrawOutput = await srcExchange.applyWithdrawFees(arbitrage.tmpCurrency, srcTradeOutput)                                                        
    const dstTradeOutput = await getTradingOutput(dstExchange,arbitrage, 'dst', srcWithdrawOutput)
    
    const ratio = dstTradeOutput/amount
    return ratio

}
async function getTradingOutput(exchange, arbitrage, step, amount) {
    
    let srcAmount = Number(amount)
    let dstAmount = 0    
    
    let marketName = arbitrage[`${step}Market`]
    let orderType = arbitrage[`${step}PriceType`]
    marketName = marketName.split('-')[1].replace(' ','')
    
    let orderbookType = orderType === 'bid' ? 'ask' : 'bid'
    orderbookType = orderType
    const orderbook = await exchange.getOrderBook(marketName, orderType)
    
    // console.log('============')
    for (const order of orderbook){
        // convert amount depending if price is in base or quote currency 
        // console.log('>>>>>>>>>>>\n',order)
        let srcTradedAmount, dstTradedAmount = 0
        if (orderType === 'bid'){
            srcTradedAmount = order.amount * order.price
            dstTradedAmount = order.amount 
        }else{
            srcTradedAmount = order.amount 
            dstTradedAmount = order.amount * order.price
        }
        
        // update src and dst amounts
        srcAmount -= srcTradedAmount
        dstAmount += dstTradedAmount
        
        // console.log({srcTradedAmount, dstTradedAmount,srcAmount,dstAmount})
        
        // when there is not more money in src to trade
        if (srcAmount <= 0){
            
            
            
            // correct dstAmount by adding negative srcAmount value
            let srcConvertedAmount = orderType == 'bid'
                            ? srcAmount / order.price
                            : srcAmount * order.price
                            
            // console.log('exit',{srcAmount,dstAmount,srcConvertedAmount})
            dstAmount += srcConvertedAmount
            
            break
        }
    }
    // console.log({dstAmount})
    dstAmount = await exchange.applyTradingFees(dstAmount) 
    // console.log({dstAmount})
    return dstAmount
}

runBot()
