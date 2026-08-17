// mutelcor mtc-au02 — LoRaWAN payload decoder
// 字段清单来自官方 payload 说明（协议事实）；解析逻辑为自实现。
"use strict";
var FIELDS = ["button","digital_input","[99] complete payload [hex]","[01] port","[02] payload version","[03] voltage battery/input [v]","[04] opcode","[89] decode error","[88] undecoded payload left [hex]","[33] alarm id","[03] pressure [hpa]","[22] switch state","[37] uid type","[38] uid"];
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
