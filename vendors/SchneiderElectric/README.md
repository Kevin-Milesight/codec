# Schneider Electric ACTI9 IEM 系列 — Modbus 集成

本目录为 Milesight EG71 网关生成 Schneider Electric ACTI9 IEM 系列电表的
`codec.json` + `devices.json`。

## 权威资料来源（Schneider 官方手册）

| 系列 | 官方手册 | 文档编号 | 下载位置 |
| --- | --- | --- | --- |
| iEM2050 / iEM2055（单相） | iEM2050 / iEM2055 Series Single Phase Energy Meter User Manual | PHA6516400-06 | productinfo.schneider-electric.com |
| iEM3100 / iEM3200 / iEM3300 系列（三相） | iEM3100 / iEM3200 / iEM3300 series User Manual | DOCA0005EN-15 | productinfo.schneider-electric.com |
| iEM3400 / iEM3500 系列（三相 LVCT/Rogowski） | iEM3400 / iEM3500 series User Manual | 7EN02-0438-14 | productinfo.schneider-electric.com |

交叉验证：ESPHome 社区集成（github.com/htvekov/iem3155_esphome，实测 iEM3155
寄存器地址与字节序一致）。

## 已集成型号（10 / 29，官方手册确认支持 Modbus RTU）

| device-id | 寄存器数 | 手册 | 说明 |
| --- | --- | --- | --- |
| iem2050 | 15 | PHA6516400-06 | 单相 1PH2W，63 A 直接接线 |
| iem2055 | 15 | PHA6516400-06 | 单相 1PH2W，100 A 直接接线 |
| iem3150 | 23 | DOCA0005EN-15 | 三相 63 A，基本型 |
| iem3155 | 35 | DOCA0005EN-15 | 三相 63 A，多费率 + DI/DO |
| iem3250 | 23 | DOCA0005EN-15 | 三相 CT 1 A/5 A，基本型 |
| iem3255 | 35 | DOCA0005EN-15 | 三相 CT 1 A/5 A，多费率 + DI/DO |
| iem3350 | 23 | DOCA0005EN-15 | 三相 125 A，基本型 |
| iem3355 | 35 | DOCA0005EN-15 | 三相 125 A，多费率 + DI/DO |
| iem3455 | 31 | 7EN02-0438-14 | 三相 LVCT/Rogowski（Modbus 型号） |
| iem3555 | 31 | 7EN02-0438-14 | 三相 LVCT/Rogowski（Modbus 型号） |

> iEM3150 / iEM3250 / iEM3350 为「基本」型号：手册明确 Total Reactive Power（3068）、
> Total Apparent Power（3076）、Total Active Energy Export（3208）、Reactive Energy
> Import/Export（3220/3224）、Partial Reactive Energy（3272）、Input Metering（3558）、
> Multi Tariffs（4191/4196–4208）等寄存器**不适用**，故其 codec 已按手册排除。
> iEM3155 / iEM3255 / iEM3355 为「完整」型号，含上述全部寄存器。

## 寄存器要点（全部为 Holding Register，功能码 0x03 / 0x16）

- 手册「Register」列为十进制寄存器号（1-based），`modbus_register_addr` 直接采用该值；
  Modbus 帧内 16 位地址 = Register − 1（如 Register 3000 → PDU 地址 0x0BB7）。
- Float32 → `float32_ab`（2 寄存器，IEEE 754 大端，高字在前）
- Int64 → `int64_be`（4 寄存器，大端，高字在前；手册 Type=Int64，单位 Wh/VARh）
- UInt16 → `uint16_ab`
- 功率因数寄存器类型为手册的 `4Q_FP_PF`（Float32，范围 −2 ~ +2），按 `float32_ab` 处理
- `modbus_scale` 均为 1（寄存器值即物理值，如 kW、Wh）

## devices.json 默认参数

| 参数 | 值 | 依据 |
| --- | --- | --- |
| protocol | modbus rtu | 官方手册 |
| modbus_default_slave_id | 1 | 手册默认地址 001 |
| modbus_baudrate | 9600 | iEM2050/2055 手册明确出厂默认 9600；iEM3000/3400 系列可选 9600/19200/38400 |
| modbus_parity | even | 手册默认 Even（可选 Even/None/Odd） |
| modbus_stopbits | 1 | 手册明确 Number of stop bits = 1 |

> ⚠️ 注意：iEM3000 系列出厂波特率手册未写明，社区实测（ESPHome，iEM3155）出厂为
> **19200 / Even / 1**。若现场连接失败，请先在电表面板核对 Communication 设置
> （波特率/奇偶校验/地址），并在 `devices.json` 中调整。Com.Protection 出厂默认
> Enable，只读采集不受影响，但部分写操作会被拒绝。

## 无法集成型号（19 / 29）— 官方手册确认不支持 Modbus

| 型号 | 原因（依据） |
| --- | --- |
| iem3100 | 无串口通信（功能矩阵 Communications 全为 “—”，仅显示 + 无脉冲输出），无 Modbus 寄存器 |
| iem3110 | 仅 S0 脉冲输出（Pulse output only），无 Modbus 通信端口 |
| iem3115 | 仅 S0 脉冲输出 + 数字输入做费率切换，无 Modbus 通信端口 |
| iem3135 | 通信协议为 **M-Bus**（DOCA0005EN-15 第 82 页），非 Modbus |
| iem3165 | 通信协议为 **BACnet MS/TP**（DOCA0005EN-15 第 111 页），非 Modbus |
| iem3175 | 通信协议为 **LonWorks**（DOCA0005EN-15 第 83 页），非 Modbus |
| iem3200 | 系列名（非独立产品）：官方手册 iEM3200 系列型号表仅含 3210/3215/3235/3250/3255/3265/3275 |
| iem3210 | 仅 S0 脉冲输出，无 Modbus 通信端口 |
| iem3215 | 仅 S0 脉冲输出 + 数字输入做费率切换，无 Modbus 通信端口 |
| iem3235 | 通信协议为 M-Bus，非 Modbus |
| iem3265 | 通信协议为 BACnet MS/TP，非 Modbus |
| iem3275 | 通信协议为 LonWorks，非 Modbus |
| iem3300 | 系列名（非独立产品）：官方手册 iEM3300 系列型号表仅含 3310/3335/3350/3355/3365/3375 |
| iem3310 | 仅 S0 脉冲输出，无 Modbus 通信端口 |
| iem3335 | 通信协议为 M-Bus，非 Modbus |
| iem3365 | 通信协议为 BACnet MS/TP，非 Modbus |
| iem3375 | 通信协议为 LonWorks，非 Modbus |
| iem3465 | 通信协议为 **BACnet MS/TP**（7EN02-0438-14 明确 Modbus 仅适用 iEM3455/iEM3555；产品型号即 “Acti9 IEM3465 energy meter BACnet”） |
| iem3565 | 同上，BACnet MS/TP（产品型号 “Acti9 IEM3565 energy meter BACnet”） |

如现场确认以上某些型号实际带有 Modbus 端口（例如特殊订货号/固件变体），可另行核实
对应官方手册后补充。

## 重新生成

```
node vendors/SchneiderElectric/_generate.js
```
