# E-Ink Tag Web App – Development Plan

## 1. Objective

Build a simple web application to send custom text to a **2.13-inch E-Ink Electronic Shelf Label (ESL)** using **Web Bluetooth**.

The current setup uses **Bluefly Browser** to connect to the tag.

### Current architecture

```text
User
  ↓
Bluefly Browser
  ↓
Web Bluetooth
  ↓
E-Ink Tag
```

### Target architecture

```text
User
  ↓
Our Web App
  ↓
Web Bluetooth API
  ↓
E-Ink Tag
```

The goal is to eventually remove the dependency on Bluefly.

---

# 2. Initial Scope

The first version should be intentionally simple.

### Features

* Enter text
* Preview text on an E-Ink canvas
* Select font size
* Select alignment
* Connect to the E-Ink tag via Bluetooth
* Send the generated image to the tag
* Display connection/send status

### Example UI

```text
┌──────────────────────────────────────────┐
│              E-Ink Tag Tool              │
├──────────────────────────────────────────┤
│                                          │
│ Text:                                    │
│ ┌──────────────────────────────────────┐ │
│ │ HELLO WORLD                          │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ Font size: [ 24 ]                        │
│ Align:     [ Center ▼ ]                  │
│                                          │
│ ┌──────────────────────────────┐         │
│ │                              │         │
│ │         HELLO WORLD          │         │
│ │                              │         │
│ └──────────────────────────────┘         │
│                                          │
│ [ Connect Tag ]     [ Send ]             │
│                                          │
│ Status: Connected                        │
└──────────────────────────────────────────┘
```

---

# 3. Proposed Architecture

No backend is required for the first version.

```text
┌─────────────────────────────────────┐
│          Chrome / Edge              │
│                                     │
│  ┌───────────────────────────────┐  │
│  │       E-Ink Web App           │  │
│  │                               │  │
│  │  Text Editor                  │  │
│  │       ↓                       │  │
│  │  Canvas Renderer              │  │
│  │       ↓                       │  │
│  │  Image Converter              │  │
│  │       ↓                       │  │
│  │  BLE Transmitter              │  │
│  └───────────────┬───────────────┘  │
└──────────────────┼──────────────────┘
                   │
             Web Bluetooth
                   │
                   ▼
          ┌────────────────┐
          │   E-Ink Tag    │
          │                │
          │  BLE / MCU     │
          │  E-Ink Display│
          └────────────────┘
```

---

# 4. Technology Stack

Keep the first version simple.

```text
HTML
CSS
JavaScript
Web Bluetooth API
HTML Canvas
```

No need for:

* React
* Next.js
* .NET API
* Database
* Cloud
* Authentication

These can be introduced later if needed.

---

# 5. Text Rendering

The application should render the user's text to an HTML Canvas.

Example:

```text
User Input
    ↓
"HELLO WORLD"
    ↓
Canvas
    ↓
250 × 122 px
    ↓
1-bit Bitmap
```

Example preview:

```text
┌──────────────────────────────┐
│                              │
│          HELLO WORLD         │
│                              │
└──────────────────────────────┘
```

The actual canvas resolution should be changed to match the physical E-Ink display.

For example:

```javascript
canvas.width = 250;
canvas.height = 122;
```

The exact resolution must be confirmed from the actual tag.

---

# 6. Bluetooth Architecture

The application will use the browser's Web Bluetooth API.

Basic flow:

```text
Connect Button
      ↓
navigator.bluetooth.requestDevice()
      ↓
Bluetooth Device
      ↓
GATT Server
      ↓
Service
      ↓
Characteristic
      ↓
Write Data
```

Conceptually:

```javascript
const device = await navigator.bluetooth.requestDevice(...);

const server = await device.gatt.connect();

const service = await server.getPrimaryService(SERVICE_UUID);

const characteristic =
    await service.getCharacteristic(CHARACTERISTIC_UUID);

await characteristic.writeValue(data);
```

The actual:

* Device name
* Service UUID
* Characteristic UUID
* Packet format

must be discovered from the existing Bluefly implementation.

---

# 7. Important: Do Not Guess the BLE Protocol

The most important technical task is discovering how Bluefly communicates with the tag.

We need to determine:

```text
Device Name
Service UUID
Characteristic UUID
Read/Write characteristics
Image format
Packet size
Packet structure
Checksum
Refresh command
```

For example:

```text
Bluetooth Device
    │
    └── GATT Server
          │
          ├── Service A
          │      ├── Characteristic A1
          │      └── Characteristic A2
          │
          └── Service B
                 ├── Characteristic B1
                 └── Characteristic B2
```

The actual values must come from the tag/Bluefly system.

---

# 8. Reverse-Engineering Strategy

Because Bluefly already works, use it as the reference implementation.

## Step 1 — Connect using Bluefly

Confirm that:

```text
Bluefly → Tag
```

works normally.

---

## Step 2 — Identify Bluetooth Device

Find:

```text
Device Name
MAC / Device ID
Services
Characteristics
```

---

## Step 3 — Identify Writable Characteristic

Determine which characteristic Bluefly uses to send data.

We are looking for something equivalent to:

```text
Characteristic
    ↓
WRITE
```

or:

```text
WRITE WITHOUT RESPONSE
```

---

## Step 4 — Capture Data

When sending an image through Bluefly, observe the BLE packets.

Expected flow may look something like:

```text
START
  ↓
HEADER
  ↓
IMAGE DATA
  ↓
IMAGE DATA
  ↓
IMAGE DATA
  ↓
CHECKSUM
  ↓
UPDATE / REFRESH
```

The exact protocol is unknown until captured.

---

# 9. Image Conversion

The E-Ink display may require a monochrome bitmap.

For a hypothetical 250 × 122 display:

```text
250 × 122 = 30,500 pixels
```

For 1-bit monochrome:

```text
30,500 / 8
≈ 3,813 bytes
```

So the raw bitmap is only around:

```text
3.8 KB
```

However, the actual BLE transmission may be larger because of:

* Protocol headers
* Packet fragmentation
* Compression
* Checksums
* Commands
* Metadata

---

# 10. Data Flow

The final application should work like this:

```text
┌──────────────────┐
│ User enters text │
└────────┬─────────┘
         ↓
┌──────────────────┐
│ Canvas Renderer   │
└────────┬─────────┘
         ↓
┌──────────────────┐
│ Bitmap Converter  │
└────────┬─────────┘
         ↓
┌──────────────────┐
│ BLE Packetizer    │
└────────┬─────────┘
         ↓
┌──────────────────┐
│ Web Bluetooth     │
└────────┬─────────┘
         ↓
┌──────────────────┐
│ E-Ink Tag         │
└──────────────────┘
```

---

# 11. Phase 1 – UI Prototype

Build the application without Bluetooth first.

### Deliverables

* Text input
* Font size
* Alignment
* Bold option
* E-Ink preview
* Clear button

Example:

```text
Text
[ Coca Cola                     ]

Font Size
[ 32 ]

Alignment
[ Center ▼ ]

☑ Bold

┌─────────────────────────────┐
│                             │
│          Coca Cola          │
│                             │
└─────────────────────────────┘

[ Connect ]    [ Send ]
```

---

# 12. Phase 2 – Bluetooth Connection

Implement:

```text
[ Connect Tag ]
```

Flow:

```text
Click Connect
      ↓
Bluetooth Device Picker
      ↓
Select ESL Tag
      ↓
Connect GATT
      ↓
Discover Services
      ↓
Discover Characteristics
      ↓
Connected
```

Display:

```text
● Connected
Device: ESL_123456
```

---

# 13. Phase 3 – Send Test Data

Before sending a complete image, test communication with simple commands.

Example:

```text
Connect
  ↓
Write test packet
  ↓
Read response
  ↓
Verify communication
```

Only after this works should we implement image transmission.

---

# 14. Phase 4 – Send Image

Implement:

```text
Canvas
  ↓
Bitmap
  ↓
Protocol Encoder
  ↓
Packetizer
  ↓
BLE Write
  ↓
Tag Refresh
```

The application should display progress:

```text
Sending...

[████████████████░░░░] 80%

Packet 16 / 20
```

Then:

```text
✓ Image sent successfully
```

---

# 15. Phase 5 – Improve the Application

Once basic text transmission works, add:

### Text features

* Font selection
* Font size
* Bold
* Italic
* Alignment
* Multiple lines
* Line spacing
* Text rotation

### E-Ink features

* Black/white mode
* Invert
* Image upload
* QR Code
* Barcode
* Simple shapes
* Borders
* Price formatting

Example:

```text
┌──────────────────────────────┐
│ COCA COLA                    │
│                              │
│          15,000 ₫            │
│                              │
│       █████████████          │
│       █   QR CODE  █         │
│       █████████████          │
└──────────────────────────────┘
```

---

# 16. Future Architecture

If the project eventually manages many tags, introduce a backend.

```text
                    ┌───────────────┐
                    │   Web UI      │
                    │   Next.js     │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   .NET API    │
                    └───────┬───────┘
                            │
                  ┌─────────┴─────────┐
                  ▼                   ▼
            ┌───────────┐       ┌───────────┐
            │ Database  │       │ BLE Agent │
            └───────────┘       └─────┬─────┘
                                      │
                            ┌─────────┼─────────┐
                            ▼         ▼         ▼
                          Tag 01    Tag 02    Tag 03
```

This would allow:

```text
Product
   ↓
Tag ID
   ↓
Template
   ↓
Generate Image
   ↓
Send
   ↓
Track Status
```

---

# 17. Recommended Development Order

```text
1. Identify E-Ink resolution
        ↓
2. Build HTML/CSS UI
        ↓
3. Build Canvas preview
        ↓
4. Identify Bluetooth device
        ↓
5. Identify GATT Service
        ↓
6. Identify writable Characteristic
        ↓
7. Capture Bluefly communication
        ↓
8. Reverse-engineer packet format
        ↓
9. Implement BLE communication
        ↓
10. Send simple test command
        ↓
11. Convert Canvas → Bitmap
        ↓
12. Send bitmap
        ↓
13. Verify E-Ink refresh
        ↓
14. Add templates/features
```

---

# 18. MVP Definition

The first working version is considered successful when this workflow works:

```text
Open Web App
     ↓
Enter:

"HELLO WORLD"
     ↓
Preview
     ↓
Click "Connect Tag"
     ↓
Select ESL
     ↓
Connected
     ↓
Click "Send"
     ↓
E-Ink Tag updates
     ↓
Display:

┌────────────────────────┐
│                        │
│      HELLO WORLD       │
│                        │
└────────────────────────┘
```

The MVP should remain **100% client-side** with no backend.

Once this works reliably, we can decide whether a larger architecture is necessary.
