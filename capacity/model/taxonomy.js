/* v2.4 domain taxonomy — the fixed enumerations (prompt §1, D16).
 * PURE data. Shared by the derivation module and the UI so there is one source
 * of truth for the channel / activity / product-request / queue-type vocabularies.
 */
const CHANNELS = ["voice", "third_party", "digital", "customer_management"];
const ACTIVITIES = ["service_request", "lead", "decision", "collections", "upsell_xsell", "maintenance"];
const PRODUCT_REQUESTS = ["new", "existing"];
const QUEUE_TYPES = ["inbound_call", "outbound_call", "case_processing", "governance"];

module.exports = { CHANNELS, ACTIVITIES, PRODUCT_REQUESTS, QUEUE_TYPES };
