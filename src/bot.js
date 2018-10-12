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
        
        await checkArbitrageValidity(arbitrages[0], walletAmount)
        // const bestArbitrage = arbitrages[0]
        // if (bestArbitrage.ratio <= 1) {console.log('No arbitrage found.');return}
        
        // console.log('Arbitrage found !')
        // console.log(bestArbitrage)
        // checkArbitrage
        // exchange = bestArbitrage.dstExchange
        // walletAmount *= bestArbitrage.ratio
        
        // console.log('Wallet amount: ' + walletAmount)
        
        working = false
        
    }, 1000*2)
    
}
async function checkArbitrageValidity(arbitrage, amount){
    
    console.log(arbitrage)
    
    const srcExchange = getExchange(arbitrage.srcExchange)
    const dstExchange = getExchange(arbitrage.dstExchange)
    
    const srcMarketName = arbitrage.srcMarket.split('-')[1].replace(' ','')
    const dstMarketName = arbitrage.dstMarket.split('-')[1].replace(' ','')
    
    const srcOrderbook = await srcExchange.getOrderBook(srcMarketName, arbitrage.dstPriceType)
    const dstOrderbook = await dstExchange.getOrderBook(dstMarketName, arbitrage.srcPriceType)
    
    const srcTradeOutput = getTradeResultFromOrderbook(srcOrderbook, 
                                                            amount, 
                                                            arbitrage.srcPriceType)
                                                    
    const dstTradeOutput = getTradeResultFromOrderbook(dstOrderbook, 
                                                            srcTradeOutput, 
                                                            arbitrage.dstPriceType)
    
    console.log(amount,srcTradeOutput, dstTradeOutput)

}
function getTradeResultFromOrderbook(orderbook, amount, type) {
    
    let srcAmount = amount
    let dstAmount = 0    
    
    for (const order of orderbook){
        // convert amount depending if price is in base or quote currency 
        let srcTradedAmount, dstTradedAmount
        if (type === 'bid'){
            srcTradedAmount = order.amount * order.price
            dstTradedAmount = order.amount
        }else{
            srcTradedAmount = order.amount 
            dstTradedAmount = order.amount * order.price
        }
        
        // update src and dst amounts
        srcAmount -= srcTradedAmount
        dstAmount += dstTradedAmount
        
        // when there is not more money in src to trade
        if (srcAmount <= 0){
            
            // correct dstAmount by adding negative srcAmount value
            let srcConvertedAmount = type == 'ask'
                            ? srcAmount * order.price
                            : srcAmount 
            dstAmount += srcConvertedAmount
            
            break
        }
    }
    return dstAmount
}

runBot()
