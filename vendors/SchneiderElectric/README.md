# Schneider Electric ACTI9 IEM 绯诲垪 鈥?Modbus 闆嗘垚

鏈洰褰曚负 Milesight EG71 缃戝叧鐢熸垚 Schneider Electric 鐢佃〃鐨?`codec.json` + `devices.json`銆?
## 鏉冨▉璧勬枡鏉ユ簮锛圫chneider 瀹樻柟鎵嬪唽锛?
| 绯诲垪 | 瀹樻柟鎵嬪唽 | 鏂囨。缂栧彿 | 涓嬭浇浣嶇疆 |
| --- | --- | --- | --- |
| iEM2050 / iEM2055锛堝崟鐩革級 | iEM2050 / iEM2055 Series Single Phase Energy Meter User Manual | PHA6516400-06 | productinfo.schneider-electric.com |
| iEM3100 / iEM3200 / iEM3300 绯诲垪锛堜笁鐩革級 | iEM3100 / iEM3200 / iEM3300 series User Manual | DOCA0005EN-15 | productinfo.schneider-electric.com |
| iEM3400 / iEM3500 绯诲垪锛堜笁鐩?LVCT/Rogowski锛?| iEM3400 / iEM3500 series User Manual | 7EN02-0438-14 | productinfo.schneider-electric.com |

浜ゅ弶楠岃瘉锛欵SPHome 绀惧尯闆嗘垚锛坓ithub.com/htvekov/iem3155_esphome锛屽疄娴?iEM3155
瀵勫瓨鍣ㄥ湴鍧€涓庡瓧鑺傚簭涓€鑷达級銆?
## 宸查泦鎴愬瀷鍙凤紙10 / 29锛屽畼鏂规墜鍐岀‘璁ゆ敮鎸?Modbus RTU锛?
| device-id | 瀵勫瓨鍣ㄦ暟 | 鎵嬪唽 | 璇存槑 |
| --- | --- | --- | --- |
| iem2050 | 15 | PHA6516400-06 | 鍗曠浉 1PH2W锛?3 A 鐩存帴鎺ョ嚎 |
| iem2055 | 15 | PHA6516400-06 | 鍗曠浉 1PH2W锛?00 A 鐩存帴鎺ョ嚎 |
| iem3150 | 23 | DOCA0005EN-15 | 涓夌浉 63 A锛屽熀鏈瀷 |
| iem3155 | 35 | DOCA0005EN-15 | 涓夌浉 63 A锛屽璐圭巼 + DI/DO |
| iem3250 | 23 | DOCA0005EN-15 | 涓夌浉 CT 1 A/5 A锛屽熀鏈瀷 |
| iem3255 | 35 | DOCA0005EN-15 | 涓夌浉 CT 1 A/5 A锛屽璐圭巼 + DI/DO |
| iem3350 | 23 | DOCA0005EN-15 | 涓夌浉 125 A锛屽熀鏈瀷 |
| iem3355 | 35 | DOCA0005EN-15 | 涓夌浉 125 A锛屽璐圭巼 + DI/DO |
| iem3455 | 31 | 7EN02-0438-14 | 涓夌浉 LVCT/Rogowski锛圡odbus 鍨嬪彿锛?|
| iem3555 | 31 | 7EN02-0438-14 | 涓夌浉 LVCT/Rogowski锛圡odbus 鍨嬪彿锛?|

> iEM3150 / iEM3250 / iEM3350 涓恒€屽熀鏈€嶅瀷鍙凤細鎵嬪唽鏄庣‘ Total Reactive Power锛?068锛夈€?> Total Apparent Power锛?076锛夈€乀otal Active Energy Export锛?208锛夈€丷eactive Energy
> Import/Export锛?220/3224锛夈€丳artial Reactive Energy锛?272锛夈€両nput Metering锛?558锛夈€?> Multi Tariffs锛?191/4196鈥?208锛夌瓑瀵勫瓨鍣?*涓嶉€傜敤**锛屾晠鍏?codec 宸叉寜鎵嬪唽鎺掗櫎銆?> iEM3155 / iEM3255 / iEM3355 涓恒€屽畬鏁淬€嶅瀷鍙凤紝鍚笂杩板叏閮ㄥ瘎瀛樺櫒銆?
## 瀵勫瓨鍣ㄨ鐐癸紙鍏ㄩ儴涓?Holding Register锛屽姛鑳界爜 0x03 / 0x16锛?
- 鎵嬪唽銆孯egister銆嶅垪涓哄崄杩涘埗瀵勫瓨鍣ㄥ彿锛?-based锛夛紝`modbus_register_addr` 鐩存帴閲囩敤璇ュ€硷紱
  Modbus 甯у唴 16 浣嶅湴鍧€ = Register 鈭?1锛堝 Register 3000 鈫?PDU 鍦板潃 0x0BB7锛夈€?- Float32 鈫?`float32_ab`锛? 瀵勫瓨鍣紝IEEE 754 澶х锛岄珮瀛楀湪鍓嶏級
- Int64 鈫?`int64_be`锛? 瀵勫瓨鍣紝澶х锛岄珮瀛楀湪鍓嶏紱鎵嬪唽 Type=Int64锛屽崟浣?Wh/VARh锛?- UInt16 鈫?`uint16_ab`
- 鍔熺巼鍥犳暟瀵勫瓨鍣ㄧ被鍨嬩负鎵嬪唽鐨?`4Q_FP_PF`锛團loat32锛岃寖鍥?鈭? ~ +2锛夛紝鎸?`float32_ab` 澶勭悊
- `modbus_scale` 鍧囦负 1锛堝瘎瀛樺櫒鍊煎嵆鐗╃悊鍊硷紝濡?kW銆乄h锛?
## devices.json 榛樿鍙傛暟

| 鍙傛暟 | 鍊?| 渚濇嵁 |
| --- | --- | --- |
| protocol | modbus rtu | 瀹樻柟鎵嬪唽 |
| modbus_default_slave_id | 1 | 鎵嬪唽榛樿鍦板潃 001 |
| modbus_baudrate | 9600 | iEM2050/2055 鎵嬪唽鏄庣‘鍑哄巶榛樿 9600锛沬EM3000/3400 绯诲垪鍙€?9600/19200/38400 |
| modbus_parity | even | 鎵嬪唽榛樿 Even锛堝彲閫?Even/None/Odd锛?|
| modbus_stopbits | 1 | 鎵嬪唽鏄庣‘ Number of stop bits = 1 |

> 鈿狅笍 娉ㄦ剰锛歩EM3000 绯诲垪鍑哄巶娉㈢壒鐜囨墜鍐屾湭鍐欐槑锛岀ぞ鍖哄疄娴嬶紙ESPHome锛宨EM3155锛夊嚭鍘備负
> **19200 / Even / 1**銆傝嫢鐜板満杩炴帴澶辫触锛岃鍏堝湪鐢佃〃闈㈡澘鏍稿 Communication 璁剧疆
> 锛堟尝鐗圭巼/濂囧伓鏍￠獙/鍦板潃锛夛紝骞跺湪 `devices.json` 涓皟鏁淬€侰om.Protection 鍑哄巶榛樿
> Enable锛屽彧璇婚噰闆嗕笉鍙楀奖鍝嶏紝浣嗛儴鍒嗗啓鎿嶄綔浼氳鎷掔粷銆?
## 鏃犳硶闆嗘垚鍨嬪彿锛?9 / 29锛夆€?瀹樻柟鎵嬪唽纭涓嶆敮鎸?Modbus

| 鍨嬪彿 | 鍘熷洜锛堜緷鎹級 |
| --- | --- |
| iem3100 | 鏃犱覆鍙ｉ€氫俊锛堝姛鑳界煩闃?Communications 鍏ㄤ负 鈥溾€斺€濓紝浠呮樉绀?+ 鏃犺剦鍐茶緭鍑猴級锛屾棤 Modbus 瀵勫瓨鍣?|
| iem3110 | 浠?S0 鑴夊啿杈撳嚭锛圥ulse output only锛夛紝鏃?Modbus 閫氫俊绔彛 |
| iem3115 | 浠?S0 鑴夊啿杈撳嚭 + 鏁板瓧杈撳叆鍋氳垂鐜囧垏鎹紝鏃?Modbus 閫氫俊绔彛 |
| iem3135 | 閫氫俊鍗忚涓?**M-Bus**锛圖OCA0005EN-15 绗?82 椤碉級锛岄潪 Modbus |
| iem3165 | 閫氫俊鍗忚涓?**BACnet MS/TP**锛圖OCA0005EN-15 绗?111 椤碉級锛岄潪 Modbus |
| iem3175 | 閫氫俊鍗忚涓?**LonWorks**锛圖OCA0005EN-15 绗?83 椤碉級锛岄潪 Modbus |
| iem3200 | 绯诲垪鍚嶏紙闈炵嫭绔嬩骇鍝侊級锛氬畼鏂规墜鍐?iEM3200 绯诲垪鍨嬪彿琛ㄤ粎鍚?3210/3215/3235/3250/3255/3265/3275 |
| iem3210 | 浠?S0 鑴夊啿杈撳嚭锛屾棤 Modbus 閫氫俊绔彛 |
| iem3215 | 浠?S0 鑴夊啿杈撳嚭 + 鏁板瓧杈撳叆鍋氳垂鐜囧垏鎹紝鏃?Modbus 閫氫俊绔彛 |
| iem3235 | 閫氫俊鍗忚涓?M-Bus锛岄潪 Modbus |
| iem3265 | 閫氫俊鍗忚涓?BACnet MS/TP锛岄潪 Modbus |
| iem3275 | 閫氫俊鍗忚涓?LonWorks锛岄潪 Modbus |
| iem3300 | 绯诲垪鍚嶏紙闈炵嫭绔嬩骇鍝侊級锛氬畼鏂规墜鍐?iEM3300 绯诲垪鍨嬪彿琛ㄤ粎鍚?3310/3335/3350/3355/3365/3375 |
| iem3310 | 浠?S0 鑴夊啿杈撳嚭锛屾棤 Modbus 閫氫俊绔彛 |
| iem3335 | 閫氫俊鍗忚涓?M-Bus锛岄潪 Modbus |
| iem3365 | 閫氫俊鍗忚涓?BACnet MS/TP锛岄潪 Modbus |
| iem3375 | 閫氫俊鍗忚涓?LonWorks锛岄潪 Modbus |
| iem3465 | 閫氫俊鍗忚涓?**BACnet MS/TP**锛?EN02-0438-14 鏄庣‘ Modbus 浠呴€傜敤 iEM3455/iEM3555锛涗骇鍝佸瀷鍙峰嵆 鈥淎cti9 IEM3465 energy meter BACnet鈥濓級 |
| iem3565 | 鍚屼笂锛孊ACnet MS/TP锛堜骇鍝佸瀷鍙?鈥淎cti9 IEM3565 energy meter BACnet鈥濓級 |

濡傜幇鍦虹‘璁や互涓婃煇浜涘瀷鍙峰疄闄呭甫鏈?Modbus 绔彛锛堜緥濡傜壒娈婅璐у彿/鍥轰欢鍙樹綋锛夛紝鍙彟琛屾牳瀹?瀵瑰簲瀹樻柟鎵嬪唽鍚庤ˉ鍏呫€?
---

# PowerLogic PM / EM / PowerTag锛圥AS600锛夌郴鍒?鈥?Modbus 闆嗘垚锛堟柊澧?21 鍙帮級

## 鏉冨▉璧勬枡鏉ユ簮锛圫chneider 瀹樻柟鎵嬪唽锛?
| 绯诲垪 | 瀹樻柟鎵嬪唽 | 鏂囨。缂栧彿 | 涓嬭浇浣嶇疆 |
| --- | --- | --- | --- |
| PM5500/5600/5700 骞冲彴锛圥M5560鈥M5761锛?| PM556x Public Modbus Register List | PM556x_PublicModbusRegisterList_v2.3.0.xlsx | download.schneider-electric.com锛圥M5560 PM5563 V2.3.0 鍥轰欢鍖咃級 |
| PM2000 骞冲彴锛圥M2120/2130/2220锛?+ EM6400NG | Public EM6400 PM2xxx PMC Register List | Public_EM6400_PM2xxx PMC Register List_v1050_6.xlsx | Schneider 瀹樻柟锛堢粡 github.com/BradleyFord/pm2200_esphome 鍏紑闀滃儚锛?|
| EM6436H | EM6400 Series Power Meters User Manual | CTD7303锛坲sermanual em6400.v01.d10锛?| Schneider 瀹樻柟鎵嬪唽锛圱able 6-4 Individual parameter address锛?|
| PM710MG | Power Meter 710 Appendix B Register List | 63230-501-209A1锛?7/2008锛?| se.com FAQ FA228949 闄勪欢 PM710_Communication.pdf |
| PowerTag锛圥AS600 缃戝叧鎸傝浇鐨勬棤绾胯澶囷級 | PowerTag Link User Guide 鈥?PowerTag Energy Sensors / Control Modules / Wireless Devices Modbus Registers | PowerTag Link D User Manual锛圱000501355锛?| productinfo.schneider-electric.com/powertaglinkuserguide |

## 宸查泦鎴愬瀷鍙凤紙21 鍙帮級

### PM 绯诲垪 鈥?PM5500/5600/5700 骞冲彴锛堝瘎瀛樺櫒琛?PM5500 鍒楀叏 Y锛屽悇鍨嬪彿鍚岄泦锛?
| device-id | 瀵勫瓨鍣ㄦ暟 | 鎵嬪唽 |
| --- | --- | --- |
| pm5560 | 37 | PM556x_PublicModbusRegisterList_v2.3.0 |
| pm5561 | 37 | 鍚屼笂 |
| pm5563 | 37 | 鍚屼笂 |
| pm5570 | 37 | 鍚屼笂 |
| pm5580 | 37 | 鍚屼笂 |
| pm5650 | 37 | 鍚屼笂 |
| pm5660 | 37 | 鍚屼笂 |
| pm5661 | 37 | 鍚屼笂 |
| pm5760 | 37 | 鍚屼笂 |
| pm5761 | 37 | 鍚屼笂 |

### PM 绯诲垪 鈥?PM2000 骞冲彴 + EM 绯诲垪

| device-id | 瀵勫瓨鍣ㄦ暟 | 鎵嬪唽 |
| --- | --- | --- |
| pm2120 | 36 | Public_EM6400_PM2xxx PMC Register List锛圥M2120 鍒楋級 |
| pm2130 | 36 | 鍚屼笂锛圥M2130 鍒楋級 |
| pm2220 | 36 | 鍚屼笂锛圥M2220 鍒楋級 |
| em6400ng | 36 | 鍚屼笂锛圗M6400 NG 鍒楋級 |
| em6436h | 33 | CTD7303 Table 6-4锛圗M6436 鍒楋級 |
| pm710mg | 41 | 63230-501-209A1 Appendix B |

### POWERTAG 绯诲垪锛圥AS600 EcoStruxure Panel Server锛孧odbus TCP锛?
| device-id | 瀵勫瓨鍣ㄦ暟 | 璇存槑 |
| --- | --- | --- |
| pas600-c2di | 6 | PowerTag Control 2DI锛圓9XMC2D3锛夛細鏁板瓧杈撳叆 1/2 鐘舵€?|
| pas600-cio | 4 | PowerTag Control IO锛圓9XMC1D3锛夛細鏁板瓧杈撳叆 1 + 鏁板瓧杈撳嚭 1 鐘舵€?|
| pas600-energy-63 | 27 | PowerTag Energy 63锛圓9MEM154x-157x锛屼唬鐮?A锛?|
| pas600-energy-m250-m630-eframe | 29 | PowerTag Energy M250/M630 E-Frame锛圠V43402x锛屼唬鐮?M锛?|
| pas600-energy-f160-rope | 59 | PowerTag Energy F160锛圓9MEM1580锛変笌 Rope锛圓9MEM159x锛屼唬鐮?R锛?|

> PowerTag Energy Sensors 瀵勫瓨鍣ㄨ〃鐨?Applicable Devices 浠ｇ爜锛欰 = PowerTag Energy 63锛?> M = PowerTag Energy M250/M630锛圠V43402x锛夛紝R = PowerTag Energy F160 涓?Rope銆?> 鍚勫彉浣撲粎鍖呭惈鍏堕€傜敤瀵勫瓨鍣紙闈炲叏閮ㄥ瘎瀛樺櫒閮芥敮鎸佹墍鏈夊彉浣擄紝宸叉寜瀹樻柟琛ㄨ繃婊わ級銆?
## 瀵勫瓨鍣ㄨ鐐?
- 鍏ㄩ儴涓?Holding Register锛屽姛鑳界爜 0x03锛圥owerTag 缃戝叧鍙︽敮鎸?0x04/0x06/0x10/0x2B锛夈€?- `modbus_register_addr` 閲囩敤瀹樻柟琛?1-based 鍗佽繘鍒跺瘎瀛樺櫒鍙凤紙Modbus PDU 鍦板潃 = 瀵勫瓨鍣ㄥ彿 鈭?1锛夈€?- Float32 鈫?`float32_ab`锛? 瀵勫瓨鍣紝IEEE 754 澶х锛岄珮瀛楀湪鍓嶏紱鎵嬪唽 Type=Float/Float32锛?- Int64 鈫?`int64_be`锛? 瀵勫瓨鍣紝澶х锛岄珮瀛楀湪鍓嶏紱鎵嬪唽 Type=Int64锛岃兘閲?Wh/VARh/VAh锛?- UInt16 鈫?`uint16_ab`锛圥owerTag Control 鏁板瓧 I/O 鐘舵€併€丳M 閮ㄥ垎瀵勫瓨鍣級
- 鍔熺巼鍥犳暟瀵勫瓨鍣紙4Q_FP_PF锛夋寜 Float32 澶勭悊锛宍float32_ab`
- `modbus_scale` 鍧囦负 1锛堝瘎瀛樺櫒鍊煎嵆鐗╃悊鍊硷紱PM710 鎵嬪唽 Integer 娈垫墠闇€瑕?Scale Factor锛?  鏈泦鎴愪粎鐢?Float 娈碉紝鏃犻渶缂╂斁锛?
## devices.json 榛樿鍙傛暟

| 绯诲垪 | protocol | 浠庣珯鍦板潃 | 娉㈢壒鐜?| 鏍￠獙 | 鍋滄浣?| 渚濇嵁 |
| --- | --- | --- | --- | --- | --- | --- |
| PM556x / PM5650-5761 | modbus tcp | 1 | 鈥?| 鈥?| 鈥?| PM5000 绯诲垪鎵嬪唽锛氬弻浠ュお缃戝彛鏀寔 Modbus TCP |
| PM2120/2130/2220 | modbus rtu | 1 | 19200 | even | 1 | PM2100 绯诲垪鎵嬪唽銆孯S-485 绔彛璁剧疆銆嶅嚭鍘傞粯璁?19200/Even |
| EM6400NG | modbus rtu | 1 | 9600 | even | 1 | EM6400 鎵嬪唽 Table 6-2锛?600/Even/Address 1锛?|
| EM6436H | modbus rtu | 1 | 9600 | even | 1 | EM64xxH 鎵嬪唽 RS-485 閰嶇疆 |
| PM710MG | modbus rtu | 1 | 9600 | even | 1 | PM710 鎵嬪唽 RS-485 榛樿 |
| PAS600锛堝叏閮?5 鍙樹綋锛?| modbus tcp | 1 | 鈥?| 鈥?| 鈥?| PAS600 涓轰互澶綉 Modbus TCP 缃戝叧 |

> 鈿狅笍 鍑哄巶娉㈢壒鐜囦互鐜板満鐢佃〃瀹為檯璁剧疆涓哄噯锛歅M2000 绯诲垪閮ㄥ垎鍥轰欢榛樿 9600锛孍M6400 绯诲垪鍙€?> 1200-19200锛涜嫢閫氫俊澶辫触璇峰厛鍦ㄧ數琛ㄩ潰鏉挎牳瀵?Communication 鍙傛暟骞跺湪 devices.json 涓皟鏁淬€?> PM710MG 鐨勬暣鏁板瘎瀛樺櫒锛?000 娈碉級渚濊禆 Scale Factor 瀵勫瓨鍣紙4105-4108锛夛紝鏈泦鎴愪粎閲囩敤
> 娴偣娈碉紙1000 娈碉級閬垮厤缂╂斁姝т箟銆?
## 閲嶆柊鐢熸垚

```
node vendors/SchneiderElectric/_generate-pm-em.js     # PM + EM 绯诲垪锛?6 鍙帮級
node vendors/SchneiderElectric/_generate-powertag.js  # PowerTag/PAS600锛? 鍙帮級
```
