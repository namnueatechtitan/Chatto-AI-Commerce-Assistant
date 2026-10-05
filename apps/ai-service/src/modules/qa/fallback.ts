import { parse, type Expr, type SelectFromStatement } from "pgsql-ast-parser";

/** Semantic recovery can widen a name search, never numeric/variant constraints. */
export function permitsNameSearchFallback(sql: string): boolean {
  try {
    const statements = parse(sql);
    if (statements.length !== 1 || statements[0].type !== "select") return false;
    const select = statements[0] as SelectFromStatement;
    if (select.groupBy || select.having || select.distinct || select.for || select.skip || select.orderBy || select.limit?.offset) return false;
    if (select.limit?.limit && (select.limit.limit.type !== "integer" || select.limit.limit.value < 1)) return false;
    if (select.from?.length !== 1 || !select.columns?.every(c => c.expr.type === "ref")) return false;
    const source = select.from[0];
    if (source.type !== "table" || source.name.name !== "catalog" || source.name.schema || source.join || source.lateral) return false;
    const matchesName = (expr: Expr, depth = 0): boolean => {
      if (depth > 15 || expr.type !== "binary" || expr.opSchema) return false;
      if (expr.op === "AND" || expr.op === "OR") return matchesName(expr.left, depth + 1) && matchesName(expr.right, depth + 1);
      return ["LIKE", "ILIKE"].includes(expr.op) && expr.left.type === "ref"
        && ["name", "sku"].includes(expr.left.name) && expr.right.type === "string";
    };
    return Boolean(select.where && matchesName(select.where));
  } catch { return false; }
}
