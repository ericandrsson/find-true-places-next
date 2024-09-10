"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useCallback, useRef, useEffect } from "react";

// Update the Modal component
const Modal = ({ content, position }) => (
  <div
    className="absolute bg-white text-black p-4 rounded-lg shadow-lg"
    style={{
      top: `${position.y}px`,
      left: `${position.x}px`,
      transform: "translate(-50%, -100%)",
    }}
  >
    {content}
    <div
      className="absolute w-0 h-0 border-l-8 border-r-8 border-t-8 border-solid border-white border-b-0"
      style={{
        bottom: "-8px",
        left: "50%",
        transform: "translateX(-50%)",
      }}
    />
  </div>
);

export default function LandingPage() {
  const router = useRouter();
  const [modalContent, setModalContent] = useState(null);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const containerRef = useRef(null);

  const handleFindSpots = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Redirect to map view with user's location
          router.push(
            `/map?lat=${position.coords.latitude}&lng=${position.coords.longitude}`
          );
        },
        (error) => {
          console.error("Error getting location:", error);
          // Redirect to map view with default location
          router.push("/map");
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      // Geolocation not supported, redirect to map view with default location
      router.push("/map");
    }
  };

  const handleMouseEnter = useCallback((content) => {
    setModalContent(content);
    setIsHovering(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
  }, []);

  const handleMouseMove = useCallback(
    (event) => {
      if (isHovering && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setModalPosition({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
      }
    },
    [isHovering]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener("mousemove", handleMouseMove);
      return () => {
        container.removeEventListener("mousemove", handleMouseMove);
      };
    }
  }, [handleMouseMove]);

  return (
    <div className="bg-gray-100" ref={containerRef}>
      <main>
        {/* Hero Section */}
        <section className="bg-blue-600 text-white py-20">
          <div className="container mx-auto text-center">
            <h2 className="text-4xl font-bold mb-4">
              Discover the Real Spots, Avoid the Traps
            </h2>
            <p className="text-xl mb-8">
              Get honest, real-time recommendations from fellow travelers. No
              ads, no BS—just the truth.
            </p>
            <Button
              className="bg-white text-blue-600 px-8 py-3 rounded-full text-lg font-semibold hover:bg-blue-100 transition"
              onClick={handleFindSpots}
            >
              Find Spots Near You
            </Button>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-16 bg-gray-100">
          <div className="container mx-auto">
            <h3 className="text-2xl font-bold text-center mb-12">
              How It Works
            </h3>
            <div className="flex justify-around text-center">
              {[
                {
                  icon: "🔍",
                  title: "Search or Browse",
                  description: "Find places near you or anywhere in the world.",
                  modalContent:
                    "Use our interactive map to discover spots in any location!",
                },
                {
                  icon: "📖",
                  title: "Read Real Reviews",
                  description:
                    "Get recommendations or avoid spots based on real user feedback.",
                  modalContent:
                    "Our reviews are written by real travelers, not paid advertisers.",
                },
                {
                  icon: "✍️",
                  title: "Drop Your Own Truth",
                  description:
                    "Contribute by adding your experiences directly on the map.",
                  modalContent:
                    "Share your honest opinions to help fellow travelers make informed decisions.",
                },
              ].map((item, index) => (
                <div
                  key={index}
                  className="w-1/3"
                  onMouseEnter={() => handleMouseEnter(item.modalContent)}
                  onMouseLeave={handleMouseLeave}
                >
                  <div className="bg-white rounded-full h-24 w-24 flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">{item.icon}</span>
                  </div>
                  <h4 className="font-semibold mb-2">{item.title}</h4>
                  <p>{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Featured Reviews */}
        <section className="py-16 bg-white">
          <div className="container mx-auto">
            <h3 className="text-2xl font-bold text-center mb-8">
              Featured Reviews
            </h3>
            <div className="grid grid-cols-2 gap-8">
              <div className="bg-gray-100 p-6 rounded-lg">
                <h4 className="font-semibold mb-2">Top Recommended in Paris</h4>
                <p>
                  "Hidden gem! Best croissants I've ever had. A must-visit
                  bakery off the tourist path."
                </p>
              </div>
              <div className="bg-gray-100 p-6 rounded-lg">
                <h4 className="font-semibold mb-2">
                  Places to Avoid in New York
                </h4>
                <p>
                  "Tourist trap alert! Overpriced and underwhelming. Skip this
                  and try the local deli next door instead."
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="bg-blue-600 text-white py-16">
          <div className="container mx-auto text-center">
            <h3 className="text-3xl font-bold mb-4">Ready to Explore?</h3>
            <p className="text-xl mb-8">
              Join 10,000+ travelers sharing real experiences.
            </p>
            <Button className="bg-white text-blue-600 px-8 py-3 rounded-full text-lg font-semibold hover:bg-blue-100 transition">
              Start Exploring Now
            </Button>
          </div>
        </section>
      </main>

      <footer className="bg-gray-800 text-white py-8">
        <div className="container mx-auto flex justify-between">
          <div>
            <h3 className="text-xl font-bold mb-4">TruthSpot</h3>
            <p>&copy; 2023 TruthSpot. All rights reserved.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Quick Links</h4>
            <ul>
              {["About", "Contact", "FAQ", "Privacy Policy"].map(
                (item, index) => (
                  <li key={index}>
                    <Link href="#" className="hover:text-blue-300">
                      {item}
                    </Link>
                  </li>
                )
              )}
            </ul>
          </div>
        </div>
      </footer>

      {isHovering && modalContent && (
        <Modal content={modalContent} position={modalPosition} />
      )}
    </div>
  );
}
