import * as dotenv from "dotenv";
import path from "path";
import { HttpStatus } from "../constants/httpStatus";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });


const PORT = Number(process.env.PORT) || 3030;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn("Warning: GEMINI_API_KEY is not set. Please set it in the .env file.");
}

export const config = {

  PORT,
  SERVER_ERROR_CODE: HttpStatus.INTERNAL_SERVER_ERROR,
  GEMINI_API_KEY,

};
