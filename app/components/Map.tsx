"use client";

import { useEffect, useState, useCallback } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  useMap,
  Marker,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pb } from "@/lib/db";
import { useAuth } from "@/app/contexts/AuthContext";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import AuthDialog from "./AuthDialog";

interface MapProps {
  initialCenter: { lat: number; lng: number };
}

function SetViewOnClick({ center }: { center: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], 13);
  }, [map, center]);
  return null;
}

function ZoomButtons() {
  const map = useMapEvents({});

  const handleZoom = useCallback(
    (delta: number) => {
      const currentZoom = map.getZoom();
      map.setZoom(currentZoom + delta);
    },
    [map]
  );

  return (
    <div className="absolute bottom-4 right-4 z-[1001] flex flex-col space-y-2">
      <button
        onClick={() => handleZoom(1)}
        className="bg-white text-gray-700 border-2 border-gray-300 rounded-full w-16 h-16 flex items-center justify-center text-xl shadow-lg hover:bg-blue-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200"
      >
        +
      </button>
      <button
        onClick={() => handleZoom(-1)}
        className="bg-white text-gray-700 border-2 border-gray-300 rounded-full w-16 h-16 flex items-center justify-center text-xl shadow-lg hover:bg-blue-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200"
      >
        -
      </button>
    </div>
  );
}

function TaggingCursor() {
  const map = useMapEvents({});

  useEffect(() => {
    map.getContainer().style.cursor = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 100 100"><text y=".9em" font-size="90">📍</text></svg>') 16 16, auto`;
    return () => {
      map.getContainer().style.cursor = "";
    };
  }, [map]);

  return null;
}

export default function Map({ initialCenter }: MapProps) {
  const { isAuthenticated } = useAuth();
  const [mode, setMode] = useState<"move" | "pin">("move");
  const [center] = useState(initialCenter);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTagForm, setShowTagForm] = useState(false);
  const [tagPosition, setTagPosition] = useState<[number, number] | null>(null);
  const [spotTitle, setSpotTitle] = useState("");
  const [spotDescription, setSpotDescription] = useState("");
  const [spotCategory, setSpotCategory] = useState<string>("");
  const [clickPosition, setClickPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string }>
  >([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const records = await pb.collection("categories").getFullList({
          sort: "name",
        });
        setCategories(
          records.map((record) => ({
            id: record.id,
            name: record.name,
          }))
        );
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };

    fetchCategories();
  }, []);

  const handleModeChange = (newMode: "move" | "pin") => {
    setMode(newMode);
    setShowTagForm(false);
  };

  const handleMapClick = useCallback(
    (e: L.LeafletMouseEvent) => {
      if (mode === "pin") {
        setTagPosition([e.latlng.lat, e.latlng.lng]);
        setClickPosition({
          x: e.originalEvent.clientX,
          y: e.originalEvent.clientY,
        });
        setShowTagForm(true);
      }
    },
    [mode]
  );

  const handleSpotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagPosition) return;

    try {
      const data = {
        name: spotTitle,
        description: spotDescription,
        lat: tagPosition[0],
        lng: tagPosition[1],
        category: spotCategory,
        user: pb.authStore.model?.id,
      };

      await pb.collection("spots").create(data);
      setShowTagForm(false);
      setSpotTitle("");
      setSpotDescription("");
      setSpotCategory("");
    } catch (error) {
      console.error("Failed to create spot:", error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Searching for:", searchQuery);
  };

  return (
    <div className="relative h-full w-full">
      <MapContainer
        className="h-full w-full z-0"
        center={[center.lat, center.lng]}
        zoom={13}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[center.lat, center.lng]} />
        {mode === "move" && <ZoomButtons />}
        {mode === "pin" && <TaggingCursor />}
        <MapEvents onClick={handleMapClick} />
        <MapInteractionController mode={mode} />
      </MapContainer>

      <div className="absolute top-4 left-4 z-10 w-64">
        <form onSubmit={handleSearch} className="flex flex-col gap-2">
          <Input
            type="text"
            placeholder="Search for a location"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white"
          />
          <Button type="submit" className="w-full">
            Search
          </Button>
        </form>
      </div>

      <div className="absolute top-4 right-4 z-10 flex flex-col space-y-3">
        <button
          onClick={() => handleModeChange("move")}
          className={`${
            mode === "move"
              ? "bg-blue-500 text-white"
              : "bg-white text-gray-700"
          } border-2 border-gray-300 rounded-full w-20 h-20 flex items-center justify-center text-3xl shadow-lg hover:bg-blue-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200`}
        >
          ✋
        </button>
        {isAuthenticated ? (
          <button
            onClick={() => handleModeChange("pin")}
            className={`${
              mode === "pin"
                ? "bg-blue-500 text-white"
                : "bg-white text-gray-700"
            } border-2 border-gray-300 rounded-full w-20 h-20 flex items-center justify-center text-3xl shadow-lg hover:bg-blue-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200`}
          >
            📍
          </button>
        ) : (
          <Dialog>
            <DialogTrigger asChild>
              <button className="bg-white text-gray-700 border-2 border-gray-300 rounded-full w-20 h-20 flex items-center justify-center text-3xl shadow-lg hover:bg-blue-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200">
                📍
              </button>
            </DialogTrigger>
            <DialogContent>
              <AuthDialog onClose={() => {}} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {showTagForm && clickPosition && (
        <div
          className={cn(
            "absolute bg-white p-4 rounded-lg shadow-lg z-20 w-80",
            "before:content-[''] before:absolute before:top-full before:left-1/2 before:-translate-x-1/2",
            "before:border-8 before:border-transparent before:border-t-white"
          )}
          style={{
            left: `${clickPosition.x}px`,
            top: `${clickPosition.y - 75}px`,
            transform: "translate(-50%, -100%)",
          }}
        >
          <form onSubmit={handleSpotSubmit} className="space-y-4">
            <Input
              type="text"
              placeholder="Spot Title"
              value={spotTitle}
              onChange={(e) => setSpotTitle(e.target.value)}
              required
            />
            <Textarea
              placeholder="Spot Description"
              value={spotDescription}
              onChange={(e) => setSpotDescription(e.target.value)}
              required
            />
            <Select onValueChange={setSpotCategory} value={spotCategory}>
              <SelectTrigger className="z-30">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent className="z-30">
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-between">
              <Button type="submit">Save Spot</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowTagForm(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function MapEvents({ onClick }: { onClick: (e: L.LeafletMouseEvent) => void }) {
  useMapEvents({
    click: onClick,
  });
  return null;
}

function MapInteractionController({ mode }: { mode: "move" | "pin" }) {
  const map = useMap();

  useEffect(() => {
    if (mode === "move") {
      map.dragging.enable();
      map.touchZoom.enable();
      map.doubleClickZoom.enable();
      map.scrollWheelZoom.enable();
      map.boxZoom.enable();
      map.keyboard.enable();
    } else {
      map.dragging.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      map.scrollWheelZoom.disable();
      map.boxZoom.disable();
      map.keyboard.disable();
    }
  }, [map, mode]);

  return null;
}
