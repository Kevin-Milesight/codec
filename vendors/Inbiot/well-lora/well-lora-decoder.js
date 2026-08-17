// inbiot well-lora — LoRaWAN payload decoder
// 字段清单来自官方 payload 说明（协议事实）；解析逻辑为自实现。
"use strict";
var FIELDS = ["temperature","humidity","co2","voc","pm2_5","pm10","sound","timetosend","ventilation","ledstatus","usewifi","lorawanregion","lorawanchannelmask","ledconfiguration","touchenable","ch2o","pm1_0","pm4","o3","no2","co","vindex","tindex","virusindex","iaqindex","moldindex"];
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
