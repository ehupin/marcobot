import fs from 'fs';

import { connectDb, updateDb, getArbitrageOpportunities } from './database';
import { getExchange } from './exchanges';

import { logger } from './loggers';

async function runBot() {
    logger.info(`######## Start bot ########`);
    try {
        // build initial config
        const config = {
            exchange: 'binance',
            coin: 'btc',
            db: connectDb(),
            working: false,
            stop: false,
            interval: 2 * 1000,
            bestArbitragesThreshold: 10
        };

        // Get wallet amount
        config.walletAmount = await getExchange(
            config.exchange
        ).getWalletAmount(config.coin);

        // setup an interval which run play function regulary
        setInterval(async () => {
            // exit if stop is requested
            if (config.stop) {
                console.info('Exit ...');
                process.exit();
            }
            // end iteration, a play round is currently in process
            if (config.working) {
                return;
            }

            // run play round
            logger.info(
                `==> New play round: ${config.walletAmount} ${config.coin} on ${
                    config.exchange
                }`
            );
            play(config);
        }, config.interval);
    } catch (e) {
        logger.error(`${e.name} - ${e.message} \n${e.stack}`);
    }
}
async function play(config) {
    // update config to prevent simultaneous play rounds
    config.working = true;

    // update database with current prices
    logger.info('Updating prices ...');
    await updateDb(config.db);

    // look for arbitrages in database
    logger.info('Looking for arbitrages ...');
    const startTime = new Date().getTime();
    const arbitrages = await getArbitrageOpportunities(
        config.db,
        config.exchange,
        config.coin
    );
    const processTime = (new Date().getTime() - startTime) / 1000;

    // end play round if no arbitrage is found
    if (arbitrages.length === 0) {
        logger.info(`No arbitrage found.`);
        return;
    }

    logger.info(`Arbitrages found! (${processTime}s)`);

    logger.info(
        'Exclude arbitrages with disabled wallets, and update ratio using order book ...'
    );
    const adjustedArbitrages = bestArbitrages.map(updateArbitrageRatio);
    const bestRatio = adjustedArbitrages.reduce(
        (min, arbitrage) => (arbitrage.ratio < min ? arbitrage.ratio : min),
        adjustedArbitrages[0].ratio
    );
    const bestArbitrage = adjustedArbitrages.filter(
        arbitrage => arbitrage.ratio === bestRatio
    )[0];

    logger.info(
        `Best arbitrage found:\n${JSON.stringify(bestArbitrage, null, 4)}`
    );

    // compute estimated gains
    bestRatio = Number(bestRatio);
    const estimatedFinalWalletAmount = config.walletAmount * bestRatio;
    logger.info(
        `Estimated gains: +${bestRatio.toFixed(5)}% ${config.walletAmount} ${
            config.coin
        } -> ${estimatedFinalWalletAmount.toFixed(8)} ${config.coin}`
    );

    logger.info('Process srcExchange trade ...');
    // let tradeLog = { config, bestArbitrage };
    // const logFilePath = `/root/dev/marcobot/logs/arbitrages/${Date.now()}.arbitrage`;
    try {
        // set exchange and marketName
        const srcExchange = await getExchange(bestArbitrage.srcExchange);
        const dstExchange = await getExchange(bestArbitrage.dstExchange);
        // TODO: store src market name in best arbitrage to avoid string manipulation
        // TODO: does market labels/name (not sure of denomination) in database have to contain the exchange name? (e.g 'binance - eth/btc')
        const marketName = bestArbitrage.srcMarket
            .split('-')[1]
            .replace(' ', '');

        // define trade type and amount (in base or quote currency)
        //TODO: not sure about this part of the code, must check
        const tradeType = bestArbitrage.srcPriceType === 'bid' ? 'buy' : 'sell';
        const tradeEstimatedOutputAmount =
            bestArbitrage.estimations.srcTradeOutput;
        const tradedAmount =
            bestArbitrage.srcPriceType === 'bid'
                ? tradeEstimatedOutputAmount
                : config.walletAmount;

        config.working = false;
        return;

        // place first trade
        logger.info(
            `Place a ${tradeType} order of ${tradedAmount} ${
                bestArbitrage.srcCurrency
            } on ${bestArbitrage.srcMarket} ...`
        );
        const srcTradeResultId = await srcExchange.placeOrder(
            marketName,
            tradedAmount,
            tradeType
        );

        // waiting for order completion
        logger.info(
            `Order placed: ${srcTradeResult}. Waiting for completion ...`
        );
        while (!srcExchange.orderIsCompleted(marketName, srcTradeResultId)) {
            await sleep(2);
        }

        // make withdrawal
        const depositAddress = dstExchange.getDepositAddress(
            bestArbitrage.tmpCurrency
        );
        logger.info(`Order completed: ${srcTradeResult}. Making withdraw ...`);
        const srcWithdrawalResult = await srcExchange.makeWithdrawal(
            bestArbitrage.tmpCurrency,
            amount,
            depositAddress
        );
    } catch (e) {
        logger.error(`Bot will exit\n${logFilePath}`);
        tradeLog.error = {};
        tradeLog.error.message = e.message;
        tradeLog.error.name = e.name;
        tradeLog.error.stack = e.stack;
        tradeLog.error.url = e.response.config.url;
        tradeLog.error.data = e.response.data;
        config.stop = true;
    }
    const logString = JSON.stringify(tradeLog, null, 4).replace(/\\n/g, '\n');
    console.log(tradeLog);
    fs.writeFileSync(logFilePath, logString);
    config.working = false;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateArbitrageRatio(arbitrage) {
    const srcExchange = getExchange(arbitrage.srcExchange);
    const dstExchange = getExchange(arbitrage.dstExchange);

    if (
        !srcExchange.walletIsEnabled(arbitrage.srcCurrency) ||
        !dstExchange.walletIsEnabled(arbitrage.tmpCurrency)
    ) {
        throw Error(`One or more wallet is disabled on this arbitrage`);
    }

    const srcTradeOutput = await getTradingOutput(
        srcExchange,
        arbitrage,
        'src',
        1 //value used as amount is 1 to make calculus of ratio easier
    );
    const srcWithdrawOutput = await srcExchange.applyWithdrawFees(
        arbitrage.tmpCurrency,
        srcTradeOutput
    );
    const dstTradeOutput = await getTradingOutput(
        dstExchange,
        arbitrage,
        'dst',
        srcWithdrawOutput
    );

    const ratio = dstTradeOutput; // because input value was 1
    return Object.assign(arbitrage, { ratio });
}
async function getTradingOutput(exchange, arbitrage, step, amount) {
    let srcAmount = Number(amount);
    let dstAmount = 0;

    let marketName = arbitrage[`${step}Market`];
    const orderType = arbitrage[`${step}PriceType`];
    marketName = marketName.split('-')[1].replace(' ', '');

    let orderbookType = orderType === 'bid' ? 'ask' : 'bid';
    orderbookType = orderType;
    const orderbook = await exchange.getOrderBook(marketName, orderType);

    // console.log('============')
    for (const order of orderbook) {
        // convert amount depending if price is in base or quote currency
        // console.log('>>>>>>>>>>>\n',order)
        let srcTradedAmount;

        let dstTradedAmount = 0;
        if (orderType === 'bid') {
            srcTradedAmount = order.amount * order.price;
            dstTradedAmount = order.amount;
        } else {
            srcTradedAmount = order.amount;
            dstTradedAmount = order.amount * order.price;
        }

        // update src and dst amounts
        srcAmount -= srcTradedAmount;
        dstAmount += dstTradedAmount;

        // console.log({srcTradedAmount, dstTradedAmount,srcAmount,dstAmount})

        // when there is not more money in src to trade
        if (srcAmount <= 0) {
            // correct dstAmount by adding negative srcAmount value
            const srcConvertedAmount =
                orderType == 'bid'
                    ? srcAmount / order.price
                    : srcAmount * order.price;

            // console.log('exit',{srcAmount,dstAmount,srcConvertedAmount})
            dstAmount += srcConvertedAmount;

            break;
        }
    }
    // console.log({dstAmount})
    dstAmount = await exchange.applyTradingFees(dstAmount);
    // console.log({dstAmount})
    return dstAmount;
}

runBot();
