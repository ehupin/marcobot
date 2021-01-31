# MarcoBot

This project goal is to identify arbitrage opportunities between 2 exchanges.
So far it only supports Binance and Bittrex.

It relies on a ArangoDb instance used to cache data from exchange (markets, prices, ...) as a graph
and from which the best arbitrage opportunities are searched.

It requires api keys from exchange to be stored in `./keys`, based on the template provided by `./keys/_template.js`.
It also requires the database information to be set in a `./src/configs/dbConfigs.js`, matching template provided by `./src/configs/dbConfigs_template.js` 

Then, here are the commands to run to test it:

``` bash
npm install
npm run setup_db
npm run start_bot
```

As a final word, arbitrages opportunities are very rare as the trading and withdraw fees makes most of them not profitable.
And this might be even worse if processing delays are considered, which are often not compatible with the short time window the opportunity exists.