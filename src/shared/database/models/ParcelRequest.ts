import { ParcelRequestItem } from "./ParcelRequestItem";

export class ParcelRequest {
  id!: number; 
  parcelRequestItems!: ParcelRequestItem[];

  constructor(id: number, parcelRequestItems: ParcelRequestItem[]) {
    this.id = id;
    this.parcelRequestItems = parcelRequestItems;
  }
}
