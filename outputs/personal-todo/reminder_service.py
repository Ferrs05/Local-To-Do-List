import ctypes
import json
import mimetypes
import os
import threading
import time
from datetime import datetime, timedelta
from urllib.parse import unquote, urlparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


APP_DIR = Path(__file__).resolve().parent
DATA_DIR = APP_DIR / "data"
TASKS_FILE = DATA_DIR / "tasks-sync.json"
NOTIFIED_FILE = DATA_DIR / "notified-reminders.json"
LOG_FILE = DATA_DIR / "service.log"
HOST = "127.0.0.1"
PORT = 8765


def ensure_data_dir():
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def parse_local_datetime(value):
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.strptime(value[:16], "%Y-%m-%dT%H:%M")
    except ValueError:
        return None


def read_json(path, fallback):
    try:
        if not path.exists():
            return fallback
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def write_json(path, payload):
    ensure_data_dir()
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temp, path)


def write_log(message):
    ensure_data_dir()
    stamp = datetime.now().isoformat(timespec="seconds")
    with LOG_FILE.open("a", encoding="utf-8") as handle:
        handle.write(f"[{stamp}] {message}\n")


def show_popup(title, message):
    ctypes.windll.user32.MessageBoxW(0, message, title, 0x00001040)


def reminder_key(task):
    return "|".join([
        str(task.get("id", "")),
        str(task.get("deadline", "")),
        str(task.get("remindBeforeMinutes", 0)),
    ])


def reminder_message(task, deadline, minutes):
    title = str(task.get("title", "Task")).strip() or "Task"
    category = str(task.get("category", "")).strip()
    notes = str(task.get("notes", "")).strip()
    unit = "menit"
    amount = minutes
    if minutes >= 1440 and minutes % 1440 == 0:
        unit = "hari"
        amount = minutes // 1440
    elif minutes >= 60 and minutes % 60 == 0:
        unit = "jam"
        amount = minutes // 60

    lines = [
        f"{title}",
        "",
        f"Deadline: {deadline.strftime('%d/%m/%Y %H:%M')}",
        f"Due in: {amount} {unit}",
    ]
    if category:
        lines.append(f"Kategori: {category}")
    if notes:
        lines.extend(["", notes[:260]])
    return "\n".join(lines)


def reminder_loop():
    ensure_data_dir()
    notified = read_json(NOTIFIED_FILE, {})
    while True:
        payload = read_json(TASKS_FILE, {"tasks": []})
        tasks = payload.get("tasks", [])
        now = datetime.now()
        changed = False

        for task in tasks:
            if task.get("done"):
                continue
            deadline = parse_local_datetime(task.get("deadline"))
            if not deadline:
                continue
            try:
                minutes = int(task.get("remindBeforeMinutes") or 0)
            except (TypeError, ValueError):
                minutes = 0
            if minutes <= 0:
                continue

            remind_at = deadline - timedelta(minutes=minutes)
            if now < remind_at or now > deadline + timedelta(hours=24):
                continue

            key = reminder_key(task)
            if notified.get(key):
                continue

            notified[key] = datetime.now().isoformat(timespec="seconds")
            changed = True
            write_json(NOTIFIED_FILE, notified)
            threading.Thread(
                target=show_popup,
                args=("Personal Workplace ToDo", reminder_message(task, deadline, minutes)),
                daemon=True,
            ).start()

        if changed:
            write_json(NOTIFIED_FILE, notified)
        time.sleep(30)


class ReminderRequestHandler(BaseHTTPRequestHandler):
    def _send(self, status, body):
        data = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self._send(200, {"ok": True})

    def do_GET(self):
        if self.path == "/api/health":
            self._send(200, {"ok": True})
            return

        parsed = urlparse(self.path)
        requested = unquote(parsed.path).lstrip("/") or "index.html"
        target = (APP_DIR / requested).resolve()
        try:
            target.relative_to(APP_DIR)
        except ValueError:
            self._send(403, {"ok": False})
            return

        if not target.exists() or not target.is_file():
            self._send(404, {"ok": False})
            return

        data = target.read_bytes()
        mime = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if self.path != "/api/tasks":
            self._send(404, {"ok": False})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(min(length, 2_000_000))
            payload = json.loads(raw.decode("utf-8"))
            if payload.get("version") != 1 or not isinstance(payload.get("tasks"), list):
                raise ValueError("Invalid payload")
            write_json(TASKS_FILE, payload)
            self._send(200, {"ok": True, "tasks": len(payload["tasks"])})
        except Exception:
            self._send(400, {"ok": False})

    def log_message(self, format, *args):
        return


def run_server():
    server = ThreadingHTTPServer((HOST, PORT), ReminderRequestHandler)
    write_log(f"Reminder service listening on http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    try:
        ensure_data_dir()
        threading.Thread(target=reminder_loop, daemon=True).start()
        run_server()
    except Exception as exc:
        write_log(f"Fatal error: {type(exc).__name__}: {exc}")
        raise
