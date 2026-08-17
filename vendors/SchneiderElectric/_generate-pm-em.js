// Generate Schneider Electric PowerLogic PM / EM series codec.json + devices.json
// Official sources (see README-pm-em.md for details):
//  - PM5500/5600/5700 platform (PM5560...PM5761): PM556x_PublicModbusRegisterList_v2.3.0.xlsx
//      (downloaded from download.schneider-electric.com, package "PM5560 PM5563 V2.3.0 Firmware and associated files")
//  - PM2000 platform (PM2120/PM2130/PM2220) + EM6400NG: Public_EM6400_PM2xxx PMC Register List_v1050_6.xlsx
//  - EM6436H: EM6400 Series Power Meters User Manual (usermanual em6400.v01.d10, CTD7303, Table 6-4 Individual parameter address)
//  - PM710MG: Power Meter 710 Appendix B Register List (63230-501-209A1)
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// BACnet unit ids from codec-thirdparty/bacnet_unit.md
const U = {
  A: 3,        // amperes
  V: 5,        // volts
  W: 47,       // watts
  KW: 48,      // kilowatts
  VAR: 11,     // volt-amperes reactive
  KVAR: 12,    // kilovolt-amperes reactive
  VA: 8,       // volt-amperes
  KVA: 9,      // kilovolt-amperes
  HZ: 27,      // hertz
  PERCENT: 98, // percent
  WH: 18,      // watt-hours
  KWH: 19,     // kilowatt-hours
  VARH: 242,   // volt-ampere-hours reactive
  KVARH: 243,  // kilovolt-ampere-hours reactive
  VAH: 239,    // volt-ampere-hours
  KVAH: 240,   // kilovolt-ampere-hours
  CELSIUS: 62, // degrees celsius
  HOURS: 71,   // hours
  MINUTES: 72, // minutes
  NONE: 95,    // no units
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

const f32 = (addr) => obj(null, null, addr, 'float32_ab', 2);
const i64 = (addr) => obj(null, null, addr, 'int64_be', 4);

function measure(id, name, addr, unit, unitId, scale) {
  const o = f32(addr);
  o.id = id; o.name = name; o.modbus_unit_type = unit; o.modbus_unit_type_id = unitId;
  o.modbus_scale = scale === undefined ? 1 : scale;
  return o;
}
function energy(id, name, addr, unit, unitId, scale) {
  const o = i64(addr);
  o.id = id; o.name = name; o.modbus_unit_type = unit; o.modbus_unit_type_id = unitId;
  o.modbus_scale = scale === undefined ? 1 : scale;
  return o;
}

// =====================================================================
// 1) PM5500/5600/5700 platform  (PM556x_PublicModbusRegisterList_v2.3.0.xlsx)
//    All rows in the "PM5500" applicability column are Y -> same set for all models.
// =====================================================================
function pm5xxxObjects() {
  const objs = [];
  // Instantaneous metering (Float32)
  objs.push(
    measure('current_a', 'Current A', 3000, 'A', U.A),
    measure('current_b', 'Current B', 3002, 'A', U.A),
    measure('current_c', 'Current C', 3004, 'A', U.A),
    measure('current_avg', 'Average Current', 3010, 'A', U.A),
    measure('voltage_a_b', 'Voltage A-B', 3020, 'V', U.V),
    measure('voltage_b_c', 'Voltage B-C', 3022, 'V', U.V),
    measure('voltage_c_a', 'Voltage C-A', 3024, 'V', U.V),
    measure('voltage_ll_avg', 'Voltage L-L Average', 3026, 'V', U.V),
    measure('voltage_a_n', 'Voltage A-N', 3028, 'V', U.V),
    measure('voltage_b_n', 'Voltage B-N', 3030, 'V', U.V),
    measure('voltage_c_n', 'Voltage C-N', 3032, 'V', U.V),
    measure('voltage_ln_avg', 'Voltage L-N Average', 3036, 'V', U.V),
    measure('active_power_a', 'Active Power A', 3054, 'kW', U.KW),
    measure('active_power_b', 'Active Power B', 3056, 'kW', U.KW),
    measure('active_power_c', 'Active Power C', 3058, 'kW', U.KW),
    measure('total_active_power', 'Total Active Power', 3060, 'kW', U.KW),
    measure('total_reactive_power', 'Total Reactive Power', 3068, 'kVAR', U.KVAR),
    measure('total_apparent_power', 'Total Apparent Power', 3076, 'kVA', U.KVA),
    measure('total_power_factor', 'Total Power Factor', 3084, '', U.NONE),
    measure('frequency', 'Frequency', 3110, 'Hz', U.HZ),
    measure('temperature', 'Device Temperature', 3132, '°C', U.CELSIUS),
    // THD (Power quality, Float32, %)
    measure('thd_current_a', 'THD Current A', 21300, '%', U.PERCENT),
    measure('thd_current_b', 'THD Current B', 21302, '%', U.PERCENT),
    measure('thd_current_c', 'THD Current C', 21304, '%', U.PERCENT),
    measure('thd_voltage_a_b', 'THD Voltage A-B', 21322, '%', U.PERCENT),
    measure('thd_voltage_b_c', 'THD Voltage B-C', 21324, '%', U.PERCENT),
    measure('thd_voltage_c_a', 'THD Voltage C-A', 21326, '%', U.PERCENT),
    measure('thd_voltage_a_n', 'THD Voltage A-N', 21330, '%', U.PERCENT),
    measure('thd_voltage_b_n', 'THD Voltage B-N', 21332, '%', U.PERCENT),
    measure('thd_voltage_c_n', 'THD Voltage C-N', 21334, '%', U.PERCENT),
  );
  // Energy (Int64, Wh)
  objs.push(
    energy('total_active_energy_delivered', 'Total Active Energy Delivered', 3204, 'Wh', U.WH),
    energy('total_active_energy_received', 'Total Active Energy Received', 3208, 'Wh', U.WH),
    energy('total_active_energy', 'Total Active Energy', 3212, 'Wh', U.WH),
    energy('total_reactive_energy_delivered', 'Total Reactive Energy Delivered', 3220, 'VARh', U.VARH),
    energy('total_reactive_energy_received', 'Total Reactive Energy Received', 3224, 'VARh', U.VARH),
  );
  // Demand (Float32)
  objs.push(
    measure('present_power_demand', 'Present Power Demand', 3766, 'kW', U.KW),
    measure('peak_power_demand', 'Peak Power Demand', 3770, 'kW', U.KW),
  );
  return objs;
}

// =====================================================================
// 2) PM2000 platform + EM6400NG  (Public_EM6400_PM2xxx PMC Register List)
//    Same layout as PM5xxx core (3000-series float32 + 3204-series int64 energy).
// =====================================================================
function pm2xxxObjects() {
  const objs = [];
  objs.push(
    measure('current_a', 'Current A', 3000, 'A', U.A),
    measure('current_b', 'Current B', 3002, 'A', U.A),
    measure('current_c', 'Current C', 3004, 'A', U.A),
    measure('current_avg', 'Average Current', 3010, 'A', U.A),
    measure('voltage_a_b', 'Voltage A-B', 3020, 'V', U.V),
    measure('voltage_b_c', 'Voltage B-C', 3022, 'V', U.V),
    measure('voltage_c_a', 'Voltage C-A', 3024, 'V', U.V),
    measure('voltage_ll_avg', 'Voltage L-L Average', 3026, 'V', U.V),
    measure('voltage_a_n', 'Voltage A-N', 3028, 'V', U.V),
    measure('voltage_b_n', 'Voltage B-N', 3030, 'V', U.V),
    measure('voltage_c_n', 'Voltage C-N', 3032, 'V', U.V),
    measure('voltage_ln_avg', 'Voltage L-N Average', 3036, 'V', U.V),
    measure('active_power_a', 'Active Power A', 3054, 'kW', U.KW),
    measure('active_power_b', 'Active Power B', 3056, 'kW', U.KW),
    measure('active_power_c', 'Active Power C', 3058, 'kW', U.KW),
    measure('total_active_power', 'Total Active Power', 3060, 'kW', U.KW),
    measure('total_reactive_power', 'Total Reactive Power', 3068, 'kVAR', U.KVAR),
    measure('total_apparent_power', 'Total Apparent Power', 3076, 'kVA', U.KVA),
    measure('total_power_factor', 'Total Power Factor', 3084, '', U.NONE),
    measure('frequency', 'Frequency', 3110, 'Hz', U.HZ),
    measure('thd_current_a', 'THD Current A', 21300, '%', U.PERCENT),
    measure('thd_current_b', 'THD Current B', 21302, '%', U.PERCENT),
    measure('thd_current_c', 'THD Current C', 21304, '%', U.PERCENT),
    measure('thd_voltage_a_b', 'THD Voltage A-B', 21322, '%', U.PERCENT),
    measure('thd_voltage_b_c', 'THD Voltage B-C', 21324, '%', U.PERCENT),
    measure('thd_voltage_c_a', 'THD Voltage C-A', 21326, '%', U.PERCENT),
    measure('thd_voltage_a_n', 'THD Voltage A-N', 21330, '%', U.PERCENT),
    measure('thd_voltage_b_n', 'THD Voltage B-N', 21332, '%', U.PERCENT),
    measure('thd_voltage_c_n', 'THD Voltage C-N', 21334, '%', U.PERCENT),
  );
  objs.push(
    energy('total_active_energy_delivered', 'Total Active Energy Delivered', 3204, 'Wh', U.WH),
    energy('total_active_energy_received', 'Total Active Energy Received', 3208, 'Wh', U.WH),
    energy('total_active_energy', 'Total Active Energy', 3212, 'Wh', U.WH),
    energy('total_reactive_energy_delivered', 'Total Reactive Energy Delivered', 3220, 'VARh', U.VARH),
    energy('total_reactive_energy_received', 'Total Reactive Energy Received', 3224, 'VARh', U.VARH),
  );
  objs.push(
    measure('present_power_demand', 'Present Power Demand', 3766, 'kW', U.KW),
    measure('peak_power_demand', 'Peak Power Demand', 3770, 'kW', U.KW),
  );
  return objs;
}

// =====================================================================
// 3) EM6436H  (EM6400 Series Power Meters User Manual, CTD7303, Table 6-4,
//    "EM6436" applicability column; Float = IEEE754 32-bit, Modbus RTU FC03)
// =====================================================================
function em6436hObjects() {
  const objs = [];
  objs.push(
    measure('current_avg', 'Average Current', 3913, 'A', U.A),
    measure('current_phase1', 'Current Phase 1', 3929, 'A', U.A),
    measure('current_phase2', 'Current Phase 2', 3943, 'A', U.A),
    measure('current_phase3', 'Current Phase 3', 3957, 'A', U.A),
    measure('voltage_ll_avg', 'Voltage L-L Average', 3909, 'V', U.V),
    measure('voltage_ln_avg', 'Voltage L-N Average', 3911, 'V', U.V),
    measure('voltage_phase1_2', 'Voltage Phase 1-2', 3925, 'V', U.V),
    measure('voltage_phase2_3', 'Voltage Phase 2-3', 3939, 'V', U.V),
    measure('voltage_phase3_1', 'Voltage Phase 3-1', 3953, 'V', U.V),
    measure('voltage_phase1_n', 'Voltage Phase 1-N', 3927, 'V', U.V),
    measure('voltage_phase2_n', 'Voltage Phase 2-N', 3941, 'V', U.V),
    measure('voltage_phase3_n', 'Voltage Phase 3-N', 3955, 'V', U.V),
    measure('total_active_power', 'Total Active Power', 3903, 'kW', U.KW),
    measure('active_power_phase1', 'Active Power Phase 1', 3919, 'kW', U.KW),
    measure('active_power_phase2', 'Active Power Phase 2', 3933, 'kW', U.KW),
    measure('active_power_phase3', 'Active Power Phase 3', 3947, 'kW', U.KW),
    measure('total_reactive_power', 'Total Reactive Power', 3905, 'kVAR', U.KVAR),
    measure('reactive_power_phase1', 'Reactive Power Phase 1', 3921, 'kVAR', U.KVAR),
    measure('reactive_power_phase2', 'Reactive Power Phase 2', 3935, 'kVAR', U.KVAR),
    measure('reactive_power_phase3', 'Reactive Power Phase 3', 3949, 'kVAR', U.KVAR),
    measure('total_apparent_power', 'Total Apparent Power', 3901, 'kVA', U.KVA),
    measure('apparent_power_phase1', 'Apparent Power Phase 1', 3917, 'kVA', U.KVA),
    measure('apparent_power_phase2', 'Apparent Power Phase 2', 3931, 'kVA', U.KVA),
    measure('apparent_power_phase3', 'Apparent Power Phase 3', 3945, 'kVA', U.KVA),
    measure('total_power_factor', 'Average Power Factor', 3907, '', U.NONE),
    measure('power_factor_phase1', 'Power Factor Phase 1', 3923, '', U.NONE),
    measure('power_factor_phase2', 'Power Factor Phase 2', 3937, '', U.NONE),
    measure('power_factor_phase3', 'Power Factor Phase 3', 3951, '', U.NONE),
    measure('frequency', 'Frequency', 3915, 'Hz', U.HZ),
    measure('forward_apparent_energy', 'Forward Apparent Energy', 3959, 'kVAh', U.KVAH),
    measure('forward_active_energy', 'Forward Active Energy', 3961, 'kWh', U.KWH),
    measure('forward_reactive_energy_inductive', 'Forward Reactive Energy (Inductive)', 3963, 'kVARh', U.KVARH),
    measure('forward_reactive_energy_capacitive', 'Forward Reactive Energy (Capacitive)', 3965, 'kVARh', U.KVARH),
  );
  return objs;
}

// =====================================================================
// 4) PM710MG  (Power Meter 710, 63230-501-209A1 Appendix B, Float section)
// =====================================================================
function pm710Objects() {
  const objs = [];
  objs.push(
    measure('total_real_energy', 'Total Real Energy', 1000, 'kWh', U.KWH),
    measure('total_apparent_energy', 'Total Apparent Energy', 1002, 'kVAh', U.KVAH),
    measure('total_reactive_energy', 'Total Reactive Energy', 1004, 'kVARh', U.KVARH),
    measure('total_real_power', 'Total Real Power', 1006, 'kW', U.KW),
    measure('total_apparent_power', 'Total Apparent Power', 1008, 'kVA', U.KVA),
    measure('total_reactive_power', 'Total Reactive Power', 1010, 'kVAR', U.KVAR),
    measure('total_power_factor', 'Total Power Factor', 1012, '', U.NONE),
    measure('voltage_ll_avg', 'Voltage L-L Average', 1014, 'V', U.V),
    measure('voltage_ln_avg', 'Voltage L-N Average', 1016, 'V', U.V),
    measure('current_avg', 'Average Current', 1018, 'A', U.A),
    measure('frequency', 'Frequency', 1020, 'Hz', U.HZ),
    measure('current_a', 'Current A', 1034, 'A', U.A),
    measure('current_b', 'Current B', 1036, 'A', U.A),
    measure('current_c', 'Current C', 1038, 'A', U.A),
    measure('current_n', 'Current N', 1040, 'A', U.A),
    measure('voltage_a_b', 'Voltage A-B', 1054, 'V', U.V),
    measure('voltage_b_c', 'Voltage B-C', 1056, 'V', U.V),
    measure('voltage_c_a', 'Voltage C-A', 1058, 'V', U.V),
    measure('voltage_a_n', 'Voltage A-N', 1060, 'V', U.V),
    measure('voltage_b_n', 'Voltage B-N', 1062, 'V', U.V),
    measure('voltage_c_n', 'Voltage C-N', 1064, 'V', U.V),
    measure('real_power_a', 'Real Power A', 1066, 'kW', U.KW),
    measure('real_power_b', 'Real Power B', 1068, 'kW', U.KW),
    measure('real_power_c', 'Real Power C', 1070, 'kW', U.KW),
    measure('apparent_power_a', 'Apparent Power A', 1072, 'kVA', U.KVA),
    measure('apparent_power_b', 'Apparent Power B', 1074, 'kVA', U.KVA),
    measure('apparent_power_c', 'Apparent Power C', 1076, 'kVA', U.KVA),
    measure('reactive_power_a', 'Reactive Power A', 1078, 'kVAR', U.KVAR),
    measure('reactive_power_b', 'Reactive Power B', 1080, 'kVAR', U.KVAR),
    measure('reactive_power_c', 'Reactive Power C', 1082, 'kVAR', U.KVAR),
    measure('thd_current_a', 'Current A THD', 1084, '%', U.PERCENT),
    measure('thd_current_b', 'Current B THD', 1086, '%', U.PERCENT),
    measure('thd_current_c', 'Current C THD', 1088, '%', U.PERCENT),
    measure('thd_voltage_a_n', 'Voltage A-N THD', 1092, '%', U.PERCENT),
    measure('thd_voltage_b_n', 'Voltage B-N THD', 1094, '%', U.PERCENT),
    measure('thd_voltage_c_n', 'Voltage C-N THD', 1096, '%', U.PERCENT),
    measure('thd_voltage_a_b', 'Voltage A-B THD', 1098, '%', U.PERCENT),
    measure('thd_voltage_b_c', 'Voltage B-C THD', 1100, '%', U.PERCENT),
    measure('thd_voltage_c_a', 'Voltage C-A THD', 1102, '%', U.PERCENT),
    measure('present_real_power_demand', 'Present Real Power Demand', 1022, 'kW', U.KW),
    measure('peak_real_power_demand', 'Peak Real Power Demand', 1028, 'kW', U.KW),
  );
  return objs;
}

// =====================================================================
// Assemble devices
//   PM5500/5600/5700 platform has dual Ethernet ports -> Modbus TCP
//   PM2000 platform / EM / PM710 -> Modbus RTU (RS-485)
// =====================================================================
const rtuDev = (id, objects, baud = 9600) => ({
  id, objects, protocol: 'modbus rtu', baud,
  defaultSlaveId: 1, parity: 'even', stopbits: 1,
});
const tcpDev = (id, objects) => ({
  id, objects, protocol: 'modbus tcp',
  defaultSlaveId: 1, parity: 'even', stopbits: 1,
});

const devices = [
  // PM5500/5600/5700 platform (Modbus TCP)
  tcpDev('pm5560', pm5xxxObjects()),
  tcpDev('pm5561', pm5xxxObjects()),
  tcpDev('pm5563', pm5xxxObjects()),
  tcpDev('pm5570', pm5xxxObjects()),
  tcpDev('pm5580', pm5xxxObjects()),
  tcpDev('pm5650', pm5xxxObjects()),
  tcpDev('pm5660', pm5xxxObjects()),
  tcpDev('pm5661', pm5xxxObjects()),
  tcpDev('pm5760', pm5xxxObjects()),
  tcpDev('pm5761', pm5xxxObjects()),
  // PM2000 platform (Modbus RTU, factory default 19200/Even/1 per PM2100 series manual)
  rtuDev('pm2120', pm2xxxObjects(), 19200),
  rtuDev('pm2130', pm2xxxObjects(), 19200),
  rtuDev('pm2220', pm2xxxObjects(), 19200),
  // EM series (Modbus RTU, factory default 9600/Even/1)
  rtuDev('em6400ng', pm2xxxObjects()),
  rtuDev('em6436h', em6436hObjects()),
  rtuDev('pm710mg', pm710Objects()),
];

// ---------- write files (UTF-8 no BOM, JSON.stringify) ----------
for (const dev of devices) {
  const dir = path.join(ROOT, dev.id);
  fs.mkdirSync(dir, { recursive: true });
  const codecPath = path.join(dir, `${dev.id}-codec.json`);
  const devicesPath = path.join(dir, `${dev.id}-devices.json`);
  const codec = { object: dev.objects };
  const devFile = {
    protocol: dev.protocol,
    codec: `vendors/SchneiderElectric/${dev.id}/${dev.id}-codec.json`,
    modbus_default_slave_id: dev.defaultSlaveId,
  };
  if (dev.protocol === 'modbus rtu') {
    devFile.modbus_baudrate = dev.baud;
    devFile.modbus_parity = dev.parity;
    devFile.modbus_stopbits = dev.stopbits;
  }
  fs.writeFileSync(codecPath, JSON.stringify(codec, null, 2), { encoding: 'utf8' });
  fs.writeFileSync(devicesPath, JSON.stringify(devFile, null, 2), { encoding: 'utf8' });
  console.log(`${dev.id}: ${dev.objects.length} objects (${dev.protocol}) -> ${codecPath}`);
}

// sanity checks
for (const dev of devices) {
  const ids = dev.objects.map(o => o.id);
  const dupIds = ids.filter((v, i) => ids.indexOf(v) !== i);
  const addrs = dev.objects.map(o => o.modbus_register_addr);
  const dupAddrs = addrs.filter((v, i) => addrs.indexOf(v) !== i);
  if (dupIds.length || dupAddrs.length) {
    console.log(`WARN ${dev.id}: dupIds=${JSON.stringify(dupIds)} dupAddrs=${JSON.stringify(dupAddrs)}`);
  }
}
console.log('DONE pm-em series');
