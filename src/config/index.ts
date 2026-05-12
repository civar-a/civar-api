import * as dotenv from "dotenv";
import path from "path";
import { HttpStatus } from "../constants/httpStatus";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });


const PORT = Number(process.env.PORT) || 3030;


export const config = {

  PORT,
  SERVER_ERROR_CODE: HttpStatus.INTERNAL_SERVER_ERROR,

};
