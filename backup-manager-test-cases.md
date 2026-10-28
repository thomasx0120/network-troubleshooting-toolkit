# Test Cases — Backup Manager

เอกสารนี้ใช้ทดสอบโดยไม่ต้องข้าม Supabase Auth

## TC-01 Export Backup
1. เข้าสู่ Toolkit ด้วย Session ที่ได้รับอนุญาต
2. ไปที่เมนู Backup
3. กด "สร้าง Backup ตอนนี้"
4. กด Export Backup เป็น JSON

คาดหวัง: ดาวน์โหลดไฟล์ JSON ที่อ่านได้; มีข้อมูล `format`, `exportedAt` และ `data`; `records`, `inventory` และฟิลด์อื่นไม่หาย

## TC-02 Import Valid JSON
1. กด "Import และตรวจสอบไฟล์"
2. เลือกไฟล์ JSON ที่ Export จาก TC-01
3. ตรวจข้อความสรุปจำนวน records/inventory แล้วยืนยัน

คาดหวัง: สร้าง Backup ของข้อมูลปัจจุบันก่อน; Restore สำเร็จและข้อมูลยังอยู่หลัง Refresh

## TC-03 Cancel Restore
กด Restore แล้วเลือก Cancel ในกล่องยืนยัน

คาดหวัง: ข้อมูล primary และ Backup ไม่เปลี่ยน

## TC-04 Invalid JSON
เลือกไฟล์ที่มีเนื้อหาไม่ใช่ JSON เช่น `not-json`

คาดหวัง: แสดงข้อผิดพลาดและไม่เปลี่ยน `networkToolkitData`

## TC-05 Unsupported JSON
เลือก JSON เช่น `{ "records": {} }`

คาดหวัง: ปฏิเสธเนื่องจาก records ต้องเป็น Array หรือไม่มีโครงสร้าง Toolkit ที่รองรับ

## TC-06 Storage Write Failure
จำลองให้ `localStorage.setItem` โยน exception หรือจำกัด quota

คาดหวัง: ไม่มีข้อความสำเร็จ; primary ไม่เปลี่ยน; หน้าจอและข้อมูลในหน่วยความจำคงสถานะเดิม

## TC-07 Restore Current Corruption
ตั้ง primary เป็น JSON เสียโดยผ่านเครื่องมือ Developer Tools แล้ว Reload

คาดหวัง: module เก่าและใหม่สร้าง recoverable backup ของข้อมูลต้นฉบับ; ระบบไม่เขียนทับค่าที่ยังอ่านได้

## TC-08 Unknown Fields
ใช้ Backup มีฟิลด์กำหนดเอง เช่น `customSupportField`

คาดหวัง: ฟิลด์ unknown รักษาไว้ทั้งเมื่อ Export/Restore และ merge ไม่ลบฟิลด์นี้

## TC-09 Refresh Persistence
สร้างข้อมูลเคสและ inventory จากหน้า UI; Refresh

คาดหวัง: ข้อมูลยังอยู่และ Dashboard จำนวนตามข้อมูลจริงเท่านั้น

## TC-10 Auth Gate
เปิด `index.html` โดยไม่มี Session

คาดหวัง: redirect ไปหน้า Login และไม่เรียก personal-support.js จน Auth Session ยืนยันสำเร็จ

## Automated Behavior Tests
ทดสอบ migration, invalid roots, unknown fields, merge, duplicate inventory, backup validation และ storage rollback ได้โดยไม่ต้องมี Supabase Session:

```powershell
node storage-model.test.cjs
python tests-static.py
```

## Automated HTTP Browser Smoke
ทดสอบว่า `index.html` redirect ไป Login เมื่อไม่มี Session และไม่เกิด JavaScript console/page error:

```powershell
python -m http.server 4173
node browser-smoke.js
```

การทดสอบนี้ต้องรันบน HTTP และไม่ใช้ข้อมูล Supabase Session หรือสร้าง Fake Login
