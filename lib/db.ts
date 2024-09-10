import PocketBase from "pocketbase";

export const pb = new PocketBase("http://127.0.0.1:8090"); // Replace with your PocketBase URL

export async function createSpot(spotData: {
  name: string;
  description: string;
  lat: number;
  lng: number;
  category: string;
}) {
  try {
    const record = await pb.collection("spots").create(spotData);
    return record;
  } catch (error) {
    console.error("Error creating spot:", error);
    throw error;
  }
}

export async function getCategories() {
  try {
    const records = await pb.collection("category").getFullList<{id: string, name: string}>({
      sort: 'name',
    });
    return records;
  } catch (error) {
    console.error("Error fetching categories:", error);
    throw error;
  }
}
