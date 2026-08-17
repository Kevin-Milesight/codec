// INTEGRA Metering TOPAS SONIC LW8 (LoRaWAN) payload decoder
// The TOPAS SONIC LW8 variant embeds the aquaradio MultiCom radio module
// (simultaneous LoRaWAN EU868 and wM-Bus 868), see TOPAS SONIC User Manual
// Topas_Sonic_UM-EN-01 section 6.1. Its LoRaWAN uplink uses the
// "WMBus telegram over LoRa" layout documented in:
//   - "aquaradio MultiCom Protocol" 9-735-PT-EN-05, section 3.6/3.9
//     (standard wM-Bus telegram, encryption mode 0, CRC removed;
//      RECORD1 main volume, RECORD2 reverse volume, RECORD3 error flag,
//      RECORD4 remaining battery lifetime)
//   - "Protocol aquastream" 9-730-PT-EN-08, section 4.5 "OMS over LoRaWAN"
//     (same frame family)
// Frame header and example water frame follow doc 9-735-PT-EN-05 verbatim.
"use strict";

// --- DIF/VIF unit tables (per official docs 9-730-PT-EN-08 and 3-140-P-LORA-EN-04) ---
// VIF table: value -> semantic info. scale multiplies the raw integer value.
var VIF_INFO = {
  // Energy (kWh)
  0x03:  { name: 'energy', scale: 0.001, unit: 'kWh' },
  0x04:  { name: 'energy', scale: 0.01,  unit: 'kWh' },
  0x05:  { name: 'energy', scale: 0.1,   unit: 'kWh' },
  0x06:  { name: 'energy', scale: 1,     unit: 'kWh' },
  0x07:  { name: 'energy', scale: 10,    unit: 'kWh' },
  0xfb00:{ name: 'energy', scale: 100,   unit: 'kWh' },
  0xfb01:{ name: 'energy', scale: 1000,  unit: 'kWh' },
  // Energy (MJ)
  0x0b:  { name: 'energy', scale: 0.001, unit: 'MJ' },
  0x0c:  { name: 'energy', scale: 0.01,  unit: 'MJ' },
  0x0d:  { name: 'energy', scale: 0.1,   unit: 'MJ' },
  0x0e:  { name: 'energy', scale: 1,     unit: 'MJ' },
  0x0f:  { name: 'energy', scale: 10,    unit: 'MJ' },
  0xfb08:{ name: 'energy', scale: 100,   unit: 'MJ' },
  0xfb09:{ name: 'energy', scale: 1000,  unit: 'MJ' },
  // Energy (kBTU / MBTU)
  0x803d:{ name: 'energy', scale: 0.001, unit: 'kBTU' },
  0x813d:{ name: 'energy', scale: 0.01,  unit: 'kBTU' },
  0x823d:{ name: 'energy', scale: 0.1,   unit: 'kBTU' },
  0x833d:{ name: 'energy', scale: 1,     unit: 'kBTU' },
  0x843d:{ name: 'energy', scale: 10,    unit: 'kBTU' },
  0x853d:{ name: 'energy', scale: 100,   unit: 'kBTU' },
  0x863d:{ name: 'energy', scale: 1000,  unit: 'kBTU' },
  // Volume (m3 / USGAL)
  0x13:  { name: 'volume', scale: 0.001, unit: 'm3' },
  0x14:  { name: 'volume', scale: 0.01,  unit: 'm3' },
  0x15:  { name: 'volume', scale: 0.1,   unit: 'm3' },
  0x16:  { name: 'volume', scale: 1,     unit: 'm3' },
  0x903d:{ name: 'volume', scale: 0.001, unit: 'USGAL' },
  0x913d:{ name: 'volume', scale: 0.01,  unit: 'USGAL' },
  0x923d:{ name: 'volume', scale: 0.1,   unit: 'USGAL' },
  0x933d:{ name: 'volume', scale: 1,     unit: 'USGAL' },
  // Mass (t)
  0x1b:  { name: 'mass', scale: 0.001, unit: 't' },
  0x1c:  { name: 'mass', scale: 0.01,  unit: 't' },
  0x1d:  { name: 'mass', scale: 0.1,   unit: 't' },
  0x1e:  { name: 'mass', scale: 1,     unit: 't' },
  // Instantaneous values (IEEE-754 float32)
  0x2b:  { name: 'power', type: 'float', unit: 'W' },
  0x3b:  { name: 'flow', type: 'float', unit: 'l/h' },
  0x5b:  { name: 'flow_temperature', type: 'float', unit: 'degC' },
  0x5f:  { name: 'return_temperature', type: 'float', unit: 'degC' },
  // Date / time / identifiers
  0x6d:  { name: 'date_time', type: 'typeF' },
  0x6c:  { name: 'date', type: 'typeG' },
  0x78:  { name: 'fabrication_number', type: 'bcd8' },
  // Info / battery (VIF 0xFD + VIFE)
  0xfd17:{ name: 'error_flag', type: 'uint16' },
  0xfd74:{ name: 'battery_life', type: 'uint16', unit: 'days' }
};

// Error flag bit definitions (aquastream protocol §4.6 / MultiCom §3.8)
var ERROR_FLAG_BITS = [
  ['tamper', 0],
  ['burst', 2],
  ['leakage', 3],
  ['no_consumption', 7],
  ['battery_low', 8],
  ['reverse_flow', 9],
  ['overflow', 10]
];

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------
function u16le(b, i)  { return b[i] | (b[i + 1] << 8); }
function u32le(b, i)  { return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0; }
function i32le(b, i)  { var v = u32le(b, i); return v >= 0x80000000 ? v - 0x100000000 : v; }

// Manual IEEE-754 single precision (little-endian) decode
function f32le(b, i) {
  var b0 = b[i], b1 = b[i + 1], b2 = b[i + 2], b3 = b[i + 3];
  var sign = (b3 & 0x80) ? -1 : 1;
  var exp = ((b3 & 0x7f) << 1) | (b2 >> 7);
  var mant = ((b2 & 0x7f) << 16) | (b1 << 8) | b0;
  if (exp === 0 && mant === 0) return 0;
  if (exp === 0xff) return sign * (mant ? NaN : Infinity);
  return sign * (1 + mant / 0x800000) * Math.pow(2, exp - 127);
}

// BCD encoded integer, n bytes, most significant nibble first.
// asString=true keeps leading zeros (used for serial numbers).
function bcd(b, i, n, asString) {
  var v = 0, s = '';
  for (var k = 0; k < n; k++) {
    var hi = (b[i + k] >> 4) & 0x0f, lo = b[i + k] & 0x0f;
    if (hi > 9 || lo > 9) return NaN;
    v = v * 100 + hi * 10 + lo;
    s += hi + '' + lo;
  }
  return asString ? s : v;
}

// EN 13757 data type F (date & time, no year field per standard): 4 bytes,
// binary bit fields: minute(6b), hour(5b), day(5b), month(4b); bit 7 = IV.
// Year is not transmitted (receiving system interprets it); we output MM-DD HH:MM.
function typeF(b, i) {
  var min = b[i] & 0x3f, hour = b[i + 1] & 0x1f, day = b[i + 2] & 0x1f, month = b[i + 3] & 0x0f;
  var inv = (b[i] & 0x80) || (b[i + 1] & 0x80) || (b[i + 2] & 0x80) || (b[i + 3] & 0x80);
  if (inv || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || min > 59) return null;
  function p(v) { return v < 10 ? '0' + v : '' + v; }
  return p(month) + '-' + p(day) + ' ' + p(hour) + ':' + p(min);
}

// Read a VIF (possibly multi-byte) starting at pos; returns {key, len}
function readVif(b, pos) {
  var v1 = b[pos];
  if (v1 === 0xfd && pos + 1 < b.length) return { key: 0xfd00 | b[pos + 1], len: 2 };
  if (v1 === 0xfb && pos + 1 < b.length) return { key: 0xfb00 | b[pos + 1], len: 2 };
  // two-byte VIF (0x80..0x93 followed by 0x3D), per CALEC ST III protocol table
  if (v1 >= 0x80 && v1 <= 0x93 && pos + 1 < b.length && b[pos + 1] === 0x3d) {
    return { key: (v1 << 8) | 0x3d, len: 2 };
  }
  return { key: v1, len: 1 };
}

// ---------------------------------------------------------------------------
// Main decoder
// ---------------------------------------------------------------------------
function decodeUplink(input) {
  var bytes = (input && input.bytes) || [];
  var data = {};
  if (!bytes || bytes.length < 12) {
    return { data: { error: 'payload too short' } };
  }
  var b = bytes;

  // --- message header (always transmitted, per official docs) ---
  // L-Field: number of following bytes (LEN-1 per EN 13757)
  data.len_field = b[0];
  data.c_field = b[1];
  // M-Field: manufacturer code 0xB425 (little-endian bytes B4 25)
  var man = u16le(b, 2);
  data.manufacturer = man === 0x25b4 ? 'INTEGRA Metering' : '0x' + man.toString(16);
  // S/N field: 4-byte BCD serial number
  data.serial_number = bcd(b, 4, 4, true);
  data.device_version = b[8];
  data.device_type = b[9]; // 0x07 = water
  var ci = b[10];
  var pos = 11;

  if (ci === 0x72) {
    // Long header (wM-Bus standard telegram)
    data.identification_number = bcd(b, pos, 4, true); pos += 4;
    pos += 2; // meter manufacturer code
    data.meter_version = b[pos++];
    data.meter_device_type = b[pos++];
    data.telegram_number = b[pos++];
    data.status = b[pos++];
    pos += 2; // configuration field
  } else {
    // Short header
    data.access_counter = b[pos++];
    data.status = b[pos++];
    pos += 2; // signature
  }

  // --- application layer records: DIF [DIFE] VIF [VIFE] VALUE ---
  var seen = {};
  while (pos < b.length) {
    var dif = b[pos++];
    var dife = null;
    if (dif & 0x80) { dife = b[pos++]; }           // DIFE present
    var vif = readVif(b, pos); pos += vif.len;
    var info = VIF_INFO[vif.key];

    var type = dif & 0x0f; // data length/type code (EN 13757-3)
    var value, raw;
    if (type === 0x05) {                           // float32
      if (pos + 4 > b.length) break;
      raw = value = f32le(b, pos); pos += 4;
    } else if (type === 0x0c) {                    // BCD8 (4 bytes)
      if (pos + 4 > b.length) break;
      raw = value = bcd(b, pos, 4); pos += 4;
    } else if (type === 0x04) {                    // int32
      if (pos + 4 > b.length) break;
      raw = value = i32le(b, pos); pos += 4;
    } else if (type === 0x02) {                    // int16
      if (pos + 2 > b.length) break;
      raw = value = u16le(b, pos); pos += 2;
    } else if (type === 0x01) {                    // int8
      if (pos + 1 > b.length) break;
      raw = value = b[pos++];
    } else {
      break; // unsupported DIF, stop parsing records
    }

    if (!info) {
      // unknown record: keep raw value for traceability
      if (!seen['record_' + vif.key]) { data['record_' + vif.key.toString(16)] = value; seen['record_' + vif.key] = true; }
      continue;
    }

    var fieldKey = info.name;
    if (fieldKey === 'volume') fieldKey = 'main_volume';
    else if (fieldKey === 'energy') fieldKey = 'main_energy';
    else if (fieldKey === 'mass') fieldKey = 'main_mass';
    if (dife !== null) {
      if (dife === 0x10) { if (fieldKey === 'main_energy') fieldKey = 'energy_tariff_1'; else if (fieldKey === 'main_volume') fieldKey = 'reverse_volume'; }
      else if (dife === 0x20) { if (fieldKey === 'main_energy') fieldKey = 'energy_tariff_2'; }
      else { fieldKey = fieldKey + '_dife' + dife.toString(16); }
    }

    // semantic conversion
    if (info.type === 'float') {
      data[fieldKey] = round(value);
    } else if (info.type === 'typeF') {
      data[fieldKey] = typeF(b, pos - 4);
    } else if (info.type === 'typeG') {
      data[fieldKey] = bcd(b, pos - 2, 2);
    } else if (fieldKey === 'error_flag') {
      data[fieldKey] = raw;
      for (var i = 0; i < ERROR_FLAG_BITS.length; i++) {
        var fb = ERROR_FLAG_BITS[i];
        data['alarm_' + fb[0]] = (raw & (1 << fb[1])) ? 1 : 0;
      }
    } else if (fieldKey === 'battery_life') {
      data[fieldKey] = raw; // days
    } else if (info.name === 'volume') {
      // volume stored in raw units (liter or m3), normalize to m3
      if (info.unit === 'm3') data[fieldKey] = round(value * info.scale);
      else data[fieldKey] = round(value * info.scale);
    } else {
      data[fieldKey] = round(value * (info.scale !== undefined ? info.scale : 1));
    }
  }

  return { data: data };
}

function round(v) {
  if (typeof v !== 'number' || !isFinite(v)) return v;
  return Math.round(v * 10000) / 10000;
}
