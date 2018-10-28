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

            // run play round
            logger.info(
                `==> New play round: ${config.walletAmount} ${
                    config.currency
                } on ${config.exchange}`
            );
            play(config);
        }, config.interval);
    } catch (e) {
        logger.error(`${e.name} - ${e.message} \n${e.stack}`);
    }
}
async function play(config) {
    // update config to prevent simultaneous play rounds
    config.run = true;

    // update database with current prices
    logger.info('Updating prices ...');
    await updateDb(config.db);

    // look for arbitrages in database
    logger.info('Looking for arbitrages ...');
    const startTime = new Date().getTime();
    // const arbitrages = await getArbitrageOpportunities(
    //     config.db,
    //     config.exchange,
    //     config.currency
    // );
    const arbitrages = [
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - storm/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00000141,
            srcTradingFees: 0.001,
            tmpCurrency: 'storm',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - storm/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00000143,
            dstTradingFees: 0.0025,
            ratio: 1.0106372872340426
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - cloak/btc',
            srcPriceType: 'bid',
            srcPrice: 0.000495,
            srcTradingFees: 0.001,
            tmpCurrency: 'cloak',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - cloak/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00050146,
            dstTradingFees: 0.0025,
            ratio: 1.0095073609090912
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - wings/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00002576,
            srcTradingFees: 0.001,
            tmpCurrency: 'wings',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - wings/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00002605,
            dstTradingFees: 0.0025,
            ratio: 1.0077208899456522
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - rep/btc',
            srcPriceType: 'bid',
            srcPrice: 0.002097,
            srcTradingFees: 0.001,
            tmpCurrency: 'rep',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - rep/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00211705,
            dstTradingFees: 0.0025,
            ratio: 1.006030337446352
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - gto/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00001079,
            srcTradingFees: 0.001,
            tmpCurrency: 'gto',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - gto/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00001089,
            dstTradingFees: 0.0025,
            ratio: 1.0057379263206674
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - lun/btc',
            srcPriceType: 'bid',
            srcPrice: 0.0006655,
            srcTradingFees: 0.001,
            tmpCurrency: 'lun',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - lun/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00067162,
            dstTradingFees: 0.0025,
            ratio: 1.0056664298271978
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - sc/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00000111,
            srcTradingFees: 0.001,
            tmpCurrency: 'sc',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - sc/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00000112,
            dstTradingFees: 0.0025,
            ratio: 1.0054800000000002
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - snt/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00000555,
            srcTradingFees: 0.001,
            tmpCurrency: 'snt',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - snt/btc',
            dstPriceType: 'ask',
            dstPrice: 0.0000056,
            dstTradingFees: 0.0025,
            ratio: 1.0054800000000002
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - powr/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00002541,
            srcTradingFees: 0.001,
            tmpCurrency: 'powr',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - powr/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00002563,
            dstTradingFees: 0.0025,
            ratio: 1.0051302272727274
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - grs/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00008417,
            srcTradingFees: 0.001,
            tmpCurrency: 'grs',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - grs/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00008488,
            dstTradingFees: 0.0025,
            ratio: 1.0049083069977427
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - nxs/btc',
            srcPriceType: 'bid',
            srcPrice: 0.0001168,
            srcTradingFees: 0.001,
            tmpCurrency: 'nxs',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - nxs/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00011769,
            dstTradingFees: 0.0025,
            ratio: 1.0040957125428083
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - dnt/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00000394,
            srcTradingFees: 0.001,
            tmpCurrency: 'dnt',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - dnt/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00000397,
            dstTradingFees: 0.0025,
            ratio: 1.0040900824873096
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - mft/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00000134,
            srcTradingFees: 0.001,
            tmpCurrency: 'mft',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - mft/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00000135,
            dstTradingFees: 0.0025,
            ratio: 1.0039390858208954
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - salt/btc',
            srcPriceType: 'bid',
            srcPrice: 0.0001038,
            srcTradingFees: 0.001,
            tmpCurrency: 'salt',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - salt/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00010454,
            dstTradingFees: 0.0025,
            ratio: 1.0036066604046243
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - rcn/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00000421,
            srcTradingFees: 0.001,
            tmpCurrency: 'rcn',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - rcn/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00000424,
            dstTradingFees: 0.0025,
            ratio: 1.0036034679334915
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - mco/btc',
            srcPriceType: 'bid',
            srcPrice: 0.000729,
            srcTradingFees: 0.001,
            tmpCurrency: 'mco',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - mco/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00073414,
            dstTradingFees: 0.0025,
            ratio: 1.0035285944444443
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - steem/btc',
            srcPriceType: 'bid',
            srcPrice: 0.0001212,
            srcTradingFees: 0.001,
            tmpCurrency: 'steem',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - steem/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00012205,
            dstTradingFees: 0.0025,
            ratio: 1.003491172648515
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - lrc/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00001775,
            srcTradingFees: 0.001,
            tmpCurrency: 'lrc',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - lrc/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00001787,
            dstTradingFees: 0.0025,
            ratio: 1.0032394183098594
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - ardr/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00001701,
            srcTradingFees: 0.001,
            tmpCurrency: 'ardr',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - ardr/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00001712,
            dstTradingFees: 0.0025,
            ratio: 1.0029466666666667
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - tusd/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00015639,
            srcTradingFees: 0.001,
            tmpCurrency: 'tusd',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - tusd/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00015733,
            dstTradingFees: 0.0025,
            ratio: 1.0024920923652407
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - lsk/btc',
            srcPriceType: 'bid',
            srcPrice: 0.0004373,
            srcTradingFees: 0.001,
            tmpCurrency: 'lsk',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - lsk/btc',
            dstPriceType: 'ask',
            dstPrice: 0.0004396,
            dstTradingFees: 0.0025,
            ratio: 1.0017436519551794
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - rlc/btc',
            srcPriceType: 'bid',
            srcPrice: 0.0000716,
            srcTradingFees: 0.001,
            tmpCurrency: 'rlc',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - rlc/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00007196,
            dstTradingFees: 0.0025,
            ratio: 1.001512847765363
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - eng/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00010233,
            srcTradingFees: 0.001,
            tmpCurrency: 'eng',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - eng/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00010284,
            dstTradingFees: 0.0025,
            ratio: 1.0014689445910292
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - pivx/btc',
            srcPriceType: 'bid',
            srcPrice: 0.000205,
            srcTradingFees: 0.001,
            tmpCurrency: 'pivx',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - pivx/btc',
            dstPriceType: 'ask',
            dstPrice: 0.000206,
            dstTradingFees: 0.0025,
            ratio: 1.001363487804878
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - gnt/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00002685,
            srcTradingFees: 0.001,
            tmpCurrency: 'gnt',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - gnt/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00002698,
            dstTradingFees: 0.0025,
            ratio: 1.001327279329609
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - waves/btc',
            srcPriceType: 'bid',
            srcPrice: 0.000295,
            srcTradingFees: 0.001,
            tmpCurrency: 'waves',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - waves/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00029639,
            dstTradingFees: 0.0025,
            ratio: 1.001197884661017
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - ark/btc',
            srcPriceType: 'bid',
            srcPrice: 0.0001214,
            srcTradingFees: 0.001,
            tmpCurrency: 'ark',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - ark/btc',
            dstPriceType: 'ask',
            dstPrice: 0.0001219,
            dstTradingFees: 0.0025,
            ratio: 1.000606711285008
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - cvc/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00002193,
            srcTradingFees: 0.001,
            tmpCurrency: 'cvc',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - cvc/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00002202,
            dstTradingFees: 0.0025,
            ratio: 1.000592113543092
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - zrx/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00012268,
            srcTradingFees: 0.001,
            tmpCurrency: 'zrx',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - zrx/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00012318,
            dstTradingFees: 0.0025,
            ratio: 1.000563889387023
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - omg/btc',
            srcPriceType: 'bid',
            srcPrice: 0.000498,
            srcTradingFees: 0.001,
            tmpCurrency: 'omg',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - omg/btc',
            dstPriceType: 'ask',
            dstPrice: 0.0005,
            dstTradingFees: 0.0025,
            ratio: 1.0005045180722894
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - qtum/btc',
            srcPriceType: 'bid',
            srcPrice: 0.000621,
            srcTradingFees: 0.001,
            tmpCurrency: 'qtum',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - qtum/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00062347,
            dstTradingFees: 0.0025,
            ratio: 1.0004660445652174
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - enj/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00000774,
            srcTradingFees: 0.001,
            tmpCurrency: 'enj',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - enj/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00000777,
            dstTradingFees: 0.0025,
            ratio: 1.0003649127906977
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - xlm/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00003593,
            srcTradingFees: 0.001,
            tmpCurrency: 'xlm',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - xlm/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00003605,
            dstTradingFees: 0.0025,
            ratio: 0.9998306463957695
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - zen/btc',
            srcPriceType: 'bid',
            srcPrice: 0.002333,
            srcTradingFees: 0.001,
            tmpCurrency: 'zen',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - zen/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00233998,
            dstTradingFees: 0.0025,
            ratio: 0.9994838919631377
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - trx/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00000361,
            srcTradingFees: 0.001,
            tmpCurrency: 'trx',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - trx/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00000362,
            dstTradingFees: 0.0025,
            ratio: 0.9992628947368423
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - vib/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00000737,
            srcTradingFees: 0.001,
            tmpCurrency: 'vib',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - vib/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00000739,
            dstTradingFees: 0.0025,
            ratio: 0.9992067130257803
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - go/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00001111,
            srcTradingFees: 0.001,
            tmpCurrency: 'go',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - go/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00001114,
            dstTradingFees: 0.0025,
            ratio: 0.9991933258325832
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - xrp/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00007093,
            srcTradingFees: 0.001,
            tmpCurrency: 'xrp',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - xrp/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00007112,
            dstTradingFees: 0.0025,
            ratio: 0.9991718285633723
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - ltc/btc',
            srcPriceType: 'bid',
            srcPrice: 0.008033,
            srcTradingFees: 0.001,
            tmpCurrency: 'ltc',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - ltc/btc',
            dstPriceType: 'ask',
            dstPrice: 0.0080545,
            dstTradingFees: 0.0025,
            ratio: 0.9991695986866675
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - sys/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00001517,
            srcTradingFees: 0.001,
            tmpCurrency: 'sys',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - sys/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00001521,
            dstTradingFees: 0.0025,
            ratio: 0.99913006097561
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - btc/usdt',
            srcPriceType: 'ask',
            srcPrice: 6504.6,
            srcTradingFees: 0.001,
            tmpCurrency: 'usdt',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - btc/usdt',
            dstPriceType: 'bid',
            dstPrice: 6488.00000003,
            dstTradingFees: 0.0025,
            ratio: 0.9990521210650478
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - etc/btc',
            srcPriceType: 'bid',
            srcPrice: 0.001488,
            srcTradingFees: 0.001,
            tmpCurrency: 'etc',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - etc/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00149173,
            dstTradingFees: 0.0025,
            ratio: 0.9990004531754033
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - bnt/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00019956,
            srcTradingFees: 0.001,
            tmpCurrency: 'bnt',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - bnt/btc',
            dstPriceType: 'ask',
            dstPrice: 0.0002,
            dstTradingFees: 0.0025,
            ratio: 0.9986996392062539
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - dash/btc',
            srcPriceType: 'bid',
            srcPrice: 0.023852,
            srcTradingFees: 0.001,
            tmpCurrency: 'dash',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - dash/btc',
            dstPriceType: 'ask',
            dstPrice: 0.0239,
            dstTradingFees: 0.0025,
            ratio: 0.9985078714573201
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - adx/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00003523,
            srcTradingFees: 0.001,
            tmpCurrency: 'adx',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - adx/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00003529,
            dstTradingFees: 0.0025,
            ratio: 0.9981996373829125
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - neo/btc',
            srcPriceType: 'bid',
            srcPrice: 0.002486,
            srcTradingFees: 0.001,
            tmpCurrency: 'neo',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - neo/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00249,
            dstTradingFees: 0.0025,
            ratio: 0.9981058829444892
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - loom/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00001823,
            srcTradingFees: 0.001,
            tmpCurrency: 'loom',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - loom/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00001825,
            dstTradingFees: 0.0025,
            ratio: 0.9975957556226001
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - mtl/btc',
            srcPriceType: 'bid',
            srcPrice: 0.0001073,
            srcTradingFees: 0.001,
            tmpCurrency: 'mtl',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - mtl/btc',
            dstPriceType: 'ask',
            dstPrice: 0.0001074,
            dstTradingFees: 0.0025,
            ratio: 0.9974312068965517
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - strat/btc',
            srcPriceType: 'bid',
            srcPrice: 0.0002638,
            srcTradingFees: 0.001,
            tmpCurrency: 'strat',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - strat/btc',
            dstPriceType: 'ask',
            dstPrice: 0.000264,
            dstTradingFees: 0.0025,
            ratio: 0.9972579984836998
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - xem/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00001459,
            srcTradingFees: 0.001,
            tmpCurrency: 'xem',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - xem/btc',
            dstPriceType: 'ask',
            dstPrice: 0.0000146,
            dstTradingFees: 0.0025,
            ratio: 0.9971855037697055
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - xzc/btc',
            srcPriceType: 'bid',
            srcPrice: 0.001699,
            srcTradingFees: 0.001,
            tmpCurrency: 'xzc',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - xzc/btc',
            dstPriceType: 'ask',
            dstPrice: 0.0017,
            dstTradingFees: 0.0025,
            ratio: 0.9970890229546793
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - xmr/btc',
            srcPriceType: 'bid',
            srcPrice: 0.016203,
            srcTradingFees: 0.001,
            tmpCurrency: 'xmr',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - xmr/btc',
            dstPriceType: 'ask',
            dstPrice: 0.0162119,
            dstTradingFees: 0.0025,
            ratio: 0.9970498598870582
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - eth/btc',
            srcPriceType: 'bid',
            srcPrice: 0.031435,
            srcTradingFees: 0.001,
            tmpCurrency: 'eth',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - eth/btc',
            dstPriceType: 'ask',
            dstPrice: 0.03144444,
            dstTradingFees: 0.0025,
            ratio: 0.9968017519039288
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - nav/btc',
            srcPriceType: 'bid',
            srcPrice: 0.0000565,
            srcTradingFees: 0.001,
            tmpCurrency: 'nav',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - nav/btc',
            dstPriceType: 'ask',
            dstPrice: 0.0000565,
            dstTradingFees: 0.0025,
            ratio: 0.9965025000000001
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - xvg/btc',
            srcPriceType: 'bid',
            srcPrice: 0.0000023,
            srcTradingFees: 0.001,
            tmpCurrency: 'xvg',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - xvg/btc',
            dstPriceType: 'ask',
            dstPrice: 0.0000023,
            dstTradingFees: 0.0025,
            ratio: 0.9965025
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - zec/btc',
            srcPriceType: 'bid',
            srcPrice: 0.018708,
            srcTradingFees: 0.001,
            tmpCurrency: 'zec',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - zec/btc',
            dstPriceType: 'ask',
            dstPrice: 0.0187,
            dstTradingFees: 0.0025,
            ratio: 0.9960763710711996
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - storj/btc',
            srcPriceType: 'bid',
            srcPrice: 0.0000513,
            srcTradingFees: 0.001,
            tmpCurrency: 'storj',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - storj/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00005126,
            dstTradingFees: 0.0025,
            ratio: 0.9957255000000002
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - mana/btc',
            srcPriceType: 'bid',
            srcPrice: 0.0000118,
            srcTradingFees: 0.001,
            tmpCurrency: 'mana',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - mana/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00001179,
            dstTradingFees: 0.0025,
            ratio: 0.9956580063559322
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - ada/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00001136,
            srcTradingFees: 0.001,
            tmpCurrency: 'ada',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - ada/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00001135,
            dstTradingFees: 0.0025,
            ratio: 0.9956252970950706
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - rvn/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00000785,
            srcTradingFees: 0.001,
            tmpCurrency: 'rvn',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - rvn/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00000784,
            dstTradingFees: 0.0025,
            ratio: 0.9952330700636943
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - bat/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00003915,
            srcTradingFees: 0.001,
            tmpCurrency: 'bat',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - bat/btc',
            dstPriceType: 'ask',
            dstPrice: 0.0000391,
            dstTradingFees: 0.0025,
            ratio: 0.995229827586207
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - poly/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00004299,
            srcTradingFees: 0.001,
            tmpCurrency: 'poly',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - poly/btc',
            dstPriceType: 'ask',
            dstPrice: 0.0000429,
            dstTradingFees: 0.0025,
            ratio: 0.9944163119330078
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - bcpt/btc',
            srcPriceType: 'bid',
            srcPrice: 0.00001681,
            srcTradingFees: 0.001,
            tmpCurrency: 'bcpt',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - bcpt/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00001677,
            dstTradingFees: 0.0025,
            ratio: 0.9941312864366448
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - kmd/btc',
            srcPriceType: 'bid',
            srcPrice: 0.0002167,
            srcTradingFees: 0.001,
            tmpCurrency: 'kmd',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - kmd/btc',
            dstPriceType: 'ask',
            dstPrice: 0.000216,
            dstTradingFees: 0.0025,
            ratio: 0.9932835256114445
        },
        {
            srcCurrency: 'btc',
            srcExchange: 'binance',
            srcMarket: 'binance - via/btc',
            srcPriceType: 'bid',
            srcPrice: 0.0001094,
            srcTradingFees: 0.001,
            tmpCurrency: 'via',
            withdrawalFees: null,
            dstExchange: 'bittrex',
            dstMarket: 'bittrex - via/btc',
            dstPriceType: 'ask',
            dstPrice: 0.00010897,
            dstTradingFees: 0.0025,
            ratio: 0.9925857168647166
        }
    ];
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
    const adjustedArbitrages = await Promise.all(
        arbitrages.map(updateArbitrageRatio)
    );
    // console.log(adjustedArbitrages);
    let bestRatio = adjustedArbitrages.reduce(
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
            config.currency
        } -> ${estimatedFinalWalletAmount.toFixed(8)} ${config.currency}`
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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateArbitrageRatio(arbitrage) {
    const srcExchange = getExchange(arbitrage.srcExchange);
    const dstExchange = getExchange(arbitrage.dstExchange);

    if (
        !srcExchange.walletIsEnabled(arbitrage.tmpCurrency) ||
        !dstExchange.walletIsEnabled(arbitrage.tmpCurrency)
    ) {
        throw Error(`One or more wallet is disabled on this arbitrage`);
    }

    //TODO: check if addresses can be generated

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
