export const VAT_RATE = 0.16;
export const VAT_LABEL = "VAT (16%)";
export const VAT_INCLUSIVE_LABEL = "Incl. VAT (16%)";

// Kenya uses VAT-inclusive pricing: extract the tax component from any total.
// Formula: price × (16 / 116) = the VAT portion already contained in the price.
export const VAT_EXTRACT = 16 / 116;
