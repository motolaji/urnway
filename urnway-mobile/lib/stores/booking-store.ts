import { create } from "zustand";
import type { FlightBookingOffer, HotelBookingOffer } from "@/lib/session";

interface BookingStore {
  // Selected offer
  selectedOffer: FlightBookingOffer | HotelBookingOffer | null;

  // Passenger/Guest form state
  passengerName: string;
  passengerBornOn: string;
  passengerEmail: string;
  passengerPhoneNumber: string;
  passengerTitle: "mr" | "mrs" | "ms" | "miss" | "mx" | "dr";
  passengerGender: "m" | "f" | "x";
  bookingNote: string;
  selectedTripId: string | null;

  // Actions
  setSelectedOffer: (
    offer: FlightBookingOffer | HotelBookingOffer | null
  ) => void;
  setPassengerName: (name: string) => void;
  setPassengerBornOn: (date: string) => void;
  setPassengerEmail: (email: string) => void;
  setPassengerPhoneNumber: (phone: string) => void;
  setPassengerTitle: (title: "mr" | "mrs" | "ms" | "miss" | "mx" | "dr") => void;
  setPassengerGender: (gender: "m" | "f" | "x") => void;
  setBookingNote: (note: string) => void;
  setSelectedTripId: (id: string | null) => void;
  reset: () => void;
}

export const useBookingStore = create<BookingStore>((set) => ({
  // Initial state
  selectedOffer: null,
  passengerName: "",
  passengerBornOn: "",
  passengerEmail: "",
  passengerPhoneNumber: "",
  passengerTitle: "mr",
  passengerGender: "m",
  bookingNote: "",
  selectedTripId: null,

  // Actions
  setSelectedOffer: (offer) => set({ selectedOffer: offer }),

  setPassengerName: (name) => set({ passengerName: name }),

  setPassengerBornOn: (date) => set({ passengerBornOn: date }),

  setPassengerEmail: (email) => set({ passengerEmail: email }),

  setPassengerPhoneNumber: (phone) => set({ passengerPhoneNumber: phone }),

  setPassengerTitle: (title) => set({ passengerTitle: title }),

  setPassengerGender: (gender) => set({ passengerGender: gender }),

  setBookingNote: (note) => set({ bookingNote: note }),

  setSelectedTripId: (id) => set({ selectedTripId: id }),

  reset: () =>
    set({
      selectedOffer: null,
      passengerName: "",
      passengerBornOn: "",
      passengerEmail: "",
      passengerPhoneNumber: "",
      passengerTitle: "mr",
      passengerGender: "m",
      bookingNote: "",
      selectedTripId: null,
    }),
}));
