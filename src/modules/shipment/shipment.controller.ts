import type { Request, Response } from "express";
import { createShipmentSchema, updateShipmentSchema, updateShipmentStatusSchema } from "./shipment.schema.js";
import {
  createShipment,
  listShipmentsByCompany,
  listShipmentsForTransaction,
  getShipment,
  updateShipment,
  updateShipmentStatus,
  deleteShipment,
} from "./shipment.service.js";
import { AppError } from "../../middleware/errorHandler.js";

export async function create(req: Request, res: Response) {
  const input = createShipmentSchema.parse(req.body);
  const shipment = await createShipment(req.params.companyId as string, input);
  res.status(201).json(shipment);
}

export async function list(req: Request, res: Response) {
  const rows = await listShipmentsByCompany(req.params.companyId as string);
  res.status(200).json(rows);
}

export async function listForTransaction(req: Request, res: Response) {
  const type = req.query.type as string;
  if (type !== "invoice" && type !== "bill") throw new AppError(400, "?type must be 'invoice' or 'bill'.");
  const rows = await listShipmentsForTransaction(type, req.params.transactionId as string);
  res.status(200).json(rows);
}

export async function getOne(req: Request, res: Response) {
  const shipment = await getShipment(req.params.id as string);
  res.status(200).json(shipment);
}

export async function update(req: Request, res: Response) {
  const input = updateShipmentSchema.parse(req.body);
  const shipment = await updateShipment(req.params.id as string, input);
  res.status(200).json(shipment);
}

export async function updateStatus(req: Request, res: Response) {
  const { status, note, location } = updateShipmentStatusSchema.parse(req.body);
  const shipment = await updateShipmentStatus(req.params.id as string, status, note, location);
  res.status(200).json(shipment);
}

export async function remove(req: Request, res: Response) {
  const result = await deleteShipment(req.params.id as string);
  res.status(200).json(result);
}
