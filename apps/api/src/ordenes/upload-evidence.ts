import { PutObjectCommand, S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import { createId } from "@paralleldrive/cuid2";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { assetTable } from "../database/schema";
import {
  getFileExtension,
  isImageContentType,
  parseBoolean,
  resolveS3Credentials,
  sanitizePathSegment,
} from "../storage/s3";
import { resolveFileSecret } from "../utils/file-secret";

export const MAX_EVIDENCE_UPLOAD_BYTES = 15 * 1024 * 1024;

const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "application/rtf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "text/csv",
  "application/csv",
  "application/json",
  "text/json",
]);

const EXTENSION_MIME_FALLBACK: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  rtf: "application/rtf",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  json: "application/json",
};

type EvidenceS3Config = {
  endpoint: string;
  region: string;
  bucket: string;
  credentials?: { accessKeyId: string; secretAccessKey: string };
  forcePathStyle: boolean;
  keyPrefix: string;
};

function getEvidenceS3Config(): EvidenceS3Config {
  const endpoint = process.env.S3_ENDPOINT?.trim() || "";
  const bucket = process.env.S3_BUCKET?.trim() || "";
  if (!endpoint || !bucket) {
    throw new HTTPException(503, {
      message: "El almacenamiento de evidencias (S3) no está configurado.",
    });
  }

  let accessKeyId = "";
  let secretAccessKey = "";
  try {
    accessKeyId = resolveFileSecret("S3_ACCESS_KEY_ID")?.trim() || "";
    secretAccessKey = resolveFileSecret("S3_SECRET_ACCESS_KEY")?.trim() || "";
  } catch {
    throw new HTTPException(503, {
      message: "Las credenciales de almacenamiento S3 no están disponibles.",
    });
  }

  let credentials: { accessKeyId: string; secretAccessKey: string } | undefined;
  try {
    credentials = resolveS3Credentials(accessKeyId, secretAccessKey);
  } catch {
    throw new HTTPException(503, {
      message: "Configuración de credenciales S3 incompleta.",
    });
  }

  return {
    endpoint,
    region: process.env.S3_REGION?.trim() || "us-east-1",
    bucket,
    credentials,
    forcePathStyle: parseBoolean(process.env.S3_FORCE_PATH_STYLE, true),
    keyPrefix: process.env.S3_KEY_PREFIX?.trim() || "",
  };
}

function resolveEvidenceMimeType(file: File): string {
  const declared =
    (file.type || "").toLowerCase().split(";")[0]?.trim() || "";
  if (isImageContentType(declared) || ALLOWED_DOCUMENT_MIME_TYPES.has(declared)) {
    return declared;
  }

  if (declared === "" || declared === "application/octet-stream") {
    const ext = getFileExtension(file.name);
    const inferred = EXTENSION_MIME_FALLBACK[ext];
    if (inferred) {
      return inferred;
    }
  }

  throw new HTTPException(400, {
    message:
      "Formato de evidencia no permitido. Usa imágenes, PDF, documentos Office, texto, Markdown, CSV o JSON.",
  });
}

function buildEvidenceObjectKey(params: {
  keyPrefix: string;
  workspaceId: string;
  projectId: string;
  taskId: string;
  filename: string;
}): string {
  const ext = getFileExtension(params.filename);
  const baseName = sanitizePathSegment(
    params.filename.replace(/\.[^/.]+$/, "") || "evidencia",
  ).slice(0, 64);
  const fileName = ext
    ? `${baseName}-${Date.now()}-${createId()}.${ext}`
    : `${baseName}-${Date.now()}-${createId()}`;

  const segments = [
    ...(params.keyPrefix ? [params.keyPrefix.replace(/\/+$/, "")] : []),
    "workspace",
    sanitizePathSegment(params.workspaceId),
    "project",
    sanitizePathSegment(params.projectId),
    "task",
    sanitizePathSegment(params.taskId),
    "evidence",
    fileName,
  ];
  return segments.join("/");
}

export async function uploadEvidenceFile(params: {
  file: File;
  workspaceId: string;
  projectId: string;
  taskId: string;
  userId: string;
}) {
  const { file, workspaceId, projectId, taskId, userId } = params;

  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new HTTPException(400, {
      message: "El archivo de evidencia está vacío.",
    });
  }

  if (file.size > MAX_EVIDENCE_UPLOAD_BYTES) {
    throw new HTTPException(400, {
      message: "El archivo de evidencia supera el máximo permitido de 15 MB.",
    });
  }

  const mimeType = resolveEvidenceMimeType(file);
  const s3Config = getEvidenceS3Config();
  const filename = file.name?.trim() || "evidencia";
  const objectKey = buildEvidenceObjectKey({
    keyPrefix: s3Config.keyPrefix,
    workspaceId,
    projectId,
    taskId,
    filename,
  });

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength === 0) {
    throw new HTTPException(400, {
      message: "El archivo de evidencia está vacío.",
    });
  }
  if (buffer.byteLength > MAX_EVIDENCE_UPLOAD_BYTES) {
    throw new HTTPException(400, {
      message: "El archivo de evidencia supera el máximo permitido de 15 MB.",
    });
  }

  const clientConfig: S3ClientConfig = {
    endpoint: s3Config.endpoint,
    region: s3Config.region,
    forcePathStyle: s3Config.forcePathStyle,
    requestChecksumCalculation: "WHEN_REQUIRED",
    ...(s3Config.credentials ? { credentials: s3Config.credentials } : {}),
  };

  const client = new S3Client(clientConfig);

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: s3Config.bucket,
        Key: objectKey,
        Body: buffer,
        ContentType: mimeType,
        ContentLength: buffer.byteLength,
      }),
    );
  } catch (error) {
    console.error("Failed to upload order evidence to S3:", error);
    throw new HTTPException(503, {
      message: "No se pudo subir el archivo de evidencia al almacenamiento.",
    });
  }

  const [asset] = await db
    .insert(assetTable)
    .values({
      workspaceId,
      projectId,
      taskId,
      objectKey,
      filename,
      mimeType,
      size: buffer.byteLength,
      kind: isImageContentType(mimeType) ? "image" : "attachment",
      surface: "evidence",
      createdBy: userId,
    })
    .returning();

  if (!asset) {
    throw new HTTPException(500, {
      message: "No se pudo registrar el archivo de evidencia.",
    });
  }

  return {
    assetId: asset.id,
    filename: asset.filename,
    mimeType: asset.mimeType,
    size: asset.size,
    url: `/api/asset/${asset.id}`,
  };
}
