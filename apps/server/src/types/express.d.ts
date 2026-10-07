import { Models } from "../prisma/contract";

declare global {
    namespace Express {
        interface Request {
            userId: Models.public_User["id"];
            sessionId: Models.public_Session["id"];
            role: Models.public_User["role"];
            visitorId?: string;
        }
    }
}

export {};
