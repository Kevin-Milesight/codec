// Generate Schneider Electric PowerTag (PAS600 EcoStruxure Panel Server) codec.json + devices.json
// Official source: PowerTag Link User Guide (productinfo.schneider-electric.com/powertaglinkuserguide)
//  - "PowerTag Energy Sensors Modbus Registers" (TPC_PowerTagEnergySensorsModbusTablesREF_0000503435)
//  - "PowerTag Control Modules Modbus Registers" (TPC_PowerTagControlModulesModbusTablesREF_0000503434)
//  - "Wireless Devices Modbus Registers" (TPC_WirelessDevicesModbusTablesREF_0000503432)
// Applicable-device codes: A = PowerTag Energy 63 (A9MEM154x/155x/156x/157x),
//   M = PowerTag Energy M250/M630 (LV43402x), R = PowerTag Energy F160 (A9MEM1580) and Rope (A9MEM159x).
// Registers are exposed by the PAS600 gateway over Modbus TCP (FC03, holding registers).
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

const U = {
  A: 3, V: 5, W: 47, VAR: 11, VA: 8, HZ: 27, PERCENT: 98,
  WH: 18, VARH: 242, VAH: 239, CELSIUS: 62, NONE: 95,
};

function obj(id, name, addr, fmt, regs, unit, unitId, scale, bacnetType) {
  return {
    id,
    name,
    description: '',
    bacnet_instance_id: 0,
    modbus_register_type: 'holding_register',
    modbus_data_format: fmt,
    modbus_register_num: regs,
    modbus_register_addr: addr,
    modbus_unit_type: unit,
    modbus_unit_type_id: unitId,
    modbus_scale: scale,
    target: { bacnet: { type: bacnetType || 'Analog-Input' } },
  };
}
const f32 = (addr, unit, unitId, scale) => obj(null, null, addr, 'float32_ab', 2, unit, unitId, scale === undefined ? 1 : scale);
const i64 = (addr, unit, unitId, scale) => obj(null, null, addr, 'int64_be', 4, unit, unitId, scale === undefined ? 1 : scale);
const u16 = (addr, bacnetType) => obj(null, null, addr, 'uint16_ab', 1, '', U.NONE, 1, bacnetType);

// ---------- PowerTag Energy sensors (per applicable-device code) ----------
// Registers common to A/M/R (from "PowerTag Energy Sensors Modbus Registers")
const commonAMR = [
  f32(3000, 'A', U.A),       // RMS current on phase A
  f32(3002, 'A', U.A),       // RMS current on phase B
  f32(3004, 'A', U.A),       // RMS current on phase C
  f32(3020, 'V', U.V),       // RMS phase-to-phase voltage A-B
  f32(3022, 'V', U.V),       // RMS phase-to-phase voltage B-C
  f32(3024, 'V', U.V),       // RMS phase-to-phase voltage C-A
  f32(3028, 'V', U.V),       // RMS phase-to-neutral voltage A-N
  f32(3030, 'V', U.V),       // RMS phase-to-neutral voltage B-N
  f32(3032, 'V', U.V),       // RMS phase-to-neutral voltage C-N
  f32(3054, 'W', U.W),       // Active power on phase A
  f32(3056, 'W', U.W),       // Active power on phase B
  f32(3058, 'W', U.W),       // Active power on phase C
  f32(3060, 'W', U.W),       // total active power
  f32(3076, 'VA', U.VA),     // Total apparent power (arithmetic)
  f32(3084, '', U.NONE),     // Total power factor
  i64(3204, 'Wh', U.WH),     // Total active energy delivered + received (not resettable)
  i64(3208, 'Wh', U.WH),     // Total active energy delivered count positively (not resettable)
  i64(3212, 'Wh', U.WH),     // Total active energy received (not resettable)
  i64(3256, 'Wh', U.WH),     // Partial active energy delivered + received (resettable)
  i64(3264, 'Wh', U.WH),     // Partial active energy delivered (resettable)
  i64(3272, 'Wh', U.WH),     // Partial active energy received (resettable)
];
// Registers available for A and R only
const commonAR = [
  i64(5009, 'Wh', U.WH),     // Active energy delivered (resettable)
  i64(5013, 'Wh', U.WH),     // Active energy delivered count positively (not resettable)
  i64(5017, 'Wh', U.WH),     // Active energy received (resettable)
  i64(5021, 'Wh', U.WH),     // Active energy received count negatively (not resettable)
  f32(3766, 'W', U.W),       // Demand total active power
  f32(3770, 'W', U.W),       // Maximum Demand total active power
];
// Registers available for M and R only
const commonMR = [
  f32(3068, 'VAR', U.VAR),   // Total reactive power
  f32(3110, 'Hz', U.HZ),     // AC frequency
  f32(3132, '°C', U.CELSIUS),// Device internal temperature
  i64(3280, 'VARh', U.VARH), // Partial reactive energy delivered (resettable)
  i64(3288, 'VARh', U.VARH), // Partial reactive energy received (resettable)
];
// Registers available for M only (per-phase active energy)
const commonM = [
  i64(3216, 'Wh', U.WH),     // Active energy on phase A delivered - received (not resettable)
  i64(3220, 'Wh', U.WH),     // Active energy on phase B delivered - received (not resettable)
  i64(3224, 'Wh', U.WH),     // Active energy on phase C delivered - received (not resettable)
];
// Registers available for R only (per-phase power / energy, reactive & apparent energy)
const commonR = [
  f32(3006, 'A', U.A),       // RMS current on Neutral
  f32(3062, 'VAR', U.VAR),   // Reactive power on phase A
  f32(3064, 'VAR', U.VAR),   // Reactive power on phase B
  f32(3066, 'VAR', U.VAR),   // Reactive power on phase C
  f32(3070, 'VA', U.VA),     // Apparent power on phase A
  f32(3072, 'VA', U.VA),     // Apparent power on phase B
  f32(3074, 'VA', U.VA),     // Apparent power on phase C
  f32(3078, '', U.NONE),     // Power factor on phase A
  f32(3080, '', U.NONE),     // Power factor on phase B
  f32(3082, '', U.NONE),     // Power factor on phase C
  i64(5049, 'Wh', U.WH),     // Active energy on phase A delivered (resettable)
  i64(5057, 'Wh', U.WH),     // Active energy on phase A received (resettable)
  i64(5077, 'Wh', U.WH),     // Active energy on phase A delivered + received (not resettable)
  i64(5089, 'Wh', U.WH),     // Active energy on phase B delivered (resettable)
  i64(5097, 'Wh', U.WH),     // Active energy on phase B received (resettable)
  i64(5129, 'Wh', U.WH),     // Active energy on phase C delivered (resettable)
  i64(5137, 'Wh', U.WH),     // Active energy on phase C received (resettable)
  i64(5177, 'VARh', U.VARH), // Reactive energy delivered (resettable)
  i64(5193, 'VARh', U.VARH), // Reactive energy received (resettable)
  i64(5365, 'VAh', U.VAH),   // Apparent energy delivered + received (resettable)
  i64(5369, 'VAh', U.VAH),   // Apparent energy delivered + received (not resettable)
  i64(5389, 'VAh', U.VAH),   // Apparent energy on phase A (resettable)
  i64(5429, 'VAh', U.VAH),   // Apparent energy on phase B (resettable)
  i64(5469, 'VAh', U.VAH),   // Apparent energy on phase C (resettable)
];

const energy63Names = [
  ['current_a', 'RMS Current Phase A'], ['current_b', 'RMS Current Phase B'], ['current_c', 'RMS Current Phase C'],
  ['voltage_a_b', 'RMS Voltage A-B'], ['voltage_b_c', 'RMS Voltage B-C'], ['voltage_c_a', 'RMS Voltage C-A'],
  ['voltage_a_n', 'RMS Voltage A-N'], ['voltage_b_n', 'RMS Voltage B-N'], ['voltage_c_n', 'RMS Voltage C-N'],
  ['active_power_a', 'Active Power Phase A'], ['active_power_b', 'Active Power Phase B'], ['active_power_c', 'Active Power Phase C'],
  ['total_active_power', 'Total Active Power'], ['total_apparent_power', 'Total Apparent Power'], ['total_power_factor', 'Total Power Factor'],
  ['total_active_energy', 'Total Active Energy Delivered + Received'], ['total_active_energy_delivered', 'Total Active Energy Delivered'],
  ['total_active_energy_received', 'Total Active Energy Received'],
  ['partial_active_energy', 'Partial Active Energy Delivered + Received'], ['partial_active_energy_delivered', 'Partial Active Energy Delivered'],
  ['partial_active_energy_received', 'Partial Active Energy Received'],
  ['active_energy_delivered', 'Active Energy Delivered (Resettable)'], ['active_energy_delivered_nr', 'Active Energy Delivered (Not Resettable)'],
  ['active_energy_received', 'Active Energy Received (Resettable)'], ['active_energy_received_nr', 'Active Energy Received (Not Resettable)'],
  ['demand_active_power', 'Demand Total Active Power'], ['max_demand_active_power', 'Maximum Demand Total Active Power'],
];

const m250m630Names = [
  ['current_a', 'RMS Current Phase A'], ['current_b', 'RMS Current Phase B'], ['current_c', 'RMS Current Phase C'],
  ['voltage_a_b', 'RMS Voltage A-B'], ['voltage_b_c', 'RMS Voltage B-C'], ['voltage_c_a', 'RMS Voltage C-A'],
  ['voltage_a_n', 'RMS Voltage A-N'], ['voltage_b_n', 'RMS Voltage B-N'], ['voltage_c_n', 'RMS Voltage C-N'],
  ['active_power_a', 'Active Power Phase A'], ['active_power_b', 'Active Power Phase B'], ['active_power_c', 'Active Power Phase C'],
  ['total_active_power', 'Total Active Power'], ['total_apparent_power', 'Total Apparent Power'], ['total_power_factor', 'Total Power Factor'],
  ['total_active_energy', 'Total Active Energy Delivered + Received'], ['total_active_energy_delivered', 'Total Active Energy Delivered'],
  ['total_active_energy_received', 'Total Active Energy Received'],
  ['partial_active_energy', 'Partial Active Energy Delivered + Received'], ['partial_active_energy_delivered', 'Partial Active Energy Delivered'],
  ['partial_active_energy_received', 'Partial Active Energy Received'],
  ['total_reactive_power', 'Total Reactive Power'], ['frequency', 'AC Frequency'], ['device_temperature', 'Device Internal Temperature'],
  ['partial_reactive_energy_delivered', 'Partial Reactive Energy Delivered'], ['partial_reactive_energy_received', 'Partial Reactive Energy Received'],
  ['active_energy_phase_a', 'Active Energy Phase A Delivered - Received'], ['active_energy_phase_b', 'Active Energy Phase B Delivered - Received'],
  ['active_energy_phase_c', 'Active Energy Phase C Delivered - Received'],
];

const f160ropeNames = [
  ['current_a', 'RMS Current Phase A'], ['current_b', 'RMS Current Phase B'], ['current_c', 'RMS Current Phase C'],
  ['voltage_a_b', 'RMS Voltage A-B'], ['voltage_b_c', 'RMS Voltage B-C'], ['voltage_c_a', 'RMS Voltage C-A'],
  ['voltage_a_n', 'RMS Voltage A-N'], ['voltage_b_n', 'RMS Voltage B-N'], ['voltage_c_n', 'RMS Voltage C-N'],
  ['active_power_a', 'Active Power Phase A'], ['active_power_b', 'Active Power Phase B'], ['active_power_c', 'Active Power Phase C'],
  ['total_active_power', 'Total Active Power'], ['total_apparent_power', 'Total Apparent Power'], ['total_power_factor', 'Total Power Factor'],
  ['total_active_energy', 'Total Active Energy Delivered + Received'], ['total_active_energy_delivered', 'Total Active Energy Delivered'],
  ['total_active_energy_received', 'Total Active Energy Received'],
  ['partial_active_energy', 'Partial Active Energy Delivered + Received'], ['partial_active_energy_delivered', 'Partial Active Energy Delivered'],
  ['partial_active_energy_received', 'Partial Active Energy Received'],
  ['active_energy_delivered', 'Active Energy Delivered (Resettable)'], ['active_energy_delivered_nr', 'Active Energy Delivered (Not Resettable)'],
  ['active_energy_received', 'Active Energy Received (Resettable)'], ['active_energy_received_nr', 'Active Energy Received (Not Resettable)'],
  ['demand_active_power', 'Demand Total Active Power'], ['max_demand_active_power', 'Maximum Demand Total Active Power'],
  ['total_reactive_power', 'Total Reactive Power'], ['frequency', 'AC Frequency'], ['device_temperature', 'Device Internal Temperature'],
  ['partial_reactive_energy_delivered', 'Partial Reactive Energy Delivered'], ['partial_reactive_energy_received', 'Partial Reactive Energy Received'],
  ['current_neutral', 'RMS Current Neutral'],
  ['reactive_power_a', 'Reactive Power Phase A'], ['reactive_power_b', 'Reactive Power Phase B'], ['reactive_power_c', 'Reactive Power Phase C'],
  ['apparent_power_a', 'Apparent Power Phase A'], ['apparent_power_b', 'Apparent Power Phase B'], ['apparent_power_c', 'Apparent Power Phase C'],
  ['power_factor_a', 'Power Factor Phase A'], ['power_factor_b', 'Power Factor Phase B'], ['power_factor_c', 'Power Factor Phase C'],
  ['active_energy_phase_a_delivered', 'Active Energy Phase A Delivered'], ['active_energy_phase_a_received', 'Active Energy Phase A Received'],
  ['active_energy_phase_a_total', 'Active Energy Phase A Delivered + Received'],
  ['active_energy_phase_b_delivered', 'Active Energy Phase B Delivered'], ['active_energy_phase_b_received', 'Active Energy Phase B Received'],
  ['active_energy_phase_c_delivered', 'Active Energy Phase C Delivered'], ['active_energy_phase_c_received', 'Active Energy Phase C Received'],
  ['reactive_energy_delivered', 'Reactive Energy Delivered'], ['reactive_energy_received', 'Reactive Energy Received'],
  ['apparent_energy', 'Apparent Energy Delivered + Received'], ['apparent_energy_nr', 'Apparent Energy Delivered + Received (Not Resettable)'],
  ['apparent_energy_phase_a', 'Apparent Energy Phase A'], ['apparent_energy_phase_b', 'Apparent Energy Phase B'],
  ['apparent_energy_phase_c', 'Apparent Energy Phase C'],
];

function named(objs, names) {
  return objs.map((o, i) => {
    const [id, name] = names[i] || [`obj${i}`, `Object ${i}`];
    const c = { ...o, id, name };
    return c;
  });
}

// ---------- PowerTag Control modules (C2DI / CIO) ----------
// Digital Input 1 (PowerTag control IO and 2DI modules)
const di1Status = [
  Object.assign(u16(34041), { id: 'di1_electrical_status', name: 'Digital Input 1 Electrical Status', target: { bacnet: { type: 'MultiState-Value' } } }),
  Object.assign(u16(34047), { id: 'di1_breaker_position', name: 'Digital Input 1 Breaker Position', target: { bacnet: { type: 'MultiState-Value' } } }),
  Object.assign(u16(34065), { id: 'di1_status', name: 'Digital Input 1 Status', target: { bacnet: { type: 'MultiState-Value' } } }),
];
// Digital Input 2 (PowerTag control 2DI module only)
const di2Status = [
  Object.assign(u16(34141), { id: 'di2_electrical_status', name: 'Digital Input 2 Electrical Status', target: { bacnet: { type: 'MultiState-Value' } } }),
  Object.assign(u16(34147), { id: 'di2_breaker_position', name: 'Digital Input 2 Breaker Position', target: { bacnet: { type: 'MultiState-Value' } } }),
  Object.assign(u16(34165), { id: 'di2_status', name: 'Digital Input 2 Status', target: { bacnet: { type: 'MultiState-Value' } } }),
];
// Digital Output 1 (PowerTag control IO module only)
const do1Status = [
  Object.assign(u16(37052), { id: 'do1_status', name: 'Digital Output 1 Status', target: { bacnet: { type: 'MultiState-Value' } } }),
];

// ---------- assemble devices ----------
const devices = [
  { id: 'pas600-c2di', name: 'PAS600 PowerTag C2DI', objects: di1Status.concat(di2Status) },
  { id: 'pas600-cio', name: 'PAS600 PowerTag CIO', objects: di1Status.concat(do1Status) },
  { id: 'pas600-energy-63', name: 'PAS600 PowerTag Energy 63', objects: named(commonAMR.concat(commonAR), energy63Names) },
  { id: 'pas600-energy-m250-m630-eframe', name: 'PAS600 PowerTag Energy M250/M630 E-Frame', objects: named(commonAMR.concat(commonM, commonMR), m250m630Names) },
  { id: 'pas600-energy-f160-rope', name: 'PAS600 PowerTag Energy F160 Rope', objects: named(commonAMR.concat(commonAR, commonM, commonMR, commonR), f160ropeNames) },
];

for (const dev of devices) {
  const dir = path.join(ROOT, dev.id);
  fs.mkdirSync(dir, { recursive: true });
  const codecPath = path.join(dir, `${dev.id}-codec.json`);
  const devicesPath = path.join(dir, `${dev.id}-devices.json`);
  const codec = { object: dev.objects };
  const devFile = {
    protocol: 'modbus tcp',
    codec: `vendors/SchneiderElectric/${dev.id}/${dev.id}-codec.json`,
    modbus_default_slave_id: 1,
  };
  fs.writeFileSync(codecPath, JSON.stringify(codec, null, 2), { encoding: 'utf8' });
  fs.writeFileSync(devicesPath, JSON.stringify(devFile, null, 2), { encoding: 'utf8' });
}

for (const dev of devices) {
  const ids = dev.objects.map(o => o.id);
  const dupIds = ids.filter((v, i) => ids.indexOf(v) !== i);
  const addrs = dev.objects.map(o => o.modbus_register_addr);
  const dupAddrs = addrs.filter((v, i) => addrs.indexOf(v) !== i);
  if (dupIds.length || dupAddrs.length) {
    console.log(`WARN ${dev.id}: dupIds=${JSON.stringify(dupIds)} dupAddrs=${JSON.stringify(dupAddrs)}`);
  }
}
console.log('DONE powertag series');
