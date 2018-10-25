import fs from 'fs';
import { logger } from './loggers';
import axios from 'axios';

/*
Return existing exchanges by reading the content of src/exchanges and loading the js files in it.
The returned exchanges are proxified first. 
All this process is made by getExchange, whereas getExchanges is just in charge of looping throught exchanges dir.
*/
export function getExchanges() {
    const exchanges = [];
    const exchagesDir = './src/exchanges/';
    const exchangeModuleFiles = fs.readdirSync(exchagesDir);
    for (const exchangeModuleFile of exchangeModuleFiles) {
        // console.log(fs.statSync(exchagesDir + exchangeModuleFile).isFile());
        if (fs.statSync(exchagesDir + exchangeModuleFile).isFile()) {
            const exchangeName = exchangeModuleFile.split('.')[0];
            exchanges.push(getExchange(exchangeName));
        }
    }
    return exchanges;
}

/*
Return required exchange, which is a proxy around the exchange contain in file.
Indeed, this function first load exchange from file, then proxify it.
*/
export function getExchange(exchangeName) {
    const exchange = require(`./exchanges/${exchangeName}.js`).default;
    return _proxifyExchange(exchange);
}

/*
This object contain function dedicated to check arguments sent to exchanges functions.
It helps to reduce the replciaiton of code for each exchange.
Indeed, when creating new exchages, developper will not have to check received arguments.
*/
// TODO refactor all this to make it DRY (attributes check are often the same)
const checkExchangeFunctionsArguments = {
    getMarkets() {},
    getCurrencies() {},
    getOrderBook(marketName, type) {
        if (
            !typeof marketName === 'string' ||
            !marketName.match(/^\w+\/\w+$/)
        ) {
            throw Error(`getOrderBook: marketName is not valid: ${marketName}`);
        }

        if (!typeof type === 'string' || !['ask', 'bid'].includes(type)) {
            throw Error(`getOrderBook: type is not valid: ${type}`);
        }
    },
    getWalletAmount(currencyName) {
        if (!typeof currencyName === 'string' || !currencyName.match(/^\w+$/)) {
            throw Error(
                `getWalletAmount: currencyName is not valid: ${currencyName}`
            );
        }
    },
    getDepositAddress(currencyName) {
        if (!typeof currencyName === 'string' || !currencyName.match(/^\w+$/)) {
            throw Error(
                `getDepositAddress: currencyName is not valid: ${currencyName}`
            );
        }
    },
    applyWithdrawFees(currencyName, amount) {
        if (!typeof currencyName === 'string' || !currencyName.match(/^\w+$/)) {
            throw Error(
                `applyWithdrawFees: currencyName is not valid: ${currencyName}`
            );
        }

        if (!typeof amount === 'number' || amount <= 0) {
            throw Error(`applyWithdrawFees: amount is not valid: ${amount}`);
        }
    },
    applyTradingFees(amount) {
        if (!typeof amount === 'number' || amount <= 0) {
            throw Error(`applyTradingFees: amount is not valid: ${amount}`);
        }
    },
    orderIsCompleted(marketName, orderId) {
        if (
            !typeof marketName === 'string' ||
            !marketName.match(/^\w+\/\w+$/)
        ) {
            throw Error(
                `orderIsCompleted: marketName is not valid: ${marketName}`
            );
        }

        if (!typeof orderId === 'string' || orderId === '') {
            throw Error(
                `orderIsCompleted: withdrawId is not valid: ${withdrawId}`
            );
        }
    },
    withdrawIsCompleted(withdrawId) {
        if (!typeof withdrawId === 'string' || withdrawId === '') {
            throw Error(
                `withdrawIsCompleted: withdrawId is not valid: ${withdrawId}`
            );
        }
    },
    //TODO: change signature attribute order to match applyWithdrawFees
    depositIsCompleted(amount, currencyName) {
        if (!typeof currencyName === 'string' || !currencyName.match(/^\w+$/)) {
            throw Error(
                `depositIsCompleted: currencyName is not valid: ${currencyName}`
            );
        }

        if (!typeof amount === 'number' || amount <= 0) {
            throw Error(`depositIsCompleted: amount is not valid: ${amount}`);
        }
    },
    placeOrder(marketName, amount, type) {
        if (
            !typeof marketName === 'string' ||
            !marketName.match(/^\w+\/\w+$/)
        ) {
            throw Error(`placeOrder: marketName is not valid: ${marketName}`);
        }

        if (!typeof amount === 'number' || amount <= 0) {
            throw Error(`placeOrder: amount is not valid: ${amount}`);
        }

        if (!typeof type === 'string' || !['buy', 'sell'].includes(type)) {
            throw Error(`placeOrder: type is not valid: ${type}`);
        }
    },
    makeWithdrawal(currencyName, amount, address, addressTag) {
        if (!typeof currencyName === 'string' || !currencyName.match(/^\w+$/)) {
            throw Error(
                `makeWithdrawal: currencyName is not valid: ${currencyName}`
            );
        }

        if (!typeof amount === 'number' || amount <= 0) {
            throw Error(`makeWithdrawal: amount is not valid: ${amount}`);
        }

        if (!typeof address === 'string' || address === '') {
            throw Error(`makeWithdrawal: address is not valid: ${address}`);
        }

        //TODO: manage addressTag requirement based on currency ??
    }
};

function isAsync(fn) {
    return fn.constructor.name === 'AsyncFunction';
}

/*
Return a proxified version of given exchange.
Extra functions are also added (e.g. _makeRequest).
Original functions are wrapped in order to check values passed as arguments
before the original exchange function is ran.
*/
function _proxifyExchange(exchange) {
    // create proxifiedExchange from original exchange
    let proxifiedExchange = Object.assign({}, exchange);

    // assign _makeRequest and re-bind _request
    proxifiedExchange._makeRequest = _makeRequest;
    proxifiedExchange._request = exchange._request.bind(proxifiedExchange);

    // wrap functions
    Object.keys(proxifiedExchange).map(key => {
        if (Object.keys(checkExchangeFunctionsArguments).includes(key)) {
            const ffunction = proxifiedExchange[key];
            const functionName = key;

            if (isAsync(ffunction)) {
                proxifiedExchange[functionName] = async function(...args) {
                    checkExchangeFunctionsArguments[functionName](...args);
                    const wrappedFunction = ffunction.bind(proxifiedExchange);
                    return await wrappedFunction(...args);
                };
            } else {
                proxifiedExchange[functionName] = function(...args) {
                    checkExchangeFunctionsArguments[functionName](...args);
                    const wrappedFunction = ffunction.bind(proxifiedExchange);
                    return wrappedFunction(...args);
                };
            }
        }
    });

    return proxifiedExchange;
}

/*
Run request using given requestConfig and return result sent by api servers.
*/
async function _makeRequest(exchange, path, requestConfig) {
    let response, errorMessage;

    // try to run the request
    try {
        response = await axios(requestConfig);

        // catch generic axios error
        if (!response.data) {
            throw Error(`request has failed: ${response.data}`);
        }

        // catch api related errors if exchange have a _catchRequestResponseErrors function
        if (exchange._catchRequestResponseErrors) {
            try {
                exchange._catchRequestResponseErrors(response);
            } catch (e) {
                throw Error(`request has failed (api error): ${e.message}`);
            }
        }

        return response.data;
    } catch (e) {
        // catch errors, reformat them, log them and throw them up
        let errorMessage = `Bittrex api call has failed: ${e.message}`;

        // add related axios error data if it exists
        if (e.response) {
            errorMessage += `\n\tAxios related error: ${JSON.stringify(
                e.response.data
            )}`;
        }

        // log error and throw it
        logger.log('error', errorMessage);
        throw e;
    } finally {
        // finally write a log file specific to this request
        // TODO: should it be included in general logger ?
        // make log object and stringify it
        const log = {
            requestConfig,
            response: response ? response.data : response,
            errorMessage
        };
        const logString = JSON.stringify(log, null, 4);

        // build log file path
        const logFileDir = './logs/exchanges_request/';
        const cleanedPath = path.replace(/\//g, '_');
        const logFileName = `${Date.now()}_${exchange.name}_${cleanedPath}_${
            errorMessage ? 'E' : 'S'
        }.json`;
        const logFilePath = logFileDir + logFileName;

        fs.writeFileSync(logFilePath, logString);
    }
}

const testedFunctionArgs = {
    getCurrencies: [],
    getMarkets: [],
    getOrderBook: ['eth/btc', 'bid'],
    getWalletAmount: ['btc'],
    getDepositAddress: ['xrp'],
    applyWithdrawFees: ['btc', 0.5],
    applyTradingFees: ['0.5']
    // orderIsCompleted: [],
    // withdrawIsCompleted: [],
    // depositIsCompleted: [],
    // placeOrder: [],
    // makeWithdrawal: []
};

async function testExchanges() {
    const testedExchangeNames = ['binance', 'bittrex'];
    const exchanges = getExchanges();
    for (const functionName of Object.keys(testedFunctionArgs)) {
        for (const exchange of exchanges) {
            if (!testedExchangeNames.includes(exchange.name)) {
                continue;
            }

            const args = testedFunctionArgs[functionName];
            console.log(
                `\n\n=> Testing ${exchange.name}.${functionName}() ...`
            );
            // continue;
            try {
                const result = await exchange[functionName](...args);

                if (typeof result === 'object') {
                    const keys = Object.keys(result);
                    // console.log(keys.length);
                    // return;
                    if (keys.length > 2) {
                        let prunedObject = {};
                        keys.slice(0, 2).map(
                            key => (prunedObject[key] = result[key])
                        );
                        console.log(prunedObject);
                        continue;
                    }
                }

                if (typeof result === 'array') {
                    continue;
                    if (result.length > 2) {
                        let prunedArray = [];
                        console.log(result.slice(0, 2));
                    }
                }

                console.log(result);
            } catch (e) {
                console.log('!!! ERROR !!! - ', e);
            }
        }
    }

    return;
}

async function binanceTests() {
    const binance = getExchange('binance');
    const result = await binance.walletIsEnabled('eon');
    console.log(result);
    // // dump deposit addresses in csv
    // const total = Object.keys(currencies).length;
    // let currencIndex = 0;
    // let csvFile = '';
    // for (let currency of Object.keys(currencies)) {
    //     currencIndex += 1;
    //     const address = await binance.getDepositAddress(currency.toLowerCase());
    //     let row = `${currency},${address.address},${address.tag}`;
    //     console.log(`>>>>>${currencIndex}/${total} ${row}`);
    //     csvFile += row + '\n';
    // }
    // fs.writeFileSync('binance_addresses.csv', csvFile);

    // result = await binance._request('get', '/api/v3/allOrders', true, {
    //     symbol: 'GOBTC'
    // });
    // console.log(result);

    // result = await binance._request('get', '/api/v3/order', true, {
    //     origClientOrderId: 'sMDLOLiHiMUdLjVAlfR9K3',
    //     symbol: 'GOBTC'
    // });
    // console.log(result);

    // result = await binance.getCurrencies();
    // for (const currency of Object.values(result)) {
    //     console.log(currency);
    // }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function dumpBittrexDepositAddressesToCsv() {
    const bittrex = getExchange('bittrex');
    let result;
    let csvFile = '';

    result = await bittrex._request('get', '/api/v1.1/public/getcurrencies');

    const totalCurrencies = result.length;
    let currentCurrencyIndex = 0;

    for (const currency of result) {
        currentCurrencyIndex += 1;
        // console.log('##########################');
        const currencyName = currency.Currency;
        const baseAddress = currency.BaseAddress;

        let address;
        let currencyIsOffline = false;
        let attemptRequest = true;
        const maxAttempt = 50;
        let attempt = 0;

        while (attemptRequest) {
            if (attempt >= maxAttempt) {
                break;
            }

            try {
                const result = await bittrex._request(
                    'get',
                    '/api/v1.1/account/getdepositaddress',
                    true,
                    {
                        currency: currencyName
                    }
                );
                address = result.Address;
                attemptRequest = false;
            } catch (e) {
                if (e.message.match(/ADDRESS_GENERATING/)) {
                    logger.debug(
                        `Bittrex exchange: generating address for ${currencyName}`
                    );
                    await sleep(500);
                    attempt += 1;
                } else if (e.message.match(/CURRENCY_OFFLINE/)) {
                    logger.debug(
                        `Bittrex exchange: cannot get address for ${currencyName} CURRENCY_OFFLINE`
                    );
                    currencyIsOffline = true;
                    attemptRequest = false;
                } else if (e.message.match(/INVALID_CURRENCY_TYPE/)) {
                    logger.debug(
                        `Bittrex exchange: cannot get address for ${currencyName} INVALID_CURRENCY_TYPE`
                    );
                    currencyIsOffline = true;
                    attemptRequest = false;
                } else if (e.message.match(/RESTRICTED_CURRENCY/)) {
                    logger.debug(
                        `Bittrex exchange: cannot get address for ${currencyName} RESTRICTED_CURRENCY`
                    );
                    currencyIsOffline = true;
                    attemptRequest = false;
                } else {
                    throw e;
                }
            }
        }
        let row;
        if (currencyIsOffline) {
            row = `${currencyName},${baseAddress},offline`;
        } else if (!address) {
            row = `${currencyName},${baseAddress},cannot generate`;
        } else {
            row = `${currencyName},${baseAddress},${address}`;
        }
        console.log(
            `>>>>>>> ${currentCurrencyIndex}/${totalCurrencies}  ${row}`
        );
        csvFile += row + '\n';
        await sleep(200);
    }
    fs.writeFileSync('bittrexCurrencies_matthieu.csv', csvFile);

    // console.log(result);
}

async function bittrexTest() {
    const bittrex = getExchange('bittrex');
    const result = await bittrex.walletIsEnabled('emc2');
    console.log(result);

    return;

    // const bittrex = getExchange('bittrex');
    // let result;
    // let csvFile = '';
    // result = await bittrex._request('get', '/api/v1.1/public/getcurrencies');
    // // result = await bittrex._request(
    // //     'get',
    // //     '/api/v2.0/pub/currencies/GetWalletHealth'
    // // );
    // for (let currency of result) {
    //     // currency = currency.Currency;

    //     if (!currency.IsActive || currency.IsRestricted) {
    //         const line = `${currency.Currency},${currency.IsActive},${
    //             currency.IsRestricted
    //         }`;
    //         console.log(line);
    //         csvFile += line + `\n`;
    //     }
    // }
    // // fs.writeFileSync('bittrexCurrencies_statuses.csv', csvFile);
}

bittrexTest();
