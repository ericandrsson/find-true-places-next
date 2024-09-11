import PocketBase from "pocketbase";

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL || "");
