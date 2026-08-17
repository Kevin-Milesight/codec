// NanoSense EP5000MML IAQ probe LoRaWAN payload decoder
// Self-implemented from the official vendor document:
//   "Commissioning of the EP5000-L (LoRa) probe" (EP5000L-commissioning.pdf, V5),
//   chapters 8.2.1 "Uplink" and 9 "CODEC example (Objenious)".
// EP5000MML-N is the Multi-Measurement LoRaWAN variant of the EP5000 family
// (see "Gamme EP5000 QAI", EP5000-line-FR-2023-V2.pdf): it shares the exact same
// 37-byte LoRaWAN telegram as every other LoRa version of the EP5000 range
// (EP5000L, E5000AL, ...). The full measurement set is CO2, TVOC, sulphurous
// odors, PM10/PM2.5/PM1, temperature, humidity, noise, atmospheric pressure,
// lux + light color temperature plus the physiological indices.
// Byte layout (37 bytes = 296 bits, MSB-first bit stream):
//   Byte 0      presence bitmask (see bits below)
//   Byte 1      EP5000 probe firmware version (bits 4-7 integer, bits 0-3 tenths)
//   Byte 2      LoRa stack firmware version (same encoding)
//   Bytes 3-4   BITE (Built-In Test Equipment) FRU flags (see bits below)
//   Byte 5      autonomy 0..100 % (1 %/LSB, indoor solar stand-alone version)
//   Bytes 6-7   emission rate in minutes (0 = default 10 min, range 1 min..12 h)
//   Byte 8      humidity UINT8 /2 %RH            (1 LSB = 0.5 %, 0..100 %RH)
//   Bits 72..80 temperature UINT9 /10 degC       (0..+51 degC, 0.1 degC/LSB)
//   Bits 81..89 PM10 9 bits x1 ug/m3
//   Bits 90..98 PM2.5 9 bits x1 ug/m3
//   Bits 99..107 PM1 9 bits x1 ug/m3
//   Bits 108..114 Noise avg 7 bits x1 dBa        (measurement range 17.7..120 dBa)
//   Bits 115..121 Noise peak 7 bits x1 dBa
//   Bit  122     dummy
//   Bits 123..135 CO2 13 bits x1 ppm             (0..5000 ppm)
//   Bits 136..151 TVOC 16 bits x0.01 ug/m3       (0..655.35 ug/m3)
//   Bits 152..167 Formaldehyde 16 bits x0.01 ug/m3
//   Bits 168..183 Benzene 16 bits x0.01 ug/m3
//   Bits 184..191 Sulphurous odor 8 bits x1 OU   (0..100 OU)
//   Bits 192..199 NOx 8 bits x2 ppb              (0..500 ppb)
//   Bits 200..207 Ozone 8 bits x2 ppb            (0..500 ppb)
//   Bits 208..221 Atmospheric pressure 14 bits /10 mbar (0.1 mbar/LSB)
//   Bits 222..231 Lux 10 bits x4 lux             (0..4096 lux)
//   Bits 232..239 Light color temperature 8 bits x23 +1635 degK (1635..7500 degK)
//   Bits 240..247 Flickering 8 bits x1 %         (0..100 %)
//   Bits 248..255 Health index 8 bits x1 %
//   Bits 256..263 Cognitivity index 8 bits x1 %
//   Bits 264..271 Sleep quality index 8 bits x1 %
//   Bits 272..279 Throat irritation index 8 bits x1 %
//   Bits 280..287 Virus spreading risk index 8 bits x1 %
//   Bits 288..295 Building health index 8 bits x1 %
// Presence byte bits (official codec order, MSB first):
//   bit7 = T/RH active, bit6 = PM, bit5 = noise, bit4 = CO2, bit3 = TVOC/odor,
//   bit2 = NOx/O3, bit1 = benzene/formaldehyde, bit0 = lux & light T.
// BITE bits (official codec order, MSB first; names from the V5 doc table):
//   bit15 = LoRa front panel board, bit14 = CO2 single band, bit13 = CO2 dual band,
//   bit12 = VOC/odors/NOx/O3 module, bit11 = motherboard, bit10 = interconnection
//   board, bit9 = particles board, bit8 = radio power supply board,
//   bit7 = multiple failures, bit6 = perishable sensor end of life.
// Scaling notes: TVOC/Formaldehyde/Benzene use x0.01 ug/m3 per the field-level
// measurement range given in the doc (0..655.35 ug/m3 for 65535 LSB);
// noise is emitted as raw dBa (1 dBa/LSB) because the doc gives no offset formula.
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
  data.temp_rh_active = (presence >> 7) & 1;
  data.pm_active = (presence >> 6) & 1;
  data.noise_active = (presence >> 5) & 1;
  data.co2_active = (presence >> 4) & 1;
  data.voc_odor_active = (presence >> 3) & 1;
  data.nox_o3_active = (presence >> 2) & 1;
  data.benzene_formaldehyde_active = (presence >> 1) & 1;
  data.light_active = (presence >> 0) & 1;

  // --- Firmware versions ---
  var fwProbe = r.read(8);
  var fwLora = r.read(8);
  data.firmware_ep5000 = round2((fwProbe >> 4) + (fwProbe & 0x0F) / 10);
  data.firmware_lora = round2((fwLora >> 4) + (fwLora & 0x0F) / 10);

  // --- BITE (16 bits) ---
  var bite = r.read(16);
  data.bite_front_lora = (bite >> 15) & 1;
  data.bite_co2_single = (bite >> 14) & 1;
  data.bite_co2_dual = (bite >> 13) & 1;
  data.bite_voc_nox_o3 = (bite >> 12) & 1;
  data.bite_motherboard = (bite >> 11) & 1;
  data.bite_interboard = (bite >> 10) & 1;
  data.bite_pm_board = (bite >> 9) & 1;
  data.bite_power_lora = (bite >> 8) & 1;
  data.bite_multiple_failure = (bite >> 7) & 1;
  data.bite_sensor_eol = (bite >> 6) & 1;

  // --- Autonomy & emission rate ---
  data.autonomy = r.read(8);       // %
  data.emission_rate = r.read(16); // minutes

  // --- Measurements ---
  var humRaw = r.read(8);
  var tempRaw = r.read(9);
  var pm10Raw = r.read(9);
  var pm25Raw = r.read(9);
  var pm1Raw = r.read(9);
  var noiseAvgRaw = r.read(7);
  var noisePeakRaw = r.read(7);
  r.read(1);                       // dummy
  var co2Raw = r.read(13);
  var tvocRaw = r.read(16);
  var formalRaw = r.read(16);
  var benzeneRaw = r.read(16);
  var odorRaw = r.read(8);
  var noxRaw = r.read(8);
  var ozoneRaw = r.read(8);
  var pressRaw = r.read(14);
  var luxRaw = r.read(10);
  var lightTempRaw = r.read(8);
  var flickRaw = r.read(8);
  var healthRaw = r.read(8);
  var cogRaw = r.read(8);
  var sleepRaw = r.read(8);
  var throatRaw = r.read(8);
  var virusRaw = r.read(8);
  var buildingRaw = r.read(8);

  data.relative_humidity = round2(humRaw / 2);              // %RH
  data.temperature = round2(tempRaw / 10);                  // degC
  data.pm10 = pm10Raw;                                      // ug/m3
  data.pm2_5 = pm25Raw;                                     // ug/m3
  data.pm1 = pm1Raw;                                        // ug/m3
  data.noise_avg = noiseAvgRaw;                             // dBa
  data.noise_peak = noisePeakRaw;                           // dBa
  data.co2 = co2Raw;                                        // ppm
  data.tvoc = round2(tvocRaw * 0.01);                       // ug/m3
  data.formaldehyde = round2(formalRaw * 0.01);             // ug/m3
  data.benzene = round2(benzeneRaw * 0.01);                 // ug/m3
  data.odor = odorRaw;                                      // OU (odor units)
  data.nox = noxRaw * 2;                                    // ppb
  data.ozone = ozoneRaw * 2;                                // ppb
  data.atmospheric_pressure = round2(pressRaw / 10);        // mbar (hPa)
  data.lux = luxRaw * 4;                                    // lux
  data.light_temp = 1635 + lightTempRaw * 23;               // degK
  data.flickering = flickRaw;                               // %
  data.health_index = healthRaw;                            // %
  data.cognitivity_index = cogRaw;                          // %
  data.sleep_index = sleepRaw;                              // %
  data.throat_irritation_index = throatRaw;                 // %
  data.virus_risk_index = virusRaw;                         // %
  data.building_health_index = buildingRaw;                 // %

  return { data: data };
}
