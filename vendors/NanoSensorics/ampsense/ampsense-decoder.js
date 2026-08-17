// Nano Sensorics AMPSENSE LoRaWAN payload decoder（基于官方 payload 说明自实现）
// 上行帧布局（来源：官方集成文档 docs.iotcreators.com/docs/nanosensorics-ampsense
//           + 官方手册 AMPSENSE Manual 2025-11 Data sizes 表）：
//   bytes 0-1 : 电流 L1 (A)，byte0 整数，byte1 一位小数
//   bytes 2-3 : 电流 L2 (A)
//   bytes 4-5 : 电流 L3 (A)
//   bytes 6-7 : 电池电压，byte6 整数伏特，byte7 小数点后两位
"use strict";
function decodeUplink(input) {
  var bytes = input.bytes;
  var data = {};
  if (!bytes || bytes.length < 8) return { data: data };
  // 相电流 (A) = 整数部分 + 一位小数 / 10
  data.current_l1 = bytes[0] + bytes[1] / 10;
  data.current_l2 = bytes[2] + bytes[3] / 10;
  data.current_l3 = bytes[4] + bytes[5] / 10;
  // 电池电压 (V) = 整数伏特 + 两位小数
  data.battery_voltage = bytes[6] + bytes[7] / 100;
  return { data: data };
}
