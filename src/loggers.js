const winston = require('winston');

const logLevels = {
    levels: {
        error: 0,
        warn: 1,
        info: 2,
        http: 3,
        sql: 4,
        debug: 5
    },
    colors: {
        error: 'red',
        warn: 'darkred',
        info: 'black',
        http: 'green',
        sql: 'blue',
        debug: 'gray'
    }
};
winston.addColors(logLevels);

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(
            info => `${info.timestamp} ${info.level}: ${info.message}`
        )
    ),
    transports: [
        new winston.transports.Console({
            level: 'debug',
            handleExceptions: true,
            json: false
        }),
        new winston.transports.File({
            level: 'debug',
            filename: `./logs/${new Date().getTime()}`,
            handleExceptions: true,
            json: true,
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});

export { logger };
