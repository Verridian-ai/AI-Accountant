#!/usr/bin/env python3
"""
Cross-Encoder Inference Script

Provides local cross-encoder reranking using MS-MARCO MiniLM models.
Called from Node.js via subprocess for model inference.

Usage:
    python cross_encoder_inference.py --check
    python cross_encoder_inference.py --rerank '{"query": "...", "documents": [...], "model": "..."}'
"""

import argparse
import json
import sys
from typing import Optional

# Global model cache
_model_cache = {}


def check_availability() -> dict:
    """Check if required dependencies are available."""
    try:
        from sentence_transformers import CrossEncoder
        return {"available": True, "message": "Cross-encoder models available"}
    except ImportError:
        return {
            "available": False,
            "message": "sentence-transformers not installed. Run: pip install sentence-transformers"
        }


def get_model(model_name: str):
    """Get or load a cross-encoder model."""
    global _model_cache

    if model_name in _model_cache:
        return _model_cache[model_name]

    from sentence_transformers import CrossEncoder

    # Map friendly names to HuggingFace model IDs
    model_mapping = {
        "ms-marco-MiniLM-L-6-v2": "cross-encoder/ms-marco-MiniLM-L-6-v2",
        "ms-marco-MiniLM-L-12-v2": "cross-encoder/ms-marco-MiniLM-L-12-v2",
    }

    model_id = model_mapping.get(model_name, model_name)

    try:
        model = CrossEncoder(model_id, max_length=512)
        _model_cache[model_name] = model
        return model
    except Exception as e:
        raise RuntimeError(f"Failed to load model {model_id}: {str(e)}")


def rerank(query: str, documents: list, model_name: str = "ms-marco-MiniLM-L-6-v2") -> dict:
    """
    Rerank documents by relevance to query using cross-encoder.

    Args:
        query: The search query
        documents: List of dicts with 'id' and 'content' keys
        model_name: Name of the cross-encoder model to use

    Returns:
        Dict with 'scores' list containing index and score for each document
    """
    if not documents:
        return {"scores": []}

    try:
        model = get_model(model_name)

        # Prepare query-document pairs
        pairs = [[query, doc["content"]] for doc in documents]

        # Get scores
        scores = model.predict(pairs)

        # Convert numpy to Python types and pair with indices
        result_scores = [
            {"index": i, "score": float(score)}
            for i, score in enumerate(scores)
        ]

        # Sort by score descending
        result_scores.sort(key=lambda x: x["score"], reverse=True)

        return {"scores": result_scores}

    except Exception as e:
        return {"error": str(e), "scores": []}


def main():
    parser = argparse.ArgumentParser(description="Cross-encoder inference for reranking")
    parser.add_argument("--check", action="store_true", help="Check if models are available")
    parser.add_argument("--rerank", type=str, help="JSON input for reranking")

    args = parser.parse_args()

    try:
        if args.check:
            result = check_availability()
        elif args.rerank:
            input_data = json.loads(args.rerank)
            query = input_data.get("query", "")
            documents = input_data.get("documents", [])
            model = input_data.get("model", "ms-marco-MiniLM-L-6-v2")
            result = rerank(query, documents, model)
        else:
            result = {"error": "No command specified. Use --check or --rerank"}

        print(json.dumps(result))

    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON input: {str(e)}"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
