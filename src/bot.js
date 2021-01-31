import {connectDb} from './database/dbHandler';
import {getExchange} from './exchanges';
import {botConfig} from "./configs/botconfig";
import {logger} from './logger';
import {sleep} from './utils.js';
import {getBestArbitrage} from "./arbitrages";

const BOT_STATUSES = {
    ready: 0,
    running: 1,
    toStop: 2
}

export async function runBot() {
    logger.info(`######## Start bot ########`);

    try {
        const db = connectDb()
        const config = botConfig
        let status = BOT_STATUSES.ready
        // setup an interval to search for arbitrages
        setInterval(async () => {
            // exit if stop is requested
            if (status === BOT_STATUSES.toStop) {
                logger.info('Exit bot');
                process.exit();
            }

            // end iteration, a search is currently in process
            if (status === BOT_STATUSES.running) {
                return;
            }

            logger.info(`Look for arbitrages for ${config.currency} on ${config.startingExchange}`);
            // update config to prevent simultaneous play rounds
            status = BOT_STATUSES.running

            // update database with current prices
            logger.info('Update prices and fees in database ...');
            await updateDb(database);

            // search for arbitrages
            let bestArbitrage
            try {
                logger.info(`Get best arbitrage ...`);
                bestArbitrage = await getBestArbitrage(config, db);
                logger.info(
                    `Best arbitrage found:\n${JSON.stringify(bestArbitrage, null, 4)}`
                );
                status = BOT_STATUSES.toStop
            } catch (e) {
                const errorMessage = `Arbitrage search failed: ${e.name} - ${e.message}\n${e.stack}`;
                logger.error(errorMessage);

                if (botConfig.exitOnFailure){
                    status = BOT_STATUSES.toStop
                }
                return
            }

            // if (bestArbitrage !== undefined && bestArbitrage.ratio > botConfig.ratioThreshold){
            //     await executeArbitrage(bestArbitrage)
            // }
        }, config.interval);
    } catch (e) {
        logger.error(`${e.name} - ${e.message} \n${e.stack}`);
    }
}

async function executeArbitrage(config, database) {
    // get wallet amount
    // const walletAmount = await getExchange(config.startingExchange).getWalletAmount(config.currency);


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

