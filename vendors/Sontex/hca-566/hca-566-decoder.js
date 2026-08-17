// Sontex - HCA 566 (heating cost allocator, Sontex Radio)
// LoRaWAN payload decoder（自实现，非第三方代码）
// 协议基础：OMS / Wireless M-Bus (EN 13757-3/4)，设备官方确认 OMS compliant
// 重要声明：Sontex 官方 LoRaWAN payload 字节布局未公开（内部文档 "M-Bus Frames 7X9 - LoRaWAN"，
// Sontex Extranet），本 decoder 依据公开的 OMS/EN 13757-3 标准 VIF/DIF 编码自实现通用解析，
// 支持 wM-Bus 帧（EN 13757-4）与纯数据记录（LoRaWAN 净荷）两种形态；
// 字段名/单位按 OMS VIF 标准，非 Sontex 专属字段映射。
"use strict";
// ---- 字节工具 ----
function hex(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] & 0xff;
    s += (b < 16 ? '0' : '') + b.toString(16);
  }
  return s;
}

function readUInt(bytes, pos, len) {
  var v = 0;
  for (var i = 0; i < len; i++) v += (bytes[pos + i] & 0xff) << (8 * i);
  return v >>> 0;
}

// BCD（每字节 2 位十进制，字节 LSB first）
function readBcd(bytes, pos, len) {
  var v = 0;
  for (var i = len - 1; i >= 0; i--) {
    var b = bytes[pos + i] & 0xff;
    v = v * 100 + ((b >> 4) & 0x0f) * 10 + (b & 0x0f);
  }
  return v;
}

// ---- VIF 主表（EN 13757-3 标准编码，多源验证）----
// 每个条目: { unit, exp, name }；物理值 = 原始整数 × 10^exp
function vifInfo(v) {
  // 能量 E1 (Wh)：0x00-0x07，0x06=kWh(×10^3)（Kamstrup/Techem/Elvaco/实测一致）
  if (v >= 0x00 && v <= 0x07) return { name: 'energy', unit: 'Wh', exp: v - 3, special: 'number' };
  // 能量 E2 (J)：0x0C-0x0F（EN 13757-3 标准 J×10^0..10^3；注：部分热量表厂商实践中将 0x0E/0x0F 用作 MJ/GJ）
  if (v >= 0x0c && v <= 0x0f) return { name: 'energy_j', unit: 'J', exp: v - 0x0c, special: 'number' };
  // 体积 (m3)：0x10-0x17，0x13=1L(×10^-3)、0x16=1m3(×10^0)
  if (v >= 0x10 && v <= 0x17) return { name: 'volume', unit: 'm3', exp: v - 0x16, special: 'number' };
  // 质量 (kg)：0x18-0x1B
  if (v >= 0x18 && v <= 0x1b) return { name: 'mass', unit: 'kg', exp: v - 0x1b, special: 'number' };
  // 运行时间 (s)：0x20-0x27
  if (v >= 0x20 && v <= 0x27) return { name: 'operating_time', unit: 's', exp: v - 0x20, special: 'number' };
  // 功率 (W)：0x2B-0x2F，0x2B=1W、0x2E=1kW（Elvaco/Engelmann/实测一致）
  if (v >= 0x2b && v <= 0x2f) return { name: 'power', unit: 'W', exp: v - 0x2b, special: 'number' };
  // 流量 (m3/h)：0x3B-0x3F，0x3B=1L/h(×10^-3)、0x3E=1m3/h（实测/Elvaco/Engelmann/Techem 一致）
  if (v >= 0x3b && v <= 0x3f) return { name: 'flow', unit: 'm3/h', exp: v - 0x3e, special: 'number' };
  // 压力 (mbar)：0x50-0x57
  if (v >= 0x50 && v <= 0x57) return { name: 'pressure', unit: 'mbar', exp: v - 0x50, special: 'number' };
  // 温度 (degC)：0x58-0x5B = 供水/第 1 温度（0x59=0.01°C、0x5B=1°C）
  if (v >= 0x58 && v <= 0x5b) return { name: 'temperature', unit: 'degC', exp: v - 0x5b, special: 'number' };
  // 回水/第 2 温度 (degC)：0x5C-0x5F（Kamstrup/Elvaco/Engelmann 实测验证）
  if (v >= 0x5c && v <= 0x5f) return { name: 'temperature_2', unit: 'degC', exp: v - 0x5f, special: 'number' };
  // 温差 (K)：0x60-0x63（Kamstrup MULTICAL: 0x61 = temperature difference 0.01K）
  if (v >= 0x60 && v <= 0x63) return { name: 'temperature_difference', unit: 'K', exp: v - 0x63, special: 'number' };
  return null;
}

function specialVif(v) {
  switch (v) {
    case 0x6c: return { name: 'date', special: 'date' };
    case 0x6d: return { name: 'date_time', special: 'datetime' };
    case 0x78: return { name: 'serial_number', special: 'serial' };
    case 0x79: return { name: 'bus_address', special: 'raw' };
    case 0x7a: return { name: 'primary_address', special: 'raw' };
    case 0x7f: return { name: 'manufacturer_specific', special: 'raw' };
  }
  return null;
}

// 扩展 VIF（0xFC 后 VIFE）：仅实现可确证项
function vifeInfo(v) {
  switch (v) {
    case 0x0c: return { name: 'error_flags', special: 'number', exp: 0 }; // Error flags
    case 0x1a: return { name: 'date', special: 'date' };                  // Date (type G)
    case 0x1c: return { name: 'time', special: 'time' };                  // Time
    case 0x0b: return { name: 'meter_datetime', special: 'datetime' };    // 部分厂商用
  }
  return null;
}

// ---- DIF 解析（EN 13757-3：bit7=DIFE 扩展、bit6=历史存储、bit5=LSB/MSB、bit4=最大值、bit0-3=长度）----
// 长度码：0=0,1=1,2=2,3=3,4=4,5=6,6=8,7=12,8=16,0C=4(8位BCD),0D=6(12位BCD),0E=8(16位BCD)
var LEN_TABLE = [0, 1, 2, 3, 4, 6, 8, 12, 16, 0, 0, 0, 4, 6, 8, 0];
function parseDif(dif) {
  return {
    len: LEN_TABLE[dif & 0x0f],
    hasDife: !!(dif & 0x80),
    isHistorical: !!(dif & 0x40),
    lsbFirst: !(dif & 0x20),
    isMax: !!(dif & 0x10)
  };
}

// ---- 数据记录解析 ----
function parseRecords(bytes, start) {
  var records = [];
  var warnings = [];
  var pos = start;
  var n = bytes.length;
  while (pos < n) {
    var difByte = bytes[pos];
    // 结束标记：DIF=0x0F 或 "00 0F"
    if (difByte === 0x0f || (difByte === 0x00 && pos + 1 < n && bytes[pos + 1] === 0x0f)) {
      pos += (difByte === 0x0f ? 1 : 2);
      break;
    }
    var dif = parseDif(difByte);
    if (dif.len === 0) {
      warnings.push('跳过无效 DIF 0x' + hex([difByte]) + ' @' + pos);
      pos++;
      continue;
    }
    pos++;
    // DIFE（storage/tariff/subunit；扩展位 bit7）
    var storage = -1, tariff = 0, subunit = 0, hasDife = dif.hasDife;
    while (hasDife && pos < n) {
      var dife = bytes[pos];
      pos++;
      storage = dife & 0x0f;
      tariff = (dife >> 4) & 0x03;
      subunit = (dife >> 6) & 0x03;
      hasDife = !!(dife & 0x80);
    }
    // VIF
    if (pos >= n) { warnings.push('缺少 VIF @' + pos); break; }
    var vifByte = bytes[pos];
    pos++;
    var info = null;
    var vifeByte = -1;
    if (vifByte === 0xfc || vifByte === 0xfd) {
      if (pos >= n) { warnings.push('缺少 VIFE @' + pos); break; }
      vifeByte = bytes[pos];
      pos++;
      info = vifeInfo(vifeByte);
      if (!info) { info = { name: 'extended_vif_0x' + hex([vifeByte]), special: 'raw' }; }
    } else if (vifByte === 0xfb) {
      info = { name: 'scaled_value', special: 'raw' };
      pos = Math.min(n, pos + 3); // 3 字节缩放定义，跳过
    } else {
      info = specialVif(vifByte) || vifInfo(vifByte);
      if (!info) { info = { name: 'unknown_vif_0x' + hex([vifByte]), special: 'raw' }; }
    }
    // 读取数据
    if (pos + dif.len > n) { warnings.push('数据不足 @' + pos + ' len=' + dif.len); break; }
    var data = bytes.slice(pos, pos + dif.len);
    pos += dif.len;
    var rec = {
      dif: hex([difByte]),
      vif: hex(vifeByte >= 0 ? [vifByte, vifeByte] : [vifByte]),
      name: info.name,
      raw: hex(data),
      lsb_first: dif.lsbFirst,
      historical: dif.isHistorical,
      maximum: dif.isMax,
      storage: storage,
      tariff: tariff,
      subunit: subunit
    };
    // 数值解码
    if (info.special === 'number') {
      rec.value = readUInt(data, 0, data.length);
      if (info.exp !== undefined && info.exp !== 0) {
        rec.scaled = Math.round(rec.value * Math.pow(10, info.exp) * 1e6) / 1e6;
      }
      if (info.unit) rec.unit = info.unit;
    } else if (info.special === 'serial') {
      rec.value = readBcd(data, 0, data.length);
      rec.unit = '';
    } else if (info.special === 'date') {
      if (data.length === 3) {
        var d = data[0], m = data[1], y = data[2];
        rec.date = String(2000 + y) + '-' + (m < 10 ? '0' + m : '' + m) + '-' + (d < 10 ? '0' + d : '' + d);
        rec.value = rec.date;
      } else {
        rec.value = 'raw ' + hex(data);
      }
    } else if (info.special === 'datetime') {
      if (data.length === 4) {
        // type F：byte0=分钟(&0x3F)、byte1=小时(&0x1F)（Sontex/Kamstrup 实测验证）；年/月/日厂商布局不同，输出 raw
        var mi = data[0] & 0x3f, hh = data[1] & 0x1f;
        rec.time = (hh < 10 ? '0' + hh : '' + hh) + ':' + (mi < 10 ? '0' + mi : '' + mi);
        rec.value = rec.time + ' (raw ' + hex(data) + ')';
      } else {
        rec.value = 'raw ' + hex(data);
      }
    } else if (info.special === 'time') {
      if (data.length === 3) {
        rec.value = 'raw ' + hex(data);
      } else {
        rec.value = 'raw ' + hex(data);
      }
    } else {
      rec.value = 'raw ' + hex(data);
    }
    records.push(rec);
  }
  return { records: records, warnings: warnings };
}

// ---- wM-Bus 帧头解析（EN 13757-4）----
// 制造商代码（EN 13757-2：16 位 = 1 保留位 + 3×5 位字符，字符值 = ASCII-64）
// 验证：Sontex "SON"(S=19,O=15,N=14) → 0x4DEE ✓
function decodeMfct(raw) {
  return String.fromCharCode(((raw >> 10) & 0x1f) + 64) +
         String.fromCharCode(((raw >> 5) & 0x1f) + 64) +
         String.fromCharCode((raw & 0x1f) + 64);
}

function parseWMBus(bytes) {
  if (bytes.length < 14) return null;
  var L = bytes[0];
  if (L + 1 !== bytes.length && L !== bytes.length - 2) return null; // 长帧 L=总长-1；短帧 L=总长-1(含CRC)
  var C = bytes[1];
  var mfctRaw = bytes[2] | (bytes[3] << 8);
  var id = readBcd(bytes, 4, 4);
  var ver = bytes[8];
  var type = bytes[9];
  var ci = bytes[10];
  var start = 11;
  var warnings = [];
  // CI 0x7A（短帧 tplh）/0x78（长帧）/0x72（有线）：OMS 固定数据 4 字节（access/status/cfg）
  if (ci === 0x7a || ci === 0x78 || ci === 0x72) {
    if (start + 4 <= bytes.length - 2) start += 4;
    var r = parseRecords(bytes, start);
    return {
      ok: true,
      header: { L: L, C: C, manufacturer_raw: mfctRaw, manufacturer: decodeMfct(mfctRaw), id: id, version: ver, device_type: type, ci: ci },
      records: r.records,
      warnings: r.warnings
    };
  }
  var r2 = parseRecords(bytes, start);
  return {
    ok: true,
    header: { L: L, C: C, manufacturer_raw: mfctRaw, manufacturer: decodeMfct(mfctRaw), id: id, version: ver, device_type: type, ci: ci },
    records: r2.records,
    warnings: r2.warnings
  };
}

// ---- 主入口 ----
function decodeOms(bytes) {
  var out = { data: {}, warnings: [] };
  var parsed = parseWMBus(bytes);
  if (parsed) {
    var h = parsed.header;
    out.data.manufacturer = h.manufacturer;
    out.data.manufacturer_raw = h.manufacturer_raw;
    out.data.meter_id = h.id;
    out.data.device_version = h.version;
    out.data.device_type = h.device_type;
    out.data.ci_field = '0x' + hex([h.ci]);
    out.records = parsed.records;
    out.warnings = out.warnings.concat(parsed.warnings);
  } else {
    var r = parseRecords(bytes, 0);
    out.records = r.records;
    out.warnings = out.warnings.concat(r.warnings);
  }
  // 扁平化：序号命名
  var counters = {};
  out.records.forEach(function (rec) {
    var key = rec.name;
    if (rec.tariff) key += '_tariff' + rec.tariff;
    if (rec.storage >= 0) key += '_s' + rec.storage;
    if (rec.historical) key += '_hist';
    if (rec.maximum) key += '_max';
    if (!counters[key]) counters[key] = 0;
    counters[key]++;
    var finalKey = counters[key] > 1 ? key + '_' + counters[key] : key;
    var v = rec.value !== undefined ? rec.value : rec.raw;
    if (typeof v === 'number' && rec.scaled !== undefined) v = rec.scaled;
    out.data[finalKey] = v;
    if (rec.unit) out.data[finalKey + '_unit'] = rec.unit;
  });
  out.data.raw_hex = hex(bytes);
  out.data.payload_length = bytes.length;
  return out;
}
function decodeUplink(input) {
  var bytes = (input && input.bytes) || [];
  var fPort = (input && input.fPort !== undefined) ? input.fPort : null;
  var res = decodeOms(bytes);
  var data = res.data;
  if (fPort !== null) data.f_port = fPort;
  // 将 wM-Bus 帧头信息提升到顶层（若存在）
  var out = { data: data };
  if (res.warnings && res.warnings.length) out.warnings = res.warnings;
  return out;
}
