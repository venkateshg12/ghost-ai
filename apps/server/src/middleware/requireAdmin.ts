import { appErrorCode } from "../constants/appErrorCode";
import { FORBIDDEN } from "../constants/http";
import { orm } from "../prisma/db";
import appAssert from "../utils/errors/appAssert";
import { catchError } from "../utils/errors/catchError";

/*
  The role in the access token is a snapshot from when it was signed, so trusting it would leave a
  demoted admin with admin rights until the token expired. Admin traffic is low enough that reading
  the current role on every admin request costs nothing worth saving. Runs after `authenticate`.
 */
const requireAdmin = catchError(async (req, _res, next) => {
    const user = await orm.User.
    where({id : req.userId}).
    select("role").
    first()
   appAssert(user?.role === "admin", FORBIDDEN, "Admin access only", appErrorCode.Forbidden);
   req.role = user.role;
   next();
});

export default requireAdmin;
