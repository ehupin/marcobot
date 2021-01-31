import {connectDb} from './database/dbHandler';
import {getExchange} from './exchanges';
import {botConfig} from "./configs/botconfig";
import {logger} from './logger';
import {sleep} from './utils.js';
import {getBestArbitrage} from "./arbitrages";

const BOT_STATUSES = {
    ready: 0,
    running: 1,
    pending: 2,
    toStop: 3
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

            } catch (e) {
                const errorMessage = `Arbitrage search failed: ${e.name} - ${e.message}\n${e.stack}`;
                logger.error(errorMessage);

                if (botConfig.exitOnFailure){
                    status = BOT_STATUSES.toStop
                }
                return
            }

            if (bestArbitrage !== undefined &&
                bestArbitrage.ratio > botConfig.ratioThreshold &&
                botConfig.dryRun === false){
                // It was never worth going that far
            }

            status = BOT_STATUSES.pending
        }, config.interval);
    } catch (e) {
        logger.error(`${e.name} - ${e.message} \n${e.stack}`);
    }
}

