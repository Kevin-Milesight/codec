// Siemens QNA2820D.EU LoRaWAN payload decoder
// 依据官方文档 A6V14457464（Indoor air quality multi-sensor QNA2..D - LoRaWAN Configuration）
// payload 使用 Google Protocol Buffers（protobuf）序列化，父消息定义见 SiemensLoRaIAQMessage.proto
// 本文件为自实现解析逻辑（protobuf wire format），未复制任何第三方 decoder 代码。
"use strict";

// ---------- protobuf wire-format 基础解析（自实现） ----------

// 读取无符号 varint（LEB128），返回 { value, pos }；用 Number 累加避免 32 位截断
function readVarint(bytes, pos) {
  var value = 0;
  var shift = 0;
  var b;
  do {
    b = bytes[pos++];
    value += (b & 0x7F) * Math.pow(2, shift);
    shift += 7;
  } while ((b & 0x80) !== 0 && pos < bytes.length && shift < 64);
  return { value: value, pos: pos };
}

// 解码一条 protobuf 消息，返回字段数组 [{ field, wire, value }]
// wire 0 -> value 为 Number；wire 2 -> value 为 Uint8Array（子消息/字符串/字节串）；
// wire 5 -> value 为 4 字节 Uint8Array（fixed32/float）；wire 1 -> 8 字节（fixed64/double）
function decodeFields(bytes) {
  var fields = [];
  var pos = 0;
  while (pos < bytes.length) {
    var tag = readVarint(bytes, pos);
    pos = tag.pos;
    var field = tag.value >>> 3;
    var wire = tag.value & 7;
    if (wire === 0) {
      var v = readVarint(bytes, pos);
      fields.push({ field: field, wire: wire, value: v.value });
      pos = v.pos;
    } else if (wire === 1) {
      fields.push({ field: field, wire: wire, value: bytes.slice(pos, pos + 8) });
      pos += 8;
    } else if (wire === 2) {
      var len = readVarint(bytes, pos);
      pos = len.pos;
      fields.push({ field: field, wire: wire, value: bytes.slice(pos, pos + len.value) });
      pos += len.value;
    } else if (wire === 5) {
      fields.push({ field: field, wire: wire, value: bytes.slice(pos, pos + 4) });
      pos += 4;
    } else {
      break; // 未支持的 wire type：终止解析，保留已解析字段
    }
  }
  return fields;
}

// 4 字节 little-endian -> IEEE754 float32
function toFloat32(raw) {
  var b = raw;
  var u = b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24);
  var sign = (u >>> 31) ? -1 : 1;
  var exp = (u >>> 23) & 0xFF;
  var mant = u & 0x7FFFFF;
  if (exp === 0xFF) { return NaN; }
  if (exp === 0) { return sign * mant * Math.pow(2, -149); }
  return sign * (1 + mant / 0x800000) * Math.pow(2, exp - 127);
}

// 4 字节 little-endian -> uint32
function toUint32(raw) {
  return (raw[0] | (raw[1] << 8) | (raw[2] << 16) | (raw[3] << 24)) >>> 0;
}

// 保留两位小数的数值（消除浮点表示噪声）
function round2(n) {
  return Math.round(n * 100) / 100;
}

// ---------- SiemensLoRaIAQMessage 消息族解码 ----------

// event_score：SiemensIAQEventScoreMessage
function decodeScore(bytes, data) {
  var fields = decodeFields(bytes);
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    if (f.field === 2 && f.wire === 0) {
      data.color = f.value;                       // 显示颜色（0..）
    } else if (f.field === 3 && f.wire === 0) {
      data.score = f.value;                       // 综合空气质量评分
    } else if (f.field === 4 && f.wire === 2) {   // index 子消息
      var idx = decodeFields(f.value);
      for (var j = 0; j < idx.length; j++) {
        if (idx[j].field === 1 && idx[j].wire === 0) { data.temp_index = idx[j].value; }
        else if (idx[j].field === 2 && idx[j].wire === 0) { data.humid_index = idx[j].value; }
        else if (idx[j].field === 3 && idx[j].wire === 0) { data.co2_index = idx[j].value; }
        else if (idx[j].field === 4 && idx[j].wire === 0) { data.voc_index = idx[j].value; }
        else if (idx[j].field === 5 && idx[j].wire === 0) { data.pm25_index = idx[j].value; }
      }
    } else if (f.field === 5 && f.wire === 2) {   // sensor 子消息
      var s = decodeFields(f.value);
      for (var k = 0; k < s.length; k++) {
        if (s[k].field === 1 && s[k].wire === 5) { data.temperature = round2(toFloat32(s[k].value)); }
        else if (s[k].field === 2 && s[k].wire === 5) { data.relative_humidity = round2(toFloat32(s[k].value)); }
        else if (s[k].field === 3 && s[k].wire === 0) { data.co2 = s[k].value; }
        else if (s[k].field === 4 && s[k].wire === 0) { data.co2_est = s[k].value; }
        else if (s[k].field === 5 && s[k].wire === 0) { data.tvoc = s[k].value; }
        else if (s[k].field === 6 && s[k].wire === 0) { data.pm2_5 = s[k].value; }
        else if (s[k].field === 7 && s[k].wire === 0) { data.pm10 = s[k].value; }
        else if (s[k].field === 8 && s[k].wire === 5) { data.lux = round2(toFloat32(s[k].value)); }
        else if (s[k].field === 9 && s[k].wire === 5) { data.spl_a = round2(toFloat32(s[k].value)); }
      }
    } else if (f.field === 6 && f.wire === 2) {   // sensor_raw 子消息（原始值）
      var r = decodeFields(f.value);
      for (var m = 0; m < r.length; m++) {
        if (r[m].field === 1 && r[m].wire === 5) { data.temp_raw = toUint32(r[m].value); }
        else if (r[m].field === 2 && r[m].wire === 5) { data.humid_raw = toUint32(r[m].value); }
        else if (r[m].field === 3 && r[m].wire === 0) { data.co2_raw = r[m].value; }
        else if (r[m].field === 4 && r[m].wire === 0) { data.co2_est_raw = r[m].value; }
        else if (r[m].field === 5 && r[m].wire === 0) { data.voc_raw = r[m].value; }
        else if (r[m].field === 6 && r[m].wire === 5) { data.voc_eth_raw = toUint32(r[m].value); }
        else if (r[m].field === 7 && r[m].wire === 5) { data.voc_h2_raw = toUint32(r[m].value); }
        else if (r[m].field === 8 && r[m].wire === 0) { data.pm2_5_raw = r[m].value; }
        else if (r[m].field === 9 && r[m].wire === 0) { data.pm10_raw = r[m].value; }
        else if (r[m].field === 10 && r[m].wire === 0) { data.lux_raw = r[m].value; }
        else if (r[m].field === 11 && r[m].wire === 0) { data.voc_baseline = r[m].value; }
      }
    } else if (f.field === 7 && f.wire === 0) {
      data.meta_temp = f.value;
    } else if (f.field === 8 && f.wire === 0) {
      data.meta_humid = f.value;
    }
  }
}

// event_battery：SiemensIAQEventBatteryMessage
function decodeBattery(bytes, data) {
  var fields = decodeFields(bytes);
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    if (f.field === 1 && f.wire === 0) { data.charge_percent = f.value; }
    else if (f.field === 2 && f.wire === 0) { data.plugged = f.value; }     // 1 -> true, 0 -> false
    else if (f.field === 3 && f.wire === 0) { data.charging = f.value; }    // 1 -> true, 0 -> false
  }
}

// 主入口
function decodeUplink(input) {
  var bytes = (input && input.bytes) ? input.bytes : [];
  var data = {};
  if (!bytes || bytes.length === 0) {
    return { data: data };
  }

  var top = decodeFields(bytes);
  for (var i = 0; i < top.length; i++) {
    var f = top[i];
    if (f.field === 1 && f.wire === 2) {           // device_uuid 子消息
      var uuid = decodeFields(f.value);
      for (var j = 0; j < uuid.length; j++) {
        if (uuid[j].field === 1 && uuid[j].wire === 0) { data.device_type = uuid[j].value; }
        else if (uuid[j].field === 2 && uuid[j].wire === 0) { data.device_id = uuid[j].value; }
      }
    } else if (f.field === 2 && f.wire === 0) {    // device_timestamp（Unix 秒）
      data.device_timestamp = f.value;
    } else if (f.field === 3 && f.wire === 2) {    // event_score
      decodeScore(f.value, data);
    } else if (f.field === 4 && f.wire === 2) {    // event_battery
      decodeBattery(f.value, data);
    }
    // 其余字段（下行命令类：display/LED/time_sync/sysctrl）为网关到设备消息，上行忽略
  }
  return { data: data };
}

// 兼容两种调用方式：decodeUplink({bytes}) 与 decodeUplink(bytes 数组)
function Decode(fPort, bytes) {
  return decodeUplink(typeof bytes === 'object' && !Array.isArray(bytes) ? bytes : { bytes: bytes });
}
