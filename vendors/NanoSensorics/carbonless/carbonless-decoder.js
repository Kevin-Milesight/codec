// Nano Sensorics CARBONLESS LoRaWAN payload decoder（基于官方 payload 说明自实现）
// 上行帧布局（来源：官方集成文档 docs.iotcreators.com/docs/nanosensorics-carbonless
//           + 官方手册 CARBONLESS Manual v2.7 / 2025-11 Data sizes 表）：
//   bytes 0-1 : CO2 浓度，unsigned 16-bit 大端，单位 ppm（官方范围 400-5000 ppm，BIN 0-65535）
//   bytes 2-3 : 温度，byte2 有符号整数部分（-128..+128 °C），byte3 小数点后两位（0-100）
//   byte  4   : 相对湿度，1 字节整数 0-100 %
//   bytes 5-6 : 电池电压，byte5 整数伏特，byte6 小数点后两位
"use strict";
function decodeUplink(input) {
  var bytes = input.bytes;
  var data = {};
  if (!bytes || bytes.length < 7) return { data: data };
  // CO2 (ppm) = unsigned 16-bit big-endian
  data.co2 = (bytes[0] << 8) | bytes[1];
  // 温度 (°C) = 有符号整数部分 + 小数部分 / 100
  var tInt = (bytes[2] & 0x80) ? bytes[2] - 256 : bytes[2];
  data.temperature = tInt + bytes[3] / 100;
  // 相对湿度 (%) = 1 字节整数 0-100
  data.relative_humidity = bytes[4];
  // 电池电压 (V) = 整数伏特 + 两位小数
  data.battery_voltage = bytes[5] + bytes[6] / 100;
  return { data: data };
}
