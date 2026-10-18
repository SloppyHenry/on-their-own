"""Filter für die Live-Liste von Hugging Face (AP17c-2). Die Trendliste ist verrauscht (Bild-, Vision-, Embedding-Modelle, Merges, Adapter);
hier wird aus den Metadaten eines Eintrags entschieden, ob er ein brauchbares Textmodell ist, und aus der Dateiliste, welche Dateien in Frage kommen.
Nur Standardbibliothek."""

from __future__ import annotations

import re

from .fit import quant_bits, quant_of

# Gründe, aus denen ein Eintrag nicht erscheint (Schlüssel der Zähler „hidden“ in der API)
NOT_TEXT = "kein Textmodell"
VISION = "Vision-Modell"
ADAPTER = "Adapter"
MERGE = "Merge"
PUBLISHER = "Herausgeber nicht auf der Liste"
NO_FILE = "keine Datei Q4–Q8"
PRIVATE = "nicht öffentlich"

TEXT_PIPELINES = {None, "", "text-generation", "image-text-to-text", "any-to-any"}
MULTIMODAL_PIPELINES = {"image-text-to-text", "any-to-any"}
NOT_TEXT_TAGS = {"feature-extraction", "sentence-similarity", "text-to-image", "text-to-speech", "automatic-speech-recognition", "image-generation", "embedding",
                 "text-embeddings-inference", "reranker"}
NOT_TEXT_NAME = re.compile(r"(?<![a-z0-9])(embed|embedding|embeddinggemma|rerank|reranker|image|ocr|diarization|tts|whisper|asr)(?![a-z])", re.I)
VISION_NAME = re.compile(r"(?<![a-z0-9])(vl|vlm|vision|llava|pixtral|paligemma|smolvlm|moondream|internvl|minicpm-v|minicpm_v)(?![a-z])", re.I)
VISION_ARCH = re.compile(r"vl$|vision|llava|paligemma|clip|pixtral", re.I)
MERGE_NAME = re.compile(r"(?<![a-z0-9])(merge|merged|mergekit|slerp|frankenmerge)(?![a-z])", re.I)
UNCENSORED = re.compile(r"uncensored|abliterated|heretic|unfiltered|decensored", re.I)
SPLIT_FILE = re.compile(r"-\d{3,6}-of-\d{3,6}\.gguf$", re.I)
SKIP_FILE = re.compile(r"mmproj|imatrix|^mtp[-_]", re.I)
SHA256 = re.compile(r"^[0-9a-f]{64}$")

LICENSE_NAMES = {"apache-2.0": "Apache-2.0", "mit": "MIT", "gemma": "Gemma-Lizenz", "llama2": "Llama-2-Lizenz", "llama3": "Llama-3-Lizenz", "llama3.1": "Llama-3.1-Lizenz",
                 "llama3.2": "Llama-3.2-Lizenz", "llama3.3": "Llama-3.3-Lizenz", "llama4": "Llama-4-Lizenz", "other": "Sonstige (siehe Modellseite)", "openrail": "OpenRAIL",
                 "cc-by-4.0": "CC-BY-4.0", "cc-by-nc-4.0": "CC-BY-NC-4.0 (nicht kommerziell)", "bsd-3-clause": "BSD-3-Clause", "agpl-3.0": "AGPL-3.0"}


def repo_name(repo_id: str) -> str:
    return repo_id.split("/", 1)[-1]


def display_name(repo_id: str) -> str:
    """„Qwen/Qwen3-8B-GGUF“ -> „Qwen3-8B“."""
    return re.sub(r"[-_.]gguf$", "", repo_name(repo_id), flags=re.I)


def license_of(tags: list[str]) -> str | None:
    """Lizenz aus den Tags (`license:apache-2.0`, bei `license:other` zusätzlich `license_name:…`)."""
    lic = next((t[8:] for t in tags if t.startswith("license:")), None)
    if lic is None:
        return None
    if lic == "other":
        name = next((t[13:] for t in tags if t.startswith("license_name:")), None)
        return name if name else LICENSE_NAMES["other"]
    return LICENSE_NAMES.get(lic, lic)


def is_uncensored(repo_id: str, tags: list[str]) -> bool:
    return bool(UNCENSORED.search(repo_name(repo_id)) or any(UNCENSORED.search(t) for t in tags if not t.startswith(("base_model:", "dataset:"))))


def is_moe(tags: list[str], arch: str | None) -> bool:
    return "moe" in tags or "mixture-of-experts" in tags or bool(arch and "moe" in arch.lower())


def reject_reason(meta: dict, publishers: set[str] | None) -> str | None:
    """None, wenn der Eintrag als Textmodell in Frage kommt; sonst der Grund. `publishers=None` heißt: jeder Herausgeber."""
    repo = meta.get("id", "")
    name = repo_name(repo)
    tags = [t for t in meta.get("tags") or [] if isinstance(t, str)]
    pipeline = meta.get("pipeline_tag")
    arch = (meta.get("gguf") or {}).get("architecture") or ""
    if meta.get("private"):
        return PRIVATE
    if pipeline not in TEXT_PIPELINES or NOT_TEXT_TAGS & set(tags) or NOT_TEXT_NAME.search(name):
        return NOT_TEXT
    if VISION_NAME.search(name) or VISION_ARCH.search(arch):
        return VISION
    if "lora" in tags or "peft" in tags or any(t.startswith("base_model:adapter:") for t in tags):
        return ADAPTER
    if "merge" in tags or "mergekit" in tags or any(t.startswith("base_model:merge:") for t in tags) or MERGE_NAME.search(name):
        return MERGE
    if publishers is not None and repo.split("/", 1)[0] not in publishers:
        return PUBLISHER
    return None


def usable_files(tree: list[dict]) -> list[dict]:
    """Einzeldateien Q4–Q8 aus `/tree/main`: {file, quant, size_mb, sha256}. Ordner (Teilstücke, MTP), geteilte Dateien, mmproj und imatrix entfallen."""
    out = []
    for e in tree:
        path = e.get("path", "")
        if e.get("type") != "file" or not path.endswith(".gguf") or SKIP_FILE.search(path) or SPLIT_FILE.search(path):
            continue
        quant = quant_of(path)
        if quant is None or quant_bits(quant) is None or not e.get("size"):
            continue
        oid = (e.get("lfs") or {}).get("oid") or ""
        out.append({"file": path, "quant": quant, "size_mb": e["size"] / 1048576, "sha256": oid if SHA256.match(oid) else None})
    return out
