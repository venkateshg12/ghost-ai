#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/a97bd5e98e8295356a6a9795cbd9e00dcc2c77bad70405cc84222c718f04c522/contract';
import startContract from '../../snapshots/a97bd5e98e8295356a6a9795cbd9e00dcc2c77bad70405cc84222c718f04c522/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f22af4680090db0d2c89b5ff1ff275abb4dbac3e8d9e50514679ecb98a20a77b/contract';
import endContract from '../../snapshots/f22af4680090db0d2c89b5ff1ff275abb4dbac3e8d9e50514679ecb98a20a77b/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'taskRun',
        column: col('queuedMs', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
