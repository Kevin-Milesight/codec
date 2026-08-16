// Watteco BOB Assistant decoder：平铺 tab 数组为 snake_case 字段，三入口统一
function _labelToId(label) {
  var s = String(label).toLowerCase();
  if (/^fft\d+$/.test(s)) s = s.replace(/^fft/, 'fft_');
  return s;
}

function _bobDecode(bytes, fPort) {
  if (!bytes || bytes.length === 0) return {};
  if (fPort !== 1) return {};

  var out = {};
  var date = new Date().toISOString();

  // Report Type
  if (bytes[0] === 0x72 || bytes[0] === 0x52) {
    var reportperiod;
    if (bytes[6] <= 0x3b) reportperiod = bytes[6];
    else reportperiod = (bytes[6] - 59) * 60;
    var operatingtime = bytes[2] * reportperiod / 127;

    out.battery_percentage = bytes[17] * 100 / 127;
    out.anomalylevel = bytes[1] * 100 / 127;
    out.anomalylevelto20last6mo = bytes[24];
    out.nbalarmreport = bytes[4];
    out.operatingtime = bytes[2] * 2 / 127;
    out.totalunknown6080 = (operatingtime - bytes[3] * operatingtime / 127) * bytes[15] / 127;
    out.totalunknown4060 = (operatingtime - bytes[3] * operatingtime / 127) * bytes[14] / 127;
    out.totalunknown2040 = (operatingtime - bytes[3] * operatingtime / 127) * bytes[13] / 127;
    out.anomalylevelto80last30d = bytes[23];
    out.vibrationlevel = (bytes[8] * 128 + bytes[9] + bytes[10] / 100) / 10 / 121.45;
    out.totalunknown1020 = operatingtime - bytes[3] * operatingtime / 127;
    out.anomalylevelto80last6mo = bytes[26];
    out.anomalylevelto50last24h = bytes[19];
    out.anomalylevelto20last24h = bytes[18];
    out.anomalylevelto50last30d = bytes[22];
    out.temperature = bytes[5] - 30;
    out.reportlength = reportperiod;
    out.anomalylevelto20last30d = bytes[21];
    out.peakfrequencyindex = bytes[11] + 1;
    out.totalunknown80100 = (operatingtime - bytes[3] * operatingtime / 127) * bytes[16] / 127;
    out.totaloperatingtimeknown = bytes[3] * operatingtime / 127;
    out.anomalylevelto50last6mo = bytes[25];
    out.anomalylevelto80last24h = bytes[20];
    return out;
  }

  // Alarm Type
  if (bytes[0] === 0x61) {
    var vibrationlevel = (bytes[4] * 128 + bytes[5] + bytes[6] / 100) / 10 / 121.45;
    out.temperature = bytes[2] - 30;
    out.vibrationlevel = vibrationlevel;
    out.anomalylevel = bytes[1] * 100 / 127;
    for (var i = 8; i <= 39; i++) {
      out['fft_' + (i - 7)] = bytes[i] * vibrationlevel / 127;
    }
    return out;
  }

  // Learning Type
  if (bytes[0] === 0x6c) {
    var FREQ_SAMPLING_ACC_LF = 800;
    var vibrationlevel = (bytes[2] * 128 + bytes[3] + bytes[4] / 100) / 10 / 121.45;
    out.temperature = bytes[6] - 30;
    out.learningfromscratch = bytes[7];
    out.learningpercentage = bytes[1];
    out.vibrationlevel = vibrationlevel;
    out.peakfrequencyindex = bytes[5] + 1;
    out.peakfrequency = (bytes[5] + 1) * FREQ_SAMPLING_ACC_LF / 256;
    for (var i = 8; i <= 39; i++) {
      out['fft_' + (i - 7)] = bytes[i] * vibrationlevel / 127;
    }
    return out;
  }

  // State Type
  if (bytes[0] === 0x53) {
    var state;
    if (bytes[1] === 100) state = 'Sensor start';
    else if (bytes[1] === 101) state = 'Sensor stop';
    else if (bytes[1] === 125) state = 'Machine stop';
    else if (bytes[1] === 126) state = 'Machine start';
    out.state = state;
    out.battery_percentage = bytes[2] * 100 / 127;
    return out;
  }

  return {};
}

function decodeUplink(input) { return { data: _bobDecode(input.bytes, input.fPort) }; }
function Decode(fPort, bytes) { return _bobDecode(bytes, fPort); }
function Decoder(bytes, port) { return _bobDecode(bytes, port); }
