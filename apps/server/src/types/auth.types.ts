import { Models } from "../prisma/contract";

export type RefreshTokenPayload = {
    sessionId : Models.public_Session["id"];
    jti : string;
}

export type AccessTokenPayload = {
    userId : Models.public_User["id"];
    role : Models.public_User["role"];
    sessionId : Models.public_Session["id"];
}
