import { BadRequestException } from "@nestjs/common";
import { parse, type Expr, type SelectFromStatement } from "pgsql-ast-parser";

export const catalogColumns = [
  "product_id", "variant_id", "name", "description", "category", "brand", "sku",
  "variant_name", "color", "size", "price", "currency", "available_qty", "status",
] as const;
export const knowledgeColumns = ["id", "type", "title", "content"] as const;
export const maximumQueryRows = 50;

const aggregates = new Set(["count", "sum", "min", "max", "avg"]);
const factualColumnNames = new Set<string>([...catalogColumns, ...knowledgeColumns]);
const binaryOperators = new Set([
  "AND", "OR", "=", "!=", ">", ">=", "<", "<=", "LIKE", "NOT LIKE", "ILIKE", "NOT ILIKE", "IN", "NOT IN",
]);
const unaryOperators = new Set(["NOT", "IS NULL", "IS NOT NULL", "IS TRUE", "IS FALSE", "IS NOT TRUE", "IS NOT FALSE"]);

export interface CompiledReadonlyQuery {
  sql: string;
  parameters: Array<string | number | boolean | null>;
  columns: string[];
}

/** Compile a small SELECT dialect; original SQL is never passed to PostgreSQL. */
export function compileReadonlyQuery(sql: string): CompiledReadonlyQuery {
  if (typeof sql !== "string" || !sql.trim() || sql.length > 8_000) reject();
  let statements;
  try { statements = parse(sql); } catch { reject(); }
  if (statements.length !== 1 || statements[0].type !== "select") reject();
  const select = statements[0] as SelectFromStatement;
  if (select.for || select.skip || Array.isArray(select.distinct)) reject();
  if (select.from?.length !== 1 || !select.columns?.length || select.columns.length > 30) reject();
  const source = select.from[0];
  if (source.type !== "table" || source.join || source.lateral || source.name.schema || source.name.columnNames) reject();
  const relation = source.name.name;
  if (relation !== "catalog" && relation !== "knowledge") reject();
  const fields: readonly string[] = relation === "catalog" ? catalogColumns : knowledgeColumns;
  const tableAlias = source.name.alias ?? relation;
  identifier(tableAlias);
  const aliases = new Map<string, string>();
  const parameters: CompiledReadonlyQuery["parameters"] = [];
  let expressionCount = 0;

  const literal = (value: string | number | boolean | null): string => {
    parameters.push(value);
    // $1 is reserved for the server-selected merchant, never model-controlled.
    return `$${parameters.length + 1}`;
  };
  const expression = (node: Expr, allowAggregate = false, allowAlias = false, depth = 0): string => {
    if (++expressionCount > 200 || depth > 15) reject();
    switch (node.type) {
      case "ref": {
        if (node.table?.schema || (node.table && node.table.name !== tableAlias)) reject();
        // Alias references are translated to their verified field/aggregate
        // expression. An arbitrary model alias never becomes a factual label.
        if (allowAlias && !node.table && aliases.has(node.name)) return aliases.get(node.name)!;
        if (!fields.includes(node.name)) reject();
        return node.table ? `${identifier(tableAlias)}.${identifier(node.name)}` : identifier(node.name);
      }
      case "string":
        if (node.value.length > 2_000 || node.value.includes("\0")) reject();
        return literal(node.value);
      case "integer":
      case "numeric":
        if (!Number.isFinite(node.value) || Math.abs(node.value) > 1e12) reject();
        return literal(node.value);
      case "boolean": return literal(node.value);
      case "null": return "NULL";
      case "binary":
        if (node.opSchema || !binaryOperators.has(node.op)) reject();
        // The parser collapses IN ('one') to a scalar expression. PostgreSQL
        // still requires parentheses around that single bound list item.
        if ((node.op === "IN" || node.op === "NOT IN") && node.right.type !== "list") {
          return `(${expression(node.left, allowAggregate, allowAlias, depth + 1)} ${node.op} (${expression(node.right, false, false, depth + 1)}))`;
        }
        return `(${expression(node.left, allowAggregate, allowAlias, depth + 1)} ${node.op} ${expression(node.right, allowAggregate, allowAlias, depth + 1)})`;
      case "unary":
        if (node.opSchema) reject();
        if ((node.op === "-" || node.op === "+") && (node.operand.type === "integer" || node.operand.type === "numeric")) {
          if (!Number.isFinite(node.operand.value) || Math.abs(node.operand.value) > 1e12) reject();
          return literal(node.op === "-" ? -node.operand.value : node.operand.value);
        }
        if (!unaryOperators.has(node.op)) reject();
        return node.op === "NOT"
          ? `(NOT ${expression(node.operand, allowAggregate, allowAlias, depth + 1)})`
          : `(${expression(node.operand, allowAggregate, allowAlias, depth + 1)} ${node.op})`;
      case "ternary":
        if (node.op !== "BETWEEN" && node.op !== "NOT BETWEEN") reject();
        return `(${expression(node.value, allowAggregate, allowAlias, depth + 1)} ${node.op} ${expression(node.lo, false, false, depth + 1)} AND ${expression(node.hi, false, false, depth + 1)})`;
      case "list":
        if (!node.expressions.length || node.expressions.length > 50) reject();
        return `(${node.expressions.map(item => expression(item, false, false, depth + 1)).join(", ")})`;
      case "call": {
        const functionName = node.function.name;
        if (!allowAggregate || node.function.schema || !aggregates.has(functionName) || node.args.length !== 1 || node.over || node.filter || node.orderBy || node.withinGroup) reject();
        const argument = node.args[0];
        if (argument.type !== "ref") reject();
        const star = argument.name === "*";
        if (star && (functionName !== "count" || argument.table || node.distinct === "distinct")) reject();
        return `${functionName.toUpperCase()}(${node.distinct === "distinct" ? "DISTINCT " : ""}${star ? "*" : expression(argument, false, false, depth + 1)})`;
      }
      default: reject();
    }
  };

  const columns: string[] = [];
  const projections = select.columns.map(column => {
    if (column.expr.type === "ref" && column.expr.name === "*") {
      if (column.alias || (column.expr.table && (column.expr.table.schema || column.expr.table.name !== tableAlias))) reject();
      columns.push(...fields);
      return fields.map(field => identifier(field)).join(", ");
    }
    // Return verified database fields/aggregates, never fabricated literal facts.
    if (column.expr.type !== "ref" && column.expr.type !== "call") reject();
    // Column names become factual labels in the grounded answer. A model must
    // not present price as stock, or an aggregate as an individual row fact.
    if (column.alias && column.expr.type === "ref" && column.alias.name !== column.expr.name) reject();
    if (column.alias && column.expr.type === "call" && factualColumnNames.has(column.alias.name.toLowerCase())) reject();
    const output = column.expr.type === "ref" ? column.expr.name : aggregateOutputName(column.expr, relation);
    identifier(output);
    if (columns.includes(output)) reject();
    columns.push(output);
    const compiled = expression(column.expr, true);
    const alias = column.alias?.name;
    if (alias) {
      identifier(alias);
      if (aliases.has(alias)) reject();
      aliases.set(alias, compiled);
    }
    if (aliases.has(output) && aliases.get(output) !== compiled) reject();
    aliases.set(output, compiled);
    return `${compiled}${column.expr.type === "call" || column.alias ? ` AS ${identifier(output)}` : ""}`;
  });
  if (new Set(columns).size !== columns.length) reject();

  let query = `SELECT ${select.distinct === "distinct" ? "DISTINCT " : ""}${projections.join(", ")} FROM ${identifier(relation)}${source.name.alias ? ` AS ${identifier(tableAlias)}` : ""}`;
  if (select.where) query += ` WHERE ${expression(select.where)}`;
  if (select.groupBy?.length) {
    if (select.groupBy.length > 14) reject();
    query += ` GROUP BY ${select.groupBy.map(node => expression(node)).join(", ")}`;
  }
  if (select.having) query += ` HAVING ${expression(select.having, true, true)}`;
  if (select.orderBy?.length) {
    if (select.orderBy.length > 14) reject();
    query += ` ORDER BY ${select.orderBy.map(order => {
      if (order.order && order.order !== "ASC" && order.order !== "DESC") reject();
      if (order.nulls && order.nulls !== "FIRST" && order.nulls !== "LAST") reject();
      return `${expression(order.by, true, true)}${order.order ? ` ${order.order}` : ""}${order.nulls ? ` NULLS ${order.nulls}` : ""}`;
    }).join(", ")}`;
  }
  const limit = boundedInteger(select.limit?.limit, maximumQueryRows + 1, 10_000);
  query += ` LIMIT ${Math.min(limit, maximumQueryRows + 1)}`;
  if (select.limit?.offset) query += ` OFFSET ${boundedInteger(select.limit.offset, 0, 10_000)}`;
  return { sql: query, parameters, columns };
}

function aggregateOutputName(node: Extract<Expr, { type: "call" }>, relation: "catalog" | "knowledge"): string {
  const argument = node.args[0];
  if (!argument || argument.type !== "ref") reject();
  if (argument.name === "*") return `count_${relation}_rows`;
  return `${node.function.name}${node.distinct === "distinct" ? "_distinct" : ""}_${argument.name}`;
}

function boundedInteger(node: Expr | null | undefined, fallback: number, maximum: number): number {
  if (!node) return fallback;
  if (node.type !== "integer" || !Number.isSafeInteger(node.value) || node.value < 0 || node.value > maximum) reject();
  return node.value;
}

function identifier(value: string): string {
  if (!/^[a-z_][a-z0-9_]{0,62}$/i.test(value)) reject();
  return `"${value}"`;
}

function reject(): never {
  throw new BadRequestException("INVALID_READONLY_QUERY: use one SELECT on catalog or knowledge with allowed columns, comparisons and aggregates");
}
