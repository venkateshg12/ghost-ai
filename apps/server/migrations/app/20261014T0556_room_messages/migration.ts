#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/b029b2070e20fdebefb79466f96d2b2082c3820981ca096685b5d30a7f5d182d/contract';
import endContract from '../../snapshots/b029b2070e20fdebefb79466f96d2b2082c3820981ca096685b5d30a7f5d182d/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f22af4680090db0d2c89b5ff1ff275abb4dbac3e8d9e50514679ecb98a20a77b/contract';
import startContract from '../../snapshots/f22af4680090db0d2c89b5ff1ff275abb4dbac3e8d9e50514679ecb98a20a77b/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'roomMessage',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('data', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('feed', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('projectId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'roomMessage',
        index: 'roomMessage_projectId_feed_createdAt_idx_13cad9cb',
        columns: ['projectId', 'feed', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'roomMessage',
        index: 'roomMessage_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'roomMessage',
        foreignKey: {
          name: 'roomMessage_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'project', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
