const JWT = require("jsonwebtoken");
const dotenv = require("dotenv");
const { PrismaClient } = require("@prisma/client");
dotenv.config();
const prisma = new PrismaClient({});
exports.isAuthenticatedUser = async (req, res, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token || token == undefined) {
      throw ErrorHandler.customError(
        "Please Login to access This resources",
        401
      );
    }

    const decodeTokenData = JWT.verify(token, process.env.JWT_SECRET);
    if (!decodeTokenData) {
      return res
        .status(403)
        .json({ message: "Failed to authenticate user please login " });
    }

    req.user = await prisma.user.findUnique({
      where: {
        id: decodeTokenData.id,
      },
    });
    next();
  } catch (error) {
    console.log(error);
    return res.status(404).send({
      success: false,
      message: "Token Expire Please Login",
    });
  }
};
