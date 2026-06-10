export const VAT_RATE = 0.20;
export const VAT_LABEL = "VAT (20%)";
export const VAT_INCLUSIVE_LABEL = "Incl. VAT (20%)";

// VAT-inclusive pricing: extract the tax component from any total.
// Formula: price × (20 / 120) = the VAT portion already contained in the price.
export const VAT_EXTRACT = 20 / 120;
