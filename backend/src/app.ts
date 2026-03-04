import dotenv from 'dotenv';
import { buildServer } from './server.js';

dotenv.config();
const app = buildServer(); // Inicializamos el servidor

const startApp = async () => {

    try {
        const port = parseInt(process.env.PORT || '8000');
        const host = '0.0.0.0';

        await app.listen({ port, host });

        console.log(`
  🚀 Servidor corriendo en:
  👉 REST API:    http://localhost:${port}/api
  👉 Video Stream: http://localhost:${port}/api/monitoreo/video
  👉 Audio Stream: http://localhost:${port}/api/monitoreo/audio
  👉 Health Check: http://localhost:${port}/
        `);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

startApp();
