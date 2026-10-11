# Hallucination Detection System — Person 1 Module

> Claim Extraction, Hallucination Detection, Confidence Scoring, and Response Analysis pipeline. See `INSTALLATION.md` for setup steps.

## 1. Module Overview

This module implements the **Claim Extraction, Hallucination Detection, Confidence Scoring, and Response Analysis** pipeline for the *Detecting and Mitigating Hallucinations in Large Language Model Responses* project.

Given a raw LLM-generated response, the module:

1. Extracts discrete, independently checkable factual claims from the text.
2. Compares each claim against retrieved evidence to detect unsupported, fabricated, or contradicted statements.
3. Aggregates per-claim outcomes into response-level trust/reliability/confidence metrics.
4. Produces a final, structured JSON verdict, exposed over a FastAPI endpoint.

It is designed and tested as a standalone service layer, independently unit-testable via constructor-injected dependencies, and independently deployable via the included `Dockerfile`.

---

## 2. Features

- **Claim Extraction** — spaCy-based sentence segmentation and Named Entity Recognition, with heuristic filtering of questions, greetings, instructions, and hedged/opinion statements, plus claim classification (`NUMERIC`, `TEMPORAL`, `ENTITY_CENTRIC`, `FACTUAL`, `OPINION`, `UNVERIFIABLE`).
- **Hallucination Detection** — retrieves evidence via a pluggable `EvidenceSource` interface (a dependency-free lexical-overlap implementation ships by default), computes support/entity-agreement scores, and flags polarity mismatches (negation) between a claim and its best-matching evidence.
- **Confidence Scoring** — computes a weighted **Trust Score**, **Reliability Score**, **Hallucination Probability**, and overall **Confidence Score**, plus a coarse `LOW`/`MEDIUM`/`HIGH` risk level, all weighted by each claim's extraction confidence.
- **Response Analysis** — orchestrates the full pipeline end-to-end and derives a final human-facing `Verdict` (`RELIABLE`, `MOSTLY_RELIABLE`, `QUESTIONABLE`, `UNRELIABLE`, `NO_VERIFIABLE_CLAIMS`), with an explicit, human-readable reason for the verdict.
- **REST API** — a single FastAPI endpoint exposing the full pipeline, with a pre-warmed NLP pipeline at startup and structured global exception handling.
- **Test Suite** — 59 pytest tests (normal/edge/invalid-input cases) across all four pipeline stages, using constructor-injected fakes for the orchestrator so the majority of tests run without loading spaCy.

---

## 3. Folder Structure

```
backend/
├── app/
│   ├── main.py                       # FastAPI app, router mounting, exception handlers
│   ├── core/
│   │   ├── config.py                 # Pydantic settings (APP_NAME, API_PREFIX, etc.)
│   │   └── logging.py                # Logger configuration
│   ├── api/
│   │   └── analysis.py               # POST /analyze router, request/response models
│   ├── models/
│   │   ├── __init__.py
│   │   ├── claim_model.py            # ClaimModel, ClaimType, VerificationStatus, Entity
│   │   └── analysis_result.py        # Deprecated shim -> ResponseAnalysis
│   ├── services/
│   │   ├── __init__.py
│   │   ├── claim_extractor.py        # ClaimExtractor
│   │   ├── hallucination_detector.py # HallucinationDetector, EvidenceSource
│   │   ├── confidence_scorer.py      # ConfidenceScorer
│   │   └── response_analyzer.py      # ResponseAnalyzer (pipeline orchestrator)
│   └── utils/
│       ├── text_cleaner.py
│       ├── tokenizer.py
│       └── validators.py
├── tests/
│   ├── conftest.py                   # Shared fixtures, markers, sys.path setup
│   ├── test_claim_extractor.py
│   ├── test_hallucination_detector.py
│   ├── test_confidence_scorer.py
│   └── test_response_analyzer.py
├── requirements.txt
├── pytest.ini
├── Dockerfile
└── .env.example
```

---

## 4. Installation

```bash
git clone <repository-url>
cd <repository-root>/backend
```

## 5. Virtual Environment Setup

```bash
python3.11 -m venv venv

# macOS / Linux
source venv/bin/activate

# Windows
venv\Scripts\activate
```

## 6. Dependency Installation

```bash
pip install -r requirements.txt
```

## 7. spaCy Model Installation

The extraction and detection services require the `en_core_web_sm` model:

```bash
python -m spacy download en_core_web_sm
```

## 8. Running FastAPI

From the `backend/` directory:

```bash
uvicorn app.main:app --reload
```

- API docs (Swagger UI): `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

## 9. Running pytest

From the `backend/` directory:

```bash
pytest
```

Expected result: **59 passed**.

---

## 10. API Endpoint Description

### `POST /api/v1/analyze`

Runs the full hallucination-detection pipeline on a single LLM response and returns a structured verdict.

**Request body**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `response_text` | `string` | Yes | 1–20,000 characters |

**Response body**

| Field | Type | Description |
|---|---|---|
| `verdict` | `string` | `reliable` / `mostly_reliable` / `questionable` / `unreliable` / `no_verifiable_claims` |
| `verdict_reason` | `string` | Human-readable explanation of the verdict |
| `analyzed_at` | `string` (ISO 8601) | UTC timestamp of the analysis |
| `scores` | `object \| null` | `trust_score`, `reliability_score`, `hallucination_probability`, `confidence_score`, `risk_level` (`null` if no claims were found) |
| `claim_summary` | `object` | `total_claims`, `supported`, `contradicted`, `insufficient_evidence` |
| `claims` | `array` | Full per-claim detail: `id`, `text`, `claim_type`, `entities`, `extraction_confidence`, `verification_status`, `evidence`, `source`, `verified`, `created_at` |

**Status codes:** `200 OK` on success, `422 Unprocessable Entity` for invalid/empty input, `500 Internal Server Error` for unexpected failures.

Other endpoints: `GET /` (service metadata), `GET /health` (liveness/readiness probe).

---

## 11. Example Request

```bash
curl -X POST "http://localhost:8000/api/v1/analyze" \
  -H "Content-Type: application/json" \
  -d '{
        "response_text": "The Eiffel Tower is located in Paris, France, and was completed in 1889."
      }'
```

## 12. Example Response

```json
{
  "verdict": "reliable",
  "verdict_reason": "Trust score 1.00, hallucination probability 0.00, reliability 1.00 across 2 claim(s) (2 supported, 0 contradicted, 0 insufficient evidence).",
  "analyzed_at": "2026-07-30T10:15:42.123456+00:00",
  "scores": {
    "trust_score": 1.0,
    "reliability_score": 1.0,
    "hallucination_probability": 0.0,
    "confidence_score": 0.95,
    "risk_level": "low"
  },
  "claim_summary": {
    "total_claims": 2,
    "supported": 2,
    "contradicted": 0,
    "insufficient_evidence": 0
  },
  "claims": [
    {
      "id": 1,
      "text": "The Eiffel Tower is located in Paris, France, and was completed in 1889.",
      "claim_type": "entity_centric",
      "entities": [
        {"text": "The Eiffel Tower", "label": "ORG", "start_char": 0, "end_char": 16},
        {"text": "Paris", "label": "GPE", "start_char": 30, "end_char": 35},
        {"text": "France", "label": "GPE", "start_char": 37, "end_char": 43}
      ],
      "extraction_confidence": 0.92,
      "verification_status": "supported",
      "evidence": ["The Eiffel Tower is a wrought-iron lattice tower in Paris, France."],
      "source": null,
      "verified": true,
      "created_at": "2026-07-30T10:15:42.001000+00:00"
    }
  ]
}
```

*(Note: exact entity boundaries, confidence values, and evidence text will vary based on the spaCy model version and the evidence corpus configured for the `HallucinationDetector`.)*

---

## 13. Technologies Used

- **Python 3.11**
- **FastAPI** — REST API layer
- **Uvicorn** — ASGI server
- **spaCy** (`en_core_web_sm`) — sentence segmentation, NER, dependency-parse-based negation detection
- **Pydantic v2** — request/response validation and settings management
- **pytest** — test framework (59 tests: normal, edge, and invalid-input cases)
- **Python `logging`** — structured application logging throughout (no `print()` statements)
- **Docker** — multi-stage `Dockerfile` for containerized deployment

---

## 14. Known Limitations

- **Evidence retrieval is lexical, not semantic.** The default `LexicalOverlapEvidenceSource` ranks evidence by stopword-filtered Jaccard token overlap. It has no notion of synonymy or paraphrase, so claims phrased differently from otherwise-matching evidence may be under-scored. A semantic/embedding-based `EvidenceSource` (e.g. backed by a vector store) can be substituted without changing `HallucinationDetector`, but is not implemented in this module.
- **No evidence corpus is wired in by default.** Without an explicit corpus supplied to the evidence source, every claim resolves to `INSUFFICIENT_EVIDENCE` rather than `SUPPORTED`/`CONTRADICTED` — the detector has nothing to check against out of the box.
- **Contradiction detection is a negation heuristic, not full entailment.** It flags polarity mismatches (e.g. "was" vs. "was not") between a claim and its best-matching evidence using spaCy's dependency parse plus a small cue-word list; it does not perform natural language inference and can miss semantically contradictory claims that don't use explicit negation.
- **`en_core_web_sm` is spaCy's small, general-purpose English model.** Entity recognition and dependency parsing accuracy are lower than the larger `en_core_web_lg`/transformer-based models, particularly on domain-specific or unusual named entities.
- **No persistence layer.** Analyses are computed per-request and not stored; there is no history, audit log, or database in this module.
- **No authentication or rate limiting** on the `/analyze` endpoint as implemented.
- **`app/api/` currently lacks an `__init__.py`.** Unlike `app/models/` and `app/services/`, which were given explicit `__init__.py` files during this module's development to avoid namespace-package import ambiguity, `app/api/` has not yet received the same treatment. It has not caused an observed failure, but should be added for structural consistency before further endpoints are added there.
- **`LangChain` is listed in `requirements.txt`** as part of the project's originally planned tech stack but is **not currently imported or used** anywhere in this module's code — the pipeline is implemented directly against spaCy without a LangChain dependency.