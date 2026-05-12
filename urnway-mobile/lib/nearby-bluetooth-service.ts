import {
  BleManager,
  ScanMode,
  State,
  type Characteristic,
  type Device,
  type Subscription,
} from "react-native-ble-plx";
import { PermissionsAndroid, Platform } from "react-native";

import {
  addBluetoothPeripheralListener,
  configurePeripheralServices,
  hasNativeBluetoothPeripheralSupport,
  startPeripheralAdvertising,
  stopPeripheralAdvertising,
  updatePeripheralCharacteristicValue,
  type NativeAdvertisingStateEvent,
  type NativeCharacteristicWriteEvent,
} from "@/lib/native-bluetooth-peripheral";
import {
  base64ToUtf8,
  buildNearbyFallbackLocalName,
  encodeNearbyAckMessage,
  encodeCompactNearbyDiscoveryPayload,
  encodeNearbyDiscoveryPayload,
  encodeNearbyDoneMessage,
  encodeNearbyPayMessage,
  parseNearbyDiscoveryPayload,
  parseNearbyDiscoveryManufacturerData,
  parseNearbyFallbackLocalName,
  parseNearbyRuntimeMessage,
  utf8ToBase64,
  utf8ToHex,
  type IncomingNearbyPayment,
  type NearbyDoneMessage,
  type NearbyUser,
  NEARBY_DISCOVERY_CHARACTERISTIC_UUID,
  NEARBY_PAYMENT_MESSAGE_CHARACTERISTIC_UUID,
  NEARBY_PAYMENT_SERVICE_UUID,
  NEARBY_STATUS_CHARACTERISTIC_UUID,
} from "@/lib/nearby-payments";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "reason" in error &&
    typeof (error as { reason?: unknown }).reason === "string"
  ) {
    return (error as { reason: string }).reason;
  }

  return fallback;
}

type StartScanningOptions = {
  onUsersUpdated(users: NearbyUser[]): void;
  onError(errorMessage: string): void;
};

type StartDiscoverableOptions = {
  username: string;
  publicUserId: string;
  onIncomingPayment(payment: IncomingNearbyPayment): void;
  onDoneReceived(message: NearbyDoneMessage): void;
  onAdvertisingStateChanged?(
    state: "starting" | "started" | "stopped" | "failed",
    errorCode?: number
  ): void;
  onError(errorMessage: string): void;
};

function getDiscoveryPayloadFromDevice(device: Device) {
  if (device.manufacturerData) {
    try {
      const parsed = parseNearbyDiscoveryManufacturerData(
        base64ToUtf8(device.manufacturerData)
      );
      if (parsed) {
        return parsed;
      }
    } catch {
      // Fall through to service/local-name parsing.
    }
  }

  const serviceData = device.serviceData ?? null;

  if (serviceData) {
    const matchingEntry = Object.entries(serviceData).find(
      ([uuid]) => uuid.toLowerCase() === NEARBY_PAYMENT_SERVICE_UUID.toLowerCase()
    );

    if (matchingEntry?.[1]) {
      try {
        const parsed = parseNearbyDiscoveryPayload(base64ToUtf8(matchingEntry[1]));
        if (parsed) {
          return parsed;
        }
      } catch {
        // Fall through to local-name parsing.
      }
    }
  }

  return parseNearbyFallbackLocalName(device.localName ?? device.name);
}

export function getNearbyPermissionErrorMessage(mode: "scan" | "advertise") {
  return mode === "advertise"
    ? "Nearby payments need Bluetooth permissions to make this user discoverable."
    : "Nearby payments need Bluetooth permissions to scan for nearby users.";
}

export function getBluetoothStateErrorMessage(
  state: State,
  mode: "scan" | "advertise"
) {
  if (state === State.Unauthorized) {
    return getNearbyPermissionErrorMessage(mode);
  }

  if (state === State.Unsupported) {
    return "This device does not support Bluetooth LE nearby payments.";
  }

  if (state === State.PoweredOff) {
    return mode === "advertise"
      ? "Turn Bluetooth on to become discoverable nearby."
      : "Turn Bluetooth on to discover nearby users.";
  }

  return null;
}

export async function requestNearbyPermissions(mode: "scan" | "advertise") {
  if (Platform.OS !== "android") {
    return true;
  }

  const version =
    typeof Platform.Version === "number" ? Platform.Version : Number(Platform.Version);

  if (version >= 31) {
    const permissions =
      mode === "advertise"
        ? [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          ]
        : [
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          ];
    const result = await PermissionsAndroid.requestMultiple(permissions);

    return Object.values(result).every(
      (value) => value === PermissionsAndroid.RESULTS.GRANTED
    );
  }

  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  ]);

  return Object.values(result).every(
    (value) => value === PermissionsAndroid.RESULTS.GRANTED
  );
}

export class NearbyBluetoothService {
  private manager: BleManager | null = null;
  private readonly discoveredUsers = new Map<string, NearbyUser>();
  private scanActive = false;
  private discoverableActive = false;
  private activeDevice: Device | null = null;
  private statusMonitor: Subscription | null = null;
  private peripheralWriteSubscription: { remove(): void } | null = null;
  private advertisingStateSubscription: { remove(): void } | null = null;

  async getState() {
    return this.getManager().state();
  }

  primeCentralManager() {
    this.getManager();
  }

  async waitForUsableState(timeoutMs = Platform.OS === "ios" ? 15000 : 8000): Promise<State> {
    const manager = this.getManager();
    const currentState = await manager.state();

    if (
      currentState !== State.Unknown &&
      currentState !== State.Resetting
    ) {
      return currentState;
    }

    return new Promise<State>((resolve) => {
      let settled = false;
      const pollInterval = setInterval(() => {
        void manager.state().then((nextState) => {
          if (settled) {
            return;
          }

          if (nextState === State.Unknown || nextState === State.Resetting) {
            return;
          }

          settled = true;
          clearTimeout(timeout);
          clearInterval(pollInterval);
          subscription.remove();
          resolve(nextState);
        });
      }, 600);

      const timeout = setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        clearInterval(pollInterval);
        subscription.remove();
        resolve(State.Unknown);
      }, timeoutMs);

      const subscription = manager.onStateChange((nextState) => {
        if (settled) {
          return;
        }

        if (nextState === State.Unknown || nextState === State.Resetting) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        clearInterval(pollInterval);
        subscription.remove();
        resolve(nextState);
      }, true);
    });
  }

  supportsDiscoverableMode() {
    if (Platform.OS === "ios") {
      return false;
    }

    return hasNativeBluetoothPeripheralSupport();
  }

  startScanning(options: StartScanningOptions) {
    this.scanActive = true;
    try {
      const manager = this.getManager();
      manager.stopDeviceScan();
      manager.startDeviceScan(
        null,
        {
          allowDuplicates: true,
          scanMode: ScanMode.LowLatency,
        },
        (error, device) => {
          if (!this.scanActive) {
            return;
          }

          if (error) {
            options.onError(getErrorMessage(error, "Bluetooth scan failed."));
            return;
          }

          if (!device) {
            return;
          }

          const payload = getDiscoveryPayloadFromDevice(device);

          if (!payload) {
            return;
          }

          const currentStatus =
            this.discoveredUsers.get(payload.publicUserId)?.status ?? "discovered";

          this.discoveredUsers.set(payload.publicUserId, {
            username: payload.username,
            publicUserId: payload.publicUserId,
            rssi: device.rssi ?? undefined,
            deviceId: device.id,
            status: currentStatus,
          });

          options.onUsersUpdated(
            Array.from(this.discoveredUsers.values()).sort(
              (left, right) => (right.rssi ?? -200) - (left.rssi ?? -200)
            )
          );
        }
      );
    } catch (error) {
      options.onError(getErrorMessage(error, "Bluetooth scan failed."));
    }
  }

  stopScanning() {
    this.scanActive = false;
    this.manager?.stopDeviceScan();
    this.discoveredUsers.clear();
  }

  startDiscoverable(options: StartDiscoverableOptions) {
    if (!hasNativeBluetoothPeripheralSupport()) {
      options.onError(
        "This build does not expose the Bluetooth peripheral bridge yet. Rebuild the dev client after installing the native patch."
      );
      return;
    }

    const discoveryPayload = encodeNearbyDiscoveryPayload({
      username: options.username,
      publicUserId: options.publicUserId,
    });
    const compactDiscoveryPayload = encodeCompactNearbyDiscoveryPayload({
      username: options.username,
      publicUserId: options.publicUserId,
    });

    try {
      configurePeripheralServices([
        {
          uuid: NEARBY_PAYMENT_SERVICE_UUID,
          characteristics: [
            {
              uuid: NEARBY_DISCOVERY_CHARACTERISTIC_UUID,
              properties: ["read"],
              value: discoveryPayload,
            },
          {
            uuid: NEARBY_PAYMENT_MESSAGE_CHARACTERISTIC_UUID,
            properties: ["write"],
          },
          {
            uuid: NEARBY_STATUS_CHARACTERISTIC_UUID,
            properties: ["notify"],
          },
        ],
      },
      ]);

      this.peripheralWriteSubscription?.remove();
      this.advertisingStateSubscription?.remove();
      this.peripheralWriteSubscription = addBluetoothPeripheralListener(
        "characteristicWriteReceived",
        (event) => {
          const payload = event as NativeCharacteristicWriteEvent;

          if (
            payload.serviceUuid.toLowerCase() !==
              NEARBY_PAYMENT_SERVICE_UUID.toLowerCase() ||
            payload.characteristicUuid.toLowerCase() !==
              NEARBY_PAYMENT_MESSAGE_CHARACTERISTIC_UUID.toLowerCase()
          ) {
            return;
          }

          const runtimeMessage = parseNearbyRuntimeMessage(payload.value);

          if (!runtimeMessage) {
            return;
          }

          if (runtimeMessage.messageType === "PAY") {
            options.onIncomingPayment({
              senderUsername: runtimeMessage.senderUsername,
              paymentIntentId: runtimeMessage.paymentIntentId,
              amountMinor: runtimeMessage.amountMinor,
              currency: runtimeMessage.currency,
              receivedAt: Date.now(),
            });

            try {
              updatePeripheralCharacteristicValue(
                NEARBY_PAYMENT_SERVICE_UUID,
                NEARBY_STATUS_CHARACTERISTIC_UUID,
                encodeNearbyAckMessage(runtimeMessage.paymentIntentId),
                true
              );
            } catch (error) {
              options.onError(getErrorMessage(error, "Could not send nearby ACK."));
            }

            return;
          }

          if (runtimeMessage.messageType === "DONE") {
            options.onDoneReceived(runtimeMessage);
          }
        }
      );

      this.advertisingStateSubscription = addBluetoothPeripheralListener(
        "advertisingStateChanged",
        (event) => {
          const payload = event as NativeAdvertisingStateEvent;

          if (payload.state === "started") {
            this.discoverableActive = true;
            options.onAdvertisingStateChanged?.("started");
            return;
          }

          if (payload.state === "stopped") {
            this.discoverableActive = false;
            options.onAdvertisingStateChanged?.("stopped");
            return;
          }

          if (payload.state === "failed") {
            this.discoverableActive = false;
            options.onAdvertisingStateChanged?.("failed", payload.errorCode);
            options.onError(
              payload.errorCode != null
                ? `Nearby advertising failed on this device (code ${payload.errorCode}).`
                : "Nearby advertising failed on this device."
            );
          }
        }
      );

      const advertisingPayload = {
        serviceUUIDs: Platform.OS === "android" ? [] : [NEARBY_PAYMENT_SERVICE_UUID],
        localName:
          Platform.OS === "android"
            ? undefined
            : buildNearbyFallbackLocalName({
                username: options.username,
                publicUserId: options.publicUserId,
              }),
        manufacturerData:
          Platform.OS === "android" ? utf8ToHex(compactDiscoveryPayload) : undefined,
        advertisingData:
          Platform.OS === "android"
            ? undefined
            : Platform.OS === "ios"
              ? undefined
              : {
                  completeServiceUUIDs128: [NEARBY_PAYMENT_SERVICE_UUID],
                  serviceData128: [
                    {
                      uuid: NEARBY_PAYMENT_SERVICE_UUID,
                      data: utf8ToHex(discoveryPayload),
                    },
                  ],
                },
      };

      options.onAdvertisingStateChanged?.("starting");
      startPeripheralAdvertising(advertisingPayload);
    } catch (error) {
      options.onError(
        getErrorMessage(error, "Could not enable nearby discoverable mode.")
      );
    }
  }

  stopDiscoverable() {
    this.discoverableActive = false;
    this.peripheralWriteSubscription?.remove();
    this.peripheralWriteSubscription = null;
    this.advertisingStateSubscription?.remove();
    this.advertisingStateSubscription = null;
    stopPeripheralAdvertising();
  }

  async connectAndSendPay(input: {
    deviceId: string;
    paymentIntentId: string;
    senderUsername: string;
    amountMinor: number;
    currency: string;
    onDeviceStatus?(status: NearbyUser["status"]): void;
    onAck?(paymentIntentId: string): void;
  }) {
    await this.disconnectActiveConnection();

    input.onDeviceStatus?.("connecting");

    const manager = this.getManager();
    const device = await manager.connectToDevice(input.deviceId, {
      requestMTU: 256,
    });
    this.activeDevice = await device.discoverAllServicesAndCharacteristics();

    input.onDeviceStatus?.("connected");

    this.statusMonitor?.remove();
    this.statusMonitor = manager.monitorCharacteristicForDevice(
      this.activeDevice.id,
      NEARBY_PAYMENT_SERVICE_UUID,
      NEARBY_STATUS_CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error || !characteristic?.value) {
          return;
        }

        const message = parseNearbyRuntimeMessage(base64ToUtf8(characteristic.value));

        if (
          message?.messageType === "ACK" &&
          message.paymentIntentId === input.paymentIntentId
        ) {
          input.onAck?.(message.paymentIntentId);
        }
      }
    );

    await this.readDiscoveryPayload(this.activeDevice.id).catch(() => null);
    await manager.writeCharacteristicWithResponseForDevice(
      this.activeDevice.id,
      NEARBY_PAYMENT_SERVICE_UUID,
      NEARBY_PAYMENT_MESSAGE_CHARACTERISTIC_UUID,
      utf8ToBase64(
        encodeNearbyPayMessage({
          senderUsername: input.senderUsername,
          paymentIntentId: input.paymentIntentId,
          amountMinor: input.amountMinor,
          currency: input.currency,
        })
      )
    );
  }

  async sendDone(paymentIntentId: string) {
    if (!this.activeDevice) {
      throw new Error("No nearby device connection is active.");
    }

    await this.getManager().writeCharacteristicWithResponseForDevice(
      this.activeDevice.id,
      NEARBY_PAYMENT_SERVICE_UUID,
      NEARBY_PAYMENT_MESSAGE_CHARACTERISTIC_UUID,
      utf8ToBase64(encodeNearbyDoneMessage(paymentIntentId))
    );
  }

  async disconnectActiveConnection() {
    this.statusMonitor?.remove();
    this.statusMonitor = null;

    if (this.activeDevice) {
      try {
        await this.manager?.cancelDeviceConnection(this.activeDevice.id);
      } catch {
        // Ignore disconnect cleanup failures.
      }
      this.activeDevice = null;
    }
  }

  async stopAll() {
    this.stopScanning();
    this.stopDiscoverable();
    await this.disconnectActiveConnection();
    this.manager?.destroy();
    this.manager = null;
  }

  private async readDiscoveryPayload(deviceId: string) {
    const characteristic = await this.getManager().readCharacteristicForDevice(
      deviceId,
      NEARBY_PAYMENT_SERVICE_UUID,
      NEARBY_DISCOVERY_CHARACTERISTIC_UUID
    );

    return this.parseCharacteristicValue(characteristic);
  }

  private parseCharacteristicValue(characteristic: Characteristic) {
    if (!characteristic.value) {
      return null;
    }

    return base64ToUtf8(characteristic.value);
  }

  private getManager() {
    if (!this.manager) {
      this.manager = new BleManager();
    }

    return this.manager;
  }
}
