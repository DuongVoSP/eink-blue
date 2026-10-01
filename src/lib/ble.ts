export type ConnectionState = "disconnected" | "connecting" | "connected" | "sending";

export type GattCharacteristicInfo = {
  uuid: string;
  properties: string[];
  characteristic: BluetoothRemoteGATTCharacteristic;
};

export type GattServiceInfo = {
  uuid: string;
  characteristics: GattCharacteristicInfo[];
};

export type BleSession = {
  device: BluetoothDevice;
  server: BluetoothRemoteGATTServer;
  services: GattServiceInfo[];
  writable: GattCharacteristicInfo[];
};

const OPTIONAL_SERVICES = [
  "0000fef0-0000-1000-8000-00805f9b34fb",
  "0000180a-0000-1000-8000-00805f9b34fb",
  "0000180f-0000-1000-8000-00805f9b34fb",
];

export function bluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.bluetooth);
}

export async function connectTag(
  onDisconnected: () => void,
): Promise<BleSession> {
  if (!navigator.bluetooth) {
    throw new Error("Web Bluetooth is not available in this browser.");
  }

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: OPTIONAL_SERVICES,
  });

  if (!device.gatt) {
    throw new Error("Selected device has no GATT server.");
  }

  device.addEventListener("gattserverdisconnected", onDisconnected);

  const server = await device.gatt.connect();
  const primary = await server.getPrimaryServices();
  const services: GattServiceInfo[] = [];

  for (const service of primary) {
    const chars = await service.getCharacteristics();
    const characteristics: GattCharacteristicInfo[] = chars.map((characteristic) => ({
      uuid: characteristic.uuid,
      properties: describeProperties(characteristic.properties),
      characteristic,
    }));
    services.push({ uuid: service.uuid, characteristics });
  }

  const writable = services
    .flatMap((service) => service.characteristics)
    .filter((item) =>
      item.properties.includes("write") ||
      item.properties.includes("writeWithoutResponse"),
    );

  return { device, server, services, writable };
}

export async function disconnectTag(session: BleSession | null): Promise<void> {
  session?.server.disconnect();
}

export type SendProgress = {
  sent: number;
  total: number;
};

/**
 * Phase 3/4 scaffold: write the packed bitmap in BLE-sized chunks.
 * Header, checksum, and refresh commands are still unknown until
 * Bluefy traffic is captured, so this is a raw payload test only.
 */
export async function writeBitmapChunks(
  characteristic: BluetoothRemoteGATTCharacteristic,
  payload: Uint8Array,
  onProgress: (progress: SendProgress) => void,
  chunkSize = 20,
): Promise<void> {
  const total = Math.max(1, Math.ceil(payload.byteLength / chunkSize));
  const useWithoutResponse = characteristic.properties.writeWithoutResponse;

  for (let i = 0; i < payload.byteLength; i += chunkSize) {
    const slice = payload.slice(i, i + chunkSize);
    if (useWithoutResponse) {
      await characteristic.writeValueWithoutResponse(slice);
    } else {
      await characteristic.writeValueWithResponse(slice);
    }
    onProgress({ sent: Math.floor(i / chunkSize) + 1, total });
    await wait(12);
  }
}

function describeProperties(properties: BluetoothCharacteristicProperties): string[] {
  const names: Array<keyof BluetoothCharacteristicProperties> = [
    "broadcast",
    "read",
    "writeWithoutResponse",
    "write",
    "notify",
    "indicate",
    "authenticatedSignedWrites",
  ];
  return names.filter((name) => properties[name]);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
