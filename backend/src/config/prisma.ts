// En prisma.ts
import { PrismaClient } from "@prisma/client";

// Definimos un espacio global para guardar nuestra instancia
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Si ya existe una instancia (porque el server se reinició), la reutilizamos.
// Si no existe (es la primera vez que arranca), creamos una nueva.
const prisma = globalForPrisma.prisma ?? new PrismaClient();

// Solo guardamos la instancia global si NO estamos en producción
if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

export default prisma;