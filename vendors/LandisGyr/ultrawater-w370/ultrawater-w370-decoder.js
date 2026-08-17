// Landis+Gyr ULTRAWATER W370 (WM1) LoRaWAN payload decoder
// 基于官方文档自实现（不复制第三方代码）：
//   - Landis+Gyr W370 Technical Description（与 W270 同系列，W270_W370 Operating and Installation Instruction EN）（12.1 "LoRaWan / Wireless M-Bus"，
//     预定义数据电报 0-8 字段清单）
//   - 数据格式：M-Bus（OMS v4 / EN 13757-4，W270 技术描述 12.1 表）
//   - DIF/VIF 数据记录编码依据 EN 13757-3（OMS 标准）
// 注意：W370 官方文档只公开了预定义电报的字段清单，
// 具体字节布局（TKB3569 "Description of the WM1 LoRaWan Interface"）未公开，
// 本 decoder 按 OMS/EN13757-3 标准数据记录（DIF/VIF/VIFE/DATA）解析标准字段，
// 字段存在性以 W270 技术描述确证为准。
"use strict";

var TELEGRAM_FIELDS = {
  0: ["volume_forward", "water_temperature", "target_date_volume_forward", "date_target_date", "battery_life_date", "error"],
  1: ["volume_forward", "water_temperature", "target_date_volume_forward", "date_target_date", "battery_life_date", "error", "auc_leakage"],
  2: ["target_date_volume_forward", "date_target_date", "battery_life_date", "error", "serial_number"],
  3: ["target_date_volume_forward", "date_target_date", "battery_life_date", "error", "auc_leakage", "serial_number"],
  4: ["volume_forward", "volume_backward", "date_target_date", "target_date_volume_forward", "battery_life_date", "error"],
  5: ["volume_forward", "volume_backward", "current_flow", "water_temperature", "flow_histogram", "downtime", "zero_flow_days", "battery_life_date"],
  6: ["volume_forward", "error"],
  7: ["volume_forward", "error", "auc_leakage"],
  8: ["target_date_volume_forward", "error", "auc_leakage"]
};

// M-Bus BCD 解码（LSB first，每字节两位十进制数字）
function readBCD(bytes, pos, len) {
  var s = "";
  for (var i = len - 1; i >= 0; i--) {
    var b = bytes[pos + i] & 0xFF;
    s += String((b >> 4) & 0x0F) + String(b & 0x0F);
  }
  return parseInt(s, 10);
}

function readU16LSB(bytes, pos) {
  return (bytes[pos] & 0xFF) | ((bytes[pos + 1] & 0xFF) << 8);
}

// VIF 换算因子（EN 13757-3 标准主表；字段单位/换算为协议事实）
function vifFactor(vif) {
  switch (vif) {
    // 体积 V [m3]
    case 0x11: return { unit: "m3", factor: 0.00001 };
    case 0x12: return { unit: "m3", factor: 0.0001 };
    case 0x13: return { unit: "m3", factor: 0.001 };
    case 0x14: return { unit: "m3", factor: 0.01 };
    case 0x15: return { unit: "m3", factor: 0.1 };
    case 0x16: return { unit: "m3", factor: 1 };
    case 0x17: return { unit: "m3", factor: 10 };
    // 温度 T [°C]
    case 0x58: case 0x5C: return { unit: "°C", factor: 0.001 };
    case 0x59: case 0x5D: return { unit: "°C", factor: 0.01 };
    case 0x5A: case 0x5E: return { unit: "°C", factor: 0.1 };
    case 0x5B: case 0x5F: return { unit: "°C", factor: 1 };
    // 体积流量 [m3/h]
    case 0x3B: return { unit: "m3/h", factor: 0.001 };
    case 0x3C: return { unit: "m3/h", factor: 0.01 };
    case 0x3D: return { unit: "m3/h", factor: 0.1 };
    case 0x3E: return { unit: "m3/h", factor: 1 };
    case 0x3F: return { unit: "m3/h", factor: 10 };
    // 能量 [Wh / kWh]
    case 0x00: return { unit: "Wh", factor: 0.001 };
    case 0x01: return { unit: "Wh", factor: 0.01 };
    case 0x02: return { unit: "Wh", factor: 0.1 };
    case 0x03: return { unit: "Wh", factor: 1 };
    case 0x04: return { unit: "Wh", factor: 10 };
    case 0x05: return { unit: "Wh", factor: 100 };
    case 0x06: return { unit: "kWh", factor: 1 };
    case 0x07: return { unit: "kWh", factor: 10 };
    default: return null;
  }
}

function roundValue(v) {
  if (typeof v !== "number" || !isFinite(v)) return v;
  return Math.round(v * 100000) / 100000;
}

// 解析 M-Bus 数据记录序列（DIF [DIFE...] VIF [VIFE...] DATA）
// 布局：DIF 低 4 位为数据长度编码；VIF=0xFD 后跟 VIFE（error flags / 厂商扩展）
function parseRecord(bytes, pos, remaining) {
  if (remaining < 2) return null;
  var dif = bytes[pos] & 0xFF;
  var isError = (dif & 0x30) === 0x30; // Function=11b => value during error state
  var lenCode = dif & 0x0F;
  var dataLen, bcd = false;
  switch (lenCode) {
    case 0x02: dataLen = 2; break;
    case 0x03: dataLen = 3; break;
    case 0x04: dataLen = 4; break;
    case 0x0A: dataLen = 2; bcd = true; break;   // BCD4
    case 0x0B: dataLen = 3; bcd = true; break;   // BCD6
    case 0x0C: dataLen = 4; bcd = true; break;   // BCD8
    default: return null;
  }

  var p = pos + 1;
  // DIFE（可选；仅当 DIF bit6-5=11b 时存在，EN 13757-3）
  if ((dif & 0x60) === 0x60) {
    while (p < pos + remaining && p - pos < 4) {
      var db = bytes[p] & 0xFF;
      p++;
      if ((db & 0x80) === 0) break; // 最后一个 DIFE
    }
  }

  if (p >= pos + remaining) return null;
  var vif = bytes[p] & 0xFF;
  p++;

  var vifes = [];
  if (vif === 0xFD) { // 扩展 VIF：VIFE 序列
    while (p < pos + remaining && vifes.length < 4) {
      var v = bytes[p] & 0xFF;
      vifes.push(v & 0x7F);
      p++;
      if ((v & 0x80) === 0) break; // 最后一个 VIFE
    }
  }

  if (p + dataLen > pos + remaining) return null;
  var raw = [];
  for (var i = 0; i < dataLen; i++) raw.push(bytes[p + i] & 0xFF);

  var out = { dif: dif, vif: vif, vifes: vifes, raw: raw, isError: isError, next: p + dataLen };

  // Error flags（VIFE 0x17）
  if (vif === 0xFD && vifes[0] === 0x17) {
    out.field = "error_flags";
    out.value = readU16LSB(bytes, p);
    return out;
  }
  // 电池寿命（VIFE 0x16 = battery lifetime in months，EN 13757-3）
  if (vif === 0xFD && vifes[0] === 0x16) {
    out.field = "battery_life_months";
    out.value = readU16LSB(bytes, p);
    return out;
  }
  // 序列号 / 仪表 ID（VIF 0x78/0x79）
  if (vif === 0x78) { out.field = "serial_number"; out.value = bcd ? readBCD(bytes, p, dataLen) : null; return out; }
  if (vif === 0x79) { out.field = "customer_number"; out.value = bcd ? readBCD(bytes, p, dataLen) : null; return out; }
  // 日期（Type G，VIF 0x6C）
  if (vif === 0x6C) { out.field = "date"; out.value = decodeDateG(bytes, p, dataLen); return out; }

  var f = vifFactor(vif);
  if (f && !bcd && dataLen <= 4) {
    var ival = readU16LSB(bytes, p);
    if (dataLen === 3 || dataLen === 4) {
      ival = (bytes[p] & 0xFF) | ((bytes[p + 1] & 0xFF) << 8) | ((bytes[p + 2] & 0xFF) << 16) |
             (dataLen === 4 ? ((bytes[p + 3] & 0xFF) << 24) : 0);
      ival = ival >>> 0;
    }
    out.field = "mbus_" + f.unit.replace(/[^a-zA-Z0-9]/g, "");
    out.value = ival * f.factor;
    out.unit = f.unit;
    out.rawValue = ival;
    return out;
  }
  if (f && bcd) {
    out.field = "mbus_" + f.unit.replace(/[^a-zA-Z0-9]/g, "");
    out.value = readBCD(bytes, p, dataLen) * f.factor;
    out.unit = f.unit;
    out.rawValue = readBCD(bytes, p, dataLen);
    return out;
  }
  return null;
}

// 解码 M-Bus Type G 日期（16 bit：day bit0-4，month bit8-11，year bit12-15<<3|bit5-7，+2000）
function decodeDateG(bytes, pos, len) {
  if (len < 2) return null;
  var u = readU16LSB(bytes, pos);
  var day = u & 0x1F;
  var month = (u >>> 8) & 0x0F;
  var year = (((u >>> 12) & 0x0F) << 3) | ((u >>> 5) & 0x07);
  year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000) return null;
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  return year + "-" + pad(month) + "-" + pad(day);
}

// 主解码入口
function decodeUplink(input) {
  var bytes = input && input.bytes ? input.bytes : [];
  var data = {};

  if (!bytes || bytes.length < 2) {
    return { data: data };
  }

  // 首个字节若为电报编号（0-8）则记录；WM1 LoRaWAN payload 以 M-Bus 数据记录开始，
  // 无法从 payload 内确定电报编号（由网络服务器/配置决定），仅解析数据记录。
  var pos = 0;
  var recordNo = 0;
  var seen = [];

  while (pos < bytes.length) {
    var r = parseRecord(bytes, pos, bytes.length - pos);
    if (!r) break;
    seen.push(r);
    pos = r.next;
  }

  // 依据官方字段清单 + 标准解析结果组织输出
  var std = { volume_forward: null, volume_backward: null, water_temperature: null,
              current_flow: null, target_date_volume_forward: null, date_target_date: null,
              error: null, serial_number: null, battery_life_date: null, auc_leakage: null };
  var m3Count = 0, tempCount = 0, flowCount = 0;

  for (var i = 0; i < seen.length; i++) {
    var rec = seen[i];
    if (!rec.field) continue;
    if (rec.field === "error_flags") { data.error = rec.value; std.error = rec.value; continue; }
    if (rec.field === "battery_life_months") { data.battery_life_months = rec.value; std.battery_life_date = rec.value; continue; }
    if (rec.field === "serial_number") { data.serial_number = String(rec.value); std.serial_number = String(rec.value); continue; }
    if (rec.field === "customer_number") { data.customer_number = String(rec.value); continue; }
    if (rec.field === "date") {
      if (std.date_target_date === null) { std.date_target_date = rec.value; data.date_target_date = rec.value; }
      else { data.date = rec.value; }
      continue;
    }
    if (rec.field && rec.field.indexOf("mbus_") === 0) {
      if (rec.unit === "m3") {
        m3Count++;
        var k3 = (m3Count === 1) ? "volume_forward" : (m3Count === 2 ? "volume_backward" : "volume_" + m3Count);
        std[k3] = roundValue(rec.value);
        data[k3] = std[k3];
      } else if (rec.unit === "°C") {
        tempCount++;
        var kt = (tempCount === 1) ? "water_temperature" : "temperature_" + tempCount;
        std[kt] = roundValue(rec.value);
        data[kt] = std[kt];
      } else if (rec.unit === "m3/h") {
        flowCount++;
        var kf = (flowCount === 1) ? "current_flow" : "flow_" + flowCount;
        std[kf] = roundValue(rec.value);
        data[kf] = std[kf];
      } else if (rec.unit === "kWh" || rec.unit === "Wh") {
        var kv = rec.unit === "kWh" ? rec.value : rec.value / 1000;
        data.energy_kwh = roundValue(kv);
        std.energy_kwh = data.energy_kwh;
      } else {
        data["mbus_raw_" + i] = rec.value;
      }
    }
  }

  // 附上官方确认的字段清单（存在性依据 W270 技术描述 12.1.1）
  data.telegram_fields = TELEGRAM_FIELDS[recordNo] ? TELEGRAM_FIELDS[recordNo].slice() : [];

  return { data: data };
}

// 兼容测试钩子
function Decode(fPort, bytes) {
  return decodeUplink({ bytes: bytes });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { decodeUplink: decodeUplink, Decode: Decode };
}
