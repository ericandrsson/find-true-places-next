"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
  Marker,
  Popup,
} from "react-leaflet";
import L from "leaflet";
import debounce from "lodash/debounce";
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
import { formatDistanceToNow } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash2, Edit, ChevronRight, ChevronLeft, List } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import MarkerClusterGroup from "react-leaflet-cluster";
import "react-leaflet-cluster/lib/assets/MarkerCluster.css";
import "react-leaflet-cluster/lib/assets/MarkerCluster.Default.css";

const MIN_ZOOM = 6; // 1 is most zoomed in (street level)
const MAX_ZOOM = 18; // 10 is most zoomed out (world level)

interface MapProps {
  initialCenter: { lat: number; lng: number };
}

interface Category {
  id: string;
  name: string;
  icon: string;
  parent_spot_category?: string;
}

interface Spot {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  category: string;
  user: string;
  isPublic: boolean;
  created: string;
}

interface DynamicMarkersProps {
  spots: Spot[];
  categories: Category[];
  handleSpotDelete: (spotId: string) => Promise<void>;
  handleSpotUpdate: (spotId: string, isPublic: boolean) => Promise<void>;
  user: { id: string } | null;
  isAdmin: boolean;
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
      const newZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, currentZoom + delta)
      );
      map.setZoom(newZoom);
    },
    [map]
  );

  return (
    <div
      className={`absolute bottom-4 right-4 z-[1001] flex flex-col space-y-2 transition-all duration-300 ease-in-out ${
        showListView ? "mr-80" : ""
      }`}
    >
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
}: DynamicMarkersProps) {
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
    (spot: Spot) => {
      const category = categories.find((c: Category) => c.id === spot.category);
      const icon = category ? category.icon : "📍";
      const timeAgo = formatDistanceToNow(new Date(spot.created), {
        addSuffix: true,
      });

      const baseSize = 24;
      const minZoom = 10;
      const maxZoom = 18;
      const zoomFactor = Math.max(0, (zoom - minZoom) / (maxZoom - minZoom));
      const sizeMultiplier = 1 + zoomFactor * 2;
      const size = Math.round(baseSize * sizeMultiplier);
      const fontSize = Math.max(10, Math.round(14 * sizeMultiplier));

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
    <MarkerClusterGroup
      chunkedLoading
      spiderfyOnMaxZoom={true}
      showCoverageOnHover={false}
      maxClusterRadius={50}
      iconCreateFunction={(cluster: L.MarkerClusterGroup) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div class="cluster-icon">${count}</div>`,
          className: "custom-cluster-icon",
          iconSize: L.point(40, 40),
        });
      }}
    >
      {spots.map((spot: Spot) => (
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
    </MarkerClusterGroup>
  );
}

export default function Map({ initialCenter }: MapProps) {
  const { user, isAdmin } = useAuth();
  const [mode, setMode] = useState<"move" | "pin">("move");
  const [center, setCenter] = useState(initialCenter);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTagForm, setShowTagForm] = useState(false);
  const [tagPosition, setTagPosition] = useState<[number, number] | null>(null);
  const [spotTitle, setSpotTitle] = useState("");
  const [spotDescription, setSpotDescription] = useState("");
  const [clickPosition, setClickPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string[]>([]);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [showListView, setShowListView] = useState(false);
  const [userSpots, setUserSpots] = useState<Spot[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mapZoom, setMapZoom] = useState(13);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const zoom = searchParams.get("zoom");
    if (lat && lng && zoom) {
      setCenter({ lat: parseFloat(lat), lng: parseFloat(lng) });
      setMapZoom(parseInt(zoom));
    }
  }, [searchParams]);

  const fetchSpots = useCallback(
    async (bounds: L.LatLngBounds) => {
      try {
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const center = bounds.getCenter();
        const radius = bounds.getNorthEast().distanceTo(center) / 1000; // km

        let filter = `lat >= ${sw.lat} && lat <= ${ne.lat} && lng >= ${sw.lng} && lng <= ${ne.lng}`;

        if (!isAdmin) {
          filter += ` && (isPublic = true || user = "${user?.id}")`;
        }

        const result = await pb.collection("spots").getList<Spot>(1, 1000, {
          filter: filter,
          sort: "-created",
        });

        const filteredSpots = result.items.filter((spot: any) => {
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

  const debouncedFetchSpots = useMemo(
    () =>
      debounce((bounds: L.LatLngBounds) => {
        fetchSpots(bounds);
      }, 300),
    [fetchSpots]
  );

  const handleMapMove = useCallback(() => {
    if (mapRef.current) {
      debouncedFetchSpots(mapRef.current.getBounds());
    }
  }, [debouncedFetchSpots]);

  function MapEventHandler() {
    const map = useMapEvents({
      moveend: handleMapMove,
      zoomend: handleMapMove,
    });

    useEffect(() => {
      mapRef.current = map;
    }, [map]);

    return null;
  }

  const handleSetCurrentLocation = useCallback(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          if (mapRef.current) {
            const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, 13));
            mapRef.current.setView([latitude, longitude], newZoom);
          }
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    } else {
      console.error("Geolocation is not supported by this browser.");
    }
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const result = await pb
          .collection("spot_categories")
          .getFullList<Category>();
        setCategories(result);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCategories();
  }, []);

  const getChildCategories = (parentId: string | null) => {
    return categories.filter(
      (category) => category.parent_spot_category === parentId
    );
  };

  const handleCategorySelect = (categoryId: string, level: number) => {
    setSelectedCategory((prev) => {
      const newSelection = [...prev.slice(0, level), categoryId];
      return newSelection.length > 3 ? newSelection.slice(-3) : newSelection;
    });
  };

  const renderCategorySelection = () => {
    const rootCategories = categories.filter(
      (category) => !category.parent_spot_category
    );

    return (
      <div className="space-y-4">
        <Select
          onValueChange={(value) => handleCategorySelect(value, 0)}
          value={selectedCategory[0] || ""}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select main category" />
          </SelectTrigger>
          <SelectContent>
            {rootCategories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                <span className="mr-2">{category.icon}</span>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedCategory[0] && (
          <Select
            onValueChange={(value) => handleCategorySelect(value, 1)}
            value={selectedCategory[1] || ""}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select sub-category" />
            </SelectTrigger>
            <SelectContent>
              {getChildCategories(selectedCategory[0]).map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  <span className="mr-2">{category.icon}</span>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {selectedCategory[1] && (
          <Select
            onValueChange={(value) => handleCategorySelect(value, 2)}
            value={selectedCategory[2] || ""}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select sub-sub-category" />
            </SelectTrigger>
            <SelectContent>
              {getChildCategories(selectedCategory[1]).map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  <span className="mr-2">{category.icon}</span>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    );
  };

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
      const spotData = {
        name: spotTitle,
        description: spotDescription,
        lat: tagPosition[0],
        lng: tagPosition[1],
        category: selectedCategory[selectedCategory.length - 1], // Use the last selected category
        user: user?.id,
        isPublic: isPublic,
      };

      const createdSpot = await pb.collection("spots").create(spotData);
      setSpots((prevSpots) => [...prevSpots, createdSpot]);
      setShowTagForm(false);
      setSpotTitle("");
      setSpotDescription("");
      setSelectedCategory([]);
      setIsPublic(true);
    } catch (error) {
      console.error("Error creating spot:", error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Searching for:", searchQuery);
  };

  useEffect(() => {
    const initialBounds = L.latLngBounds(
      L.latLng(center.lat - 0.1, center.lng - 0.1),
      L.latLng(center.lat + 0.1, center.lng + 0.1)
    );
    fetchSpots(initialBounds);
  }, [center, fetchSpots]);

  const handleSpotUpdate = async (spotId: string, isPublic: boolean) => {
    try {
      await pb.collection("spots").update(spotId, { isPublic });
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
      setSpots(spots.filter((spot) => spot.id !== spotId));
    } catch (error) {
      console.error("Failed to delete spot:", error);
    }
  };

  useEffect(() => {
    const fetchUserSpots = async () => {
      if (user) {
        try {
          const result = await pb.collection("spots").getList<Spot>(1, 50, {
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

  const handleSpotClick = useCallback((spot: Spot) => {
    if (mapRef.current) {
      mapRef.current.setView([spot.lat, spot.lng], 15);
    }
    setShowListView(false);
  }, []);

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
          width: 150px;
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
          white-space: normal;
          word-wrap: break-word;
          max-width: 150px;
          line-height: 1.2;
          margin-top: 2px;
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

        .custom-cluster-icon {
          background-color: #3b82f6;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 14px;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3);
        }

        .cluster-icon {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>

      <div
        className={`transition-all duration-300 ease-in-out ${
          showListView ? "mr-80" : ""
        }`}
      >
        <MapContainer
          className="h-full w-full z-0"
          center={[center.lat, center.lng]}
          zoom={mapZoom}
          zoomControl={false}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
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
          <MapEventHandler />
        </MapContainer>
      </div>

      <div
        className={`absolute top-4 right-4 z-10 flex flex-col space-y-3 transition-all duration-300 ease-in-out ${
          showListView ? "mr-80" : ""
        }`}
      >
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
                  showListView
                    ? "bg-blue-500 text-white"
                    : "bg-white text-gray-700"
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

      {showTagForm && clickPosition && (
        <div
          className={cn(
            "absolute bg-white p-4 rounded-lg shadow-lg z-20 w-80",
            "before:content-[''] before:absolute before:top-full before:left-1/2 before:-translate-x-1/2",
            "before:border-8 before:border-transparent before:border-t-white",
            showListView ? "mr-80" : ""
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
            {/* Category Selection */}
            <div className="space-y-2">
              <Label>Category</Label>
              {renderCategorySelection()}
            </div>
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
                  setSelectedCategory([]);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="absolute bottom-4 left-4 z-[1001]">
        <button
          onClick={handleSetCurrentLocation}
          className="bg-white text-gray-700 border-2 border-gray-300 rounded-full w-16 h-16 flex items-center justify-center text-xl shadow-lg hover:bg-blue-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors duration-200"
        >
          📍
        </button>
      </div>

      {/* Add the sidebar */}
      <div
        className={`absolute top-0 right-0 h-full w-80 bg-white shadow-lg z-[1002] transition-transform duration-300 ease-in-out ${
          showListView
            ? "transform translate-x-0"
            : "transform translate-x-full"
        }`}
      >
        <div className="p-4">
          <h2 className="text-2xl font-bold mb-4">Your Spots</h2>
          <ScrollArea className="h-[calc(100vh-8rem)]">
            {userSpots.map((spot) => (
              <div
                key={spot.id}
                className="mb-4 p-3 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors duration-200"
                onClick={() => handleSpotClick(spot)}
              >
                <h3 className="font-bold text-lg">{spot.name}</h3>
                <p className="text-sm text-gray-600">{spot.description}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDistanceToNow(new Date(spot.created), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            ))}
          </ScrollArea>
        </div>
      </div>
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
