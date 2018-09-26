import {listPairs, updatePairs} from './pairs.js'

function findArbitrageOpportunities(currentExchange, pairs, currency){
    
    let validPairs = []
    for (let pair of pairs){
        if (pair.exchange  === currentExchange){
            if (pair.baseCurrency === currency || pair.quoteCurrency === currency){
            validPairs.push(pair)
            }   
        }
    } 
    
    console.log(validPairs)
    
    let possibleTrades = []
    for (let inputPair of validPairs){
        for (let outputPair of validPairs){
            
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
                possibleTrades.push({
                    inputPair,
                    outputPair,
                    priceDifference: Math.abs(inputPair.price - outputPair.price)
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
    
    let currentExchange = 'bittrex'
    
    listPairs().then((pairs)=>{
        
        setInterval(()=>{
            updatePairs(pairs).then(()=>{
                const bestTrade = findArbitrageOpportunities(currentExchange, pairs, 'usd')
                if (bestTrade){
                    console.log(bestTrade)
                    currentExchange = bestTrade.outputPair.exchange
                }
            })
        }, 3* 1000 )
    })
}


main()

