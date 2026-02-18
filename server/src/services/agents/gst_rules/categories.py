"""Australian GST Categorization Rules — Pattern constants."""

# GST-FREE supply categories (no GST charged, but can claim inputs)
GST_FREE_PATTERNS: dict[str, list[str]] = {
    "medical": [
        r"(?i)doctor", r"(?i)gp\s", r"(?i)medical\s+centre", r"(?i)hospital",
        r"(?i)pharmacy(?!\s+mart)", r"(?i)chemist(?!\s+warehouse)",
        r"(?i)pathology", r"(?i)radiology", r"(?i)x-?ray", r"(?i)ultrasound",
        r"(?i)physiotherapy", r"(?i)physio\s", r"(?i)dentist", r"(?i)dental",
        r"(?i)optometrist", r"(?i)psycholog", r"(?i)medicare",
        r"(?i)health\s+fund", r"(?i)private\s+health", r"(?i)medibank",
        r"(?i)bupa", r"(?i)hcf\s", r"(?i)nib\s",
    ],
    "education": [
        r"(?i)university", r"(?i)tafe", r"(?i)college", r"(?i)school\s+fees",
        r"(?i)tuition", r"(?i)course\s+fees", r"(?i)education",
        r"(?i)childcare", r"(?i)child\s+care", r"(?i)kindy", r"(?i)kindergarten",
        r"(?i)preschool", r"(?i)pre-school",
    ],
    "fresh_food": [
        r"(?i)woolworths(?!.*(?:liquor|dan\s*murphy))",
        r"(?i)coles(?!.*(?:liquor|express))",
        r"(?i)aldi\s", r"(?i)iga\s",
        r"(?i)fruit(?:\s+&|\s+and)?\s+veg", r"(?i)greengrocer",
        r"(?i)butcher(?!.*bar)", r"(?i)baker[y]?(?!.*cafe)",
        r"(?i)fish\s+market", r"(?i)seafood\s+market",
    ],
    "export": [
        r"(?i)export", r"(?i)overseas\s+sale", r"(?i)international\s+sale",
        r"(?i)foreign\s+sale",
    ],
    "charity": [
        r"(?i)donation", r"(?i)charity", r"(?i)red\s+cross",
        r"(?i)salvation\s+army", r"(?i)lifeline", r"(?i)beyond\s+blue",
    ],
    "water": [
        r"(?i)water\s+corp", r"(?i)sydney\s+water", r"(?i)sa\s+water",
        r"(?i)urban\s+utilities", r"(?i)sewerage",
    ],
}

# INPUT-TAXED supplies (no GST, cannot claim inputs)
INPUT_TAXED_PATTERNS: dict[str, list[str]] = {
    "financial": [
        r"(?i)bank\s+fee", r"(?i)account\s+fee", r"(?i)monthly\s+fee",
        r"(?i)loan\s+interest", r"(?i)mortgage\s+interest",
        r"(?i)credit\s+card\s+interest", r"(?i)interest\s+charge",
        r"(?i)share\s+brokerage", r"(?i)broker\s+fee",
        r"(?i)investment\s+fee", r"(?i)management\s+fee",
        r"(?i)financial\s+advice", r"(?i)superannuation\s+fee",
    ],
    "residential_rent": [
        r"(?i)residential\s+rent", r"(?i)rent\s+received",
        r"(?i)rental\s+income",
    ],
}

# CAPITAL ACQUISITIONS (GST claimable, reported separately)
CAPITAL_PATTERNS: list[str] = [
    r"(?i)computer", r"(?i)laptop", r"(?i)desktop", r"(?i)mac(?:book)?(?:\s|$)",
    r"(?i)ipad", r"(?i)tablet",
    r"(?i)furniture", r"(?i)desk", r"(?i)chair", r"(?i)office\s+fit",
    r"(?i)vehicle", r"(?i)car\s+purchase", r"(?i)motor\s+vehicle",
    r"(?i)equipment", r"(?i)machinery", r"(?i)plant\s+&",
    r"(?i)renovation", r"(?i)fit\s*out", r"(?i)construction",
    r"(?i)server", r"(?i)networking\s+equipment",
    r"(?i)printer(?:\s+|$)", r"(?i)photocopier",
    r"(?i)phone\s+system", r"(?i)security\s+system",
]

# PRIVATE/NON-BUSINESS patterns
PRIVATE_PATTERNS: list[str] = [
    r"(?i)atm\s+withdrawal", r"(?i)cash\s+withdrawal",
    r"(?i)transfer\s+to\s+self", r"(?i)personal",
    r"(?i)grocery(?:\s|$)",
    r"(?i)netflix", r"(?i)spotify", r"(?i)disney\+",
    r"(?i)gym\s+membership", r"(?i)fitness\s+first",
]

# FUEL (for fuel tax credits calculation)
FUEL_PATTERNS: list[str] = [
    r"(?i)bp\s", r"(?i)shell\s", r"(?i)caltex", r"(?i)ampol",
    r"(?i)7-?eleven\s+fuel", r"(?i)united\s+petrol",
    r"(?i)petrol", r"(?i)diesel", r"(?i)fuel(?:\s|$)",
    r"(?i)service\s+station",
]
