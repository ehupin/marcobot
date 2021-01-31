import fs from 'fs';
import {logger} from './logger';
import axios from 'axios';
import {getWalletStatus, getWithdrawFees} from './database/dbHandler';
import {isAsync} from "./utils";

const EXCHANGES = {};

/*
Return existing exchanges by reading the content of src/exchanges and loading the js files in it.
The returned exchanges are proxified first. 
All this process is made by getExchange, whereas getExchanges is just in charge of looping throught exchanges dir.
*/
export function getExchanges() {
    const exchanges = [];
    const exchangeDir = './src/exchanges/';
    const exchangeModuleFiles = fs.readdirSync(exchangeDir);
    for (const exchangeModuleFile of exchangeModuleFiles) {
        if (fs.statSync(exchangeDir + exchangeModuleFile).isFile()) {
            const exchangeName = exchangeModuleFile.split('.')[0];
            const exchange = getExchange(exchangeName);
            exchanges.push(exchange);
        }
    }
    return exchanges;
}

/*
Return required exchange, which is a proxy around the exchange contain in file.
Indeed, this function first load exchange from file, then proxify it.
*/
export function getExchange(exchangeName) {
    // to improve performances, exchanges are stored in EXCHANGE object
    // so when a exchange is called, first check if it has been loaded before
    if (Object.keys(EXCHANGES).includes(exchangeName)) {
        return EXCHANGES[exchangeName];
    }

    const exchange = require(`./exchanges/${exchangeName}.js`).default;
    const proxifiedExchange = _proxifyExchange(exchange);
    EXCHANGES[exchangeName] = proxifiedExchange;
    return proxifiedExchange;
}

/*
Return a proxified version of given exchange.
Extra functions are also added (e.g. _makeRequest).
Original functions are wrapped in order to check values passed as arguments
before the original exchange function is ran.
*/
function _proxifyExchange(exchange) {
    // create proxifiedExchange from original exchange
    const newExchange = Object.assign({}, abstractExchange);
    let proxifiedExchange = Object.assign(newExchange, exchange);

    // bind exchange _request
    proxifiedExchange._request = exchange._request.bind(proxifiedExchange);

    // wrap functions
    Object.keys(proxifiedExchange).map(key => {
        if (Object.keys(validateExchangeFunctionsArguments).includes(key)) {
            const function_ = proxifiedExchange[key];
            const functionName = key;

            if (isAsync(function_)) {
                proxifiedExchange[functionName] = async function(...args) {
                    validateExchangeFunctionsArguments[functionName](...args);
                    const wrappedFunction = function_.bind(proxifiedExchange);
                    return await wrappedFunction(...args);
                };
            } else {
                proxifiedExchange[functionName] = function(...args) {
                    validateExchangeFunctionsArguments[functionName](...args);
                    const wrappedFunction = function_.bind(proxifiedExchange);
                    return wrappedFunction(...args);
                };
            }
        }
    });

    return proxifiedExchange;
}

const abstractExchange = {
    async applyWithdrawFees(currencyName, amount, db) {
        let currencyFees = await getWithdrawFees(db, this.name, currencyName);

        if (!currencyFees) {
            throw Error('cannot get fees from database');
        }

        if (amount < currencyFees.withdrawMin) {
            throw Error(
                `withdraw too low ${amount} < ${currencyFees.withdrawMin}`
            );
        }
        if (!currencyFees.withdrawEnabled) {
            throw Error('withdraw disabled');
        }
        const withdrawOutput = amount - currencyFees.withdrawFee;
        return withdrawOutput;
    },
    async applyTradingFees(amount) {
        return amount * (1 - this.tradingFees);
    },
    async walletIsEnabled(currencyName, db) {
        let walletStatus = await getWalletStatus(db, this.name, currencyName);
        return walletStatus.depositEnabled && walletStatus.withdrawEnabled;
    },
    async _makeRequest(exchange, path, requestConfig) {
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
            let errorMessage = `Request call has failed: ${e.message}`;

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
            if (!fs.existsSync(logFileDir)){
                fs.mkdirSync(logFileDir);
            }
            fs.writeFileSync(logFilePath, logString);
        }
    }

};

/*
This object contain function dedicated to check arguments sent to exchanges functions.
It helps to reduce the duplication of code for each exchange.
Indeed, when creating new exchanges, developer will not have to check received arguments.
*/
const validateExchangeFunctionsArguments = {
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


