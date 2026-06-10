export const EXPENSE_CATEGORIES = [
  { value: "RENT",        label: "Rent" },
  { value: "SALARIES",    label: "Salaries" },
  { value: "UTILITIES",   label: "Utilities" },
  { value: "TRANSPORT",   label: "Transport" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "MARKETING",   label: "Marketing" },
  { value: "OTHER",       label: "Other" },
] as const;

export type ExpenseCategoryValue = (typeof EXPENSE_CATEGORIES)[number]["value"];
