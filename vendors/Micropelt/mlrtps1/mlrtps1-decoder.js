// micropelt mlrtps1 — LoRaWAN payload decoder
// 字段清单来自官方 payload 说明（协议事实）；解析逻辑为自实现。
"use strict";
var FIELDS = ["temperature","motion","ambient_temperature","pir_status","energy_storage_low","radio_communication_error","radio_signal_strength","pir_sensor_failure","ambient_temperature_failure","storage_voltage","set_point_temperature_value"];
function decodeUplink(input) {
  var bytes = (input.bytes || []).slice();
  var data = {};
  var idx = 0;
  for (var i = 0; i < FIELDS.length && idx < bytes.length; i++) {
    var v = 0;
    for (var b = 0; b < 2 && idx < bytes.length; b++, idx++) v = (v << 8) | (bytes[idx] & 0xff);
    data[FIELDS[i]] = v;
  }
  return { data: data };
}
