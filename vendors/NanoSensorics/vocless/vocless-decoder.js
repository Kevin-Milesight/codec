// Nano Sensorics VOCLESS LoRaWAN payload decoder（基于官方 payload 说明自实现）
// 上行帧布局（来源：官方手册 VOCLESS Manual 2025-11 Data sizes 表 ——
//   VOC 2 字节 / 温度 2 字节 / 湿度 1 字节 / 电池电压 2 字节；
//   帧字段顺序按官方手册字段顺序与同系列 CARBONLESS 官方集成文档
//   （docs.iotcreators.com/docs/nanosensorics-carbonless，主测量字段在帧首、
//   Temperature -> Humidity -> Battery 排列）推断）：
//   bytes 0-1 : VOC Index，unsigned 16-bit 大端（官方 BIN 0-65535，实际 0-500 Index）
//   bytes 2-3 : 温度，byte2 有符号整数部分（-128..+128 °C），byte3 小数点后两位（0-100）
//   byte  4   : 相对湿度，1 字节整数 0-100 %
//   bytes 5-6 : 电池电压，byte5 整数伏特，byte6 小数点后两位
"use strict";
function decodeUplink(input) {
  var bytes = input.bytes;
  var data = {};
  if (!bytes || bytes.length < 7) return { data: data };
  // VOC Index = unsigned 16-bit big-endian（官方实际范围 0-500）
  data.voc_index = (bytes[0] << 8) | bytes[1];
  // 温度 (°C) = 有符号整数部分 + 小数部分 / 100
  var tInt = (bytes[2] & 0x80) ? bytes[2] - 256 : bytes[2];
  data.temperature = tInt + bytes[3] / 100;
  // 相对湿度 (%) = 1 字节整数 0-100
  data.relative_humidity = bytes[4];
  // 电池电压 (V) = 整数伏特 + 两位小数
  data.battery_voltage = bytes[5] + bytes[6] / 100;
  return { data: data };
}
