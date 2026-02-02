#!/usr/bin/env tsx
/**
 * Import Navicat-exported departments.sql into the local Docker Postgres.
 *
 * Default connection assumes docker-compose.yml exposes Postgres on localhost:5433.
 *
 * Usage:
 *   npm run db:import:departments
 *   npm run db:import:departments -- --file docs/departments.sql
 *   npm run db:import:departments -- --no-admin
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import crypto from 'node:crypto'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import { Client } from 'pg'

type ParsedArgs = {
  filePath: string
  host: string
  port: number
  database: string
  user: string
  password: string
  companyName?: string
  createAdmin: boolean
  adminUsername?: string
  adminPassword: string
  adminPhone?: string
  replaceCompanyDepartments: boolean
}

function getFlagValue(argv: string[], flag: string): string | undefined {
  const idx = argv.indexOf(flag)
  if (idx === -1) return undefined
  const value = argv[idx + 1]
  if (!value || value.startsWith('--')) return undefined
  return value
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag)
}

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), '.env')
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath })
}

function mustGetEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env: ${name}`)
  return value
}

function parseArgs(argv: string[]): ParsedArgs {
  const filePath = getFlagValue(argv, '--file') ?? 'docs/departments.sql'

  const host = getFlagValue(argv, '--host')
    ?? process.env.PGHOST
    ?? process.env.POSTGRES_HOST
    ?? 'localhost'

  const port = Number.parseInt(
    getFlagValue(argv, '--port')
      ?? process.env.PGPORT
      ?? process.env.POSTGRES_PORT
      ?? '5433',
    10
  )

  const database = getFlagValue(argv, '--db')
    ?? process.env.PGDATABASE
    ?? process.env.POSTGRES_DB
    ?? mustGetEnv('POSTGRES_DB')

  const user = getFlagValue(argv, '--user')
    ?? process.env.PGUSER
    ?? process.env.POSTGRES_USER
    ?? mustGetEnv('POSTGRES_USER')

  const password = getFlagValue(argv, '--password')
    ?? process.env.PGPASSWORD
    ?? process.env.POSTGRES_PASSWORD
    ?? mustGetEnv('POSTGRES_PASSWORD')

  const companyName = getFlagValue(argv, '--company-name') ?? process.env.IMPORTED_COMPANY_NAME

  const createAdmin = !hasFlag(argv, '--no-admin')
  const adminUsername = getFlagValue(argv, '--admin-username') ?? process.env.IMPORTED_ADMIN_USERNAME
  const adminPassword = getFlagValue(argv, '--admin-password')
    ?? process.env.IMPORTED_ADMIN_PASSWORD
    ?? 'admin123'
  const adminPhone = getFlagValue(argv, '--admin-phone') ?? process.env.IMPORTED_ADMIN_PHONE

  const replaceCompanyDepartments = hasFlag(argv, '--replace')

  return {
    filePath,
    host,
    port,
    database,
    user,
    password,
    companyName,
    createAdmin,
    adminUsername,
    adminPassword,
    adminPhone,
    replaceCompanyDepartments,
  }
}

function extractCompanyIdFromSql(sqlText: string): string {
  const lines = sqlText.split(/\r?\n/)
  const insertLine = lines.find((line) => /^INSERT INTO\s+"public"\."departments"\s+VALUES\s*\(/.test(line))
  if (!insertLine) {
    throw new Error('No INSERT statements found for public.departments in the SQL file.')
  }

  const match = insertLine.match(/VALUES\s*\(\s*'[^']*'\s*,\s*'([^']+)'\s*,/)
  if (!match) {
    throw new Error('Failed to parse company_id from the first INSERT line.')
  }
  return match[1]
}

function derivePhoneFromCompanyId(companyId: string): string {
  const hash = crypto.createHash('sha256').update(companyId).digest('hex')
  const n = Number.parseInt(hash.slice(0, 8), 16) % 100_000_000
  return `199${String(n).padStart(8, '0')}`
}

function transformDepartmentsInserts(sqlText: string): string[] {
  const lines = sqlText.split(/\r?\n/)
  const insertPrefix = /^INSERT INTO\s+"public"\."departments"\s+VALUES\s*\(/
  const inserts: string[] = []

  for (const line of lines) {
    if (!insertPrefix.test(line)) continue

    const rewritten = line
      .replace(
        insertPrefix,
        'INSERT INTO departments (id, company_id, name, description, icon, sort_order, created_at, updated_at, is_active, parent_id, parent_sids) VALUES ('
      )
      .replace(
        /\);\s*$/,
        ') ON CONFLICT (id) DO UPDATE SET company_id=EXCLUDED.company_id, name=EXCLUDED.name, description=EXCLUDED.description, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, created_at=EXCLUDED.created_at, updated_at=EXCLUDED.updated_at, is_active=EXCLUDED.is_active, parent_id=EXCLUDED.parent_id, parent_sids=EXCLUDED.parent_sids;'
      )

    inserts.push(rewritten)
  }

  if (inserts.length === 0) {
    throw new Error('No departments INSERT lines matched for import.')
  }

  return inserts
}

async function ensureSchemaCompat(client: Client) {
  // Drop any legacy unique constraints that block duplicate department names.
  // This dataset can contain many duplicated names (e.g. 多个“财务部”) within the same company.
  await client.query(`
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    JOIN unnest(c.conkey) WITH ORDINALITY AS cols(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = cols.attnum
    WHERE c.conrelid = 'public.departments'::regclass AND c.contype = 'u'
    GROUP BY c.conname
    HAVING array_agg(a.attname::text ORDER BY cols.ord) = ARRAY['company_id','name']::text[]
        OR array_agg(a.attname::text ORDER BY cols.ord) = ARRAY['name','company_id']::text[]
  ) LOOP
    EXECUTE format('ALTER TABLE public.departments DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
`)
  await client.query('ALTER TABLE departments ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;')
  await client.query('ALTER TABLE departments ADD COLUMN IF NOT EXISTS parent_id TEXT;')
  await client.query('ALTER TABLE departments ADD COLUMN IF NOT EXISTS parent_sids TEXT;')
  await client.query('CREATE INDEX IF NOT EXISTS idx_department_company_parent ON departments(company_id, parent_id);')
}

async function ensureCompany(client: Client, companyId: string, companyName?: string) {
  const finalName = companyName ?? `Imported Company (${companyId})`
  await client.query(
    `INSERT INTO companies (id, name, created_at, updated_at)
     VALUES ($1, $2, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [companyId, finalName]
  )
}

async function ensureAdminUser(client: Client, companyId: string, args: ParsedArgs) {
  const username = args.adminUsername ?? `org_admin_${companyId.slice(0, 8)}`
  const phone = args.adminPhone ?? derivePhoneFromCompanyId(companyId)
  const userId = username
  const passwordHash = await bcrypt.hash(args.adminPassword, 10)

  const existing = await client.query(
    `SELECT id FROM users WHERE company_id = $1 AND username = $2 LIMIT 1`,
    [companyId, username]
  )

  if ((existing.rowCount ?? 0) > 0) {
    await client.query(
      `UPDATE users
       SET password_hash = $1, role = 'ADMIN', is_active = true
       WHERE id = $2`,
      [passwordHash, existing.rows[0].id]
    )
    return { username, phone, password: args.adminPassword, created: false }
  }

  const id = crypto.randomUUID()
  await client.query(
    `INSERT INTO users (
      id, company_id, username, user_id, phone, password_hash,
      chinese_name, english_name, email, display_name, role, is_active, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, 'ADMIN', true, NOW(), NOW()
    )`,
    [
      id,
      companyId,
      username,
      userId,
      phone,
      passwordHash,
      '导入管理员',
      'Imported Admin',
      null,
      '导入管理员',
    ]
  )

  return { username, phone, password: args.adminPassword, created: true }
}

async function main() {
  loadDotEnv()
  const args = parseArgs(process.argv.slice(2))

  const sqlPath = path.resolve(process.cwd(), args.filePath)
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`SQL file not found: ${args.filePath}`)
  }

  const sqlText = fs.readFileSync(sqlPath, 'utf8')
  const companyId = extractCompanyIdFromSql(sqlText)
  const inserts = transformDepartmentsInserts(sqlText)

  const client = new Client({
    host: args.host,
    port: args.port,
    database: args.database,
    user: args.user,
    password: args.password,
  })

  await client.connect()

  try {
    await client.query('BEGIN')

    await ensureSchemaCompat(client)
    await ensureCompany(client, companyId, args.companyName)

    let admin: { username: string; phone: string; password: string; created: boolean } | null = null
    if (args.createAdmin) {
      admin = await ensureAdminUser(client, companyId, args)
    }

    if (args.replaceCompanyDepartments) {
      await client.query(`DELETE FROM departments WHERE company_id = $1`, [companyId])
    }

    await client.query(inserts.join('\n'))

    const count = await client.query(
      `SELECT COUNT(*)::int AS count FROM departments WHERE company_id = $1`,
      [companyId]
    )

    await client.query('COMMIT')

    console.log(`✅ Imported departments for company_id=${companyId}`)
    console.log(`📦 Departments total (company scope): ${count.rows[0]?.count ?? '0'}`)
    if (admin) {
      console.log(
        `👤 Admin ${admin.created ? 'created' : 'updated'}: username=${admin.username} phone=${admin.phone} password=${admin.password}`
      )
    } else {
      console.log('ℹ️  Admin creation skipped (--no-admin)')
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error('❌ Import failed:', error)
  process.exit(1)
})
