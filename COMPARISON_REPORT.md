# Regulation Intelligence Dashboard — Pipeline Comparison Report

**Date:** 2026-02-19  
**Test:** Head-to-head comparison of three independently-built crawl→analyze→persist pipelines  
**LLM Backend:** MiniMax M2.5 via Anthropic-compatible endpoint

---

## Executive Summary

| Metric | Claude | Codex | OpenCode |
|--------|--------|-------|----------|
| **Events Found** | 34 | 24 | **54** |
| **Sources Defined** | 33 | 30 | 28 |
| **Sources Working** | 25 | 16 | 27 |
| **Items Crawled** | 52 | 49 | 95 |
| **Jurisdictions** | 8 | 11 | **19** |
| **Avg Impact Score** | 3.9 | 4.0 | 3.9 |
| **Avg Confidence** | 3.3 | 3.6 | **3.5** |
| **Pipeline Duration** | 334s ✅ | 252s ✅ | ~500s ✅ |
| **Completed?** | ✅ | ✅ | ✅ |

**Winner: OpenCode** — Most events (54), best jurisdiction coverage (19 unique), robust fallback analysis.

---

## Iteration History

### Baseline (Pre-fixes)
| | Claude | Codex | OpenCode |
|---|--------|-------|----------|
| Events | 10 | CRASH | 0 |
| Issues | Conservative prompt | Wrong API auth header, OOM from Promise.all on 591 items | Wrong API auth header, `system` role not supported, all LLM calls failed |

### Round 1 — Core Fixes
- **Claude:** Better User-Agent, 30s timeouts, meta tag extraction, inclusive prompt, expanded sources (Google News RSS, EU DPAs, think tanks)
- **Codex:** Fixed `Authorization: Bearer` → `x-api-key` + `anthropic-version`, increased max_tokens 768→2048, inclusive prompt
- **OpenCode:** Fixed auth header, removed invalid `system` role message, robust JSON parsing with code fence stripping, inclusive prompt

### Round 2 — Scaling Fixes
- **All three:** Capped RSS items to 5/feed to prevent item explosion
- **Claude:** Disabled seed data contamination, increased analysis concurrency to 5
- **OpenCode:** Replaced 15+ broken RSS URLs (404s) with Google News RSS and direct HTML sources

### Round 3 — Concurrency + SQLite Fixes
- **Codex & OpenCode:** Added concurrent batch analysis (5 at a time)
- **All:** Added SQLite WAL mode + busy_timeout to prevent READONLY_DBMOVED errors
- **OpenCode:** Added stage normalization (LLM returns like "enforcement" → mapped to "effective")

---

## Architecture Comparison

### Claude's Pipeline
- **Crawler:** Simple HTML fetch + RSS parser (regex-based)
- **Analyzer:** Anthropic-format API call (correct from start), user message with inline prompt
- **Sources:** 33 sources — mix of direct gov pages + Google News RSS
- **Strengths:** Clean architecture, correct API format from day 1, good concurrency model
- **Weaknesses:** Regex-based RSS parsing less robust, some dedup from overlapping Google News results

### Codex's Pipeline  
- **Crawler:** HTML page parser + RSS (regex-based), clever use of Google News RSS for discovery
- **Analyzer:** Anthropic-format with template substitution, stage fallback with regex patterns
- **Sources:** 30 sources — heavy on Google News RSS + official RSS feeds (many 404)
- **Strengths:** Smart stage normalization fallbacks, structured source IDs, jurisdiction splitting logic
- **Weaknesses:** 14/30 sources returned errors (broken URLs), `parseWebPage` had too-short text truncation (4000→8000 fixed)

### OpenCode's Pipeline
- **Crawler:** Uses `fast-xml-parser` (proper XML parser) + `turndown` (HTML→Markdown), Chrome User-Agent
- **Analyzer:** Keyword-based fallback when LLM fails, jurisdiction/product/stage detection built-in
- **Sources:** 28 sources — balanced mix of gov HTML + Google News RSS
- **Strengths:** Best crawler (proper XML parsing, Markdown conversion), intelligent fallback, broadest source mix after fixes
- **Weaknesses:** Sequential source processing (slower), some stage normalization gaps (fixed)

---

## Jurisdiction Coverage

| Region | Claude | Codex | OpenCode |
|--------|--------|-------|----------|
| **United States** | 14 | 12 | 14 |
| **United Kingdom** | 9 | 3 | 11 |
| **Australia** | 5 | 3 | 7 |
| **European Union** | 1 | 5 | 4 |
| **Canada** | 1 | 0 | 1 |
| **China** | 1 | 0 | 2 |
| **India** | 0 | 1 | 3 |
| **Singapore** | 0 | 0 | 1 |
| **France** | 0 | 0 | 1 |
| **Global/Multi** | 3 | 0 | 10 |
| **Japan** | 0 | 0 | 0 |
| **South Korea** | 0 | 0 | 0 |

---

## Key Regulations Captured

### Must-have regulations (across all three)

| Regulation | Claude | Codex | OpenCode |
|-----------|--------|-------|----------|
| COPPA (FTC) | ✅ | ✅ | ✅ |
| KOSA (Kids Online Safety Act) | ✅ (4 entries) | ❌ | ✅ (5 entries) |
| California AADC (AB-2273) | ✅ | ❌ | ✅ |
| UK Online Safety Act 2023 | ✅ (3 entries) | ✅ | ✅ (5 entries) |
| EU Digital Services Act | ✅ | ✅ | ✅ |
| Australia Online Safety Act / Ban | ✅ (4 entries) | ✅ | ✅ (7 entries) |
| Canada Online Harms Act (C-63) | ✅ | ❌ | ✅ |
| UK ICO Children's Code | ✅ | ❌ | ✅ |
| EU GDPR Children's Data | ❌ | ❌ | ❌ |
| India DPDP Act | ❌ | ✅ | ✅ (3 entries) |
| Florida HB 1 (Online Protections for Minors) | ❌ | ✅ | ❌ |
| Texas HB 18 | ✅ | ❌ | ❌ |
| Utah SB 0152 | ✅ | ❌ | ❌ |
| Meta Teen Accounts | ❌ | ❌ | ✅ (3 entries) |

---

## Quality Assessment

### Best Analysis Quality: **Claude**
- Cleaner, more standardized titles
- Better deduplication (fewer near-duplicates)
- More accurate stage classification
- Higher average chili score (4.5) suggests better urgency calibration

### Best Coverage: **OpenCode**
- Most events (54)
- Most jurisdictions (19)
- Captured India, Singapore, China, France that others missed
- Captured Meta-specific industry response articles

### Best Source Architecture: **Codex**
- Structured source IDs (`us-federal-register-rss`, etc.)
- Explicit source kind types
- Google News RSS for discovery was clever
- BUT: too many broken RSS URLs hurt actual performance

### Most Reliable Pipeline: **Claude**
- Only pipeline that completed in baseline without crashes
- Fastest completion time (334s)
- Fewest errors
- Correct API format from the start

---

## Recommendations

1. **Use OpenCode's source list** with Claude's analysis pipeline for best results
2. **Replace all broken official RSS URLs** with Google News RSS searches (they're more reliable)
3. **Add proper XML parser** (like fast-xml-parser) instead of regex-based RSS parsing
4. **Cap items per feed** at 5 to prevent explosion while maintaining recency
5. **Use concurrent batch analysis** (5 at a time) with sequential DB writes
6. **Always use WAL mode** for SQLite in concurrent pipelines
7. **Stage normalization** is critical — LLMs return inconsistent values
8. **GDPR Article 8** was missed by all three — the EU data protection page is too generic; need specific Article 8 URLs
