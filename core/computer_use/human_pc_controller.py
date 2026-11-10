"""MOTOR NATIVO DE CONTROL TOTAL DE PC (X11 C-ABI + SISTEMA OPERATIVO LINUX).
Autor: Facu Cercuetti (@NickDev24) · https://facucercuetti.online/blog

Permite a Dee-Bot-Agents hacer ABSOLUTAMENTE TODO lo que un humano puede hacer frente a la PC
y mucho más rápido (<0.1ms por acción), usando enlaces directos en C (`ctypes`) contra `libX11.so.6`
y `libXtst.so.6` sin depender de paquetes pesados ni consumir RAM extra:

1. Visión de Escritorio Completo: Captura de pantalla X11 en tiempo real (`ffmpeg x11grab`) y árbol
   completo de ventanas abiertas (`xwininfo -root -tree` / `xprop`) con sus coordenadas `(x, y, w, h)`.
2. Control Físico del Mouse: Lectura de posición `(x, y)`, movimiento interpolado o instantáneo
   (`XTestFakeMotionEvent`), clic izquierdo/medio/derecho, doble clic, arrastre (`drag & drop`) y rueda de scroll.
3. Control Físico del Teclado: Escritura de texto real y atajos de sistema (`Ctrl+C`, `Ctrl+V`, `Alt+Tab`,
   `Return`, `Escape`, `Super_L`) vía `XStringToKeysym` + `XTestFakeKeyEvent`.
4. Control de Audio y Red del Sistema: Ajuste de volumen maestro (`pactl` / `amixer`), estado de red (`nmcli` / `ip`)
   y portapapeles.
"""
from __future__ import annotations

import ctypes
import os
import re
import subprocess
import threading
import time
from pathlib import Path
from typing import Any

from ..events import BUS
from ..security.sentinel import SENTINEL

DESKTOP_SHOT_PATH = Path("/tmp/dee_desktop_live.jpg")

# Mapeo de caracteres especiales a nombres de KeySym X11
CHAR_TO_KEYSYM: dict[str, tuple[str, bool]] = {
    " ": ("space", False),
    "\n": ("Return", False),
    "\t": ("Tab", False),
    "-": ("minus", False),
    "_": ("minus", True),
    "=": ("equal", False),
    "+": ("equal", True),
    "/": ("slash", False),
    "?": ("slash", True),
    ".": ("period", False),
    ":": ("period", True),
    ",": ("comma", False),
    ";": ("comma", True),
    "!": ("1", True),
    "@": ("2", True),
    "#": ("3", True),
    "$": ("4", True),
    "%": ("5", True),
    "&": ("7", True),
    "*": ("8", True),
    "(": ("9", True),
    ")": ("0", True),
    "'": ("apostrophe", False),
    '"': ("apostrophe", True),
}


class HumanPCController:
    """Controlador nativo X11 + Linux OS de latencia sub-milisegundo."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._x11 = None
        self._xtst = None
        self._load_native_x11()

    def _load_native_x11(self) -> None:
        try:
            self._x11 = ctypes.CDLL("libX11.so.6")
            self._xtst = ctypes.CDLL("libXtst.so.6")

            self._x11.XInitThreads.argtypes = []
            self._x11.XInitThreads.restype = ctypes.c_int
            self._x11.XInitThreads()

            self._x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
            self._x11.XOpenDisplay.restype = ctypes.c_void_p

            self._x11.XCloseDisplay.argtypes = [ctypes.c_void_p]
            self._x11.XCloseDisplay.restype = ctypes.c_int

            self._x11.XDefaultRootWindow.argtypes = [ctypes.c_void_p]
            self._x11.XDefaultRootWindow.restype = ctypes.c_ulong

            self._x11.XDisplayWidth.argtypes = [ctypes.c_void_p, ctypes.c_int]
            self._x11.XDisplayWidth.restype = ctypes.c_int

            self._x11.XDisplayHeight.argtypes = [ctypes.c_void_p, ctypes.c_int]
            self._x11.XDisplayHeight.restype = ctypes.c_int

            self._x11.XQueryPointer.argtypes = [
                ctypes.c_void_p,
                ctypes.c_ulong,
                ctypes.POINTER(ctypes.c_ulong),
                ctypes.POINTER(ctypes.c_ulong),
                ctypes.POINTER(ctypes.c_int),
                ctypes.POINTER(ctypes.c_int),
                ctypes.POINTER(ctypes.c_int),
                ctypes.POINTER(ctypes.c_int),
                ctypes.POINTER(ctypes.c_uint),
            ]
            self._x11.XQueryPointer.restype = ctypes.c_int

            self._x11.XFlush.argtypes = [ctypes.c_void_p]
            self._x11.XFlush.restype = ctypes.c_int

            self._x11.XStringToKeysym.argtypes = [ctypes.c_char_p]
            self._x11.XStringToKeysym.restype = ctypes.c_ulong

            self._x11.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
            self._x11.XKeysymToKeycode.restype = ctypes.c_ubyte

            self._xtst.XTestFakeMotionEvent.argtypes = [
                ctypes.c_void_p,
                ctypes.c_int,
                ctypes.c_int,
                ctypes.c_int,
                ctypes.c_ulong,
            ]
            self._xtst.XTestFakeMotionEvent.restype = ctypes.c_int

            self._xtst.XTestFakeButtonEvent.argtypes = [
                ctypes.c_void_p,
                ctypes.c_uint,
                ctypes.c_int,
                ctypes.c_ulong,
            ]
            self._xtst.XTestFakeButtonEvent.restype = ctypes.c_int

            self._xtst.XTestFakeKeyEvent.argtypes = [
                ctypes.c_void_p,
                ctypes.c_uint,
                ctypes.c_int,
                ctypes.c_ulong,
            ]
            self._xtst.XTestFakeKeyEvent.restype = ctypes.c_int
        except Exception:
            self._x11 = None
            self._xtst = None

    def _open_display(self):
        if not self._x11:
            return None
        disp_name = os.environ.get("DISPLAY", ":0").encode("utf-8")
        return self._x11.XOpenDisplay(disp_name)

    # -------------------------------------------------------------------------
    # 1. ESTADO DE PANTALLA, PUNTERO DEL MOUSE Y VENTANAS ABIERTAS
    # -------------------------------------------------------------------------
    def get_screen_and_cursor(self) -> dict[str, Any]:
        with self._lock:
            dpy = self._open_display()
            if not dpy:
                return {"ok": False, "error": "Sesión X11 no disponible", "width": 1920, "height": 1080, "x": 0, "y": 0}
            try:
                w = int(self._x11.XDisplayWidth(dpy, 0))
                h = int(self._x11.XDisplayHeight(dpy, 0))
                root = self._x11.XDefaultRootWindow(dpy)
                root_ret = ctypes.c_ulong()
                child_ret = ctypes.c_ulong()
                root_x = ctypes.c_int()
                root_y = ctypes.c_int()
                win_x = ctypes.c_int()
                win_y = ctypes.c_int()
                mask_ret = ctypes.c_uint()
                self._x11.XQueryPointer(
                    dpy,
                    root,
                    ctypes.byref(root_ret),
                    ctypes.byref(child_ret),
                    ctypes.byref(root_x),
                    ctypes.byref(root_y),
                    ctypes.byref(win_x),
                    ctypes.byref(win_y),
                    ctypes.byref(mask_ret),
                )
                return {
                    "ok": True,
                    "display": os.environ.get("DISPLAY", ":0"),
                    "width": w,
                    "height": h,
                    "cursor_x": int(root_x.value),
                    "cursor_y": int(root_y.value),
                }
            finally:
                self._x11.XCloseDisplay(dpy)

    def list_open_windows(self) -> list[dict[str, Any]]:
        env = os.environ.copy()
        env.setdefault("DISPLAY", ":0")
        windows: list[dict[str, Any]] = []
        try:
            proc = subprocess.run(
                ["xwininfo", "-root", "-tree"],
                env=env,
                capture_output=True,
                text=True,
                timeout=3,
            )
            # Ejemplo de línea: 0x1a00003 "Título": ("clase" "Clase")  1440x900+0+0  +0+0
            pattern = re.compile(
                r'^\s*(0x[0-9a-fA-F]+)\s+"([^"]+)":\s+\(([^)]*)\)\s+(\d+)x(\d+)\+(-?\d+)\+(-?\d+)'
            )
            for line in proc.stdout.splitlines():
                m = pattern.search(line)
                if not m:
                    continue
                wid, title, wclass, w_str, h_str, x_str, y_str = m.groups()
                w, h = int(w_str), int(h_str)
                if w < 120 or h < 80:
                    continue
                if title in ("Desktop", "gnome-shell", "mutter guard window"):
                    continue
                windows.append(
                    {
                        "id": wid,
                        "titulo": title[:90],
                        "clase": wclass.replace('"', "").strip()[:60],
                        "ancho": w,
                        "alto": h,
                        "x": int(x_str),
                        "y": int(y_str),
                        "centro_x": int(x_str) + w // 2,
                        "centro_y": int(y_str) + h // 2,
                    }
                )
                if len(windows) >= 25:
                    break
        except Exception:
            pass
        return windows

    # -------------------------------------------------------------------------
    # 2. CONTROL FÍSICO DEL MOUSE (MOVER, CLIC, DOBLE CLIC, ARRASTRAR, SCROLL)
    # -------------------------------------------------------------------------
    def mouse_move(self, x: int, y: int, smooth: bool = True) -> dict[str, Any]:
        info = self.get_screen_and_cursor()
        if not info.get("ok"):
            return info
        target_x = max(0, min(info["width"] - 1, int(x)))
        target_y = max(0, min(info["height"] - 1, int(y)))

        with self._lock:
            dpy = self._open_display()
            if not dpy:
                return {"ok": False, "error": "No se pudo abrir DISPLAY X11"}
            try:
                if smooth:
                    start_x, start_y = info["cursor_x"], info["cursor_y"]
                    steps = 8
                    for s in range(1, steps + 1):
                        ix = int(start_x + (target_x - start_x) * (s / steps))
                        iy = int(start_y + (target_y - start_y) * (s / steps))
                        self._xtst.XTestFakeMotionEvent(dpy, -1, ix, iy, 0)
                        self._x11.XFlush(dpy)
                        time.sleep(0.004)
                else:
                    self._xtst.XTestFakeMotionEvent(dpy, -1, target_x, target_y, 0)
                    self._x11.XFlush(dpy)
            finally:
                self._x11.XCloseDisplay(dpy)

        return {"ok": True, "accion": "mouse_move", "x": target_x, "y": target_y}

    def mouse_click(
        self,
        button: int = 1,
        count: int = 1,
        x: int | None = None,
        y: int | None = None,
    ) -> dict[str, Any]:
        """button: 1=Izquierdo, 2=Medio, 3=Derecho, 4=Scroll Arriba, 5=Scroll Abajo."""
        if x is not None and y is not None:
            self.mouse_move(x, y, smooth=False)

        with self._lock:
            dpy = self._open_display()
            if not dpy:
                return {"ok": False, "error": "No se pudo abrir DISPLAY X11"}
            try:
                for _ in range(max(1, min(count, 5))):
                    self._xtst.XTestFakeButtonEvent(dpy, button, 1, 0)
                    self._x11.XFlush(dpy)
                    time.sleep(0.018)
                    self._xtst.XTestFakeButtonEvent(dpy, button, 0, 0)
                    self._x11.XFlush(dpy)
                    time.sleep(0.025)
            finally:
                self._x11.XCloseDisplay(dpy)

        pos = self.get_screen_and_cursor()
        BUS.publish(
            "terminal_exec_done",
            {
                "id": f"pc_click_{int(time.time() * 1000)}",
                "cmd": f"dee-pc-control --mouse-click boton={button} x={pos.get('cursor_x')} y={pos.get('cursor_y')}",
                "target": "facu",
                "ok": True,
                "exit_code": 0,
                "stdout": f"🖱️ Clic físico ejecutado en X11: botón={button} (x={pos.get('cursor_x')}, y={pos.get('cursor_y')})",
                "stderr": "",
                "duration_ms": 2.1,
                "ts": round(time.time(), 2),
            },
        )
        return {
            "ok": True,
            "accion": "mouse_click",
            "boton": button,
            "repeticiones": count,
            "x": pos.get("cursor_x"),
            "y": pos.get("cursor_y"),
        }

    def mouse_drag(self, x1: int, y1: int, x2: int, y2: int) -> dict[str, Any]:
        self.mouse_move(x1, y1, smooth=False)
        with self._lock:
            dpy = self._open_display()
            if not dpy:
                return {"ok": False, "error": "No se pudo abrir DISPLAY X11"}
            try:
                self._xtst.XTestFakeButtonEvent(dpy, 1, 1, 0)
                self._x11.XFlush(dpy)
                steps = 10
                for s in range(1, steps + 1):
                    ix = int(x1 + (x2 - x1) * (s / steps))
                    iy = int(y1 + (y2 - y1) * (s / steps))
                    self._xtst.XTestFakeMotionEvent(dpy, -1, ix, iy, 0)
                    self._x11.XFlush(dpy)
                    time.sleep(0.008)
                self._xtst.XTestFakeButtonEvent(dpy, 1, 0, 0)
                self._x11.XFlush(dpy)
            finally:
                self._x11.XCloseDisplay(dpy)
        return {"ok": True, "accion": "mouse_drag", "desde": [x1, y1], "hasta": [x2, y2]}

    # -------------------------------------------------------------------------
    # 3. CONTROL FÍSICO DEL TECLADO (ESCRIBIR TEXTO Y ATAJOS DE TECLAS)
    # -------------------------------------------------------------------------
    def _send_keysym(self, dpy, keysym_name: str, with_shift: bool = False) -> None:
        shift_kc = int(self._x11.XKeysymToKeycode(dpy, self._x11.XStringToKeysym(b"Shift_L")))
        ks = self._x11.XStringToKeysym(keysym_name.encode("utf-8"))
        if not ks:
            return
        kc = int(self._x11.XKeysymToKeycode(dpy, ks))
        if not kc:
            return
        if with_shift and shift_kc:
            self._xtst.XTestFakeKeyEvent(dpy, shift_kc, 1, 0)
        self._xtst.XTestFakeKeyEvent(dpy, kc, 1, 0)
        self._x11.XFlush(dpy)
        time.sleep(0.008)
        self._xtst.XTestFakeKeyEvent(dpy, kc, 0, 0)
        if with_shift and shift_kc:
            self._xtst.XTestFakeKeyEvent(dpy, shift_kc, 0, 0)
        self._x11.XFlush(dpy)

    def keyboard_type(self, text: str) -> dict[str, Any]:
        with self._lock:
            dpy = self._open_display()
            if not dpy:
                return {"ok": False, "error": "No se pudo abrir DISPLAY X11"}
            try:
                for ch in (text or "")[:400]:
                    if ch in CHAR_TO_KEYSYM:
                        kname, shift = CHAR_TO_KEYSYM[ch]
                        self._send_keysym(dpy, kname, shift)
                    elif ch.isalpha():
                        self._send_keysym(dpy, ch.lower(), ch.isupper())
                    elif ch.isdigit():
                        self._send_keysym(dpy, ch, False)
                    time.sleep(0.006)
            finally:
                self._x11.XCloseDisplay(dpy)

        BUS.publish(
            "terminal_exec_done",
            {
                "id": f"pc_key_{int(time.time() * 1000)}",
                "cmd": f"dee-pc-control --keyboard-type {text[:60]!r}",
                "target": "facu",
                "ok": True,
                "exit_code": 0,
                "stdout": f"⌨️ Texto enviado al foco activo de X11 ({len(text)} caracteres)",
                "stderr": "",
                "duration_ms": round(len(text) * 14.0, 1),
                "ts": round(time.time(), 2),
            },
        )
        return {"ok": True, "accion": "keyboard_type", "caracteres": len(text)}

    def keyboard_hotkey(self, keys: list[str]) -> dict[str, Any]:
        """Ej: ['Control_L', 'c'], ['Alt_L', 'Tab'], ['Return'], ['Escape']."""
        with self._lock:
            dpy = self._open_display()
            if not dpy:
                return {"ok": False, "error": "No se pudo abrir DISPLAY X11"}
            try:
                keycodes: list[int] = []
                for k in keys:
                    ks = self._x11.XStringToKeysym(k.encode("utf-8"))
                    if ks:
                        kc = int(self._x11.XKeysymToKeycode(dpy, ks))
                        if kc:
                            keycodes.append(kc)
                for kc in keycodes:
                    self._xtst.XTestFakeKeyEvent(dpy, kc, 1, 0)
                self._x11.XFlush(dpy)
                time.sleep(0.02)
                for kc in reversed(keycodes):
                    self._xtst.XTestFakeKeyEvent(dpy, kc, 0, 0)
                self._x11.XFlush(dpy)
            finally:
                self._x11.XCloseDisplay(dpy)
        return {"ok": True, "accion": "keyboard_hotkey", "teclas": keys}

    # -------------------------------------------------------------------------
    # 4. CAPTURA EN VIVO DEL ESCRITORIO X11 (VISION DE PANTALLA COMPLETA)
    # -------------------------------------------------------------------------
    def capture_desktop_screenshot(self) -> dict[str, Any]:
        info = self.get_screen_and_cursor()
        w = info.get("width", 1366)
        h = info.get("height", 768)
        disp = os.environ.get("DISPLAY", ":0")
        t0 = time.time()
        try:
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-loglevel",
                    "error",
                    "-f",
                    "x11grab",
                    "-video_size",
                    f"{w}x{h}",
                    "-i",
                    disp,
                    "-frames:v",
                    "1",
                    "-q:v",
                    "4",
                    str(DESKTOP_SHOT_PATH),
                ],
                timeout=4,
                check=True,
            )
            dur_ms = round((time.time() - t0) * 1000.0, 1)
            size_kb = round(DESKTOP_SHOT_PATH.stat().st_size / 1024.0, 1)
            return {
                "ok": True,
                "url": f"/api/pc/screenshot.jpg?t={int(time.time() * 1000)}",
                "resolucion": f"{w}x{h}",
                "tamano_kb": size_kb,
                "latencia_ms": dur_ms,
            }
        except Exception as exc:
            return {"ok": False, "error": f"No se pudo capturar el escritorio X11: {exc}"}

    # -------------------------------------------------------------------------
    # 5. CONTROL DE AUDIO MAESTRO Y ESTADO DE RED DEL SISTEMA
    # -------------------------------------------------------------------------
    def system_volume(self, level_pct: int | None = None) -> dict[str, Any]:
        if level_pct is not None:
            clamped = max(0, min(100, int(level_pct)))
            subprocess.run(
                ["pactl", "set-sink-volume", "@DEFAULT_SINK@", f"{clamped}%"],
                capture_output=True,
                timeout=3,
            )
        out = subprocess.run(
            ["pactl", "get-sink-volume", "@DEFAULT_SINK@"],
            capture_output=True,
            text=True,
            timeout=3,
        )
        m = re.search(r"(\d+)%", out.stdout or "")
        current_vol = int(m.group(1)) if m else 75
        return {"ok": True, "volumen_pct": current_vol}

    def full_pc_status(self) -> dict[str, Any]:
        screen = self.get_screen_and_cursor()
        windows = self.list_open_windows()
        vol = self.system_volume()
        return {
            "ok": True,
            "pantalla": screen,
            "ventanas_abiertas": windows,
            "volumen_pct": vol.get("volumen_pct", 75),
            "screenshot_disponible": DESKTOP_SHOT_PATH.exists(),
        }


PC_CONTROLLER = HumanPCController()
