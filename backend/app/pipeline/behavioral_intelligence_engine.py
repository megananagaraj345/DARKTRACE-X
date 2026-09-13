import math
import re
from collections import Counter
from typing import Any, Dict, Iterable, List, Sequence


DEFAULT_FUNCTION_WORDS = {
    "the", "a", "an", "and", "or", "but", "if", "then", "to", "of",
    "in", "on", "for", "with", "as", "at", "by", "from", "is", "are",
    "was", "were", "be", "been", "it", "this", "that", "i", "we",
    "you", "they", "he", "she", "my", "your", "our", "their"
}


def _words(text: str) -> List[str]:
    return re.findall(r"\b[a-zA-Z0-9_'-]+\b", str(text).lower())


def _sentences(text: str) -> List[str]:
    return [s.strip() for s in re.split(r"[.!?]+", str(text)) if s.strip()]


def _char_ngrams(text: str, n: int = 3) -> Counter:
    normalized = re.sub(r"\s+", " ", str(text).lower()).strip()
    return Counter(normalized[i:i+n] for i in range(max(0, len(normalized)-n+1)))


def _cosine(a: Counter, b: Counter) -> float:
    if not a or not b:
        return 0.0
    keys = set(a) | set(b)
    dot = sum(a[k] * b[k] for k in keys)
    na = math.sqrt(sum(v*v for v in a.values()))
    nb = math.sqrt(sum(v*v for v in b.values()))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def extract_behavioral_fingerprint(texts: Sequence[str] | str) -> Dict[str, Any]:
    if isinstance(texts, str):
        texts = [texts]
    texts = [str(t) for t in texts if str(t).strip()]
    joined = "\n".join(texts)
    words = _words(joined)
    sentences = _sentences(joined)

    word_count = len(words)
    sentence_count = len(sentences)
    avg_word_length = (
        sum(len(w) for w in words) / word_count if word_count else 0.0
    )
    avg_sentence_length = (
        word_count / sentence_count if sentence_count else 0.0
    )
    punctuation = {
        "?": joined.count("?"),
        "!": joined.count("!"),
        ",": joined.count(","),
        ";": joined.count(";"),
        ":": joined.count(":"),
    }
    function_words = Counter(w for w in words if w in DEFAULT_FUNCTION_WORDS)
    vocabulary = Counter(words)
    hapax_ratio = (
        sum(1 for v in vocabulary.values() if v == 1) / len(vocabulary)
        if vocabulary else 0.0
    )

    return {
        "text_count": len(texts),
        "word_count": word_count,
        "sentence_count": sentence_count,
        "average_word_length": round(avg_word_length, 3),
        "average_sentence_length": round(avg_sentence_length, 3),
        "unique_word_ratio": round(len(vocabulary) / word_count, 4) if word_count else 0.0,
        "hapax_ratio": round(hapax_ratio, 4),
        "function_word_profile": dict(function_words.most_common(20)),
        "punctuation_profile": punctuation,
        "top_terms": [
            {"term": term, "count": count}
            for term, count in vocabulary.most_common(15)
        ],
        "character_trigram_count": len(_char_ngrams(joined, 3)),
        "technical_token_ratio": round(
            sum(
                1 for w in words
                if "_" in w or any(ch.isdigit() for ch in w)
            ) / word_count,
            4
        ) if word_count else 0.0,
    }


def compare_behavioral_fingerprints(
    text_a: Sequence[str] | str,
    text_b: Sequence[str] | str,
) -> Dict[str, Any]:
    fp_a = extract_behavioral_fingerprint(text_a)
    fp_b = extract_behavioral_fingerprint(text_b)

    joined_a = "\n".join(text_a if isinstance(text_a, list) else [text_a])
    joined_b = "\n".join(text_b if isinstance(text_b, list) else [text_b])

    char_similarity = _cosine(
        _char_ngrams(joined_a, 3),
        _char_ngrams(joined_b, 3)
    )

    numeric_pairs = [
        ("average_word_length", fp_a["average_word_length"], fp_b["average_word_length"]),
        ("average_sentence_length", fp_a["average_sentence_length"], fp_b["average_sentence_length"]),
        ("unique_word_ratio", fp_a["unique_word_ratio"], fp_b["unique_word_ratio"]),
        ("hapax_ratio", fp_a["hapax_ratio"], fp_b["hapax_ratio"]),
        ("technical_token_ratio", fp_a["technical_token_ratio"], fp_b["technical_token_ratio"]),
    ]

    component_scores = {}
    for name, a, b in numeric_pairs:
        denominator = max(abs(float(a)), abs(float(b)), 1.0)
        component_scores[name] = max(0.0, 1.0 - abs(float(a)-float(b))/denominator)

    function_a = Counter(fp_a["function_word_profile"])
    function_b = Counter(fp_b["function_word_profile"])
    function_similarity = _cosine(function_a, function_b)

    top_a = {x["term"] for x in fp_a["top_terms"]}
    top_b = {x["term"] for x in fp_b["top_terms"]}
    vocabulary_similarity = (
        len(top_a & top_b) / len(top_a | top_b)
        if top_a | top_b else 0.0
    )

    overall = (
        char_similarity * 0.40
        + function_similarity * 0.20
        + vocabulary_similarity * 0.20
        + sum(component_scores.values()) / len(component_scores) * 0.20
    )

    return {
        "similarity": round(max(0.0, min(1.0, overall)), 4),
        "similarity_percent": round(overall * 100, 1),
        "components": {
            "character_ngrams": round(char_similarity, 4),
            "function_words": round(function_similarity, 4),
            "vocabulary": round(vocabulary_similarity, 4),
            **{k: round(v, 4) for k, v in component_scores.items()},
        },
        "fingerprint_a": fp_a,
        "fingerprint_b": fp_b,
        "assessment": (
            "High behavioral similarity"
            if overall >= 0.80
            else "Moderate behavioral similarity"
            if overall >= 0.60
            else "Low behavioral similarity"
        ),
        "disclaimer": (
            "Behavioral similarity is an intelligence signal and does not establish "
            "real-world identity."
        ),
    }
