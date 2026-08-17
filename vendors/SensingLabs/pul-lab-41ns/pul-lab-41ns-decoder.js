// Sensing Labs SenlabM (SENLAB M - PUL-LAB-41NS) LoRaWAN payload decoder
// 依据官方 User Guide 与官方 codec.slbase.io 行为验证自实现（未复制任何第三方代码）。
// FPort 3 datalog 帧：[ID 1B][BATTERY 1B(值×100/254 %)][TIME 3B][测量值...]
// FPort 4 RESTART 帧：[0x00][DEV_EUI 8B][APP_TYPE 1B][VERSION 3B][EXT 1B][LOG_PERIOD 2B(×2s)][TX_PERIOD 2B(×2s)][MAX_BATT 4B(mAs)]
"use strict";

var MODEL_SLUG = "pul-lab-41ns";
var MODEL_FAMILY = "SenlabM";
var DATALOG_PREFIX = 0x02;
var DATALOG_PREFIX2 = null;

function decodeUplink(input) {
  var bytes = input.bytes;
  var fPort = input.fPort;
  var data = {};
  if (!bytes || bytes.length < 2) { return { data: data }; }
  if (fPort === 4) {
    decodeRestart(bytes, data);
  } else if (fPort === 3) {
    decodeDatalog(bytes, data);
  }
  return { data: data };
}

function decodeRestart(bytes, data) {
  // RESTART/START 帧：设备激活/重启后自动发送，所有 Senlab 型号通用
  if (bytes.length < 13) { return; }
  data.start_event = 1;
  data.dev_eui = toHex(bytes.slice(1, 9));
  data.firmware_type = String.fromCharCode(bytes[9] || 0x3f);
  data.firmware_version = bytes[10] + "." + bytes[11] + "." + bytes[12];
  if (bytes.length >= 15) { data.log_period_min = round2(((bytes[13] << 8) | bytes[14]) * 2 / 60); }
  if (bytes.length >= 17) { data.tx_period_min = round2(((bytes[15] << 8) | bytes[16]) * 2 / 60); }
  if (bytes.length >= 21) { data.max_battery_mas = u32be(bytes, 17); }
}

function decodeDatalog(bytes, data) {
  var prefix = bytes[0];
  var ok = (DATALOG_PREFIX !== null && prefix === DATALOG_PREFIX) ||
           (DATALOG_PREFIX2 !== null && prefix === DATALOG_PREFIX2);
  if (!ok) { return; }
  // battery：1 字节，1/254 → %（向下取整，与官方 codec 一致）
  data.battery_current_level = Math.floor(bytes[1] * 100 / 254);
  // SenlabM：raw_index（脉冲计数），datalog 帧取尾部 2B 为最新 log（MSB first）
  if (bytes.length >= 7) {
    data.raw_index = u16be(bytes, bytes.length - 2);
  }
}

// 工具函数
function u16be(b, i) { return ((b[i] << 8) | b[i + 1]) >>> 0; }
function u32be(b, i) { return ((b[i] * 16777216) + (b[i + 1] * 65536) + (b[i + 2] * 256) + b[i + 3]) >>> 0; }
function round2(x) { return Math.round(x * 100) / 100; }
function toHex(arr) {
  var s = "";
  for (var i = 0; i < arr.length; i++) {
    var h = arr[i].toString(16);
    if (h.length < 2) { h = "0" + h; }
    s += h;
  }
  return s;
}

// 部分网关运行时兼容入口
function Decoder(bytes, fPort) { return decodeUplink({ bytes: bytes, fPort: fPort }).data; }