import {connectDb, getArbitrageOpportunities} from './database.js'
import {updateDb} from './scripts/updateDb.js'

async function runBot(){
    let exchange = 'bitstamp'
    let coin = 'eth'
    let walletAmount =  0.08253742
    const db = connectDb()
    
    console.log('Wallet amount: ' + walletAmount)
    
    setInterval(async()=>{
        
        console.log('Updating prices ...')
        await updateDb(db)
        
        console.log('Looking for arbitrages ...')
        const arbitrages = (await getArbitrageOpportunities(db, exchange, coin))
        if (arbitrages.length === 0){return}
        const bestArbitrage = arbitrages[0]
        if (bestArbitrage.ratio <= 1) {return}
        
        console.log('Arbitrage found !')
        console.log(bestArbitrage)
        exchange = bestArbitrage.dstExchange
        walletAmount *= bestArbitrage.ratio
        
        console.log('Wallet amount: ' + walletAmount)
        
    }, 1000*2)
    
}


runBot()
