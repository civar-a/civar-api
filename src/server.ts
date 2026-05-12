import http from 'http';
import { config } from './config';
import { createApp } from "./app";


process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception! Shutting down...', { message: err.message, stack: err.stack });
    process.exit(1);
});

process.on('unhandledRejection', (err: any) => {
    console.error('Unhandled Rejection! Shutting down...', { message: err.message, stack: err.stack });
    process.exit(1);
});

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = async (signal: string) => {
    console.info(`${signal} received. Shutting down gracefully...`);

    try {


        // Add other cleanup tasks here (e.g. closing http server, disconnecting websocket)
        process.exit(0);
    } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

/**
 * server bootstrap
 */
const startServer = async () => {
    try {
        /**
         * create express app
         */
        const app = createApp();
        const server = http.createServer(app);


        /**
         * start listening
         */
        server.listen(config.PORT, () => {
            console.log(`Server is running at http://localhost:${config.PORT}`);
        });
    } catch (error) {
        console.error("Failed to start the server:", error);
        process.exit(1);
    }
}


startServer();
