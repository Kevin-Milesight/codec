/**
 * SenseCAP S2120 — LoRaWAN 8-in-1 Weather Station decoder.
 *
 * Based on the official Seeed-Solution SenseCAP-Decoder:
 *   repos/Seeed-Solution/SenseCAP-Decoder S2120/TTN/SenseCAP_S2120_TTN_Decoder.js
 *
 * Three equivalent entry points, all producing a FLAT object with snake_case keys:
 *   decodeUplink(input) -> { data: {...} }
 *   Decode(fPort, bytes) -> {...}
 *   Decoder(bytes, port) -> {...}
 */

/* ============================ official S2120 core ============================ */

function bytes2HexString (arrBytes) {
  var str = ''
  for (var i = 0; i < arrBytes.length; i++) {
    var tmp
    var num = arrBytes[i]
    if (num < 0) {
      tmp = (255 + num + 1).toString(16)
    } else {
      tmp = num.toString(16)
    }
    if (tmp.length === 1) {
      tmp = '0' + tmp
    }
    str += tmp
  }
  return str
}

function bigEndianTransform (data) {
  var dataArray = []
  for (var i = 0; i < data.length; i += 2) {
    dataArray.push(data.substring(i, i + 2))
  }
  return dataArray
}

function toBinary (arr) {
  var binaryData = arr.map(function (item) {
    var data = parseInt(item, 16).toString(2)
    var dataLength = data.length
    if (data.length !== 8) {
      for (var i = 0; i < 8 - dataLength; i++) {
        data = '0' + data
      }
    }
    return data
  })
  return binaryData.toString().replace(/,/g, '')
}

function loraWANV2DataFormat (str, divisor) {
  if (divisor === undefined) divisor = 1
  var strReverse = bigEndianTransform(str)
  var str2 = toBinary(strReverse)
  if (str2.substring(0, 1) === '1') {
    var arr = str2.split('')
    var reverseArr = arr.map(function (item) {
      if (parseInt(item) === 1) return 0
      return 1
    })
    str2 = parseInt(reverseArr.join(''), 2) + 1
    return parseFloat('-' + str2 / divisor)
  }
  return parseInt(str2, 2) / divisor
}

function loraWANV2BitDataFormat (str) {
  var strReverse = bigEndianTransform(str)
  var str2 = toBinary(strReverse)
  var channel = parseInt(str2.substring(0, 4), 2)
  var status = parseInt(str2.substring(4, 5), 2)
  var type = parseInt(str2.substring(5), 2)
  return { channel: channel, status: status, type: type }
}

function sensorErrorDesc (errorCode) {
  switch (errorCode) {
    case '00': return 'CCL_SENSOR_ERROR_NONE'
    case '01': return 'CCL_SENSOR_NOT_FOUND'
    case '02': return 'CCL_SENSOR_WAKEUP_ERROR'
    case '03': return 'CCL_SENSOR_NOT_RESPONSE'
    case '04': return 'CCL_SENSOR_DATA_EMPTY'
    case '05': return 'CCL_SENSOR_DATA_HEAD_ERROR'
    case '06': return 'CCL_SENSOR_DATA_CRC_ERROR'
    case '07': return 'CCL_SENSOR_DATA_B1_NO_VALID'
    case '08': return 'CCL_SENSOR_DATA_B2_NO_VALID'
    case '09': return 'CCL_SENSOR_RANDOM_NOT_MATCH'
    case '0A': return 'CCL_SENSOR_PUBKEY_SIGN_VERIFY_FAILED'
    case '0B': return 'CCL_SENSOR_DATA_SIGN_VERIFY_FAILED'
    case '0C': return 'CCL_SENSOR_DATA_VALUE_HI'
    case '0D': return 'CCL_SENSOR_DATA_VALUE_LOW'
    case '0E': return 'CCL_SENSOR_DATA_VALUE_MISSED'
    case '0F': return 'CCL_SENSOR_ARG_INVAILD'
    case '10': return 'CCL_SENSOR_RS485_MASTER_BUSY'
    case '11': return 'CCL_SENSOR_RS485_REV_DATA_ERROR'
    case '12': return 'CCL_SENSOR_RS485_REG_MISSED'
    case '13': return 'CCL_SENSOR_RS485_FUN_EXE_ERROR'
    case '14': return 'CCL_SENSOR_RS485_WRITE_STRATEGY_ERROR'
    case '15': return 'CCL_SENSOR_CONFIG_ERROR'
    case 'FF': return 'CCL_SENSOR_DATA_ERROR_UNKONW'
    default: return 'CC_OTHER_FAILED'
  }
}

/**
 * Split a hex payload into (dataId, dataValue) frames.
 * dataId 01/20/21/30/31/33/40/41/42/43/44/45/4a -> 10-byte dataValue
 * dataId 02/4b -> 8-byte; 03/06 -> 1-byte; 05/34 -> 4-byte;
 * dataId 04/10/32/35/36/37/38/39 -> 9-byte; 4c -> 6-byte.
 */
function dataSplit (bytes) {
  var frameArray = []
  for (var i = 0; i < bytes.length; i++) {
    var remainingValue = bytes
    var dataId = remainingValue.substring(0, 2).toLowerCase()
    var dataValue
    var dataObj = {}
    switch (dataId) {
      case '01':
      case '20':
      case '21':
      case '30':
      case '31':
      case '33':
      case '40':
      case '41':
      case '42':
      case '43':
      case '44':
      case '45':
      case '4a':
        dataValue = remainingValue.substring(2, 22)
        bytes = remainingValue.substring(22)
        dataObj = { dataId: dataId, dataValue: dataValue }
        break
      case '02':
      case '4b':
        dataValue = remainingValue.substring(2, 18)
        bytes = remainingValue.substring(18)
        dataObj = { dataId: dataId, dataValue: dataValue }
        break
      case '03':
      case '06':
        dataValue = remainingValue.substring(2, 4)
        bytes = remainingValue.substring(4)
        dataObj = { dataId: dataId, dataValue: dataValue }
        break
      case '05':
      case '34':
        dataValue = remainingValue.substring(2, 10)
        bytes = remainingValue.substring(10)
        dataObj = { dataId: dataId, dataValue: dataValue }
        break
      case '04':
      case '10':
      case '32':
      case '35':
      case '36':
      case '37':
      case '38':
      case '39':
        dataValue = remainingValue.substring(2, 20)
        bytes = remainingValue.substring(20)
        dataObj = { dataId: dataId, dataValue: dataValue }
        break
      case '4c':
        dataValue = remainingValue.substring(2, 14)
        bytes = remainingValue.substring(14)
        dataObj = { dataId: dataId, dataValue: dataValue }
        break
      default:
        dataValue = '9'
        break
    }
    if (dataValue.length < 2) {
      break
    }
    frameArray.push(dataObj)
  }
  return frameArray
}

function dataIdAndDataValueJudge (dataId, dataValue) {
  var messages = []
  switch (dataId) {
    case '01':
    case '4a':
      messages = [{
        measurementValue: loraWANV2DataFormat(dataValue.substring(0, 4), 10),
        measurementId: '4097', type: 'Air Temperature'
      }, {
        measurementValue: loraWANV2DataFormat(dataValue.substring(4, 6)),
        measurementId: '4098', type: 'Air Humidity'
      }, {
        measurementValue: loraWANV2DataFormat(dataValue.substring(6, 14)),
        measurementId: '4099', type: 'Light Intensity'
      }, {
        measurementValue: loraWANV2DataFormat(dataValue.substring(14, 16), 10),
        measurementId: '4190', type: 'UV Index'
      }, {
        measurementValue: loraWANV2DataFormat(dataValue.substring(16, 20), 10),
        measurementId: '4105', type: 'Wind Speed'
      }]
      break
    case '02':
    case '4b':
      messages = [{
        measurementValue: loraWANV2DataFormat(dataValue.substring(0, 4)),
        measurementId: '4104', type: 'Wind Direction Sensor'
      }, {
        measurementValue: loraWANV2DataFormat(dataValue.substring(4, 12), 1000),
        measurementId: '4113', type: 'Rain Gauge'
      }, {
        measurementValue: loraWANV2DataFormat(dataValue.substring(12, 16), 0.1),
        measurementId: '4101', type: 'Barometric Pressure'
      }]
      break
    case '03':
      messages = [{
        'Battery(%)': loraWANV2DataFormat(dataValue)
      }]
      break
    case '04':
      messages = [{
        'Battery(%)': loraWANV2DataFormat(dataValue.substring(0, 2)),
        'Hardware Version': `${loraWANV2DataFormat(dataValue.substring(2, 4))}.${loraWANV2DataFormat(dataValue.substring(4, 6))}`,
        'Firmware Version': `${loraWANV2DataFormat(dataValue.substring(6, 8))}.${loraWANV2DataFormat(dataValue.substring(8, 10))}`,
        'measureInterval': parseInt(loraWANV2DataFormat(dataValue.substring(10, 14))) * 60,
        'gpsInterval': parseInt(loraWANV2DataFormat(dataValue.substring(14, 18))) * 60
      }]
      break
    case '05':
      messages = [{
        'measureInterval': parseInt(loraWANV2DataFormat(dataValue.substring(0, 4))) * 60,
        'gpsInterval': parseInt(loraWANV2DataFormat(dataValue.substring(4, 8))) * 60
      }]
      break
    case '06':
      messages = [{
        measurementId: '4101', type: 'sensor_error_event',
        errCode: dataValue, descZh: sensorErrorDesc(dataValue)
      }]
      break
    case '10': {
      var statusValue = dataValue.substring(0, 2)
      var bit = loraWANV2BitDataFormat(statusValue)
      messages = [{
        status: bit.status, channelType: bit.type, sensorEui: dataValue.substring(2)
      }]
      break
    }
    case '4c':
      messages = [{
        measurementValue: loraWANV2DataFormat(dataValue.substring(0, 4), 10),
        measurementId: '4191', type: 'Peak Wind Gust'
      }, {
        measurementValue: loraWANV2DataFormat(dataValue.substring(4, 12), 1000),
        measurementId: '4213', type: 'Rain Accumulation'
      }]
      break
    default:
      break
  }
  return messages
}

/* ============================ flat mapping layer ============================ */

var MEASUREMENT_ID_MAP = {
  '4097': 'air_temperature',
  '4098': 'air_humidity',
  '4099': 'light_intensity',
  '4100': 'co2',
  '4101': 'barometric_pressure',
  '4102': 'soil_temperature',
  '4103': 'soil_moisture',
  '4104': 'wind_direction',
  '4105': 'wind_speed',
  '4113': 'rainfall_hourly',
  '4190': 'uv_index',
  '4195': 'tvoc'
}

function toHex (bytes) {
  var hex = ''
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] & 0xff
    hex += ('0' + b.toString(16)).slice(-2)
  }
  return hex.toUpperCase()
}

function decodeUplink (input) {
  var raw = toHex(input.bytes)
  var out = { raw_uplink: raw }

  var hex = raw.toUpperCase()
  var splitArray = dataSplit(hex)
  for (var i = 0; i < splitArray.length; i++) {
    var messages = dataIdAndDataValueJudge(splitArray[i].dataId, splitArray[i].dataValue)
    for (var j = 0; j < messages.length; j++) {
      var msg = messages[j]
      if (msg.type === 'upload_battery' && msg.battery !== undefined) {
        out.battery_percentage = msg.battery
      } else if (msg['Battery(%)'] !== undefined) {
        out.battery_percentage = msg['Battery(%)']
      } else if (msg.measurementId !== undefined && msg.measurementValue !== undefined) {
        var field = MEASUREMENT_ID_MAP[String(msg.measurementId)]
        if (field) out[field] = msg.measurementValue
      }
    }
  }
  return { data: out }
}

function Decode (fPort, bytes) {
  return decodeUplink({ bytes: bytes, fPort: fPort }).data
}

function Decoder (bytes, port) {
  return decodeUplink({ bytes: bytes, fPort: port }).data
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { decodeUplink: decodeUplink, Decode: Decode, Decoder: Decoder }
}
