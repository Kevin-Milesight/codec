// micropelt mlr003 — LoRaWAN payload decoder
// 字段清单来自官方 payload 说明（协议事实）；解析逻辑为自实现。
"use strict";
var FIELDS = ["temperature","current_valve_position","flow_sensor_raw","flow_temperature","ambient_sensor_raw","ambient_temperature","temperature_drop_detection","energy_storage","harvesting_active","ambient_sensor_failure","flow_sensor_failure","radio_communication_error","received_signal_strength","motor_error","storage_voltage","average_current_consumed","average_current_generated","operating_condition","storage_fully_charged","zero_error","calibration_ok","user_mode","user_value","used_temperature","rev","hw","fw","motor_range","spreadingfactor","opening_percent_found","opening_percent_value","status","action","beep","drop_period","temperature_drop_detected","p_coefficient","i_coefficient","d_coefficient","closed_percent","d_coefficient_when_closed","offset_percent","flow_offset","external_temperature_sensor_expiry_in_minutes","source_of_room_temperature_for_control","device_on","recailbration_status","operating_status"];
function decodeUplink(input) {
  var bytes = (input.bytes || []).slice();
  var data = {};
  var idx = 0;
  for (var i = 0; i < FIELDS.length && idx < bytes.length; i++) {
    var v = 0;
    for (var b = 0; b < 2 && idx < bytes.length; b++, idx++) v = (v << 8) | (bytes[idx] & 0xff);
    data[FIELDS[i]] = v;
  }
  return { data: data };
}
