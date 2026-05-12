import { create } from "zustand";

interface HotelSearchStore {
  // Form state
  city: string;
  citySearchValue: string | null;
  checkIn: string;
  checkOut: string;
  rooms: string;
  roomTier: "standard" | "deluxe" | "suite";

  // Actions
  setCity: (value: string, searchValue?: string | null) => void;
  setCheckIn: (date: string) => void;
  setCheckOut: (date: string) => void;
  setRooms: (rooms: string) => void;
  setRoomTier: (tier: "standard" | "deluxe" | "suite") => void;
  reset: () => void;
}

export const useHotelSearchStore = create<HotelSearchStore>((set) => ({
  // Initial state
  city: "",
  citySearchValue: null,
  checkIn: "",
  checkOut: "",
  rooms: "1",
  roomTier: "standard",

  // Actions
  setCity: (value, searchValue = null) =>
    set({ city: value, citySearchValue: searchValue }),

  setCheckIn: (date) => set({ checkIn: date }),

  setCheckOut: (date) => set({ checkOut: date }),

  setRooms: (rooms) => set({ rooms }),

  setRoomTier: (tier) => set({ roomTier: tier }),

  reset: () =>
    set({
      city: "",
      citySearchValue: null,
      checkIn: "",
      checkOut: "",
      rooms: "1",
      roomTier: "standard",
    }),
}));
