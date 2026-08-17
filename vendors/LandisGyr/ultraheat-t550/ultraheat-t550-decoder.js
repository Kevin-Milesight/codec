// Landis+Gyr ULTRAHEAT T550 (CMi4110) LoRaWAN payload decoder
// 基于官方文档自实现（不复制第三方代码）：
//   - Landis+Gyr T550 (UH50/UC50) 技术描述 10.6 "Funk-Modul 868 MHz LoRaWAN (CMi4110)"
//   - Elvaco CMi4110 User Manual v1.6（表 10-22 消息格式与 DIF/VIF 布局）
// 字段名、单位、换算系数（MWh/kWh/GJ、m3、kW、m3/h、°C）均来自官方文档。
// 数据为 M-Bus 编码：BCD 值 LSB first（低位字节在前）。
"use strict";

// 消息格式标识符（CMi4110 User Manual 表 7）
var MESSAGE_FORMATS = {
  0x00: "Standard",
  0x01: "Compact",
  0x02: "JSON",
  0x03: "Scheduled-Daily redundant",
  0x04: "Scheduled-Extended",
  0x3F: "Scheduled-Extended+ (1)",
  0x40: "Scheduled-Extended+ (2)",
  0x41: "Compact Tariff",
  0x46: "Max Flow",
  0x47: "Scheduled-Daily redundant Tariff (1)",
  0x48: "Scheduled-Daily redundant Tariff (2)",
  0x49: "Scheduled-Monthly",
  0x4A: "Scheduled-Daily"
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

// 读取小端（LSB first）无符号 16 位整数
function readU16LSB(bytes, pos) {
  return (bytes[pos] & 0xFF) | ((bytes[pos + 1] & 0xFF) << 8);
}

// 读取小端（LSB first）有符号 32 位整数
function readS32LSB(bytes, pos) {
  var v = (bytes[pos] & 0xFF) | ((bytes[pos + 1] & 0xFF) << 8) |
          ((bytes[pos + 2] & 0xFF) << 16) | ((bytes[pos + 3] & 0xFF) << 24);
  return v;
}

// 解析 046D 日期时间（M-Bus Type F / INT32，LSB first；CMi4111 手册表 12 位定义）
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

function formatDateTime(dt) {
  if (!dt || dt.year < 2000) return null;
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  return dt.year + "-" + pad(dt.month) + "-" + pad(dt.day) + "T" + pad(dt.hour) + ":" + pad(dt.minute);
}

function roundValue(v) {
  if (typeof v !== "number" || !isFinite(v)) return v;
  return Math.round(v * 100000) / 100000;
}

// 处理一个 DIB：返回 { field, value, next } 或 null
// 布局依据 CMi4110 手册表 10（Standard）/表 11（Compact）等：
//   Energy  BCD8: 0C06=kWh, 0C07=MWh*0.01, 0CFB00=MWh*0.1, 0CFB01=MWh,
//                 0C0E=GJ*0.001, 0C0F=GJ*0.01, 0CFB08=GJ*0.1, 0CFB09=GJ
//   Volume  BCD8: 0C14=m3*0.01, 0C15=m3*0.1, 0C16=m3
//   Power   BCD6: 0B2B=kW*0.001, 0B2C=kW*0.01, 0B2D=kW*0.1, 0B2E=kW
//   Flow    BCD6: 0B3B=m3/h*0.001, 0B3C=*0.01, 0B3D=*0.1, 0B3E=m3/h
//   Fw temp BCD4: 0A5A=°C*0.1, 0A5B=°C
//   Rt temp BCD4: 0A5E=°C*0.1, 0A5F=°C
//   Meter ID BCD8: 0C78 (serial) / 0C79 (customer number)
//   Error flags INT16: 02FD17xxxx
//   Date & time INT32: 046Dxxxxxxxx
function parseDIB(bytes, pos, remaining) {
  if (remaining < 2) return null;
  var dif = bytes[pos] & 0xFF;
  var vif = bytes[pos + 1] & 0xFF;
  var isError = (dif & 0x30) === 0x30; // Function=11b => value during error state

  // DIF 低 4 位 => 数据长度/类型：0x02=INT16, 0x04=INT32, 0x0A=BCD4, 0x0B=BCD6, 0x0C=BCD8
  var lenCode = dif & 0x0F;
  var dataLen, bcd = false;
  switch (lenCode) {
    case 0x02: dataLen = 2; break;
    case 0x04: dataLen = 4; break;
    case 0x0A: dataLen = 2; bcd = true; break;
    case 0x0B: dataLen = 3; bcd = true; break;
    case 0x0C: dataLen = 4; bcd = true; break;
    default: return null;
  }

  var vife = null;
  var dataPos = pos + 2;
  if (vif === 0xFD) { // VIF 扩展（VIFE）
    if (remaining < 3) return null;
    vife = bytes[pos + 2] & 0xFF;
    dataPos = pos + 3;
  } else if (vif === 0xFB) { // VIF 扩展（能量精度）
    if (remaining < 3) return null;
    vife = bytes[pos + 2] & 0xFF;
    dataPos = pos + 3;
  }
  if (dataPos + dataLen > pos + remaining) return null;

  var out = { dif: dif, vif: vif, vife: vife, isError: isError, next: dataPos + dataLen };

  // Meter ID / customer number
  if (vif === 0x78 && bcd) { out.field = "meter_id"; out.value = readBCD(bytes, dataPos, dataLen); return out; }
  if (vif === 0x79 && bcd) { out.field = "customer_number"; out.value = readBCD(bytes, dataPos, dataLen); return out; }

  // Error flags
  if (vif === 0xFD && vife === 0x17) { out.field = "error_flags"; out.value = readU16LSB(bytes, dataPos); return out; }

  // Date & time
  if (vif === 0x6D) { out.field = "date_time"; out.value = decodeDateTime([bytes[dataPos], bytes[dataPos+1], bytes[dataPos+2], bytes[dataPos+3]]); return out; }

  if (bcd) {
    var bcdVal = readBCD(bytes, dataPos, dataLen);
    // Energy（BCD8）
    if (lenCode === 0x0C) {
      if (vif === 0x06) { out.field = "energy_kwh"; out.value = bcdVal; return out; }               // kWh
      if (vif === 0x07) { out.field = "energy_kwh"; out.value = bcdVal * 10; return out; }           // MWh 2位小数 -> kWh
      if (vif === 0x0E) { out.field = "energy_gj"; out.value = bcdVal / 1000; return out; }          // GJ 3位小数
      if (vif === 0x0F) { out.field = "energy_gj"; out.value = bcdVal / 100; return out; }           // GJ 2位小数
      if (vif === 0xFB && vife === 0x00) { out.field = "energy_kwh"; out.value = bcdVal * 100; return out; }  // MWh 1位
      if (vif === 0xFB && vife === 0x01) { out.field = "energy_kwh"; out.value = bcdVal * 1000; return out; } // MWh
      if (vif === 0xFB && vife === 0x08) { out.field = "energy_gj"; out.value = bcdVal / 10; return out; }    // GJ 1位
      if (vif === 0xFB && vife === 0x09) { out.field = "energy_gj"; out.value = bcdVal; return out; }         // GJ
      // Volume（BCD8）
      if (vif === 0x14) { out.field = "volume_m3"; out.value = bcdVal / 100; return out; }
      if (vif === 0x15) { out.field = "volume_m3"; out.value = bcdVal / 10; return out; }
      if (vif === 0x16) { out.field = "volume_m3"; out.value = bcdVal; return out; }
    }
    // Power / Flow（BCD6）
    if (lenCode === 0x0B) {
      if (vif === 0x2B) { out.field = "power_kw"; out.value = bcdVal / 1000; return out; }
      if (vif === 0x2C) { out.field = "power_kw"; out.value = bcdVal / 100; return out; }
      if (vif === 0x2D) { out.field = "power_kw"; out.value = bcdVal / 10; return out; }
      if (vif === 0x2E) { out.field = "power_kw"; out.value = bcdVal; return out; }
      if (vif === 0x3B) { out.field = "flow_m3h"; out.value = bcdVal / 1000; return out; }
      if (vif === 0x3C) { out.field = "flow_m3h"; out.value = bcdVal / 100; return out; }
      if (vif === 0x3D) { out.field = "flow_m3h"; out.value = bcdVal / 10; return out; }
      if (vif === 0x3E) { out.field = "flow_m3h"; out.value = bcdVal; return out; }
    }
    // Temperature（BCD4）
    if (lenCode === 0x0A) {
      if (vif === 0x5A) { out.field = "forward_temperature_c"; out.value = bcdVal / 10; return out; }
      if (vif === 0x5B) { out.field = "forward_temperature_c"; out.value = bcdVal; return out; }
      if (vif === 0x5E) { out.field = "return_temperature_c"; out.value = bcdVal / 10; return out; }
      if (vif === 0x5F) { out.field = "return_temperature_c"; out.value = bcdVal; return out; }
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

  // JSON 格式（0x02）：明文 JSON
  if (fmtId === 0x02) {
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

  return { data: data };
}

// 兼容测试钩子（供审计脚本直接调用）
function Decode(fPort, bytes) {
  return decodeUplink({ bytes: bytes });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { decodeUplink: decodeUplink, Decode: Decode };
}
