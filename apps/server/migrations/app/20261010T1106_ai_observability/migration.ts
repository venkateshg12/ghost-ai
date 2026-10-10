#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/a97bd5e98e8295356a6a9795cbd9e00dcc2c77bad70405cc84222c718f04c522/contract';
import endContract from '../../snapshots/a97bd5e98e8295356a6a9795cbd9e00dcc2c77bad70405cc84222c718f04c522/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f2765448c946eb0392ad46bf51bdca03cf8a4aa8ac8703994319d2b53d12aafb/contract';
import startContract from '../../snapshots/f2765448c946eb0392ad46bf51bdca03cf8a4aa8ac8703994319d2b53d12aafb/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'taskRun',
        constraint: 'taskRun_kind_check_fb61b3b4',
      }),
      this.addColumn({
        schema: 'public',
        table: 'taskRun',
        column: col('completedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'taskRun',
        column: col('fellBack', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'taskRun',
        column: col('inputTokens', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'taskRun',
        column: col('latencyMs', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'taskRun',
        column: col('model', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'taskRun',
        column: col('outputTokens', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'taskRun',
        column: col('prompt', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'taskRun',
        column: col('provider', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'taskRun',
        column: col('snapshotPath', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'taskRun',
        column: col('status', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'taskRun',
        constraint: 'taskRun_kind_check_269691ce',
        expression: "\"kind\" IN ('design', 'spec', 'chat', 'review', 'image')",
      }),
      this.createIndex({
        schema: 'public',
        table: 'taskRun',
        index: 'taskRun_projectId_createdAt_idx_d2d6484f',
        columns: ['projectId', 'createdAt'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
