import { create } from "zustand";

// Multi-city flight segment
export interface FlightSegment {
  origin: string;
  originSearchValue: string | null;
  destination: string;
  destinationSearchValue: string | null;
  departDate: string;
}

interface FlightSearchStore {
  // Flight type
  flightType: "roundtrip" | "oneway" | "multicity";

  // Round-trip / One-way form state
  origin: string;
  originSearchValue: string | null;
  destination: string;
  destinationSearchValue: string | null;
  departDate: string;
  returnDate: string; // Empty for one-way

  // Multi-city segments (array of flight legs)
  multiCitySegments: FlightSegment[];

  // Common fields
  cabinClass: "economy" | "premium" | "business";

  // Actions
  setFlightType: (type: "roundtrip" | "oneway" | "multicity") => void;
  setOrigin: (value: string, searchValue?: string | null) => void;
  setDestination: (value: string, searchValue?: string | null) => void;
  setDepartDate: (date: string) => void;
  setReturnDate: (date: string) => void;
  setCabinClass: (cabin: "economy" | "premium" | "business") => void;
  swapLocations: () => void;

  // Multi-city actions
  addMultiCitySegment: () => void;
  removeMultiCitySegment: (index: number) => void;
  updateMultiCitySegment: (
    index: number,
    segment: Partial<FlightSegment>
  ) => void;

  reset: () => void;
}

export const useFlightSearchStore = create<FlightSearchStore>((set) => ({
  // Initial state
  flightType: "roundtrip",
  origin: "",
  originSearchValue: null,
  destination: "",
  destinationSearchValue: null,
  departDate: "",
  returnDate: "",
  multiCitySegments: [
    {
      origin: "",
      originSearchValue: null,
      destination: "",
      destinationSearchValue: null,
      departDate: "",
    },
    {
      origin: "",
      originSearchValue: null,
      destination: "",
      destinationSearchValue: null,
      departDate: "",
    },
  ],
  cabinClass: "economy",

  // Actions
  setFlightType: (type) =>
    set((state) => {
      // When switching to multicity, initialize with 2 segments if needed
      if (type === "multicity" && state.multiCitySegments.length < 2) {
        return {
          flightType: type,
          multiCitySegments: [
            {
              origin: state.origin,
              originSearchValue: state.originSearchValue,
              destination: state.destination,
              destinationSearchValue: state.destinationSearchValue,
              departDate: state.departDate,
            },
            {
              origin: "",
              originSearchValue: null,
              destination: "",
              destinationSearchValue: null,
              departDate: "",
            },
          ],
        };
      }

      // When switching to oneway, clear return date
      if (type === "oneway") {
        return { flightType: type, returnDate: "" };
      }

      return { flightType: type };
    }),

  setOrigin: (value, searchValue = null) =>
    set({ origin: value, originSearchValue: searchValue }),

  setDestination: (value, searchValue = null) =>
    set({ destination: value, destinationSearchValue: searchValue }),

  setDepartDate: (date) => set({ departDate: date }),

  setReturnDate: (date) => set({ returnDate: date }),

  setCabinClass: (cabin) => set({ cabinClass: cabin }),

  swapLocations: () =>
    set((state) => ({
      origin: state.destination,
      originSearchValue: state.destinationSearchValue,
      destination: state.origin,
      destinationSearchValue: state.originSearchValue,
    })),

  // Multi-city actions
  addMultiCitySegment: () =>
    set((state) => {
      if (state.multiCitySegments.length >= 5) return state;
      return {
        multiCitySegments: [
          ...state.multiCitySegments,
          {
            origin: "",
            originSearchValue: null,
            destination: "",
            destinationSearchValue: null,
            departDate: "",
          },
        ],
      };
    }),

  removeMultiCitySegment: (index) =>
    set((state) => {
      if (state.multiCitySegments.length <= 2) return state;
      return {
        multiCitySegments: state.multiCitySegments.filter(
          (_, i) => i !== index
        ),
      };
    }),

  updateMultiCitySegment: (index, segment) =>
    set((state) => ({
      multiCitySegments: state.multiCitySegments.map((s, i) =>
        i === index ? { ...s, ...segment } : s
      ),
    })),

  reset: () =>
    set({
      flightType: "roundtrip",
      origin: "",
      originSearchValue: null,
      destination: "",
      destinationSearchValue: null,
      departDate: "",
      returnDate: "",
      multiCitySegments: [
        {
          origin: "",
          originSearchValue: null,
          destination: "",
          destinationSearchValue: null,
          departDate: "",
        },
        {
          origin: "",
          originSearchValue: null,
          destination: "",
          destinationSearchValue: null,
          departDate: "",
        },
      ],
      cabinClass: "economy",
    }),
}));
