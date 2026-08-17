// NanoSense QAA (Atmospheric Air Quality probe) LoRaWAN payload decoder
// Self-implemented from the official vendor document:
//   "Parametrage de la sonde de Qualite de l'Air Atmospherique en mode LoRa
//   ou LoRaWAN" (QAA-Parametrage-LoRa.pdf, V6), chapters 3.2.1 "Voie montante",
//   including the official Objenious codec example (chapter 8) that confirms the
//   exact bit order. The QAA and the AAQ probe share the same LoRa telegram
//   (AAQ-LoRa-Setting.pdf, same 44-byte layout).
// Byte layout (44 bytes, MSB-first bit stream):
//   Byte 0      presence bitmask (bit0 = T/RH active, bit1 = PM, bit2 = Noise,
//               bit3 = Gas1, bit4 = Gas2, bit5 = Gas3, bit6 = Battery, bit7 = reserved)
//   Byte 1      QAA firmware version (bits 4-7 integer, bits 0-3 tenths, 1.0..16.16)
//   Byte 2      LoRa module firmware version (same encoding)
//   Bytes 3-4   emission rate in minutes (0 = default 10 min, range 1 min..12 h)
//   Byte 5      battery state: bit7 = 0 -> %, 1 -> hours; bits 0-6 value (0..100 % / 0..125 h)
//   Bytes 6..43 2 x 19-byte measurement groups:
//     group (19 bytes = 152 bits):
//       humidity            UINT8  x100/255 %RH        (1 LSB = 0.39 %)
//       temperature_dummy   6 bits
//       temperature         UINT10 x80/1023 degC       (0..+80 degC, EEP A5 04 02)
//       PM10_Value          9 bits x1 ug/m3
//       PM2.5_Value         9 bits x1 ug/m3
//       PM1_Value           9 bits x1 ug/m3
//       PM_Dummy            5 bits (bit0 = PM1 active, bit1 = PM2.5 active,
//                                   bit2 = PM10 active)
//       Noise_Avg           UINT10 -> 17.7 + raw*0.1 dBa (0.1 dBa/LSB, 17.7..120 dBa)
//       Noise_Peak          UINT10 -> 17.7 + raw*0.1 dBa
//       Noise_Dummy         4 bits
//       Gas1_Value          UINT16 x1 ug/m3
//       Gas1_Type           UINT8  gas id (0=NOX,1=NO2,2=O3,3=H2S,4=SO2,5=NH3)
//       Gas2_Value          UINT16 x1 ug/m3
//       Gas2_Type           UINT8
//       Gas3_Value          UINT16 x1 ug/m3
//       Gas3_Type           UINT8
// Gas concentration scaling note (official doc): 1 LSB = 1 ug/m3; the gases
// NOX/NO2/O3 additionally carry a 0.1 multiplication factor (0.1 ug/m3 res.),
// H2S/SO2/ammoniac factors are marked TBD (not applied here).
// The 2 groups are successive measurements (oldest first); the gateway time stamps.
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

  // --- Header ---
  var presence = r.read(8);
  data.temp_rh_active = (presence >> 0) & 1;
  data.pm_active = (presence >> 1) & 1;
  data.noise_active = (presence >> 2) & 1;
  data.gas1_active = (presence >> 3) & 1;
  data.gas2_active = (presence >> 4) & 1;
  data.gas3_active = (presence >> 5) & 1;
  data.battery_active = (presence >> 6) & 1;

  var fwQaa = r.read(8);
  var fwLora = r.read(8);
  data.firmware_qaa = round2((fwQaa >> 4) + (fwQaa & 0x0F) / 10);
  data.firmware_lora = round2((fwLora >> 4) + (fwLora & 0x0F) / 10);
  data.emission_rate = r.read(16); // minutes (0 = default 10 min)

  var batUnit = r.read(1);
  var batState = r.read(7);
  data.battery_unit = batUnit;           // 0 = %, 1 = hours
  data.battery_state = batState;         // 0..100 % or 0..125 h

  // --- 2 measurement groups (19 bytes each) ---
  var measurements = [];
  for (var g = 0; g < 2 && r.remaining() >= 152; g++) {
    var m = {};
    var humRaw = r.read(8);
    r.read(6);                            // temperature dummy
    var tempRaw = r.read(10);
    var pm10Raw = r.read(9);
    var pm25Raw = r.read(9);
    var pm1Raw = r.read(9);
    var pmDummy = r.read(5);
    var noiseAvgRaw = r.read(10);
    var noisePeakRaw = r.read(10);
    r.read(4);                            // noise dummy
    var g1v = r.read(16);
    var g1t = r.read(8);
    var g2v = r.read(16);
    var g2t = r.read(8);
    var g3v = r.read(16);
    var g3t = r.read(8);

    m.relative_humidity = round2(humRaw * 100 / 255);   // %RH
    m.temperature = round2(tempRaw * 80 / 1023);        // degC (0..+80)
    m.pm10 = pm10Raw;                                   // ug/m3
    m.pm2_5 = pm25Raw;                                  // ug/m3
    m.pm1 = pm1Raw;                                     // ug/m3
    m.pm1_active = (pmDummy >> 0) & 1;
    m.pm2_5_active = (pmDummy >> 1) & 1;
    m.pm10_active = (pmDummy >> 2) & 1;
    m.noise_avg = round2(17.7 + noiseAvgRaw * 0.1);     // dBa
    m.noise_peak = round2(17.7 + noisePeakRaw * 0.1);   // dBa
    m.gas1_value = g1v;                                 // ug/m3 (raw)
    m.gas1_type = g1t;
    m.gas2_value = g2v;
    m.gas2_type = g2t;
    m.gas3_value = g3v;
    m.gas3_type = g3t;
    measurements.push(m);
  }
  data.measurements = measurements;

  // Top-level convenience fields: latest group (last in the frame = most recent).
  if (measurements.length > 0) {
    var last = measurements[measurements.length - 1];
    data.relative_humidity = last.relative_humidity;
    data.temperature = last.temperature;
    data.pm10 = last.pm10;
    data.pm2_5 = last.pm2_5;
    data.pm1 = last.pm1;
    data.noise_avg = last.noise_avg;
    data.noise_peak = last.noise_peak;
    data.gas1_value = last.gas1_value;
    data.gas1_type = last.gas1_type;
    data.gas2_value = last.gas2_value;
    data.gas2_type = last.gas2_type;
    data.gas3_value = last.gas3_value;
    data.gas3_type = last.gas3_type;
  }

  return { data: data };
}
