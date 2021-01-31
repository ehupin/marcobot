const dbConfig = {
    url: 'http://0.0.0.0:8529',
    login: 'root',
    password: 'root',
    dbName: 'marcoBot',
    maxConnectionsAttempts: 5,
    maxQueriesAttempts: 10,
    queryRetryDelay: 1000
}

export { dbConfig };