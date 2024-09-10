"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  useMap,
  Marker,
  useMapEvents,
  Popup,
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
import { haversineDistance } from "@/lib/utils";
import debounce from "lodash/debounce";
import { formatDistanceToNow } from "date-fns";

interface MapProps {
  initialCenter: { lat: number; lng: number };
}

interface Category {
  id: string;
  name: string;
  icon: string;
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [spots, setSpots] = useState<Array<any>>([]);

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
            icon: record.icon,
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

      const newSpot = await pb.collection("spots").create(data);
      setShowTagForm(false);
      setSpotTitle("");
      setSpotDescription("");
      setSpotCategory("");

      // Update the spots state with the new spot
      setSpots((prevSpots) => [...prevSpots, newSpot]);

      // Re-center the map on the new spot
      if (mapRef.current) {
        mapRef.current.setView([newSpot.lat, newSpot.lng], 13);
      }
    } catch (error) {
      console.error("Failed to create spot:", error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Searching for:", searchQuery);
  };

  const fetchSpots = useCallback(async (bounds: L.LatLngBounds) => {
    try {
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const center = bounds.getCenter();
      const radius = bounds.getNorthEast().distanceTo(center) / 1000; // km

      const result = await pb.collection("spots").getList(1, 1000, {
        filter: `lat >= ${sw.lat} && lat <= ${ne.lat} && lng >= ${sw.lng} && lng <= ${ne.lng}`,
        sort: "-created",
      });

      const filteredSpots = result.items.filter((spot) => {
        const distance = haversineDistance(
          center.lat,
          center.lng,
          spot.lat,
          spot.lng
        );
        return distance <= radius;
      });

      setSpots(filteredSpots);
    } catch (error) {
      console.error("Error fetching spots:", error);
    }
  }, []);

  const fetchSpotsRef = useRef(debounce(fetchSpots, 300));

  useEffect(() => {
    // Fetch spots on initial load
    const initialBounds = L.latLngBounds(
      L.latLng(center.lat - 0.1, center.lng - 0.1),
      L.latLng(center.lat + 0.1, center.lng + 0.1)
    );
    fetchSpots(initialBounds);
  }, [center, fetchSpots]);

  // Create a function to get the icon for a spot
  const getSpotIcon = useCallback(
    (spot: any) => {
      const category = categories.find((c) => c.id === spot.category);
      const icon = category ? category.icon : "📍";
      const timeAgo = formatDistanceToNow(new Date(spot.created), {
        addSuffix: true,
      });

      return L.divIcon({
        html: `
          <div class="spot-marker">
            <span class="spot-icon">${icon}</span>
            <div class="spot-text">
              <span class="spot-title">${spot.name}</span>
              <span class="spot-time">${timeAgo}</span>
            </div>
          </div>
        `,
        className: "custom-div-icon",
        iconSize: [200, 80],
        iconAnchor: [100, 80],
      });
    },
    [categories]
  );

  // Add a ref for the map
  const mapRef = useRef<L.Map | null>(null);

  return (
    <div className="relative h-full w-full">
      <style jsx global>{`
        .spot-marker {
          display: flex;
          flex-direction: column;
          align-items: center;
          transition: all 0.3s ease;
        }
        .spot-marker:hover {
          transform: scale(1.05);
        }
        .spot-icon {
          font-size: 48px;
          filter: drop-shadow(0 4px 3px rgba(0, 0, 0, 0.4));
        }
        .spot-text {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-top: -5px;
        }
        .spot-title {
          font-family: 'Nunito', sans-serif;
          font-size: 16px;
          font-weight: 800;
          color: #3b82f6;
          text-align: center;
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-shadow: 
            2px 0 0 #fff, -2px 0 0 #fff, 0 2px 0 #fff, 0 -2px 0 #fff,
            1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff;
        }
        .spot-time {
          font-family: 'Nunito', sans-serif;
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-align: center;
          text-shadow: 
            1px 0 0 #fff, -1px 0 0 #fff, 0 1px 0 #fff, 0 -1px 0 #fff,
            0.5px 0.5px 0 #fff, -0.5px -0.5px 0 #fff, 0.5px -0.5px 0 #fff, -0.5px 0.5px 0 #fff;
        }
      `}</style>
      <MapContainer
        className="h-full w-full z-0"
        center={[center.lat, center.lng]}
        zoom={13}
        zoomControl={false}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {spots.map((spot) => (
          <Marker
            key={spot.id}
            position={[spot.lat, spot.lng]}
            icon={getSpotIcon(spot)}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-bold text-lg">{spot.name}</h3>
                <p className="text-sm text-gray-600">{spot.description}</p>
                {spot.category && (
                  <p className="text-xs text-blue-500 mt-1">
                    Category:{" "}
                    <span
                      style={{ fontSize: "1.2em", verticalAlign: "middle" }}
                    >
                      {categories.find((c) => c.id === spot.category)?.icon ||
                        "📍"}
                    </span>{" "}
                    {categories.find((c) => c.id === spot.category)?.name ||
                      spot.category}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
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
                    <span
                      className="mr-2 text-xl"
                      style={{
                        display: "inline-block",
                        width: "1.5em",
                        textAlign: "center",
                      }}
                    >
                      {category.icon}
                    </span>
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
