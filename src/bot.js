import fs from 'fs';

import { connectDb, updateDb, getArbitrageOpportunities } from './database';
import { getExchange } from './exchanges';

import { logger } from './loggers';
import { sleep } from './utilities.js';

async function runBot() {
    logger.info(`######## Start bot ########`);
    try {
        // build initial config
        const config = {
            exchange: 'binance',
            currency: 'btc',
            db: connectDb(),
            run: false,
            stop: false,
            interval: 2 * 1000,
            bestArbitragesThreshold: 10
        };

        // Get wallet amount
        config.walletAmount = await getExchange(
            config.exchange
        ).getWalletAmount(config.currency);
        // config.walletAmount = 0.02;

        // setup an interval which run play function regulary
        setInterval(async () => {
            // exit if stop is requested
            if (config.stop) {
                console.info('Exit ...');
                process.exit();
            }
            // end iteration, a play round is currently in process
            if (config.run) {
                return;
            }

            logger.info(
                `==> New play round: ${config.walletAmount} ${
                    config.currency
                } on ${config.exchange}`
            );
            // update config to prevent simultaneous play rounds
            config.run = true;

            // update database with current prices
            logger.info('Update prices and fees in database ...');
            // await updateDb(config.db);

            // run play round
            try {
                logger.info(`Get best arbitrage ...`);
                await getBestArbitrage(config);
            } catch (e) {
                const errorMessage = `Play round failed: ${e.name} - ${
                    e.message
                }\n${e.stack}`;
                logger.error(errorMessage);
                config.stop = true;
                // throw Error(errorMessage)
            }
        }, config.interval);
    } catch (e) {
        logger.error(`${e.name} - ${e.message} \n${e.stack}`);
    }
}
async function getBestArbitrage(config) {
    // look for arbitrages in database
    logger.info('Looking for arbitrages ...');
    const startTime = new Date().getTime();
    const arbitrages = await getArbitrageOpportunities(
        config.db,
        config.exchange,
        config.currency
    );

    const processTime = (new Date().getTime() - startTime) / 1000;

    // end play round if no arbitrage is found
    if (arbitrages.length === 0) {
        logger.info(`No arbitrage found.`);
        return;
    }

    logger.info(`${arbitrages.length} arbitrages found!`);

    logger.info('Exclude arbitrages with disabled wallets ...');
    // TODO: optimize using one function that gather api calls (e.g. btc wallet on binance might be call often)
    let validArbitrages = [];
    for (let arbitrage of arbitrages) {
        // if (await arbitrageWalletsAreEnabled(arbitrage)) {
        validArbitrages.push(arbitrage);
        // }
    }

    logger.info('Update arbitrage ratio using order book ...');
    let adjustedArbitrages = [];
    for (let arbitrage of validArbitrages) {
        adjustedArbitrages.push(
            await updateArbitrageRatio(arbitrage, config.walletAmount)
        );
    }

    logger.info('Search for best arbitrage ...');
    let bestRatio = adjustedArbitrages.reduce(
        (max, arbitrage) => (arbitrage.ratio > max ? arbitrage.ratio : max),
        adjustedArbitrages[0].ratio
    );
    const bestArbitrage = adjustedArbitrages.filter(
        arbitrage => arbitrage.ratio === bestRatio
    )[0];

    logger.info(
        `Best arbitrage found:\n${JSON.stringify(bestArbitrage, null, 4)}`
    );
    // logger.info(
    //     `Raw best arbitrage found:\n${JSON.stringify(arbitrages[0], null, 4)}`
    // );

    return;

    // compute estimated gains
    bestRatio = Number(bestRatio);
    const estimatedFinalWalletAmount = config.walletAmount * bestRatio;
    logger.info(
        `Estimated gains: +${bestRatio.toFixed(5)}% ${config.walletAmount} ${
            config.currency
        } -> ${estimatedFinalWalletAmount.toFixed(8)} ${config.currency}`
    );

    logger.info('Process srcExchange trade ...');
    // let tradeLog = { config, bestArbitrage };
    // const logFilePath = `/root/dev/marcobot/logs/arbitrages/${Date.now()}.arbitrage`;

    //TODO: move next code to a separate function
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

        config.run = false;
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
        console.log(e);
        // let tradeLog = {
        //     message: e.message,
        //     name: e.name,
        //     stack: e.stack,
        //     url: e.response.config.url,
        //     data: e.response.data
        // };

        config.stop = true;
        // logger.error(`Bot will exit:\n${JSON.stringify(tradeLog)}`);
    }
    // const logString = JSON.stringify(tradeLog, null, 4).replace(/\\n/g, '\n');
    // // console.log(tradeLog);
    // fs.writeFileSync(logFilePath, logString);
    config.run = false;
}

async function arbitrageWalletsAreEnabled(arbitrage) {
    try {
        const srcExchange = getExchange(arbitrage.srcExchange);
        const dstExchange = getExchange(arbitrage.dstExchange);

        const srcWalletEnabled = await srcExchange.walletIsEnabled(
            arbitrage.tmpCurrency
        );
        const dstWalletEnabled = await dstExchange.walletIsEnabled(
            arbitrage.tmpCurrency
        );

        if (!srcWalletEnabled || !dstWalletEnabled) {
            logger.debug(
                `Arbitrage wallets are disabled: ${
                    arbitrage.srcMarket
                }:${srcWalletEnabled} -${
                    arbitrage.dstMarket
                }:${dstWalletEnabled}`
            );
        }
        return srcWalletEnabled && dstWalletEnabled;
    } catch (e) {
        logger.error(
            `Cannot check arbitrage wallets statuses: ${e.name}${e.message}\n${
                e.stack
            }`
        );
        logger.info(`Cannot check wallets, arbitrage skiped:\n${arbitrage}`);
        return false;
    }
}

async function updateArbitrageRatio(arbitrage, amount) {
    const srcExchange = getExchange(arbitrage.srcExchange);
    const dstExchange = getExchange(arbitrage.dstExchange);

    // console.log(arbitrage);
    // return arbitrage;

    //TODO: check if addresses can be generated
    // console.log(`srcAmount ${amount}`);
    logger.debug('Proceed to src trade');
    const srcTradeOutput = await getTradingOutput(
        srcExchange,
        arbitrage,
        'src',
        amount //value used as amount is 1 to make calculus of ratio easier
    );
    // throw Error('po');
    // console.log(`tmpAmount ${srcTradeOutput}`);
    logger.debug('Proceed to transfert from src to dst');
    const srcWithdrawOutput = await srcExchange.applyWithdrawFees(
        arbitrage.tmpCurrency,
        srcTradeOutput
    );
    logger.debug(
        `Transfered difference: ${srcTradeOutput} -> ${srcWithdrawOutput}`
    );
    // console.log(`tmpTransferedAmount ${srcWithdrawOutput}`);
    logger.debug('Proceed to dst trade');
    const dstTradeOutput = await getTradingOutput(
        dstExchange,
        arbitrage,
        'dst',
        srcWithdrawOutput
    );
    // console.log(`dstAmount ${dstTradeOutput}`);
    const ratio = dstTradeOutput / amount;
    logger.debug(
        `Arbitrage updated:\n ${JSON.stringify(
            {
                amount,
                srcTradeOutput,
                srcWithdrawOutput,
                dstTradeOutput,
                originalRatio: arbitrage.ratio,
                ratio
            },
            null,
            4
        )}`
    );

    console.log(`${arbitrage.ratio} -> ${ratio}`);
    return Object.assign(arbitrage, { ratio });
}
async function getTradingOutput(exchange, arbitrage, step, amount) {
    let marketName = arbitrage[`${step}Market`];
    let priceType = arbitrage[`${step}PriceType`];
    marketName = marketName.split('-')[1].replace(' ', '');

    // orderType = orderType === 'bid' ? 'ask' : 'bid';
    // orderbookType = orderType;
    const orderbook = await exchange.getOrderBook(marketName, priceType);

    const marketCurrencies = marketName.split('/');
    const srcCurrency =
        priceType == 'bid' ? marketCurrencies[0] : marketCurrencies[1];
    const dstCurrency =
        priceType == 'bid' ? marketCurrencies[1] : marketCurrencies[0];

    logger.debug(
        `Aout to trade ${amount} ${srcCurrency} at ${priceType} prices on ${marketName}.`
    );
    logger.debug(
        `Market order book:\n ${JSON.stringify(
            orderbook.slice(0, 10),
            null,
            4
        )}`
    );

    let srcAmount = Number(amount);
    let dstAmount = 0;
    for (const order of orderbook) {
        logger.debug(
            `Start trading with ${srcAmount} ${srcCurrency} and ${dstAmount} ${dstCurrency}.`
        );
        logger.debug(`Traded order: ${order}`);
        // console.log('before:', { srcAmount, dstAmount });
        if (priceType == 'ask') {
            srcAmount -= order.price * order.amount;
            dstAmount += order.amount;
        } else {
            srcAmount -= order.amount;
            dstAmount += order.price * order.amount;
        }
        logger.debug(
            `End trading with ${srcAmount} ${srcCurrency} and ${dstAmount} ${dstCurrency}.`
        );
        // if (priceType === 'ask'){
        // console.log('after:', { srcAmount, dstAmount });
        if (srcAmount < 0) {
            if (priceType == 'ask') {
                dstAmount += srcAmount / order.price;
            } else {
                dstAmount += srcAmount * order.price;
            }
            logger.debug(
                `Adjusted final amounts: ${srcAmount} ${srcCurrency} | ${dstAmount} ${dstCurrency}.`
            );
            // console.log('adjusted:', { dstAmount });
            break;
        }
    }
    dstAmount = await exchange.applyTradingFees(dstAmount);
    // console.log({dstAmount})
    return dstAmount;

    //     let srcTradedAmount, dstTradedAmount;
    //     if (priceType === 'ask') {
    //         srcTradedAmount = order.amount / order.price;
    //         dstTradedAmount = order.amount;
    //     } else {
    //         srcTradedAmount = order.amount;
    //         dstTradedAmount = order.amount * order.price;
    //     }

    //     // console.log('srcAmount is in');
    //     // ), { orderType, srcTradedAmount, dstTradedAmount });

    //     // update src and dst amounts
    //     srcAmount -= srcTradedAmount;
    //     dstAmount += dstTradedAmount;

    //     // console.log({srcTradedAmount, dstTradedAmount,srcAmount,dstAmount})

    //     // when there is not more money in src to trade
    //     if (srcAmount <= 0) {
    //         // correct dstAmount by adding negative srcAmount value
    //         const srcConvertedAmount =
    //             priceType == 'bid'
    //                 ? srcAmount / order.price
    //                 : srcAmount * order.price;

    //         // console.log('exit', { srcAmount, dstAmount, srcConvertedAmount });
    //         dstAmount += srcConvertedAmount;

    //         break;
    //     }
    // }
    // dstAmount = await exchange.applyTradingFees(dstAmount);
    // // console.log({dstAmount})
    // return dstAmount;
}

runBot();
