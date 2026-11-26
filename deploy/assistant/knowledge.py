"""Local retrieval worker for the BrokerIQ application catalog."""
import hashlib
import json
import os
import re
import threading
import urllib.error
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

COLLECTION = "brokeriq_module_guides_bge_m3_v1"
QDRANT_HOST = os.environ.get("BGE_QDRANT_HOST", "qdrant")
if QDRANT_HOST not in ("qdrant", "127.0.0.1"):
    raise ValueError("Qdrant must be on the isolated service network or loopback")
QDRANT = f"http://{QDRANT_HOST}:6333/collections/{COLLECTION}"
MAX_BODY = 96 * 1024
LOCK = threading.Lock()
known_points = set()


class Encoder:
    def __init__(self, directory):
        model = Path(directory)
        self.tokenizer = Tokenizer.from_file(str(model / "tokenizer.json"))
        self.tokenizer.enable_truncation(max_length=384)
        self.tokenizer.enable_padding(pad_id=1, pad_token="<pad>")
        options = ort.SessionOptions()
        options.intra_op_num_threads = 2
        self.session = ort.InferenceSession(str(model / "model.onnx"), sess_options=options, providers=["CPUExecutionProvider"])

    def encode(self, texts):
        encoded = self.tokenizer.encode_batch(texts)
        values = {
            "input_ids": np.asarray([item.ids for item in encoded], dtype=np.int64),
            "attention_mask": np.asarray([item.attention_mask for item in encoded], dtype=np.int64),
            "token_type_ids": np.asarray([item.type_ids for item in encoded], dtype=np.int64),
        }
        return self.session.run(None, {item.name: values[item.name] for item in self.session.get_inputs()})


def qdrant(method, path="", data=None):
    request = urllib.request.Request(
        QDRANT + path,
        method=method,
        headers={"Content-Type": "application/json"},
        data=json.dumps(data).encode() if data is not None else None,
    )
    with urllib.request.urlopen(request, timeout=3) as response:
        return json.load(response)["result"]


def vectors(texts):
    dense = embedding.encode(texts)[0]
    if dense.ndim == 3:
        dense = dense[:, 0, :]
    if dense.ndim != 2 or dense.shape[1] != 1024:
        raise ValueError("Expected 1024-dimensional BGE-M3 vectors")
    return (dense / np.maximum(np.linalg.norm(dense, axis=1, keepdims=True), 1e-12)).tolist()


def rank(query, documents, lexical):
    permitted = {}
    for item in documents:
        key = item["key"]
        if not re.fullmatch(r"[a-z_]{1,70}", key):
            raise ValueError("Invalid catalog module")
        text = item["name"] + "\n" + item["description"]
        if len(text) > 1000:
            raise ValueError("Invalid catalog document length")
        fingerprint = hashlib.sha256(json.dumps([key, text], ensure_ascii=False).encode()).hexdigest()
        permitted[str(uuid.UUID(fingerprint[:32]))] = (key, text)

    unseen = [point for point in permitted if point not in known_points]
    for offset in range(0, len(unseen), 8):
        batch = unseen[offset:offset + 8]
        encoded = vectors([permitted[point][1] for point in batch])
        qdrant("PUT", "/points?wait=true", {"points": [
            {"id": point, "vector": vector} for point, vector in zip(batch, encoded)
        ]})
        known_points.update(batch)

    hits = qdrant("POST", "/points/query", {
        "query": vectors([query])[0],
        "filter": {"must": [{"has_id": list(permitted)}]},
        "limit": 8,
        "with_payload": False,
    })["points"]
    candidates = {item["id"]: permitted[item["id"]] for item in hits if item["id"] in permitted}
    candidates.update({p: item for p, item in permitted.items() if item[0] in lexical[:6]})
    if not candidates:
        return []
    items = list(candidates.values())
    scores = reranker.encode([(query, item[1]) for item in items])[0].reshape(-1)
    if len(scores) != len(items):
        raise ValueError("Expected one reranker logit per result")
    ranked = sorted(zip(scores, items), key=lambda item: float(item[0]), reverse=True)
    return [item[0] for _, item in ranked[:6]]


class Handler(BaseHTTPRequestHandler):
    timeout = 5

    def log_message(self, _format, *_args):
        # Prompts are private and are never recorded by this worker.
        return

    def reply(self, status, value):
        body = json.dumps(value).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_POST(self):
        if self.path != "/rank":
            return self.reply(404, {})
        if not LOCK.acquire(blocking=False):
            return self.reply(503, {})
        try:
            size = int(self.headers["Content-Length"])
            if not 0 < size <= MAX_BODY:
                return self.reply(413, {})
            value = json.loads(self.rfile.read(size))
            query, docs, lexical = value["query"], value["documents"], value["lexical"]
            if not isinstance(query, str) or not 0 < len(query) <= 220 or not 0 < len(docs) <= 120:
                return self.reply(400, {})
            return self.reply(200, {"keys": rank(query, docs, lexical)})
        except (ValueError, KeyError, TypeError):
            return self.reply(400, {})
        except (OSError, RuntimeError):
            return self.reply(503, {})
        finally:
            LOCK.release()


if __name__ == "__main__":
    embedding = Encoder(os.environ["BGE_EMBEDDING_PATH"])
    reranker = Encoder(os.environ["BGE_RERANKER_PATH"])
    try:
        qdrant("GET")
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise
        qdrant("PUT", data={"vectors": {"size": 1024, "distance": "Cosine"}})
    host = "0.0.0.0" if os.environ.get("BGE_CONTAINER") == "true" else "127.0.0.1"
    port = 8080 if host == "0.0.0.0" else 18092
    ThreadingHTTPServer((host, port), Handler).serve_forever()
