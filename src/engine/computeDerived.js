
import { evaluate } from './evaluate.js';

export function computeDerived(systemConfig, name, context = {}) {
  const formula = systemConfig?.formulas?.[name];
  if (formula === undefined) return null;
  const ctx = {
    ...context,
    tables: { ...systemConfig.tables, ...context.tables },
  };
  return evaluate(formula, ctx);
}
