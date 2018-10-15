import fs from 'fs'

import { connectDb, updateDb, getArbitrageOpportunities } from './database'
import { getExchange } from './exchanges'

async function runBot() {
    const botLog = {}
    const logFilePath = `./logs/${Date.now()}.bot`
    try {
        const config = {
            exchange: 'binance',
            coin: 'btc',
            db: connectDb(),
            working: false,
            stop: false,
        }
        config.walletAmount = await getExchange(config.exchange).getWalletAmount(config.coin)
        console.log(`Wallet amount: ${config.walletAmount}`)

        setInterval(async () => {
            play(config)
        }, 1000 * 2)
    } catch (e) {
        botLog.error = {}
        botLog.error.message = e.message
        botLog.error.name = e.name
        botLog.error.stack = e.stack
        // botLog.error.url = e.response.config.url
        // botLog.error.data = e.response.data
    }

    const logString = JSON.stringify(botLog, null, 4).replace(/\\n/g, '\n')
    console.log(logString)
    fs.writeFileSync(logFilePath, logString)
}
async function play(config) {
    if (config.stop) {
        process.exit()
    }
    if (config.working) {
        return
    }

    config.working = true

    console.log('Updating prices ...')
    await updateDb(config.db)

    console.log('Looking for arbitrages ...')
    const arbitrages = await getArbitrageOpportunities(config.db, config.exchange, config.coin)

    if (arbitrages.length === 0) {
        console.log('No arbitrage found.')
        return
    }

    console.log('Arbitrages found!')
    console.log('Selecting best arbitrage ...')
    const updatedArbitrages = {}
    for (const arbitrage of arbitrages.slice(0, 10)) {
        const updatedArbitrage = await getArbitrageUpdatedRatio(arbitrage, config.walletAmount)
        updatedArbitrages[updatedArbitrage.estimations.ratio] = updatedArbitrage
    }
    const ratios = Object.keys(updatedArbitrages).sort()
    let bestRatio = ratios[ratios.length - 1]
    const bestArbitrage = updatedArbitrages[bestRatio]
    bestRatio = Number(bestRatio)

    console.log('Best arbitrage found!')
    console.log(bestArbitrage)

    const estimatedFinalWalletAmount = config.walletAmount * bestRatio
    console.log(
        `Estimated gains: +${bestRatio.toFixed(5)}% ${config.walletAmount} ${
        config.coin
        } -> ${estimatedFinalWalletAmount.toFixed(8)} ${config.coin}`,
    )

    console.log('Process srcExchange trade ...')
    // return
    let tradeLog = { config, bestArbitrage }
    const logFilePath = `/root/dev/marcobot/logs/arbitrages/${Date.now()}.arbitrage`
    try {
        // set exchange and marketName
        const srcExchange = await getExchange(bestArbitrage.srcExchange)
        const marketName = bestArbitrage.srcMarket.split('-')[1].replace(' ', '')

        // set trade variables
        const tradeType = bestArbitrage.srcPriceType === 'bid' ? 'buy' : 'sell'
        const tradeEstimatedOutputAmount = bestArbitrage.estimations.srcTradeOutput
        const tradedAmount = bestArbitrage.srcPriceType === 'bid' ? tradeEstimatedOutputAmount : config.walletAmount

        tradeLog = Object.assign(tradeLog, { marketName, tradeType, tradedAmount })

        return

        // TODO: check if deposit is enabled

        // run source trade
        const srcTradeResult = await srcExchange.placeOrder(marketName, tradedAmount, tradeType)

        tradeLog.srcTradeResult = srcTradeResult
        config.stop = true
    } catch (e) {
        console.log(`ERROR - Bot wil exit\n${logFilePath}`)
        tradeLog.error = {}
        tradeLog.error.message = e.message
        tradeLog.error.name = e.name
        tradeLog.error.stack = e.stack
        tradeLog.error.url = e.response.config.url
        tradeLog.error.data = e.response.data
        config.stop = true
    }
    const logString = JSON.stringify(tradeLog, null, 4).replace(/\\n/g, '\n')
    console.log(tradeLog)
    fs.writeFileSync(logFilePath, logString)
    config.working = false
}
async function getArbitrageUpdatedRatio(arbitrage, amount) {
    // console.log(arbitrage)

    const srcExchange = getExchange(arbitrage.srcExchange)
    const dstExchange = getExchange(arbitrage.dstExchange)

    const srcTradeOutput = await getTradingOutput(srcExchange, arbitrage, 'src', amount)
    const srcWithdrawOutput = await srcExchange.applyWithdrawFees(
        arbitrage.tmpCurrency,
        srcTradeOutput,
    )
    const dstTradeOutput = await getTradingOutput(dstExchange, arbitrage, 'dst', srcWithdrawOutput)

    const ratio = dstTradeOutput / amount
    const estimations = {
        srcTradeOutput,
        srcWithdrawOutput,
        dstTradeOutput,
        ratio,
    }
    return Object.assign(arbitrage, { estimations })
}
async function getTradingOutput(exchange, arbitrage, step, amount) {
    let srcAmount = Number(amount)
    let dstAmount = 0

    let marketName = arbitrage[`${step}Market`]
    const orderType = arbitrage[`${step}PriceType`]
    marketName = marketName.split('-')[1].replace(' ', '')

    let orderbookType = orderType === 'bid' ? 'ask' : 'bid'
    orderbookType = orderType
    const orderbook = await exchange.getOrderBook(marketName, orderType)

    // console.log('============')
    for (const order of orderbook) {
        // convert amount depending if price is in base or quote currency
        // console.log('>>>>>>>>>>>\n',order)
        let srcTradedAmount

        let dstTradedAmount = 0
        if (orderType === 'bid') {
            srcTradedAmount = order.amount * order.price
            dstTradedAmount = order.amount
        } else {
            srcTradedAmount = order.amount
            dstTradedAmount = order.amount * order.price
        }

        // update src and dst amounts
        srcAmount -= srcTradedAmount
        dstAmount += dstTradedAmount

        // console.log({srcTradedAmount, dstTradedAmount,srcAmount,dstAmount})

        // when there is not more money in src to trade
        if (srcAmount <= 0) {
            // correct dstAmount by adding negative srcAmount value
            const srcConvertedAmount = orderType == 'bid' ? srcAmount / order.price : srcAmount * order.price

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
