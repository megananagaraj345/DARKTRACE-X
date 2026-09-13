import re


def extract_stylometry(text: str):
    """
    Generate a simple stylometry profile from text.
    This is an initial version for the DARKTRACE-X pipeline.
    """

    words = re.findall(r"\b\w+\b", text.lower())
    sentences = re.split(r"[.!?]+", text)

    words = [word for word in words if word]

    valid_sentences = [
        sentence.strip()
        for sentence in sentences
        if sentence.strip()
    ]

    word_count = len(words)
    sentence_count = len(valid_sentences)

    if word_count == 0:
        return {
            "word_count": 0,
            "average_word_length": 0,
            "average_sentence_length": 0,
            "question_marks": 0,
            "exclamation_marks": 0
        }

    average_word_length = sum(
        len(word) for word in words
    ) / word_count

    average_sentence_length = (
        word_count / sentence_count
        if sentence_count > 0
        else word_count
    )

    return {
        "word_count": word_count,
        "average_word_length": round(average_word_length, 2),
        "average_sentence_length": round(average_sentence_length, 2),
        "question_marks": text.count("?"),
        "exclamation_marks": text.count("!")
    }