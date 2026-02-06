import dotenv from 'dotenv';
import { buildServer } from './server.js';

dotenv.config();

const startApp = async () => {

    const app = buildServer();

    try {
        const port = parseInt(process.env.PORT || '8000');
        const host = '0.0.0.0';

        await app.listen({ port, host });

        console.log(`Servidor corriendo en http://localhost:${port}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

startApp();
