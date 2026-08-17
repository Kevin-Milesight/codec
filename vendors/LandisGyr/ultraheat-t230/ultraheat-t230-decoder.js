// Landis+Gyr ULTRAHEAT T230 (CMi4111) LoRaWAN payload decoder
// 基于官方文档自实现（不复制第三方代码）：
//   - Landis+Gyr "T230/T330 LoRaWAN Communication Interface (CMi4111)" (Communication-Interface_a.pdf)
//   - Elvaco CMi4111 User's Manual English v1.4, 6.7 "Message formats"（表 4-16）
// 消息格式标识符与 DIF/VIF 字段布局、单位、换算系数均来自上述官方文档。
// 字节序：所有多字节数据按 M-Bus 标准 LSB first（低位字节在前）。
"use strict";

// 消息格式标识符（CMi4111 User's Manual 表 4）
var MESSAGE_FORMATS = {
  0x05: "Standard",
  0x06: "Compact",
  0x07: "JSON",
  0x08: "Scheduled-Daily redundant",
  0x09: "Scheduled-Extended",
  0x0A: "Combined heat/cooling",
  0x0B: "Simple billing",
  0x0C: "Plausibility check",
  0x0D: "Monitoring",
  0xFA: "Clock"
};

// 能量 VIF 换算为 kWh 的乘数（CMi4111 表 5/11/12）
function energyKwhFactor(vif) {
  switch (vif) {
    case 0x00: return 0.001 / 1000;      // xxx,xxx Wh -> *0.001 Wh
    case 0x01: return 0.01 / 1000;       // xxx,xx Wh
    case 0x02: return 0.1 / 1000;        // xxx,x Wh
    case 0x03: return 1 / 1000;          // xxx Wh
    case 0x04: return 10 / 1000;         // xxx * 10 Wh
    case 0x05: return 100 / 1000;        // xxx * 100 Wh
    case 0x06: return 1;                 // kWh
    case 0x07: return 10;                // xxx * 10 kWh
    case 0x0E: return 277.7777777778;    // MJ -> kWh (1 MJ = 1/3.6 kWh)
    case 0x0F: return 2777.777777778;    // xxx * 10 MJ
    default: return null;
  }
}

// 体积 VIF 换算为 m3 的乘数（CMi4111 表 5）
function volumeM3Factor(vif) {
  switch (vif) {
    case 0x11: return 0.00001;   // *0.00001 m3
    case 0x12: return 0.0001;    // *0.0001 m3
    case 0x13: return 0.001;     // *0.001 m3
    case 0x14: return 0.01;      // *0.01 m3
    case 0x15: return 0.1;       // *0.1 m3
    case 0x16: return 1;         // m3
    case 0x17: return 10;        // *10 m3
    default: return null;
  }
}

// 功率 VIF 换算为 W 的乘数（CMi4111 表 5）
function powerWattFactor(vif) {
  switch (vif) {
    case 0x2A: return 0.1;    // x,x W
    case 0x2B: return 1;      // W
    case 0x2C: return 10;     // *10 W
    case 0x2D: return 100;    // *100 W
    case 0x2E: return 1000;   // kW
    case 0x2F: return 10000;  // *10 kW
    default: return null;
  }
}

// 流量 VIF 换算为 m3/h 的乘数（CMi4111 表 5）
function flowM3hFactor(vif) {
  switch (vif) {
    case 0x3B: return 0.001;  // *0.001 m3/h
    case 0x3C: return 0.01;   // *0.01 m3/h
    case 0x3D: return 0.1;    // *0.1 m3/h
    case 0x3E: return 1;      // m3/h
    case 0x3F: return 10;     // *10 m3/h
    default: return null;
  }
}

// 温度 VIF 换算为 °C 的乘数（CMi4111 表 5）
function tempCFactor(vif) {
  switch (vif) {
    case 0x58: case 0x5C: return 0.001;  // *0.001 °C
    case 0x59: case 0x5D: return 0.01;   // *0.01 °C
    case 0x5A: case 0x5E: return 0.1;    // *0.1 °C
    case 0x5B: case 0x5F: return 1;      // °C
    default: return null;
  }
}

// 读取小端（LSB first）无符号 16 位整数
function readU16LSB(bytes, pos) {
  return (bytes[pos] & 0xFF) | ((bytes[pos + 1] & 0xFF) << 8);
}

// 读取小端（LSB first）有符号 16 位整数
function readS16LSB(bytes, pos) {
  var v = readU16LSB(bytes, pos);
  return v >= 0x8000 ? v - 0x10000 : v;
}

// 读取小端（LSB first）有符号 32 位整数
function readS32LSB(bytes, pos) {
  var v = (bytes[pos] & 0xFF) | ((bytes[pos + 1] & 0xFF) << 8) |
          ((bytes[pos + 2] & 0xFF) << 16) | ((bytes[pos + 3] & 0xFF) << 24);
  return v;
}

// M-Bus BCD 解码（LSB first，每字节两位十进制数字）
function readBCD(bytes, pos, len) {
  var s = "";
  for (var i = len - 1; i >= 0; i--) {
    var b = bytes[pos + i] & 0xFF;
    s += String((b >> 4) & 0x0F) + String(b & 0x0F);
  }
  return parseInt(s, 10);
}

// 解析 046D 日期时间（32 位二进制，LSB first；CMi4111 表 11/12）
// Bit31-28 Year-high | Bit27-24 Month | Bit23-21 Year-low | Bit20-16 Day
// Bit15 Summertime | Bit12-8 Hour | Bit7 Error flag | Bit6 Reserved | Bit5-0 Minute
function decodeDateTime(raw) {
  if (raw.length < 4) return null;
  var v = (raw[0] & 0xFF) | ((raw[1] & 0xFF) << 8) | ((raw[2] & 0xFF) << 16) | ((raw[3] & 0xFF) << 24);
  var yearHigh = (v >>> 28) & 0x0F;
  var month    = (v >>> 24) & 0x0F;
  var yearLow  = (v >>> 21) & 0x07;
  var day      = (v >>> 16) & 0x1F;
  var dst      = (v >>> 15) & 0x01;
  var hour     = (v >>> 8)  & 0x1F;
  var err      = (v >>> 7)  & 0x01;
  var minute   = v & 0x3F;
  var year     = ((yearHigh << 3) | yearLow) + 2000;
  return {
    year: year, month: month, day: day, hour: hour, minute: minute,
    summertime: dst, valid: (err === 0)
  };
}

// 处理一个 DIF/VIF 数据块，返回 { field, value, raw } 或 null
function parseDIB(bytes, pos, remaining) {
  if (remaining < 2) return null;
  var dif = bytes[pos] & 0xFF;
  var vif = bytes[pos + 1] & 0xFF;
  var isError = (dif & 0x30) === 0x30; // Function 字段 = 11b => value during error state
  // DIF 低 4 位表示数据长度（0x02=2字节 INT16, 0x04=4字节 INT32, 0x0C=4字节 BCD8）
  var lenCode = dif & 0x0F;
  var dataLen, bcd = false;
  switch (lenCode) {
    case 0x02: dataLen = 2; break;
    case 0x04: dataLen = 4; break;
    case 0x0C: dataLen = 4; bcd = true; break;
    default: return null; // 不支持的 DIF 长度编码，跳过
  }
  var vife = null;
  var dataPos = pos + 2;
  // VIF=0xFD 表示扩展 VIF（VIFE 跟随）
  if (vif === 0xFD) {
    if (remaining < 3) return null;
    vife = bytes[pos + 2] & 0xFF;
    dataPos = pos + 3;
  }
  if (dataPos + dataLen > pos + remaining) return null;

  var raw = [];
  for (var i = 0; i < dataLen; i++) raw.push(bytes[dataPos + i] & 0xFF);

  var out = { dif: dif, vif: vif, vife: vife, raw: raw, isError: isError, next: dataPos + dataLen };
  var val;

  // --- 字段识别（DIF/VIF 组合，来自 CMi4111 手册表 5）---
  if (vif === 0x78) { // Meter ID（0C78，4 字节 BCD）
    out.field = "meter_id";
    out.value = bcd ? readBCD(bytes, dataPos, dataLen) : null;
    return out;
  }
  if (vif === 0x79) { // Customer number（0C79）
    out.field = "customer_number";
    out.value = bcd ? readBCD(bytes, dataPos, dataLen) : null;
    return out;
  }
  if (vif === 0xFD && vife === 0x17) { // Error bits（04FD17，INT32）
    out.field = "error_flags";
    out.value = readS32LSB(bytes, dataPos);
    return out;
  }
  if (vif === 0x6D) { // Date & time（046D）
    out.field = "date_time";
    out.value = decodeDateTime(raw);
    return out;
  }
  if (vif >= 0x00 && vif <= 0x0F) { // Energy（Wh/J 系列）
    var f = energyKwhFactor(vif);
    if (f !== null) {
      out.field = "energy_kwh";
      out.value = readS32LSB(bytes, dataPos) * f;
      out.rawValue = readS32LSB(bytes, dataPos);
      return out;
    }
  }
  if (vif >= 0x11 && vif <= 0x17) { // Volume（m3）
    var fv = volumeM3Factor(vif);
    if (fv !== null) {
      out.field = "volume_m3";
      out.value = readS32LSB(bytes, dataPos) * fv;
      out.rawValue = readS32LSB(bytes, dataPos);
      return out;
    }
  }
  if (vif >= 0x2A && vif <= 0x2F) { // Power（W）
    var fp = powerWattFactor(vif);
    if (fp !== null) {
      out.field = "power_w";
      out.value = readS16LSB(bytes, dataPos) * fp;
      out.rawValue = readS16LSB(bytes, dataPos);
      return out;
    }
  }
  if (vif >= 0x3B && vif <= 0x3F) { // Flow（m3/h）
    var ff = flowM3hFactor(vif);
    if (ff !== null) {
      out.field = "flow_m3h";
      out.value = readS16LSB(bytes, dataPos) * ff;
      out.rawValue = readS16LSB(bytes, dataPos);
      return out;
    }
  }
  if (vif >= 0x58 && vif <= 0x5F) { // Forward/Return temperature（°C）
    var ft = tempCFactor(vif);
    if (ft !== null) {
      out.field = (vif <= 0x5B) ? "forward_temperature_c" : "return_temperature_c";
      out.value = readS16LSB(bytes, dataPos) * ft;
      out.rawValue = readS16LSB(bytes, dataPos);
      return out;
    }
  }
  return null;
}

// 主解码入口
function decodeUplink(input) {
  var bytes = input && input.bytes ? input.bytes : [];
  var data = {};

  if (!bytes || bytes.length < 2) {
    return { data: data };
  }

  var fmtId = bytes[0] & 0xFF;
  var fmtName = MESSAGE_FORMATS[fmtId];
  data.message_format = fmtName || ("unknown_0x" + fmtId.toString(16));
  data.message_format_id = fmtId;

  // JSON 格式（0x07）：明文 JSON
  if (fmtId === 0x07) {
    var jsonStr = "";
    for (var j = 1; j < bytes.length; j++) jsonStr += String.fromCharCode(bytes[j]);
    try {
      var parsed = JSON.parse(jsonStr);
      for (var k in parsed) {
        if (Object.prototype.hasOwnProperty.call(parsed, k)) data[k] = parsed[k];
      }
    } catch (e) {
      data.json_raw = jsonStr;
    }
    return { data: data };
  }

  // Scheduled-Extended（0x09）与 Scheduled-Daily redundant（0x08）含特殊组合块，
  // 先按通用 DIB 解析（Energy/Volume/MeterID/Error 均为标准 DIF/VIF）。
  var pos = 1;
  while (pos < bytes.length) {
    var r = parseDIB(bytes, pos, bytes.length - pos);
    if (!r) break;
    if (r.field) {
      if (r.field === "date_time" && r.value) {
        data[r.field] = formatDateTime(r.value);
      } else if (r.field === "meter_id" || r.field === "customer_number") {
        data[r.field] = String(r.value);
      } else {
        data[r.field] = roundValue(r.value);
        if (r.isError) data[r.field + "_error"] = 1;
      }
    }
    pos = r.next;
  }

  // 处理 0x09 Scheduled-Extended 的 Power/Flow/Fw/Rt 组合块（Byte0-2=0x07FFA0）
  if (fmtId === 0x09 && pos + 12 <= bytes.length && bytes[pos] === 0x07 && bytes[pos + 1] === 0xFF && bytes[pos + 2] === 0xA0) {
    var scaling = bytes[pos + 3] & 0xFF;
    var pwSc = Math.pow(10, ((scaling >> 4) & 0x07) - 3);  // 10^(n-3) W
    var flSc = Math.pow(10, (scaling & 0x07) - 3);          // 10^(m-3) m3/h
    var fwRaw = readS16LSB(bytes, pos + 4);
    var rtRaw = readS16LSB(bytes, pos + 6);
    var flRaw = readS16LSB(bytes, pos + 8);
    var pwRaw = readS16LSB(bytes, pos + 10);
    data.forward_temperature_c = roundValue(fwRaw * 0.01); // °C, 2 decimals（表 12）
    data.return_temperature_c = roundValue(rtRaw * 0.01);
    data.flow_m3h = roundValue(flRaw * flSc);
    data.power_w = roundValue(pwRaw * pwSc);
    pos += 12;
  }

  // 0x09 的 Meter ID / Error bits 组合块（Byte0-2=0x07FF21）
  if (fmtId === 0x09 && pos + 11 <= bytes.length && bytes[pos] === 0x07 && bytes[pos + 1] === 0xFF && bytes[pos + 2] === 0x21) {
    var errRaw = readS32LSB(bytes, pos + 3);
    var idRaw = readU16LSB(bytes, pos + 7) | (readU16LSB(bytes, pos + 9) << 16);
    data.error_flags = errRaw;
    data.meter_id = String(idRaw);
    pos += 11;
  }

  // 0x08/0x09 的 Meter date/time（046D，若通用解析未覆盖）
  // 0x08 的 Accumulated energy at 24:00 已在通用 DIB 循环中作为 energy_kwh 覆盖

  return { data: data };
}

function formatDateTime(dt) {
  if (!dt || dt.year < 2000) return null;
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  return dt.year + "-" + pad(dt.month) + "-" + pad(dt.day) + "T" + pad(dt.hour) + ":" + pad(dt.minute);
}

function roundValue(v) {
  if (typeof v !== "number" || !isFinite(v)) return v;
  return Math.round(v * 100000) / 100000;
}

// 兼容测试钩子（供审计脚本直接调用）
function Decode(fPort, bytes) {
  return decodeUplink({ bytes: bytes });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { decodeUplink: decodeUplink, Decode: Decode };
}
