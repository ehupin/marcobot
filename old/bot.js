import {listPairs, updatePairs} from './pairs.js'
import {exchanges} from './exchanges.js'
import fs from 'fs'


function findArbitrageOpportunities(currentExchange, pairs, currency){
    
    
    let inputPairs = []
    for (let pair of pairs){
        if (pair.exchange  === currentExchange){
            if (pair.baseCurrency === currency || pair.quoteCurrency === currency){
            inputPairs.push(pair)
            }   
        }
    } 
    
    
    let possibleTrades = []
    for (let outputPair of pairs){
        
        
        for (let inputPair of inputPairs){
            
            if (inputPair === outputPair){
                continue
            }
            
            let isTradeable = false
            
            if (inputPair.baseCurrency === currency &&
                inputPair.quoteCurrency == outputPair.baseCurrency &&
                outputPair.quoteCurrency == currency){
                    isTradeable = true
                }
                
            else if (inputPair.baseCurrency === currency &&
                inputPair.quoteCurrency == outputPair.quoteCurrency &&
                outputPair.baseCurrency == currency){
                    isTradeable = true
                }
                
            else if (inputPair.quoteCurrency === currency &&
                inputPair.baseCurrency == outputPair.baseCurrency &&
                outputPair.quoteCurrency == currency){
                    isTradeable = true
                }
                
            else if (inputPair.quoteCurrency === currency &&
                inputPair.baseCurrency == outputPair.quoteCurrency &&
                outputPair.baseCurrency == currency){
                    isTradeable = true
                }
                
            if (isTradeable && inputPair.price>outputPair.price){
                
                const inP = inputPair.price
                const outP = outputPair.price
                const ratio = inP*exchanges[inputPair.exchange].tradingFees
                possibleTrades.push({
                    inputPair,
                    outputPair,
                    priceDifference: Math.abs(inP - outP) / ((inP +outP)/2)*100,
                    rentability: 
                })
            }
            
        } 
    }
    
    if (possibleTrades.length === 0){
        return
    }
    
    
    let rankedTrades = {}
    for (let trade of possibleTrades){
        if (rankedTrades[trade.priceDifference]){
            rankedTrades[trade.priceDifference].push(trade)
        } else {
            rankedTrades[trade.priceDifference] = [trade]
        }
    }
    
    
    
    const bestPriceDifference = Math.max(...Object.keys(rankedTrades))
    // console.log(rankedTrades)
    const bestTrade = rankedTrades[bestPriceDifference][0]
    // const bestTrade = possibleTrades.reduce((min, trade) => trade.priceDifference < min ? trade.priceDifference : min, possibleTrades[0].priceDifference);
    
    return bestTrade
}


function main(){
    
    let now = new Date();
    const startupLine = ` === RESTARTED AT ${now.toString()} ===`
    console.log(startupLine)
    fs.appendFileSync('index.html', "\n\n<br><br>" +startupLine + "\n<br>")
    
    
    let currentExchange = 'bittrex'
    let baseCurrency = 'usd'
    let wallet = 1000
    
    listPairs().then((pairs)=>{
        
        setInterval(()=>{
            updatePairs(pairs).then(()=>{
                
                const bestTrade = findArbitrageOpportunities(currentExchange, pairs, baseCurrency)
                
                if (bestTrade){
                
                    wallet *= 1 + (bestTrade.priceDifference/100)
                    
                    const tempCurrency = bestTrade.inputPair.baseCurrency === baseCurrency ? bestTrade.inputPair.quoteCurrency :bestTrade.inputPair.baseCurrency
                    now = new Date();
                    const logLine = `${wallet.toString().substring(0,7)} --- ${now.toString()} --- (${bestTrade.inputPair.exchange}) ${baseCurrency}>${tempCurrency}>${baseCurrency} (${bestTrade.outputPair.exchange}) - ${bestTrade.priceDifference.toString().substring(0,5)}%`
                    console.log(logLine)
                    fs.appendFileSync('index.html', logLine + "\n<br>");

                    currentExchange = bestTrade.outputPair.exchange
                }
            })
        }, 3 * 1000 )
    })
}


main()

