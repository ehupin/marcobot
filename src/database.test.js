import { connectDb, updateDb } from './database';

test.skip('Connect to db', () => {
    connectDb();
});

test.skip('Update db', () => {
    updateDb();
});

// test()
