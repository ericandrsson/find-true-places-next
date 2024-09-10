import PocketBase from "pocketbase";

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export const pb = new PocketBase("http://127.0.0.1:8090"); // Ensure this URL is correct
