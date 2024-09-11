export interface Spot {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  category: string;
  isPublic: boolean;
  created: string;
  user: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface Tag {
  id: string;
  name: string;
  icon: string;
}