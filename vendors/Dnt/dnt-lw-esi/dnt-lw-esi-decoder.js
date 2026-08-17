// dnt dnt-lw-esi — LoRaWAN payload decoder
// 字段清单来自官方 payload 说明（协议事实）；解析逻辑为自实现。
"use strict";
var FIELDS = ["energy","power","parser_error","tx_reason","supply_voltage","frame_type","error_msg","bootloader_version","firmware_version","hw_revision"];
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
