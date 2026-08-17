// Gossen Metrawatt EM2387 LORAWAN LoRaWAN payload decoder
// Based on the official "Interface Description: LPWAN for Multi Tariff Meters U2X8X W8"
// (Gossen Metrawatt GmbH, doc 3-447-248-03), chapter 3.2.3, Table 6 & Table 7.
// Byte layout (little endian, 28 bytes):
//   Byte 0      UINT8   Date/time structure identifier = 0x24
//   Byte 1      UINT8   Second
//   Byte 2      UINT8   Minute
//   Byte 3      UINT8   Hour
//   Byte 4      UINT8   Day
//   Byte 5      UINT8   Month
//   Bytes 6-7   UINT16  Year
//   Byte 8      UINT8   Total active energy import identifier = 0x25
//   Bytes 9-16  Double  Total active energy import (kWh)
//   Byte 17     UINT8   Total active energy export identifier = 0x26
//   Bytes 18-25 Double  Total active energy export (kWh)
//   Byte 26     UINT8   Error status byte identifier = 0x54
//   Byte 27     UINT8   Error status byte (see bit table below)
// Error status byte bits (Table 7):
//   Bit 0  Phase voltage too low  (U1/U2/U3 < 75% of nominal voltage)
//   Bit 1  Phase voltage too high (U1/U2/U3 > 120% of nominal voltage)
//   Bit 2  Exceeded phase current at I1, I2 or I3
//   Bit 3  Error in frequency synchronization / wrong rotation direction
//   Bit 4  Reset occurred
//   Bits 5-6 Problems with internal communication
//   Bit 7  DC offset too high / device not calibrated / device broken
// Self-implemented, no third-party code.
"use strict";

// Read an IEEE 754 double precision value (8 bytes) stored little-endian.
function readDoubleLE(bytes, offset) {
  var b0 = bytes[offset],     b1 = bytes[offset + 1];
  var b2 = bytes[offset + 2], b3 = bytes[offset + 3];
  var b4 = bytes[offset + 4], b5 = bytes[offset + 5];
  var b6 = bytes[offset + 6], b7 = bytes[offset + 7];
  var sign = (b7 & 0x80) !== 0 ? -1 : 1;
  var expBits = ((b7 & 0x7F) << 4) | (b6 >> 4);
  // 52-bit mantissa: high 20 bits (b6 low nibble, b5, b4) + low 32 bits (b3..b0)
  var mantHigh = ((b6 & 0x0F) << 16) | (b5 << 8) | b4;
  var mantLow = (b3 << 24) | (b2 << 16) | (b1 << 8) | b0;
  var mantissa = mantHigh * 4294967296 + mantLow; // full 52-bit integer
  if (expBits === 0x7FF) {
    return NaN; // Infinity / NaN is not a valid meter reading
  }
  if (expBits === 0) {
    if (mantissa === 0) return 0; // signed zero
    return sign * mantissa * Math.pow(2, -1074); // subnormal
  }
  return sign * (1 + mantissa / 4503599627370496) * Math.pow(2, expBits - 1023);
}

function readUint16LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function pad2(n) {
  return (n < 10 ? "0" : "") + n;
}

function decodeUplink(input) {
  var bytes = input && input.bytes ? input.bytes : [];
  var data = {};

  // Short/dummy messages (e.g. 1-byte deploy mode probe) have no measurement data.
  if (bytes.length < 28) {
    data.raw = bytes.map(function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    return { data: data };
  }

  // --- Date/time block (bytes 0..7), identifier must be 0x24 ---
  var second = bytes[1];
  var minute = bytes[2];
  var hour = bytes[3];
  var day = bytes[4];
  var month = bytes[5];
  var year = readUint16LE(bytes, 6);
  data.date_time_identifier = bytes[0];
  data.datetime = year + "-" + pad2(month) + "-" + pad2(day) + "T" +
                  pad2(hour) + ":" + pad2(minute) + ":" + pad2(second);
  data.year = year;
  data.month = month;
  data.day = day;
  data.hour = hour;
  data.minute = minute;
  data.second = second;

  // --- Total active energy import (bytes 8..16), identifier must be 0x25 ---
  data.energy_import_identifier = bytes[8];
  data.total_active_energy_import = readDoubleLE(bytes, 9); // kWh

  // --- Total active energy export (bytes 17..25), identifier must be 0x26 ---
  data.energy_export_identifier = bytes[17];
  data.total_active_energy_export = readDoubleLE(bytes, 18); // kWh

  // --- Error status byte (bytes 26..27), identifier must be 0x54 ---
  data.error_status_identifier = bytes[26];
  var err = bytes[27];
  data.error_status = err;
  data.error_voltage_low = (err >> 0) & 1;       // bit 0
  data.error_voltage_high = (err >> 1) & 1;      // bit 1
  data.error_overcurrent = (err >> 2) & 1;       // bit 2
  data.error_frequency_sync = (err >> 3) & 1;    // bit 3
  data.error_reset = (err >> 4) & 1;             // bit 4
  data.error_internal_comm = (err >> 5) & 1;     // bits 5-6
  data.error_dc_offset = (err >> 7) & 1;         // bit 7

  return { data: data };
}
