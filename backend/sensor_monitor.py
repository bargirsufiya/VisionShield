import random
import threading
import time


class SensorMonitor:
    def __init__(self):
        self._stop_event = threading.Event()
        self._thread = None
        self._lock = threading.Lock()
        self._ingest_fn = None
        self._settings_fn = None

    def configure(self, settings_fn, ingest_fn):
        self._settings_fn = settings_fn
        self._ingest_fn = ingest_fn

    def start(self):
        with self._lock:
            if self._thread and self._thread.is_alive():
                return
            self._stop_event.clear()
            self._thread = threading.Thread(
                target=self._run,
                name="visionshield-sensor-monitor",
                daemon=True,
            )
            self._thread.start()

    def stop(self):
        self._stop_event.set()
        thread = self._thread
        if thread and thread.is_alive():
            thread.join(timeout=2)

    def generate_reading(self, settings):
        temp_min = float(settings.get("min_temperature", 1300))
        temp_max = float(settings.get("max_temperature", 1600))
        weight_min = float(settings.get("min_weight", 500))
        weight_max = float(settings.get("max_weight", 650))

        roll = random.random()
        if roll < 0.18:
            temperature = round(temp_max + random.uniform(15, 90), 1)
        elif roll < 0.24:
            temperature = round(max(0, temp_min - random.uniform(10, 60)), 1)
        else:
            temperature = round(random.uniform(temp_min, temp_max), 1)

        weight_roll = random.random()
        if weight_roll < 0.12:
            weight = round(weight_max + random.uniform(8, 40), 1)
        elif weight_roll < 0.18:
            weight = round(max(0, weight_min - random.uniform(5, 30)), 1)
        else:
            weight = round(random.uniform(weight_min, weight_max), 1)

        return temperature, weight

    def _run(self):
        last_ingest = 0.0
        loop_count = 0

        while not self._stop_event.is_set():
            try:
                settings = self._settings_fn() if self._settings_fn else {}
                monitoring_enabled = bool(settings.get("monitoring_enabled"))
                interval = float(settings.get("refresh_interval") or 5)
                if interval <= 0:
                    interval = 5

                now = time.monotonic()

                # Debug: Print status every 20 loops (~5 seconds)
                loop_count += 1
                if loop_count % 20 == 0:
                    print(f"[SensorMonitor] Loop: monitoring_enabled={monitoring_enabled}, interval={interval}, last_ingest={last_ingest}, has_ingest_fn={self._ingest_fn is not None}")
                    if monitoring_enabled:
                        print(f"[SensorMonitor] Settings: temp_range={settings.get('min_temperature')}-{settings.get('max_temperature')}, weight_range={settings.get('min_weight')}-{settings.get('max_weight')}")

                if monitoring_enabled and self._ingest_fn:
                    if last_ingest == 0.0 or (now - last_ingest) >= interval:
                        temperature, weight = self.generate_reading(settings)
                        print(f"[SensorMonitor] Generating reading: temp={temperature}, weight={weight}")
                        self._ingest_fn(temperature, weight)
                        last_ingest = time.monotonic()
                else:
                    last_ingest = 0.0
            except Exception as error:
                print(f"[SensorMonitor] ERROR: {error}")
                import traceback
                traceback.print_exc()

            self._stop_event.wait(0.25)


sensor_monitor = SensorMonitor()
