import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { AppError } from "../middleware/errorHandler.js";

/**
 * LOCAL-DISK FILE STORAGE for uploaded documents
 * -----------------------------------------------
 * Layout on disk:   <UPLOAD_DIR>/<companyId>/<random-uuid>.<ext>
 *
 * The database keeps the person's ORIGINAL file name (for display and for
 * the download name) plus `storedName` — the random name the file has on
 * disk. The two are deliberately separate:
 *   - two people can upload "invoice.pdf" without overwriting each other;
 *   - a hostile file name like "../../etc/passwd" can never reach the
 *     filesystem, because it is never used as a path;
 *   - replacing a document keeps the old file on disk, so every version in
 *     the history stays downloadable.
 *
 * Everything that touches the disk lives in THIS file, so moving to S3 /
 * R2 / GCS later means rewriting only these functions.
 */

/**
 * The only file types a document upload accepts, keyed by extension. The
 * MIME type we store and later serve is looked up from THIS table — never
 * taken from the browser's claim about the file — so a person can't get an
 * HTML file served back as something else.
 */
export const ALLOWED_FILE_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
  ".txt": "text/plain",
};

/** Types that are safe to display inline in the browser. Everything else is always sent as a download. */
export const INLINE_SAFE_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"]);

export const MAX_UPLOAD_BYTES = env.MAX_UPLOAD_MB * 1024 * 1024;

function uploadRoot() {
  return path.resolve(env.UPLOAD_DIR);
}

function companyDir(companyId: string) {
  return path.join(uploadRoot(), companyId);
}

/**
 * Browsers send multipart file names as UTF-8 bytes, but the multipart
 * parser hands them back decoded as latin1 — so "résumé.pdf" arrives as
 * "rÃ©sumÃ©.pdf". Re-decoding fixes that; if the result isn't valid UTF-8
 * the original was already fine, so we keep it.
 */
function fixEncoding(name: string) {
  const redecoded = Buffer.from(name, "latin1").toString("utf8");
  return redecoded.includes("\uFFFD") ? name : redecoded;
}

/** Strips any folder part, control characters and absurd length from a file name — it is only ever used for DISPLAY, never as a path. */
export function cleanFileName(raw: string) {
  const base = path.basename(fixEncoding(raw).replace(/\\/g, "/"));
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (cleaned.length <= 200) return cleaned || "document";
  const ext = path.extname(cleaned);
  return cleaned.slice(0, 200 - ext.length) + ext;
}

export type ValidatedUpload = {
  buffer: Buffer;
  fileName: string;
  ext: string;
  mimeType: string;
  fileSize: number;
};

/** Checks that a file was really sent and is an allowed type. Throws a friendly 400 otherwise. */
export function validateUpload(file: Express.Multer.File | undefined): ValidatedUpload {
  if (!file) {
    throw new AppError(400, "No file received. Send the file in a multipart form field named \"file\".");
  }
  if (file.size === 0 || file.buffer.length === 0) {
    throw new AppError(400, "That file is empty.");
  }

  const fileName = cleanFileName(file.originalname);
  const ext = path.extname(fileName).toLowerCase();
  const mimeType = ALLOWED_FILE_TYPES[ext];
  if (!mimeType) {
    const allowed = Object.keys(ALLOWED_FILE_TYPES).join(", ");
    throw new AppError(400, `"${ext || "no extension"}" files aren't allowed. Allowed types: ${allowed}.`);
  }

  return { buffer: file.buffer, fileName, ext, mimeType, fileSize: file.size };
}

export type SavedFile = { storedName: string; fileName: string; mimeType: string; fileSize: number };

/** Writes a validated upload to disk under the company's folder and returns what to record in the database. */
export async function saveFile(companyId: string, upload: ValidatedUpload): Promise<SavedFile> {
  const dir = companyDir(companyId);
  await fs.mkdir(dir, { recursive: true });

  const storedName = `${randomUUID()}${upload.ext}`;
  // flag "wx" = fail instead of overwrite, as a last line of defence.
  await fs.writeFile(path.join(dir, storedName), upload.buffer, { flag: "wx" });

  return { storedName, fileName: upload.fileName, mimeType: upload.mimeType, fileSize: upload.fileSize };
}

/** Best-effort delete — a file that's already gone is not an error, and a failed cleanup must never fail the request that triggered it. */
export async function deleteStoredFile(companyId: string, storedName: string | null | undefined) {
  if (!storedName || path.basename(storedName) !== storedName) return;
  try {
    await fs.unlink(path.join(companyDir(companyId), storedName));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`Could not delete stored file ${companyId}/${storedName}:`, err);
    }
  }
}

export async function deleteStoredFiles(files: { companyId: string; storedName: string | null }[]) {
  await Promise.all(files.map((f) => deleteStoredFile(f.companyId, f.storedName)));
}

/**
 * Confirms a stored file is really on disk and returns the folder + name to
 * hand to `res.sendFile`. Throws a friendly 404 if the file has gone missing
 * (e.g. the uploads folder was deleted or the server was moved).
 */
export async function locateStoredFile(companyId: string, storedName: string) {
  if (path.basename(storedName) !== storedName) throw new AppError(404, "File not found.");
  const dir = companyDir(companyId);
  try {
    await fs.access(path.join(dir, storedName));
  } catch {
    throw new AppError(404, "The file for this document is missing on the server. Please upload it again.");
  }
  return { dir, storedName };
}

/** `Content-Disposition` value that survives non-ASCII file names (RFC 6266 / 5987). */
export function contentDisposition(type: "inline" | "attachment", fileName: string) {
  const asciiFallback = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${type}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
