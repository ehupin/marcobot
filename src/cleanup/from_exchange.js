//
// const testedFunctionArgs = {
//     getCurrencies: [],
//     getMarkets: [],
//     getOrderBook: ['eth/btc', 'bid'],
//     getWalletAmount: ['btc'],
//     getDepositAddress: ['xrp'],
//     applyWithdrawFees: ['btc', 0.5],
//     applyTradingFees: ['0.5']
//     // orderIsCompleted: [],
//     // withdrawIsCompleted: [],
//     // depositIsCompleted: [],
//     // placeOrder: [],
//     // makeWithdrawal: []
// };
//
// async function testExchanges() {
//     const testedExchangeNames = ['binance', 'bittrex'];
//     const exchanges = getExchanges();
//     for (const functionName of Object.keys(testedFunctionArgs)) {
//         for (const exchange of exchanges) {
//             if (!testedExchangeNames.includes(exchange.name)) {
//                 continue;
//             }
//
//             const args = testedFunctionArgs[functionName];
//             console.log(
//                 `\n\n=> Testing ${exchange.name}.${functionName}() ...`
//             );
//             // continue;
//             try {
//                 const result = await exchange[functionName](...args);
//
//                 if (typeof result === 'object') {
//                     const keys = Object.keys(result);
//                     // console.log(keys.length);
//                     // return;
//                     if (keys.length > 2) {
//                         let prunedObject = {};
//                         keys.slice(0, 2).map(
//                             key => (prunedObject[key] = result[key])
//                         );
//                         console.log(prunedObject);
//                         continue;
//                     }
//                 }
//
//                 if (typeof result === 'array') {
//                     continue;
//                     if (result.length > 2) {
//                         let prunedArray = [];
//                         console.log(result.slice(0, 2));
//                     }
//                 }
//
//                 console.log(result);
//             } catch (e) {
//                 console.log('!!! ERROR !!! - ', e);
//             }
//         }
//     }
//
//     return;
// }
//
// async function dumpBittrexDepositAddressesToCsv() {
//     const bittrex = getExchange('bittrex');
//     let result;
//     let csvFile = '';
//
//     result = await bittrex._request('get', '/api/v1.1/public/getcurrencies');
//
//     const totalCurrencies = result.length;
//     let currentCurrencyIndex = 0;
//
//     for (const currency of result) {
//         currentCurrencyIndex += 1;
//         // console.log('##########################');
//         const currencyName = currency.Currency;
//         const baseAddress = currency.BaseAddress;
//
//         let address;
//         let currencyIsOffline = false;
//         let attemptRequest = true;
//         const maxAttempt = 50;
//         let attempt = 0;
//
//         while (attemptRequest) {
//             if (attempt >= maxAttempt) {
//                 break;
//             }
//
//             try {
//                 const result = await bittrex._request(
//                     'get',
//                     '/api/v1.1/account/getdepositaddress',
//                     true,
//                     {
//                         currency: currencyName
//                     }
//                 );
//                 address = result.Address;
//                 attemptRequest = false;
//             } catch (e) {
//                 if (e.message.match(/ADDRESS_GENERATING/)) {
//                     logger.debug(
//                         `Bittrex exchange: generating address for ${currencyName}`
//                     );
//                     await sleep(500);
//                     attempt += 1;
//                 } else if (e.message.match(/CURRENCY_OFFLINE/)) {
//                     logger.debug(
//                         `Bittrex exchange: cannot get address for ${currencyName} CURRENCY_OFFLINE`
//                     );
//                     currencyIsOffline = true;
//                     attemptRequest = false;
//                 } else if (e.message.match(/INVALID_CURRENCY_TYPE/)) {
//                     logger.debug(
//                         `Bittrex exchange: cannot get address for ${currencyName} INVALID_CURRENCY_TYPE`
//                     );
//                     currencyIsOffline = true;
//                     attemptRequest = false;
//                 } else if (e.message.match(/RESTRICTED_CURRENCY/)) {
//                     logger.debug(
//                         `Bittrex exchange: cannot get address for ${currencyName} RESTRICTED_CURRENCY`
//                     );
//                     currencyIsOffline = true;
//                     attemptRequest = false;
//                 } else {
//                     throw e;
//                 }
//             }
//         }
//         let row;
//         if (currencyIsOffline) {
//             row = `${currencyName},${baseAddress},offline`;
//         } else if (!address) {
//             row = `${currencyName},${baseAddress},cannot generate`;
//         } else {
//             row = `${currencyName},${baseAddress},${address}`;
//         }
//         console.log(
//             `>>>>>>> ${currentCurrencyIndex}/${totalCurrencies}  ${row}`
//         );
//         csvFile += row + '\n';
//         await sleep(200);
//     }
//     fs.writeFileSync('bittrexCurrencies_matthieu.csv', csvFile);
//
//     // console.log(result);
// }
//
// async function bittrexTest() {
//     const bittrex = getExchange('bittrex');
//     const result = await bittrex.walletIsEnabled('emc2');
//     console.log(result);
//
//     return;

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
// }

// binanceTests();