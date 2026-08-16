// Adeunis TIC PME-PMI decoder（按官方 @adeunis/codecs 0x49/0x4a parser 字段布局）
function _u32be(b, o) { return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0; }
function _p2d(v) { return ('0' + v).slice(-2); }

// 0x49 TIC 数据帧（ticPmePmi）：字段偏移 + u32 大端，0x80000000 表示 notFound
function _decode0x49(bytes) {
  var out = {};
  function val(offset, key) {
    var v = _u32be(bytes, offset);
    if (v !== 0x80000000) out[key] = v;
  }
  function str(start, end, key) {
    var s = '';
    for (var i = start; i < end; i++) if (bytes[i] !== 0x00) s += String.fromCharCode(bytes[i]);
    if (s.length > 0) out[key] = s;
  }
  // DATE：6 字节（年[+2000] 月 日 时 分 秒）
  if (bytes.length >= 8) {
    var y = 2000 + bytes[4], mo = _p2d(bytes[3]), d = _p2d(bytes[2]);
    var h = _p2d(bytes[5]), mi = _p2d(bytes[6]), s = _p2d(bytes[7]);
    out.date = y + '-' + mo + '-' + d + 'T' + h + ':' + mi + ':' + s;
  }
  val(8, 'ea_s');
  val(12, 'er_plus_s');
  val(16, 'er_moins_s');
  val(20, 'eapp_s');
  str(24, 27, 'ptcour1');
  val(27, 'eap_s');
  val(31, 'er_plus_p_s');
  val(35, 'er_moins_p_s');
  val(39, 'ea_p_1_s');
  val(43, 'er_plus_p_1_s');
  val(47, 'er_moins_p_1_s');
  return out;
}

function _decode(bytes) {
  if (!bytes || bytes.length < 2) return {};
  var fc = bytes[0];
  if (fc === 0x49) return _decode0x49(bytes);
  // 0x4a 告警帧为 label/alarmType/value 文本，codec 未定义对应字段，返回空
  return {};
}

function decodeUplink(input) { return { data: _decode(input.bytes) }; }
function Decode(fPort, bytes) { return _decode(bytes); }
function Decoder(bytes, port) { return _decode(bytes); }
