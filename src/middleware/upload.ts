import multer from "multer";
import { MAX_UPLOAD_BYTES } from "../lib/fileStorage.js";

/**
 * Parses a `multipart/form-data` request containing ONE file in a field
 * named "file" (plus any ordinary text fields, which land in `req.body`)
 * and exposes it as `req.file`.
 *
 * The file is held in memory only for the length of the request — the
 * service validates everything else first (permissions, the parent
 * invoice/bill, the other form fields) and only THEN writes it to disk, so
 * a rejected request never leaves a stray file behind. The size cap keeps
 * the memory cost bounded.
 */
export const singleFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
}).single("file");