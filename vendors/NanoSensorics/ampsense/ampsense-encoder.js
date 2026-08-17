// Nano Sensorics AMPSENSE LoRaWAN encoder（固定模板）
// Raw downlink passthrough encoder
"use strict";
function encodeDownlink(input) {
  var bytes = [];
  var h = (input && input.data && (input.data.raw || input.data.raw_downlink)) || '';
  h = String(h).replace(/[^0-9a-fA-F]/g, '');
  for (var i = 0; i + 1 < h.length; i += 2) bytes.push(parseInt(h.substr(i, 2), 16));
  return { bytes: bytes };
}
function Encode(fPort, obj) { return encodeDownlink({ data: obj }); }
