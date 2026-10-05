import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { MerchantStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { compileReadonlyQuery, maximumQueryRows } from "./readonly-query.compiler";

export interface ReadonlyQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  truncated: boolean;
}

// These are the only relations exposed to model SQL. Tenant and active filters
// are defined by the server; model output cannot alter either definition.
const scopedRelations = `WITH catalog AS (
  SELECT p.id::text AS product_id, v.id::text AS variant_id, p.name, p.description,
    p.category, p.brand, v.sku, v.variant_name, v.color, v.size, v.price,
    COALESCE(v.currency, 'THB') AS currency,
    CASE WHEN v.stock_on_hand IS NULL THEN NULL
      ELSE GREATEST(v.stock_on_hand - COALESCE(v.stock_reserved, 0), 0)
    END AS available_qty, p.status::text AS status
  FROM products p
  LEFT JOIN product_variants v ON v.product_id = p.id
    AND v.merchant_id = p.merchant_id AND v.status = 'active'
  WHERE p.merchant_id = $1::uuid AND p.status = 'active'
), knowledge AS (
  SELECT id::text AS id, type, title, content FROM knowledge_base_documents
  WHERE merchant_id = $1::uuid AND status = 'active'
)
`;

@Injectable()
export class ReadonlyQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async query(merchantId: string, sql: string): Promise<ReadonlyQueryResult> {
    assertMerchantId(merchantId);
    const compiled = compileReadonlyQuery(sql);
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId }, select: { status: true },
    });
    if (!merchant || (merchant.status !== MerchantStatus.ACTIVE && merchant.status !== MerchantStatus.TRIAL)) {
      throw new NotFoundException("Merchant knowledge is unavailable");
    }
    try {
      const rows = await this.prisma.$transaction(async transaction => {
        await transaction.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        await transaction.$executeRawUnsafe("SET LOCAL statement_timeout = '2000ms'");
        await transaction.$executeRawUnsafe("SET LOCAL lock_timeout = '500ms'");
        return transaction.$queryRawUnsafe<Record<string, unknown>[]>(
          scopedRelations + compiled.sql, merchantId, ...compiled.parameters,
        );
      }, { timeout: 3_000, maxWait: 2_000 });
      return {
        columns: compiled.columns,
        rows: rows.slice(0, maximumQueryRows).map(row => Object.fromEntries(
          Object.entries(row).map(([key, value]) => [key, jsonValue(value)]),
        )),
        truncated: rows.length > maximumQueryRows,
      };
    } catch {
      // Never expose database error bodies, connection details or query text.
      throw new ServiceUnavailableException("READONLY_QUERY_FAILED");
    }
  }
}

export function assertMerchantId(value: string): void {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new BadRequestException("A valid merchant_id UUID is required");
  }
}

function jsonValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) ? numeric : value.toString();
  }
  if (Prisma.Decimal.isDecimal(value)) return value.toNumber();
  if (value instanceof Date) return value.toISOString();
  return value;
}
