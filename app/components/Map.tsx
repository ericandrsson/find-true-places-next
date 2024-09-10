"use client";

import { useEffect, useState, useCallback, useRef, useContext } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash2, Edit, ChevronRight, ChevronLeft, List } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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

function ZoomButtons({ showListView }: { showListView: boolean }) {
  const map = useMapEvents({});

  const handleZoom = useCallback(
    (delta: number) => {
      const currentZoom = map.getZoom();
      map.setZoom(currentZoom + delta);
    },
    [map]
  );

  return (
    <div className={`absolute bottom-4 right-4 z-[1001] flex flex-col space-y-2 transition-all duration-300 ease-in-out ${
      showListView ? 'mr-80' : ''
    }`}>
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

function DynamicMarkers({
  spots,
  categories,
  handleSpotDelete,
  handleSpotUpdate,
  user,
  isAdmin,
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const updateZoom = () => {
      setZoom(map.getZoom());
    };

    map.on("zoomend", updateZoom);

    return () => {
      map.off("zoomend", updateZoom);
    };
  }, [map]);

  const getSpotIcon = useCallback(
    (spot: any) => {
      const category = categories.find((c) => c.id === spot.category);
      const icon = category ? category.icon : "📍";
      const timeAgo = formatDistanceToNow(new Date(spot.created), {
        addSuffix: true,
      });

      // Adjust size based on zoom level
      const baseSize = 24; // Base size in pixels
      const minZoom = 10; // Minimum zoom level
      const maxZoom = 18; // Maximum zoom level
      const zoomFactor = Math.max(0, (zoom - minZoom) / (maxZoom - minZoom));
      const sizeMultiplier = 1 + zoomFactor * 2; // Increase size up to 3x at max zoom
      const size = Math.round(baseSize * sizeMultiplier);
      const fontSize = Math.max(10, Math.round(14 * sizeMultiplier)); // Minimum font size of 10px

      return L.divIcon({
        html: `
          <div class="spot-marker" style="font-size: ${fontSize}px;">
            <span class="spot-icon" style="font-size: ${size}px;">${icon}</span>
            <div class="spot-text">
              <span class="spot-title">${spot.name}</span>
              <span class="spot-time">${timeAgo}</span>
            </div>
          </div>
        `,
        className: "custom-div-icon",
        iconSize: [size * 1.5, size * 1.5],
        iconAnchor: [size * 0.75, size * 1.5],
      });
    },
    [categories, zoom]
  );

  return (
    <>
      {spots.map((spot) => (
        <Marker
          key={spot.id}
          position={[spot.lat, spot.lng]}
          icon={getSpotIcon(spot)}
        >
          <Popup className="custom-popup">
            <div className="p-4 bg-white rounded-lg shadow-lg w-64">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-nunito font-extrabold text-xl text-blue-600">
                  {spot.name}
                </h3>
                {(isAdmin || user?.id === spot.user) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSpotDelete(spot.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    ❌
                  </Button>
                )}
              </div>
              <p className="font-nunito text-sm text-gray-700 mb-3">
                {spot.description}
              </p>
              {spot.category && (
                <div className="flex items-center mb-3">
                  <span className="text-2xl mr-2">
                    {categories.find((c) => c.id === spot.category)?.icon ||
                      "📍"}
                  </span>
                  <span className="font-nunito font-semibold text-sm text-purple-600">
                    {categories.find((c) => c.id === spot.category)?.name ||
                      spot.category}
                  </span>
                </div>
              )}
              <div className="text-xs text-gray-500 mb-3">
                Added by: {spot.user === user?.id ? "You" : "Another user"}
              </div>
              {(isAdmin || user?.id === spot.user) && (
                <div className="flex items-center space-x-2">
                  <Switch
                    id={`public-switch-${spot.id}`}
                    checked={spot.isPublic}
                    onCheckedChange={(checked) =>
                      handleSpotUpdate(spot.id, checked)
                    }
                  />
                  <Label
                    htmlFor={`public-switch-${spot.id}`}
                    className="text-sm"
                  >
                    {spot.isPublic ? "Public" : "Private"}
                  </Label>
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

export default function Map({ initialCenter }: MapProps) {
  const { user, isAdmin } = useAuth();
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
  const [isPublic, setIsPublic] = useState(true);
  const [showListView, setShowListView] = useState(false);
  const [userSpots, setUserSpots] = useState<Array<any>>([]);

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
        isPublic: isPublic,
      };

      const newSpot = await pb.collection("spots").create(data);
      setShowTagForm(false);
      setSpotTitle("");
      setSpotDescription("");
      setSpotCategory("");
      setIsPublic(true);

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

  const fetchSpots = useCallback(
    async (bounds: L.LatLngBounds) => {
      try {
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const center = bounds.getCenter();
        const radius = bounds.getNorthEast().distanceTo(center) / 1000; // km

        let filter = `lat >= ${sw.lat} && lat <= ${ne.lat} && lng >= ${sw.lng} && lng <= ${ne.lng}`;

        // If the user is not an admin, only fetch public spots or spots owned by the user
        if (!isAdmin) {
          filter += ` && (isPublic = true || user = "${user?.id}")`;
        }

        const result = await pb.collection("spots").getList(1, 1000, {
          filter: filter,
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
    },
    [isAdmin, user]
  );

  const fetchSpotsRef = useRef(debounce(fetchSpots, 300));

  useEffect(() => {
    // Fetch spots on initial load
    const initialBounds = L.latLngBounds(
      L.latLng(center.lat - 0.1, center.lng - 0.1),
      L.latLng(center.lat + 0.1, center.lng + 0.1)
    );
    fetchSpots(initialBounds);
  }, [center, fetchSpots]);

  // Add a ref for the map
  const mapRef = useRef<L.Map | null>(null);

  const handleSpotUpdate = async (spotId: string, isPublic: boolean) => {
    try {
      await pb.collection("spots").update(spotId, { isPublic });
      // Update the local state to reflect the change
      setSpots(
        spots.map((spot) => (spot.id === spotId ? { ...spot, isPublic } : spot))
      );
    } catch (error) {
      console.error("Failed to update spot:", error);
    }
  };

  const handleSpotDelete = async (spotId: string) => {
    try {
      await pb.collection("spots").delete(spotId);
      // Remove the deleted spot from the local state
      setSpots(spots.filter((spot) => spot.id !== spotId));
    } catch (error) {
      console.error("Failed to delete spot:", error);
    }
  };

  useEffect(() => {
    const fetchUserSpots = async () => {
      if (user) {
        try {
          const result = await pb.collection("spots").getList(1, 50, {
            filter: `user = "${user.id}"`,
            sort: "-created",
          });
          setUserSpots(result.items);
        } catch (error) {
          console.error("Error fetching user spots:", error);
        }
      }
    };

    fetchUserSpots();
  }, [user]);

  const handleListViewToggle = () => {
    setShowListView(!showListView);
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
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
          width: 150px; /* Set a fixed width */
        }
        .spot-title {
          font-family: "Nunito", sans-serif;
          font-size: 16px;
          font-weight: 800;
          color: #3b82f6;
          text-align: center;
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-shadow: 2px 0 0 #fff, -2px 0 0 #fff, 0 2px 0 #fff, 0 -2px 0 #fff,
            1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff;
        }
        .spot-time {
          font-family: "Nunito", sans-serif;
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-align: center;
          white-space: normal; /* Allow wrapping */
          word-wrap: break-word; /* Break long words if necessary */
          max-width: 150px; /* Match the width of spot-text */
          line-height: 1.2; /* Adjust line height for better readability */
          margin-top: 2px; /* Add a small gap between title and time */
          text-shadow: 1px 0 0 #fff, -1px 0 0 #fff, 0 1px 0 #fff, 0 -1px 0 #fff,
            0.5px 0.5px 0 #fff, -0.5px -0.5px 0 #fff, 0.5px -0.5px 0 #fff,
            -0.5px 0.5px 0 #fff;
        }

        .leaflet-popup-content-wrapper {
          background: transparent;
          box-shadow: none;
        }
        .leaflet-popup-content {
          margin: 0;
          width: auto !important;
        }
        .leaflet-popup-tip-container {
          display: none;
        }

        .custom-div-icon {
          background: none;
          border: none;
        }

        .leaflet-container {
          height: 100% !important;
          width: 100% !important;
          position: absolute !important;
        }
      `}</style>
      
      <div 
        className={`transition-all duration-300 ease-in-out ${
          showListView ? 'mr-80' : ''
        }`}
      >
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
          <DynamicMarkers
            spots={spots}
            categories={categories}
            handleSpotDelete={handleSpotDelete}
            handleSpotUpdate={handleSpotUpdate}
            user={user}
            isAdmin={isAdmin}
          />
          {mode === "move" && <ZoomButtons showListView={showListView} />}
          {mode === "pin" && <TaggingCursor />}
          <MapEvents onClick={handleMapClick} />
          <MapInteractionController mode={mode} />
        </MapContainer>
      </div>

      <div className={`absolute top-4 right-4 z-10 flex flex-col space-y-3 transition-all duration-300 ease-in-out ${
        showListView ? 'mr-80' : ''
      }`}>
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
        {user ? (
          <>
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
            <button
              onClick={handleListViewToggle}
              className={`
                ${
                  showListView ? "bg-blue-500 text-white" : "bg-white text-gray-700"
                }
                border-2 border-gray-300 rounded-full w-20 h-20 flex items-center justify-center text-3xl shadow-lg
                hover:bg-blue-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
                transition-colors duration-200
              `}
            >
              <List size={32} />
            </button>
          </>
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

      {/* List View Sidebar */}
      <div
        className={`
          absolute top-0 right-0 h-full w-80 bg-white shadow-lg z-20
          transform transition-all duration-300 ease-in-out
          ${showListView ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="h-full flex flex-col">
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="text-xl font-bold">Your Spots</h2>
            <button
              onClick={handleListViewToggle}
              className="text-gray-500 hover:text-gray-700"
            >
              <ChevronRight size={24} />
            </button>
          </div>
          <ScrollArea className="flex-grow">
            <div className="p-4">
              {userSpots.map((spot) => (
                <div
                  key={spot.id}
                  className="mb-4 p-3 bg-gray-100 rounded-lg"
                >
                  <h3 className="font-semibold">{spot.name}</h3>
                  <p className="text-sm text-gray-600">{spot.description}</p>
                  <button
                    onClick={() => {
                      if (mapRef.current) {
                        mapRef.current.setView([spot.lat, spot.lng], 15);
                      }
                      setShowListView(false);
                    }}
                    className="mt-2 text-blue-500 hover:text-blue-700 text-sm"
                  >
                    View on map
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {showTagForm && clickPosition && (
        <div
          className={cn(
            "absolute bg-white p-4 rounded-lg shadow-lg z-20 w-80",
            "before:content-[''] before:absolute before:top-full before:left-1/2 before:-translate-x-1/2",
            "before:border-8 before:border-transparent before:border-t-white",
            showListView ? 'mr-80' : ''
          )}
          style={{
            left: `${clickPosition.x}px`,
            top: `${clickPosition.y - 75}px`,
            transform: 'translate(-50%, -100%)',
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
            <div className="flex items-center space-x-2">
              <Switch
                id="public-switch"
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
              <Label htmlFor="public-switch">
                {isPublic ? "Public" : "Private"}
              </Label>
            </div>
            <div className="flex justify-between">
              <Button type="submit">Save Spot</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowTagForm(false);
                  setIsPublic(true);
                }}
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
