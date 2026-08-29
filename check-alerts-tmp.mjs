// TEMP read-only diagnostic — delete after use.
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const total  = await db.deviceAlert.count();
const open   = await db.deviceAlert.count({ where: { status: 'OPEN' } });
const unread = await db.deviceAlert.count({ where: { status: 'OPEN', adminReadAt: null } });

console.log('DeviceAlert rows total :', total);
console.log('  OPEN                 :', open);
console.log('  OPEN & unread (bell) :', unread);

const recent = await db.deviceAlert.findMany({
  orderBy: { createdAt: 'desc' }, take: 8,
  select: { deviceName: true, storeName: true, status: true, startedAt: true, adminReadAt: true, cause: true },
});
console.log('recent alerts:');
for (const a of recent) {
  console.log('  ', a.startedAt.toISOString().slice(0, 16),
    a.status.padEnd(8), (a.storeName ?? a.deviceName ?? '?').slice(0, 20).padEnd(20),
    'read=' + (a.adminReadAt ? 'y' : 'n'), a.cause ?? '');
}

const devs = await db.device.groupBy({ by: ['status'], _count: true });
console.log('devices by status:', devs.map((d) => `${d.status}=${d._count}`).join(' '));

await db.$disconnect();
