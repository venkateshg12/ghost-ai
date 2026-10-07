#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/f2765448c946eb0392ad46bf51bdca03cf8a4aa8ac8703994319d2b53d12aafb/contract';
import endContract from '../../snapshots/f2765448c946eb0392ad46bf51bdca03cf8a4aa8ac8703994319d2b53d12aafb/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'project',
        columns: [
          col('canvasJsonPath', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ownerId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('project_status_check_bee39d02', "\"status\" IN ('DRAFT', 'ARCHIVED')"),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'projectCollaborator',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('projectId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'projectSpec',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('fileName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('filePath', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('projectId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'session',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            default: fn("(CURRENT_TIMESTAMP + '30 days'::interval)"),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('prevRefreshJti', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('refreshJti', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('rotatedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('userAgent', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'taskRun',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('projectId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('runId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('taskRun_kind_check_fb61b3b4', "\"kind\" IN ('design', 'spec')"),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'user',
        columns: [
          col('authProvider', 'text', {
            notNull: true,
            default: lit('local'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('avatar', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('googleId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('name', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('passwordHash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('role', 'text', {
            notNull: true,
            default: lit('user'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('verified', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'user_authProvider_check_7916b13c',
            "\"authProvider\" IN ('local', 'google')",
          ),
          checkExpression('user_role_check_5b6d1a59', "\"role\" IN ('user', 'admin')"),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'verificationLink',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('token', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'verificationLink_type_check_c88c716f',
            "\"type\" IN ('email_verification', 'password_reset')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'projectCollaborator',
        constraint: 'projectCollaborator_projectId_email_key',
        columns: ['projectId', 'email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'taskRun',
        constraint: 'taskRun_runId_key',
        columns: ['runId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'user',
        constraint: 'user_email_key',
        columns: ['email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'user',
        constraint: 'user_googleId_key',
        columns: ['googleId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'verificationLink',
        constraint: 'verificationLink_token_key',
        columns: ['token'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'project',
        index: 'project_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'project',
        index: 'project_ownerId_idx_e2d0c1ef',
        columns: ['ownerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'projectCollaborator',
        index: 'projectCollaborator_email_idx_46df9cad',
        columns: ['email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'projectCollaborator',
        index: 'projectCollaborator_projectId_createdAt_idx_d2d6484f',
        columns: ['projectId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'projectCollaborator',
        index: 'projectCollaborator_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'projectSpec',
        index: 'projectSpec_projectId_createdAt_idx_d2d6484f',
        columns: ['projectId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'projectSpec',
        index: 'projectSpec_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'session',
        index: 'session_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'session',
        index: 'session_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'taskRun',
        index: 'taskRun_projectId_idx_a96e4d92',
        columns: ['projectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'taskRun',
        index: 'taskRun_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'taskRun',
        index: 'taskRun_userId_projectId_idx_a2a73bc7',
        columns: ['userId', 'projectId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'verificationLink',
        index: 'verificationLink_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'verificationLink',
        index: 'verificationLink_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'project',
        foreignKey: {
          name: 'project_ownerId_fkey',
          columns: ['ownerId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'projectCollaborator',
        foreignKey: {
          name: 'projectCollaborator_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'project', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'projectSpec',
        foreignKey: {
          name: 'projectSpec_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'project', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'session',
        foreignKey: {
          name: 'session_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'taskRun',
        foreignKey: {
          name: 'taskRun_projectId_fkey',
          columns: ['projectId'],
          references: { schema: 'public', table: 'project', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'taskRun',
        foreignKey: {
          name: 'taskRun_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'verificationLink',
        foreignKey: {
          name: 'verificationLink_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
