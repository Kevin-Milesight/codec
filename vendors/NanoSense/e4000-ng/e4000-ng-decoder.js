// NanoSense E4000-NG LoRaWAN payload decoder
// Self-implemented from the official vendor document:
//   "Setting of the E4000-NG air quality probe in LoRa or LoRaWAN Class A mode"
//   (nano-sense.com, E4000NG-LoRa-Setting.pdf, V1), chapter 3 "LoRaWAN Payload".
// Byte layout (45 bytes, MSB-first bit stream):
//   Byte 0                presence sensor bitmask (see bits below)
//   Bytes 1..44           4 x 11-byte measurement groups
//     group (11 bytes = 88 bits):
//       CO2_Value         UINT8   x5000/255 ppm        (1 LSB = 19.6 ppm, 0..5000 ppm)
//       humidity          UINT8   /2 %RH               (1 LSB = 0.5 %, 0..100 %RH)
//       temperature       UINT8   /5 degC              (1 LSB = 0.2 degC, 0..+51 degC)
//       dummy1            1 bit
//       CO2_BatAutonomy   3 bits  battery autonomy estimate 0..7
//       dummy2            4 bits
//       VOC_Value         UINT16  x10 ug/m3            (1 LSB = 10 ug/m3)
//       PM10_Value        9 bits  x1 ug/m3             (0..511 ug/m3)
//       PM2.5_Value       9 bits  x1 ug/m3
//       PM1_Value         9 bits  x1 ug/m3
//       PM_Dummy          5 bits  (bit0 = PM1 active, bit1 = PM2.5 active,
//                                  bit2 = PM10 active, see "Detail of PM data")
//       State_Dummy       6 bits
//       State_Window      1 bit   window open
//       State_Occupancy   1 bit   occupancy
// Presence byte bits:
//   bit0 = CO2/T/RH active, bit1 = VOC active, bit2 = PM active,
//   bit3 = occupancy sensor paired, bit4 = opening sensor paired,
//   bit5 = suspicion presence, bit6 = suspicion window opening, bit7 = reserved.
// The 4 groups are successive measurements (oldest first), spaced over the
// emission rate; the gateway is responsible for time stamping.
// Self-implemented, no third-party code.
"use strict";

// MSB-first bit reader over a byte array.
function BitReader(bytes) {
  var pos = 0;
  var total = bytes.length * 8;
  this.remaining = function () { return total - pos; };
  this.read = function (n) {
    var v = 0;
    for (var i = 0; i < n; i++) {
      var byteIdx = Math.floor(pos / 8);
      var bitIdx = 7 - (pos % 8);
      v = (v << 1) | ((bytes[byteIdx] >> bitIdx) & 1);
      pos++;
    }
    return v;
  };
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

function decodeUplink(input) {
  var bytes = input && input.bytes ? input.bytes : [];
  var data = {};

  if (bytes.length === 0) {
    return { data: data };
  }

  var r = new BitReader(bytes);

  // --- Presence byte ---
  var presence = r.read(8);
  data.co2_active = (presence >> 0) & 1;
  data.voc_active = (presence >> 1) & 1;
  data.pm_active = (presence >> 2) & 1;
  data.presence_sensor = (presence >> 3) & 1; // EnOcean occupancy sensor paired
  data.open_sensor = (presence >> 4) & 1;     // EnOcean opening sensor paired
  data.presence_calc = (presence >> 5) & 1;   // suspicion presence
  data.open_calc = (presence >> 6) & 1;       // suspicion window opening

  // --- Up to 4 measurement groups (11 bytes each) ---
  var measurements = [];
  for (var g = 0; g < 4 && r.remaining() >= 88; g++) {
    var m = {};
    var co2Raw = r.read(8);
    var humRaw = r.read(8);
    var tempRaw = r.read(8);
    r.read(1);              // CO2 dummy 1
    m.battery_autonomy = r.read(3);
    r.read(4);              // CO2 dummy 2
    var vocRaw = r.read(16);
    var pm10Raw = r.read(9);
    var pm25Raw = r.read(9);
    var pm1Raw = r.read(9);
    var pmDummy = r.read(5);
    r.read(6);              // State dummy
    m.window_open = r.read(1);
    m.occupancy = r.read(1);

    m.co2 = round2(co2Raw * 5000 / 255);          // ppm
    m.relative_humidity = round2(humRaw / 2);     // %RH
    m.temperature = round2(tempRaw / 5);          // degC
    m.voc = vocRaw * 10;                          // ug/m3
    m.pm10 = pm10Raw;                             // ug/m3
    m.pm2_5 = pm25Raw;                            // ug/m3
    m.pm1 = pm1Raw;                               // ug/m3
    m.pm1_active = (pmDummy >> 0) & 1;
    m.pm2_5_active = (pmDummy >> 1) & 1;
    m.pm10_active = (pmDummy >> 2) & 1;
    measurements.push(m);
  }
  data.measurements = measurements;

  // Top-level convenience fields: latest group (the last one in the frame,
  // the document states the order goes from the oldest to the most recent).
  if (measurements.length > 0) {
    var last = measurements[measurements.length - 1];
    data.co2 = last.co2;
    data.relative_humidity = last.relative_humidity;
    data.temperature = last.temperature;
    data.voc = last.voc;
    data.pm10 = last.pm10;
    data.pm2_5 = last.pm2_5;
    data.pm1 = last.pm1;
    data.battery_autonomy = last.battery_autonomy;
    data.window_open = last.window_open;
    data.occupancy = last.occupancy;
  }

  return { data: data };
}
