# Index: API Endpoints

## Authentication (2 routes)
| Method | Path | Route ID |
|--------|------|----------|
| POST | /auth/register | route-auth-register |
| POST | /auth/login | route-auth-login |

## Statements (5 routes)
| Method | Path | Route ID |
|--------|------|----------|
| GET | /api/statements | route-get-statements |
| POST | /api/statements/upload | route-upload-statement |
| POST | /api/statements/:id/reprocess | route-reprocess-statement |
| DELETE | /api/statements/:id | route-delete-statement |
| GET | /api/statements/gaps | route-statement-gaps |

## Transactions (7 routes)
| Method | Path | Route ID |
|--------|------|----------|
| GET | /api/transactions | route-get-transactions |
| GET | /api/transactions/:id | route-get-transaction |
| PATCH | /api/transactions/:id | route-update-transaction |
| POST | /api/transactions/:id/split | route-split-transaction |
| DELETE | /api/transactions/:id | route-delete-transaction |
| GET | /api/transactions/export/csv | route-export-csv |
| GET | /api/transactions/export/xlsx | route-export-xlsx |

## Accounts (5 routes)
| Method | Path | Route ID |
|--------|------|----------|
| GET | /api/accounts | route-get-accounts |
| POST | /api/accounts | route-create-account |
| PATCH | /api/accounts/:id | route-update-account |
| DELETE | /api/accounts/:id | route-delete-account |
| GET | /api/accounts/:id/balance-history | route-get-balance-history |

## Transfers (4 routes)
| Method | Path | Route ID |
|--------|------|----------|
| GET | /api/transfers | route-get-transfers |
| POST | /api/transfers | route-create-transfer |
| DELETE | /api/transfers/:id | route-delete-transfer |
| POST | /api/transfers/auto-detect | route-auto-detect-transfers |

## BAS (8 routes)
| Method | Path | Route ID |
|--------|------|----------|
| GET | /api/bas/periods | route-get-bas-periods |
| POST | /api/bas/periods | route-create-bas-period |
| GET | /api/bas/periods/:id | route-get-bas-period |
| POST | /api/bas/calculate | route-calculate-bas |
| POST | /api/bas/periods/:id/save | route-save-bas |
| GET | /api/bas/gst-summary | route-get-gst-summary |
| GET | /api/bas/history | route-get-bas-history |
| POST | /api/bas/export-pdf | route-export-bas-pdf |

## Tax (10 routes)
| Method | Path | Route ID |
|--------|------|----------|
| POST | /api/tax/calculate | route-calculate-tax |
| GET | /api/tax/deductions | route-get-deductions |
| POST | /api/tax/deductions | route-add-deduction |
| PATCH | /api/tax/deductions/:id | route-update-deduction |
| DELETE | /api/tax/deductions/:id | route-delete-deduction |
| GET | /api/tax/cgt-assets | route-get-cgt-assets |
| POST | /api/tax/cgt-assets | route-add-cgt-asset |
| POST | /api/tax/cgt-assets/:id/dispose | route-record-disposal |
| GET | /api/tax/depreciation | route-get-depreciation |
| POST | /api/tax/depreciation | route-add-depreciation |

## Analytics (4 routes)
| Method | Path | Route ID |
|--------|------|----------|
| GET | /api/stats | route-get-stats |
| GET | /api/analytics/monthly | route-get-monthly-analytics |
| GET | /api/analytics/categories | route-get-category-analytics |
| POST | /api/debt/recommendations | route-debt-recommendations |

## Real-time (1 route)
| Method | Path | Route ID |
|--------|------|----------|
| GET | /api/events | route-sse-events |

**Total: 65 routes**
