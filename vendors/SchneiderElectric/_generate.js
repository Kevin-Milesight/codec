// Generate Schneider Electric ACTI9 IEM series codec.json + devices.json
// Sources (official Schneider manuals):
//  - iEM2050/2055: PHA6516400-06 (productinfo.schneider-electric.com)
//  - iEM3100/3200/3300 series: DOCA0005EN-15 (productinfo.schneider-electric.com)
//  - iEM3400/3500 series: 7EN02-0438-14 (productinfo.schneider-electric.com)
const fs = require('fs');
const path = require('path');

const ROOT = __dirname; // script lives in vendors/SchneiderElectric

const U = {
  AMP: 3,      // A
  VOLT: 5,     // V
  KW: 48,      // kW
  KVAR: 12,    // kVAR
  KVA: 9,      // kVA
  HZ: 27,      // Hz
  WH: 18,      // Wh
  VARH: 242,   // VARh
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
const u16 = (addr) => obj(null, null, addr, 'uint16_ab', 1);

// ---------- iEM2050 / iEM2055 (single-phase, manual PHA6516400-06) ----------
const singlePhase = [
  ['current', 'Current', 3001, 'A', U.AMP],
  ['voltage', 'Voltage', 3029, 'V', U.VOLT],
  ['active_power', 'Active Power', 3055, 'kW', U.KW],
  ['reactive_power', 'Reactive Power', 3069, 'kVAr', U.KVAR],
  ['apparent_power', 'Apparent Power', 3077, 'kVA', U.KVA],
  ['power_factor', 'Power Factor', 3085, '', U.NONE],
  ['frequency', 'Frequency', 3111, 'Hz', U.HZ],
].map(([id, name, addr, un, uid]) => {
  const o = f32(addr);
  o.id = id; o.name = name; o.modbus_unit_type = un; o.modbus_unit_type_id = uid; o.modbus_scale = 1;
  return o;
}).concat(
  [
    ['forward_active_energy', 'Forward Active Energy', 3205, 'Wh', U.WH],
    ['reverse_active_energy', 'Reverse Active Energy', 3209, 'Wh', U.WH],
    ['total_active_energy', 'Total Active Energy', 3213, 'Wh', U.WH],
    ['forward_reactive_energy', 'Forward Reactive Energy', 3221, 'VARh', U.VARH],
    ['reverse_reactive_energy', 'Reverse Reactive Energy', 3225, 'VARh', U.VARH],
    ['total_reactive_energy', 'Total Reactive Energy', 3229, 'VARh', U.VARH],
    ['partial_active_energy', 'Partial Active Energy', 3257, 'Wh', U.WH],
  ].map(([id, name, addr, un, uid]) => {
    const o = i64(addr);
    o.id = id; o.name = name; o.modbus_unit_type = un; o.modbus_unit_type_id = uid; o.modbus_scale = 1;
    return o;
  }),
  (() => { const o = u16(4192); o.id = 'tariff'; o.name = 'Active Tariff'; o.modbus_unit_type = ''; o.modbus_unit_type_id = U.NONE; o.modbus_scale = 1; o.target = { bacnet: { type: 'MultiState-Value' } }; return o; })(),
);

// ---------- iEM3xxx three-phase common measurements (manual DOCA0005EN-15 / 7EN02-0438-14) ----------
function threePhaseMeasurements(includeReactiveApparent) {
  const list = [
    ['phase1_current', 'Phase 1 Current', 3000, 'A', U.AMP],
    ['phase2_current', 'Phase 2 Current', 3002, 'A', U.AMP],
    ['phase3_current', 'Phase 3 Current', 3004, 'A', U.AMP],
    ['current_avg', 'Average Current', 3010, 'A', U.AMP],
    ['voltage_l1_l2', 'Voltage L1-L2', 3020, 'V', U.VOLT],
    ['voltage_l2_l3', 'Voltage L2-L3', 3022, 'V', U.VOLT],
    ['voltage_l3_l1', 'Voltage L3-L1', 3024, 'V', U.VOLT],
    ['voltage_ll_avg', 'Voltage L-L Average', 3026, 'V', U.VOLT],
    ['voltage_l1_n', 'Voltage L1-N', 3028, 'V', U.VOLT],
    ['voltage_l2_n', 'Voltage L2-N', 3030, 'V', U.VOLT],
    ['voltage_l3_n', 'Voltage L3-N', 3032, 'V', U.VOLT],
    ['voltage_ln_avg', 'Voltage L-N Average', 3036, 'V', U.VOLT],
    ['active_power_phase1', 'Active Power Phase 1', 3054, 'kW', U.KW],
    ['active_power_phase2', 'Active Power Phase 2', 3056, 'kW', U.KW],
    ['active_power_phase3', 'Active Power Phase 3', 3058, 'kW', U.KW],
    ['total_active_power', 'Total Active Power', 3060, 'kW', U.KW],
  ];
  if (includeReactiveApparent) {
    list.push(
      ['total_reactive_power', 'Total Reactive Power', 3068, 'kVAR', U.KVAR],
      ['total_apparent_power', 'Total Apparent Power', 3076, 'kVA', U.KVA],
    );
  }
  list.push(
    ['total_power_factor', 'Total Power Factor', 3084, '', U.NONE],
    ['frequency', 'Frequency', 3110, 'Hz', U.HZ],
  );
  return list.map(([id, name, addr, un, uid]) => {
    const o = f32(addr);
    o.id = id; o.name = name; o.modbus_unit_type = un; o.modbus_unit_type_id = uid; o.modbus_scale = 1;
    return o;
  });
}

function energyObjs(list) {
  return list.map(([id, name, addr, un, uid]) => {
    const o = i64(addr);
    o.id = id; o.name = name; o.modbus_unit_type = un; o.modbus_unit_type_id = uid; o.modbus_scale = 1;
    return o;
  });
}

// ---------- iEM3150 / iEM3250 / iEM3350 (3-phase basic, Modbus) ----------
// NOTE: manual marks Total Reactive Power / Total Apparent Power / Export / Partial Reactive /
// Input Metering / Multi Tariffs as "Not applicable for iEM3150 / iEM3250 / iEM3350"
const basic3phEnergy = energyObjs([
  ['total_active_energy_import', 'Total Active Energy Import', 3204, 'Wh', U.WH],
  ['partial_active_energy_import', 'Partial Active Energy Import', 3256, 'Wh', U.WH],
  ['active_energy_import_phase1', 'Active Energy Import Phase 1', 3518, 'Wh', U.WH],
  ['active_energy_import_phase2', 'Active Energy Import Phase 2', 3522, 'Wh', U.WH],
  ['active_energy_import_phase3', 'Active Energy Import Phase 3', 3526, 'Wh', U.WH],
]);

// ---------- iEM3155 / iEM3255 / iEM3355 (3-phase full, Modbus, multi-tariff) ----------
const full3phEnergy = energyObjs([
  ['total_active_energy_import', 'Total Active Energy Import', 3204, 'Wh', U.WH],
  ['total_active_energy_export', 'Total Active Energy Export', 3208, 'Wh', U.WH],
  ['total_reactive_energy_import', 'Total Reactive Energy Import', 3220, 'VARh', U.VARH],
  ['total_reactive_energy_export', 'Total Reactive Energy Export', 3224, 'VARh', U.VARH],
  ['partial_active_energy_import', 'Partial Active Energy Import', 3256, 'Wh', U.WH],
  ['partial_reactive_energy_import', 'Partial Reactive Energy Import', 3272, 'VARh', U.VARH],
  ['active_energy_import_phase1', 'Active Energy Import Phase 1', 3518, 'Wh', U.WH],
  ['active_energy_import_phase2', 'Active Energy Import Phase 2', 3522, 'Wh', U.WH],
  ['active_energy_import_phase3', 'Active Energy Import Phase 3', 3526, 'Wh', U.WH],
  ['input_metering_accumulation', 'Input Metering Accumulation', 3558, '', U.NONE],
]);
const full3phTail = [
  (() => { const o = u16(4191); o.id = 'active_tariff_rate'; o.name = 'Active Tariff Rate'; o.modbus_unit_type = ''; o.modbus_unit_type_id = U.NONE; o.modbus_scale = 1; o.target = { bacnet: { type: 'MultiState-Value' } }; return o; })(),
].concat(energyObjs([
  ['rate_a_active_energy_import', 'Rate A Active Energy Import', 4196, 'Wh', U.WH],
  ['rate_b_active_energy_import', 'Rate B Active Energy Import', 4200, 'Wh', U.WH],
  ['rate_c_active_energy_import', 'Rate C Active Energy Import', 4204, 'Wh', U.WH],
  ['rate_d_active_energy_import', 'Rate D Active Energy Import', 4208, 'Wh', U.WH],
]));

// ---------- iEM3455 / iEM3555 (3-phase LVCT/Rogowski, manual 7EN02-0438-14) ----------
// Modbus RTU available only on iEM3455 / iEM3555. No per-rate energy registers in the
// Modbus register list of this manual (rates are handled via BACnet objects / command interface).
const lvct3phEnergy = energyObjs([
  ['total_active_energy_import', 'Total Active Energy Import', 3204, 'Wh', U.WH],
  ['total_active_energy_export', 'Total Active Energy Export', 3208, 'Wh', U.WH],
  ['total_reactive_energy_import', 'Total Reactive Energy Import', 3220, 'VARh', U.VARH],
  ['total_reactive_energy_export', 'Total Reactive Energy Export', 3224, 'VARh', U.VARH],
  ['partial_active_energy_import', 'Partial Active Energy Import', 3256, 'Wh', U.WH],
  ['partial_reactive_energy_import', 'Partial Reactive Energy Import', 3272, 'VARh', U.VARH],
  ['active_energy_import_phase1', 'Active Energy Import Phase 1', 3518, 'Wh', U.WH],
  ['active_energy_import_phase2', 'Active Energy Import Phase 2', 3522, 'Wh', U.WH],
  ['active_energy_import_phase3', 'Active Energy Import Phase 3', 3526, 'Wh', U.WH],
  ['input_metering_accumulation', 'Input Metering Accumulation', 3558, '', U.NONE],
]);
const lvctTail = [
  (() => { const o = u16(4191); o.id = 'active_tariff_rate'; o.name = 'Active Tariff Rate'; o.modbus_unit_type = ''; o.modbus_unit_type_id = U.NONE; o.modbus_scale = 1; o.target = { bacnet: { type: 'MultiState-Value' } }; return o; })(),
];

// ---------- assemble devices ----------
const devices = [
  { id: 'iem2050', name: 'iEM2050', manual: 'PHA6516400-06', objects: singlePhase },
  { id: 'iem2055', name: 'iEM2055', manual: 'PHA6516400-06', objects: singlePhase },
  { id: 'iem3150', name: 'iEM3150', manual: 'DOCA0005EN-15', objects: threePhaseMeasurements(false).concat(basic3phEnergy) },
  { id: 'iem3155', name: 'iEM3155', manual: 'DOCA0005EN-15', objects: threePhaseMeasurements(true).concat(full3phEnergy, full3phTail) },
  { id: 'iem3250', name: 'iEM3250', manual: 'DOCA0005EN-15', objects: threePhaseMeasurements(false).concat(basic3phEnergy) },
  { id: 'iem3255', name: 'iEM3255', manual: 'DOCA0005EN-15', objects: threePhaseMeasurements(true).concat(full3phEnergy, full3phTail) },
  { id: 'iem3350', name: 'iEM3350', manual: 'DOCA0005EN-15', objects: threePhaseMeasurements(false).concat(basic3phEnergy) },
  { id: 'iem3355', name: 'iEM3355', manual: 'DOCA0005EN-15', objects: threePhaseMeasurements(true).concat(full3phEnergy, full3phTail) },
  { id: 'iem3455', name: 'iEM3455', manual: '7EN02-0438-14', objects: threePhaseMeasurements(true).concat(lvct3phEnergy, lvctTail) },
  { id: 'iem3555', name: 'iEM3555', manual: '7EN02-0438-14', objects: threePhaseMeasurements(true).concat(lvct3phEnergy, lvctTail) },
];

// ---------- write files (UTF-8 no BOM, JSON.stringify) ----------
for (const dev of devices) {
  const dir = path.join(ROOT, dev.id);
  fs.mkdirSync(dir, { recursive: true });
  const codecPath = path.join(dir, `${dev.id}-codec.json`);
  const devicesPath = path.join(dir, `${dev.id}-devices.json`);
  const codec = { object: dev.objects };
  const devFile = {
    protocol: 'modbus rtu',
    codec: `vendors/SchneiderElectric/${dev.id}/${dev.id}-codec.json`,
    modbus_default_slave_id: 1,
    modbus_baudrate: 9600,
    modbus_parity: 'even',
    modbus_stopbits: 1,
  };
  fs.writeFileSync(codecPath, JSON.stringify(codec, null, 2), { encoding: 'utf8' });
  fs.writeFileSync(devicesPath, JSON.stringify(devFile, null, 2), { encoding: 'utf8' });
  console.log(`${dev.id}: ${dev.objects.length} objects -> ${codecPath}`);
}

// duplicate id / address sanity check
for (const dev of devices) {
  const ids = dev.objects.map(o => o.id);
  const dupIds = ids.filter((v, i) => ids.indexOf(v) !== i);
  const addrs = dev.objects.map(o => o.modbus_register_addr);
  const dupAddrs = addrs.filter((v, i) => addrs.indexOf(v) !== i);
  if (dupIds.length || dupAddrs.length) {
    console.log(`WARN ${dev.id}: dupIds=${JSON.stringify(dupIds)} dupAddrs=${JSON.stringify(dupAddrs)}`);
  }
}
console.log('DONE');
