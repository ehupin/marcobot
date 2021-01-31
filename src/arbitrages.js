import {logger} from "./logger";
import {getExchange} from "./exchanges";
import {getArbitrageOpportunities} from "./database/dbHandler";

const PRICE_TYPE = {
    'ask': 'ask',
    'bid': 'bid'
}

export async function getBestArbitrage(config, db) {
    // look for arbitrages in database
    logger.info('Looking for arbitrages ...');
    const arbitrages = await getArbitrageOpportunities(
        db,
        config.startingExchange,
        config.currency
    );

    // end search if no arbitrage is found
    if (arbitrages.length === 0) {
        logger.info(`No arbitrage found.`);
        return;
    }
    logger.info(`${arbitrages.length} arbitrages found`);

    // filter out arbitrage based on disabled wallets
    logger.info('Exclude arbitrages with disabled wallets ...');
    let validArbitrages = [];
    for (let arbitrage of arbitrages) {
        if (await arbitrageWalletsAreEnabled(arbitrage, db)) {
            validArbitrages.push(arbitrage);
        }
    }
    logger.info(`${validArbitrages.length} arbitrages left`);

    logger.info('Update arbitrage ratio based on order book ...');
    let adjustedArbitrages = [];
    for (let [index, arbitrage] of validArbitrages.entries()) {
        try {
            const ratio = await computeArbitrageRatio(arbitrage, db)
            const updatedArbitrage = Object.assign(arbitrage, {ratio})
            logger.info(`Arbitrage #${index+1} has a ratio of ${ratio}`);
            adjustedArbitrages.push(updatedArbitrage);
        } catch (e) {
            logger.error(`${e.name} - ${e.message} \n${e.stack}`);
        }
    }

    logger.info('Filter out best arbitrage ...');
    let bestRatio = adjustedArbitrages.reduce(
        (max, arbitrage) => (arbitrage.ratio > max ? arbitrage.ratio : max),
        adjustedArbitrages[0].ratio
    );
    const bestArbitrage = adjustedArbitrages.filter(
        arbitrage => arbitrage.ratio === bestRatio
    )[0];


    return bestArbitrage;
}

async function arbitrageWalletsAreEnabled(arbitrage, db) {
    try {
        const srcExchange = getExchange(arbitrage.srcExchangeName);
        const dstExchange = getExchange(arbitrage.dstExchangeName);
        const srcWalletEnabled = await srcExchange.walletIsEnabled(
            arbitrage.tmpCurrency, db
        );
        const dstWalletEnabled = await dstExchange.walletIsEnabled(
            arbitrage.tmpCurrency, db
        );

        if (!srcWalletEnabled || !dstWalletEnabled) {
            logger.debug(
                `Arbitrage wallets are disabled: ${
                    arbitrage.srcMarketLabel
                }:${srcWalletEnabled} -${
                    arbitrage.dstMarketLabel
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

async function computeArbitrageRatio(arbitrage, db) {

    logger.debug('Simulate src trade');
    const srcTradeOutput = await computeTradingOutput(
        arbitrage.srcExchangeName,
        arbitrage.srcMarketLabel,
        arbitrage.srcPriceType,
        1 //value used as amount is 1 to make calculus of ratio easier
    );

    logger.debug('Simulate transfer fees');
    const srcExchange = getExchange(arbitrage.srcExchangeName)
    const srcWithdrawOutput = await srcExchange.applyWithdrawFees(
        arbitrage.tmpCurrency,
        srcTradeOutput,
        db
    );

    logger.debug('Simulate dst trade');
    const dstTradeOutput = await computeTradingOutput(
        arbitrage.dstExchangeName,
        arbitrage.dstMarketLabel,
        arbitrage.dstPriceType,
        srcWithdrawOutput
    );
    logger.debug(`Second trade output: ${dstTradeOutput}`);

    logger.debug(`Arbitrage ratio updated from ${arbitrage.ratio} to ${dstTradeOutput}`);

    // As arbitrage has been simulated with a source amount of 1, dstTradeOutput
    // can be considered as a 0..1 ratio
    return  dstTradeOutput;
}

async function computeTradingOutput(exchangeName, marketLabel, priceType, amount) {
    const marketName = marketLabel.split('-')[1].replace(' ', '');
    const marketCurrencies = marketName.split('/');

    // define src and dst currenvies based on price type
    let srcCurrency, dstCurrency
    if (priceType == PRICE_TYPE.bid) {
        srcCurrency = marketCurrencies[0]
        dstCurrency = marketCurrencies[1]
    } else {
        srcCurrency = marketCurrencies[1]
        dstCurrency = marketCurrencies[0]
    }
    logger.debug(`About to compute the trading ${amount} ${srcCurrency} at ${priceType} prices on ${marketName}.`);

    // get order book for market and price type
    const exchange = getExchange(exchangeName);
    const orderbook = await exchange.getOrderBook(marketName, priceType);
    logger.debug(`Market order book:\n ${JSON.stringify(orderbook, null, 4)}`
    );

    // loop through orders to compute trade output
    let srcAmount = Number(amount);
    let dstAmount = 0;
    for (const order of orderbook) {
        logger.debug(`Amounts before trade: ${srcAmount} ${srcCurrency} / ${dstAmount} ${dstCurrency}.`);
        logger.debug(`Trading with order: ${JSON.stringify(order)}`);

        // define amounts used for order caoomputation based on price type
        let orderAmountInSrcCurrency, orderAmountInDstCurrency, tradableAmount
        if (priceType == PRICE_TYPE.ask) {
            orderAmountInSrcCurrency = order.amount * order.price
            orderAmountInDstCurrency = order.amount
            tradableAmount = srcAmount / order.price
        } else {
            orderAmountInSrcCurrency = order.amount
            orderAmountInDstCurrency = order.amount * order.price
            tradableAmount = srcAmount * order.price
        }

        // compute order impact on src and dst amounts
        if (orderAmountInSrcCurrency <= srcAmount) {
            srcAmount -= orderAmountInSrcCurrency
            dstAmount += orderAmountInDstCurrency
        } else {
            srcAmount = 0
            dstAmount += tradableAmount
        }

        // stop trading if the src amount is 0 (nothing left to trade)
        if (srcAmount === 0) {
            logger.debug(`Trading done: ${srcAmount} ${srcCurrency} / ${dstAmount} ${dstCurrency}.`);
            break;
        }

    }
    dstAmount = await exchange.applyTradingFees(dstAmount);
    return dstAmount;
}