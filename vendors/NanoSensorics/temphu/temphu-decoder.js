// Nano Sensorics TEMPHU LoRaWAN payload decoder（基于官方 payload 说明自实现）
// 上行帧布局（来源：官方手册 TEMPHU Manual 2025-11 Data sizes 表 ——
//   温度 2 字节 / 湿度 1 字节 / 电池电压 2 字节；
//   帧字段顺序按官方手册字段顺序与同系列 CARBONLESS 官方集成文档
//   （docs.iotcreators.com/docs/nanosensorics-carbonless）的
//   Temperature -> Humidity -> Battery 排列推断）：
//   bytes 0-1 : 温度，byte0 有符号整数部分（-128..+128 °C），byte1 小数点后两位（0-100）
//   byte  2   : 相对湿度，1 字节整数 0-100 %
//   bytes 3-4 : 电池电压，byte3 整数伏特，byte4 小数点后两位
"use strict";
function decodeUplink(input) {
  var bytes = input.bytes;
  var data = {};
  if (!bytes || bytes.length < 5) return { data: data };
  // 温度 (°C) = 有符号整数部分 + 小数部分 / 100
  var tInt = (bytes[0] & 0x80) ? bytes[0] - 256 : bytes[0];
  data.temperature = tInt + bytes[1] / 100;
  // 相对湿度 (%) = 1 字节整数 0-100
  data.relative_humidity = bytes[2];
  // 电池电压 (V) = 整数伏特 + 两位小数
  data.battery_voltage = bytes[3] + bytes[4] / 100;
  return { data: data };
}
