import {
  NativeEventEmitter,
  NativeModules,
  type EmitterSubscription,
} from "react-native";

export const BLUETOOTH_PERIPHERAL_EVENTS = {
  characteristicWriteReceived: "characteristicWriteReceived",
  centralConnectionStateChanged: "centralConnectionStateChanged",
  characteristicSubscriptionChanged: "characteristicSubscriptionChanged",
  advertisingStateChanged: "advertisingStateChanged",
} as const;

type BluetoothPeripheralNativeModule = {
  startAdvertising(options: {
    serviceUUIDs: string[];
    localName?: string;
    advertisingData?: Record<string, unknown>;
    manufacturerData?: string;
  }): void;
  stopAdvertising(): void;
  setServices(
    services: {
      uuid: string;
      characteristics: {
        uuid: string;
        properties: string[];
        value?: string;
      }[];
    }[]
  ): void;
  updateCharacteristicValue(
    serviceUuid: string,
    characteristicUuid: string,
    value: string,
    notify: boolean
  ): void;
  addListener?(eventName: string): void;
  removeListeners?(count: number): void;
};

export type NativeCharacteristicWriteEvent = {
  deviceId: string;
  serviceUuid: string;
  characteristicUuid: string;
  value: string;
};

export type NativeCentralConnectionStateEvent = {
  deviceId: string;
  state: "connected" | "disconnected";
};

export type NativeCharacteristicSubscriptionEvent = {
  deviceId: string;
  serviceUuid: string;
  characteristicUuid: string;
  subscribed: boolean;
};

export type NativeAdvertisingStateEvent = {
  state: "started" | "stopped" | "failed";
  errorCode?: number;
};

const bluetoothPeripheral = NativeModules.BluetoothPeripheral as
  | BluetoothPeripheralNativeModule
  | undefined;

function canUseBluetoothPeripheralEventEmitter(
  module: BluetoothPeripheralNativeModule | undefined
) {
  return Boolean(module?.addListener && module?.removeListeners);
}

function getBluetoothPeripheralEventEmitter() {
  if (!canUseBluetoothPeripheralEventEmitter(bluetoothPeripheral)) {
    return null;
  }

  return new NativeEventEmitter(NativeModules.BluetoothPeripheral);
}

export function hasNativeBluetoothPeripheralSupport() {
  return Boolean(
    bluetoothPeripheral &&
      typeof bluetoothPeripheral.updateCharacteristicValue === "function" &&
      canUseBluetoothPeripheralEventEmitter(bluetoothPeripheral)
  );
}

export function startPeripheralAdvertising(options: {
  serviceUUIDs: string[];
  localName?: string;
  advertisingData?: Record<string, unknown>;
  manufacturerData?: string;
}) {
  bluetoothPeripheral?.startAdvertising(options);
}

export function stopPeripheralAdvertising() {
  bluetoothPeripheral?.stopAdvertising();
}

export function configurePeripheralServices(
  services: {
    uuid: string;
    characteristics: {
      uuid: string;
      properties: string[];
      value?: string;
    }[];
  }[]
) {
  bluetoothPeripheral?.setServices(services);
}

export function updatePeripheralCharacteristicValue(
  serviceUuid: string,
  characteristicUuid: string,
  value: string,
  notify: boolean
) {
  bluetoothPeripheral?.updateCharacteristicValue(
    serviceUuid,
    characteristicUuid,
    value,
    notify
  );
}

export function addBluetoothPeripheralListener(
  eventName: keyof typeof BLUETOOTH_PERIPHERAL_EVENTS,
  listener: (
    event:
      | NativeCharacteristicWriteEvent
      | NativeCentralConnectionStateEvent
      | NativeCharacteristicSubscriptionEvent
      | NativeAdvertisingStateEvent
  ) => void
): EmitterSubscription | null {
  const bluetoothPeripheralEventEmitter = getBluetoothPeripheralEventEmitter();

  if (!bluetoothPeripheralEventEmitter) {
    return null;
  }

  return bluetoothPeripheralEventEmitter.addListener(
    BLUETOOTH_PERIPHERAL_EVENTS[eventName],
    listener
  );
}
