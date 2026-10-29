#!/usr/bin/env python3
"""Master CLI E2E Test Runner for QQ Game Hall 3D (QQ游戏大厅 3D — 童年四大经典合集).

Usage:
  python3 -B tests/run_e2e.py --tier all
  python3 -B tests/run_e2e.py --tier 1
  python3 -B tests/run_e2e.py --list
"""

from __future__ import annotations

import argparse
import dataclasses
import json
from pathlib import Path
import re
import sys
import time
import traceback

TESTS_DIR = Path(__file__).resolve().parent
if str(TESTS_DIR) not in sys.path:
  sys.path.insert(0, str(TESTS_DIR))

from harness import (  # pylint: disable=wrong-import-position
    DEFAULT_PROJECT_ROOT,
    QQHallTestHarness,
    RecordedStaticHTTPServer,
    TestCaseSpec,
    TestResult,
)

EXPECTED_GAMES = [
    ("tang", "qq-tang-3d", "https://kunruiw1991.github.io/qq-tang-3d/", "https://github.com/kunruiw1991/qq-tang-3d"),
    ("watermelon", "qq-watermelon-3d", "https://kunruiw1991.github.io/qq-watermelon-3d/", "https://github.com/kunruiw1991/qq-watermelon-3d"),
    ("aeroplane", "qq-aeroplane-chess-3d", "https://kunruiw1991.github.io/qq-aeroplane-chess-3d/", "https://github.com/kunruiw1991/qq-aeroplane-chess-3d"),
    ("bubbledragon", "qq-bubble-dragon-3d", "https://kunruiw1991.github.io/qq-bubble-dragon-3d/", "https://github.com/kunruiw1991/qq-bubble-dragon-3d"),
]


def _reset_hall(h: QQHallTestHarness) -> dict:
  return h.eval_js(
      """(() => {
        const api = window.__QQ_HALL__;
        api.closeEmbedded();
        api.setMuted(false);
        api.selectGame('tang', { instantSnap: true, silent: true });
        return api.stepFrames(2);
      })()"""
  )


# ============================================================================
# TIER 1: Core 3D Sky Plaza, Penguin Host & 4 Miniature 3D Island Dioramas
# ============================================================================

def test_t1_01_frozen_api_and_deep_clone(h: QQHallTestHarness) -> None:
  _reset_hall(h)
  res = h.eval_js(
      """(() => {
        const api = window.__QQ_HALL__;
        const isFrozen = Object.isFrozen(api);
        const requiredFns = ['selectGame', 'rotateCarousel', 'openEmbedded', 'closeEmbedded', 'stepFrames', 'getState'];
        const missing = requiredFns.filter((k) => typeof api[k] !== 'function');
        const st1 = api.getState();
        st1.selectedGameId = 'MUTATED_EXTERNAL';
        st1.games[0].titleZh = 'MUTATED_TITLE';
        const st2 = api.getState();
        return {
          isFrozen,
          missing,
          preservedId: st2.selectedGameId,
          preservedTitle: st2.games[0].titleZh,
        };
      })()"""
  )
  assert res["isFrozen"] is True, res
  assert res["missing"] == [], res
  assert res["preservedId"] == "tang", res
  assert res["preservedTitle"] == "QQ堂 3D", res


def test_t1_02_webgl2_plaza_and_viewport_coverage(h: QQHallTestHarness) -> None:
  st = _reset_hall(h)
  rnd = st["render"]
  assert rnd["webgl2"] is True, rnd
  assert rnd["drawCalls"] >= 15, rnd
  assert rnd["triangles"] >= 1000, rnd
  assert rnd["dioramaViewportRatio"] >= 0.55, rnd


def test_t1_03_penguin_host_rig_and_raycast_cheer(h: QQHallTestHarness) -> None:
  st0 = _reset_hall(h)
  assert st0["render"]["penguinMeshCount"] >= 14, st0["render"]
  w0 = st0["penguinHost"]["waveAngle"]
  s0 = st0["penguinHost"]["scarfFlutter"]
  c0 = st0["penguinHost"]["cheerCount"]

  st1 = h.eval_js("window.__QQ_HALL__.stepFrames(25)")
  assert st1["penguinHost"]["waveAngle"] != w0 or st1["penguinHost"]["scarfFlutter"] != s0, st1["penguinHost"]

  # Click directly on the projected 2D screen position of the 3D QQ Penguin Host
  p_screen = st1["penguinHost"]["screenPos"]
  assert p_screen["visible"] is True, p_screen
  h.click_at(p_screen["x"], p_screen["y"])
  st2 = h.eval_js("window.__QQ_HALL__.stepFrames(5)")
  assert st2["penguinHost"]["cheerCount"] > c0, (c0, st2["penguinHost"])


def test_t1_04_tang_island_3d_diorama_animation(h: QQHallTestHarness) -> None:
  st0 = _reset_hall(h)
  assert st0["render"]["islandMeshCounts"]["tang"] >= 16, st0["render"]
  tang0 = next(g for g in st0["games"] if g["id"] == "tang")["dioramaState"]
  st1 = h.eval_js("window.__QQ_HALL__.stepFrames(45)")
  tang1 = next(g for g in st1["games"] if g["id"] == "tang")["dioramaState"]

  assert (tang0["miduo"]["x"], tang0["miduo"]["z"]) != (tang1["miduo"]["x"], tang1["miduo"]["z"])
  assert tang0["bubbles"][0]["scaleXZ"] != tang1["bubbles"][0]["scaleXZ"]


def test_t1_05_watermelon_island_3d_jar_physics(h: QQHallTestHarness) -> None:
  st0 = _reset_hall(h)
  assert st0["render"]["islandMeshCounts"]["watermelon"] >= 20, st0["render"]
  wm0 = next(g for g in st0["games"] if g["id"] == "watermelon")["dioramaState"]
  assert len(wm0["fruits"]) == 7, wm0

  st1 = h.eval_js("window.__QQ_HALL__.stepFrames(60)")
  wm1 = next(g for g in st1["games"] if g["id"] == "watermelon")["dioramaState"]

  moved = sum(
      1
      for f0, f1 in zip(wm0["fruits"], wm1["fruits"])
      if abs(f0["x"] - f1["x"]) > 1e-3 or abs(f0["y"] - f1["y"]) > 1e-3
  )
  assert moved >= 5, (wm0["fruits"], wm1["fruits"])
  for f in wm1["fruits"]:
    assert -0.75 <= f["x"] <= 0.75 and 0.0 <= f["y"] <= 1.65, f


def test_t1_06_aeroplane_island_3d_biplanes_and_die(h: QQHallTestHarness) -> None:
  st0 = _reset_hall(h)
  assert st0["render"]["islandMeshCounts"]["aeroplane"] >= 24, st0["render"]
  ap0 = next(g for g in st0["games"] if g["id"] == "aeroplane")["dioramaState"]
  assert len(ap0["planes"]) == 4, ap0

  st1 = h.eval_js("window.__QQ_HALL__.stepFrames(40)")
  ap1 = next(g for g in st1["games"] if g["id"] == "aeroplane")["dioramaState"]
  assert ap0["dice"]["rotX"] != ap1["dice"]["rotX"]
  assert ap0["planes"][0]["x"] != ap1["planes"][0]["x"]
  assert ap0["planes"][0]["propAngle"] != ap1["planes"][0]["propAngle"]


def test_t1_07_bubbledragon_island_3d_cannon_and_hex_pop(h: QQHallTestHarness) -> None:
  st0 = _reset_hall(h)
  assert st0["render"]["islandMeshCounts"]["bubbledragon"] >= 24, st0["render"]
  bd0 = next(g for g in st0["games"] if g["id"] == "bubbledragon")["dioramaState"]

  st1 = h.eval_js("window.__QQ_HALL__.stepFrames(65)")
  bd1 = next(g for g in st1["games"] if g["id"] == "bubbledragon")["dioramaState"]
  assert bd0["cannonYaw"] != bd1["cannonYaw"]
  assert bd0["gearAngle"] != bd1["gearAngle"]
  assert bd1["popCycleCount"] >= 1, bd1


def test_t1_08_all_four_catalog_live_and_repo_urls(h: QQHallTestHarness) -> None:
  st = _reset_hall(h)
  assert len(st["games"]) == 4
  for idx, (gid, slug, live_url, repo_url) in enumerate(EXPECTED_GAMES):
    g = st["games"][idx]
    assert g["id"] == gid, g
    assert g["slug"] == slug, g
    assert g["liveUrl"] == live_url, g
    assert g["repoUrl"] == repo_url, g


# ============================================================================
# TIER 2: Carousel Rotation, 3D Raycast, Swipe Drag, Keyboard & Hash Links
# ============================================================================

def test_t2_01_select_game_by_id_slug_and_index(h: QQHallTestHarness) -> None:
  _reset_hall(h)
  for gid, slug, live_url, _ in EXPECTED_GAMES:
    st = h.eval_js(f"window.__QQ_HALL__.selectGame({json.dumps(gid)}, {{ instantSnap: true }})")
    assert st["selectedGameId"] == gid, st
    assert st["selectedGame"]["liveUrl"] == live_url, st
    assert abs(st["carousel"]["islandAngles"][gid]) < 0.01, st["carousel"]

    st_slug = h.eval_js(f"window.__QQ_HALL__.selectGame({json.dumps(slug)}, {{ instantSnap: true }})")
    assert st_slug["selectedGameId"] == gid, st_slug


def test_t2_02_rotate_carousel_discrete_steps_and_wraparound(h: QQHallTestHarness) -> None:
  _reset_hall(h)
  expected_fwd = ["watermelon", "aeroplane", "bubbledragon", "tang"]
  for exp_id in expected_fwd:
    st = h.eval_js("window.__QQ_HALL__.rotateCarousel(1)")
    assert st["selectedGameId"] == exp_id, st
    st = h.eval_js("window.__QQ_HALL__.stepFrames(45)")
    assert abs(st["carousel"]["islandAngles"][exp_id]) < 0.05, st["carousel"]

  expected_bwd = ["bubbledragon", "aeroplane", "watermelon", "tang"]
  for exp_id in expected_bwd:
    st = h.eval_js("window.__QQ_HALL__.rotateCarousel(-1)")
    assert st["selectedGameId"] == exp_id, st


def test_t2_03_rotate_carousel_continuous_radians_and_spring_snap(h: QQHallTestHarness) -> None:
  _reset_hall(h)
  # Rotate by -1.45 rad (~ -83 deg) -> closest island is index 1 ('watermelon' at +PI/2)
  st_drag = h.eval_js("window.__QQ_HALL__.rotateCarousel(-1.45, { mode: 'radians' })")
  assert st_drag["selectedGameId"] == "watermelon", st_drag
  st_settled = h.eval_js("window.__QQ_HALL__.stepFrames(75)")
  assert abs(st_settled["carousel"]["angle"] - st_settled["carousel"]["targetAngle"]) < 0.01, st_settled["carousel"]
  assert abs(st_settled["carousel"]["islandAngles"]["watermelon"]) < 0.02, st_settled["carousel"]


def test_t2_04_pointer_drag_swipe_rotates_carousel(h: QQHallTestHarness) -> None:
  st0 = _reset_hall(h)
  a0 = st0["carousel"]["angle"]
  # Drag horizontally across the 3D plaza canvas
  h.drag_canvas(start_x=820, start_y=420, dx=-260, dy=0, steps=10)
  st1 = h.eval_js("window.__QQ_HALL__.stepFrames(45)")
  assert st1["carousel"]["angle"] != a0, (a0, st1["carousel"])
  assert st1["selectedGameId"] == "watermelon", st1


def test_t2_05_3d_raycast_click_off_center_island_selects_it(h: QQHallTestHarness) -> None:
  st0 = _reset_hall(h)
  assert st0["selectedGameId"] == "tang"
  wm_game = next(g for g in st0["games"] if g["id"] == "watermelon")
  sp = wm_game["screenPos"]
  assert sp["visible"] is True, sp

  # Click directly on the 3D Watermelon Island in the WebGL canvas
  h.click_at(sp["x"], sp["y"])
  st1 = h.eval_js("window.__QQ_HALL__.stepFrames(60)")
  assert st1["selectedGameId"] == "watermelon", st1
  assert st1["uiMode"] == "hall", st1
  assert abs(st1["carousel"]["islandAngles"]["watermelon"]) < 0.04, st1["carousel"]


def test_t2_06_3d_raycast_click_centered_island_opens_embedded(h: QQHallTestHarness) -> None:
  st0 = _reset_hall(h)
  tang_game = next(g for g in st0["games"] if g["id"] == "tang")
  sp = tang_game["screenPos"]
  assert sp["visible"] is True, sp

  # Tapping the already-centered front island opens it in Embedded Play!
  h.click_at(sp["x"], sp["y"])
  st1 = h.get_state()
  assert st1["uiMode"] == "embedded", st1
  assert st1["embedded"]["active"] is True, st1["embedded"]
  assert st1["embedded"]["gameId"] == "tang", st1["embedded"]
  h.eval_js("window.__QQ_HALL__.closeEmbedded()")


def test_t2_07_keyboard_arrows_enter_and_escape(h: QQHallTestHarness) -> None:
  _reset_hall(h)
  h.tap_key("ArrowRight", hold_frames=30)
  st1 = h.get_state()
  assert st1["selectedGameId"] == "watermelon", st1

  h.tap_key("ArrowLeft", hold_frames=30)
  st2 = h.get_state()
  assert st2["selectedGameId"] == "tang", st2

  h.tap_key("Enter", hold_frames=2)
  st3 = h.get_state()
  assert st3["uiMode"] == "embedded" and st3["embedded"]["active"] is True, st3

  h.tap_key("Escape", hold_frames=2)
  st4 = h.get_state()
  assert st4["uiMode"] == "hall" and st4["embedded"]["active"] is False, st4


def test_t2_08_url_hash_deep_linking(h: QQHallTestHarness) -> None:
  for gid, _, _, _ in EXPECTED_GAMES:
    h.navigate(f"{h.http_server.base_url}#{gid}", wait_hall=True)
    st = h.get_state()
    assert st["selectedGameId"] == gid, (gid, st)

  # Dynamic hashchange without page reload
  h.eval_js("window.location.hash = '#aeroplane'")
  time.sleep(0.06)
  st_hash = h.eval_js("window.__QQ_HALL__.stepFrames(50)")
  assert st_hash["selectedGameId"] == "aeroplane", st_hash


# ============================================================================
# TIER 3: Embedded Seamless Play, Return Pill & WebAudio Auto-Pause/Resume
# ============================================================================

def test_t3_01_play_button_mounts_embedded_iframe_and_return_pill(h: QQHallTestHarness) -> None:
  _reset_hall(h)
  h.click_testid("btn-play-embedded")
  h.pump_cdp(0.35)
  st = h.get_state()
  assert st["uiMode"] == "embedded", st
  assert st["embedded"]["active"] is True, st["embedded"]
  assert st["embedded"]["allow"] == "autoplay; fullscreen", st["embedded"]
  assert st["embedded"]["iframeSrc"] == "https://kunruiw1991.github.io/qq-tang-3d/", st["embedded"]
  assert st["embedded"]["dockIframeOverlapArea"] == 0, st["embedded"]
  assert any("qq-tang-3d/src/main.js" in u for u in h.fulfilled_github_urls), h.fulfilled_github_urls

  pill_rect = h.get_testid_rect("btn-return-hall")
  assert pill_rect and pill_rect["visible"] is True, pill_rect
  assert pill_rect["width"] >= 68 and pill_rect["height"] >= 68, pill_rect
  assert pill_rect["svgCount"] == 0, pill_rect
  assert "🏠" in pill_rect["textContent"] and "大厅" in pill_rect["textContent"], pill_rect

  h.click_testid("btn-return-hall")
  st_back = h.get_state()
  assert st_back["uiMode"] == "hall", st_back
  assert st_back["embedded"]["active"] is False, st_back["embedded"]


def test_t3_02_switch_all_four_games_in_embedded_player(h: QQHallTestHarness) -> None:
  _reset_hall(h)
  for gid, slug, live_url, _ in EXPECTED_GAMES:
    h.fulfilled_github_urls.clear()
    st_open = h.eval_js(f"window.__QQ_HALL__.openEmbedded({json.dumps(gid)})")
    h.pump_cdp(0.25)
    assert st_open["uiMode"] == "embedded", st_open
    assert st_open["embedded"]["gameId"] == gid, st_open["embedded"]
    assert st_open["embedded"]["liveUrl"] == live_url, st_open["embedded"]
    assert st_open["embedded"]["iframeSrc"] == live_url, st_open["embedded"]
    assert st_open["embedded"]["dockIframeOverlapArea"] == 0, st_open["embedded"]
    assert any(slug in u for u in h.fulfilled_github_urls), (slug, h.fulfilled_github_urls)

    st_close = h.eval_js("window.__QQ_HALL__.closeEmbedded()")
    assert st_close["uiMode"] == "hall", st_close
    assert st_close["embedded"]["active"] is False, st_close["embedded"]


def test_t3_03_bgm_auto_pauses_in_embedded_and_resumes_on_return(h: QQHallTestHarness) -> None:
  _reset_hall(h)
  # Trigger real user gesture to unlock WebAudio
  h.click_testid("btn-next-game")
  st_hall = h.get_state()
  assert st_hall["audio"]["unlocked"] is True, st_hall["audio"]
  assert st_hall["audio"]["bgmPlaying"] is True, st_hall["audio"]
  assert st_hall["audio"]["bgmPausedForEmbedded"] is False, st_hall["audio"]

  # Open embedded game -> BGM must pause automatically
  h.click_testid("btn-play-embedded")
  h.pump_cdp(0.15)
  st_emb = h.get_state()
  assert st_emb["audio"]["bgmPausedForEmbedded"] is True, st_emb["audio"]
  assert st_emb["audio"]["bgmPlaying"] is False, st_emb["audio"]

  # Click `🏠 大厅` return pill -> BGM must resume cleanly
  h.click_testid("btn-return-hall")
  st_ret = h.get_state()
  assert st_ret["audio"]["bgmPausedForEmbedded"] is False, st_ret["audio"]
  assert st_ret["audio"]["bgmPlaying"] is True, st_ret["audio"]


def test_t3_04_standalone_launch_buttons_in_hall_and_embedded(h: QQHallTestHarness) -> None:
  _reset_hall(h)
  h.eval_js(
      """(() => {
        window.__TEST_OPEN_CALLS__ = [];
        window.__ORIG_WINDOW_OPEN__ = window.open;
        window.open = (url, target, features) => {
          window.__TEST_OPEN_CALLS__.push({
            url: String(url || ''),
            target: String(target || ''),
            features: String(features || ''),
          });
          return null;
        };
        window.__QQ_HALL__.selectGame('bubbledragon', { instantSnap: true });
      })()"""
  )
  try:
    h.click_testid("btn-open-standalone")
    st1 = h.get_state()
    calls1 = h.eval_js("window.__TEST_OPEN_CALLS__.slice()")
    assert st1["embedded"]["lastStandaloneOpenedUrl"] == "https://kunruiw1991.github.io/qq-bubble-dragon-3d/"
    assert st1["embedded"]["standaloneOpenCount"] >= 1
    assert len(calls1) == 1, calls1
    assert calls1[0]["url"] == "https://kunruiw1991.github.io/qq-bubble-dragon-3d/", calls1
    assert calls1[0]["target"] == "_blank", calls1

    st2 = h.eval_js("window.__QQ_HALL__.openStandalone('aeroplane', { suppressPopup: true })")
    calls2 = h.eval_js("window.__TEST_OPEN_CALLS__.slice()")
    assert st2["embedded"]["lastStandaloneOpenedUrl"] == "https://kunruiw1991.github.io/qq-aeroplane-chess-3d/"
    assert len(calls2) == 1, calls2
  finally:
    h.eval_js(
        """(() => {
          if (window.__ORIG_WINDOW_OPEN__) {
            window.open = window.__ORIG_WINDOW_OPEN__;
            delete window.__ORIG_WINDOW_OPEN__;
          }
          delete window.__TEST_OPEN_CALLS__;
        })()"""
    )


def test_t3_05_audio_mute_button_and_key_m(h: QQHallTestHarness) -> None:
  _reset_hall(h)
  h.click_testid("btn-audio-mute")
  st1 = h.get_state()
  assert st1["audio"]["muted"] is True, st1["audio"]
  assert st1["audio"]["bgmPlaying"] is False, st1["audio"]

  h.tap_key("KeyM", hold_frames=1)
  st2 = h.get_state()
  assert st2["audio"]["muted"] is False, st2["audio"]
  assert st2["audio"]["bgmPlaying"] is True, st2["audio"]


def test_t3_06_webaudio_keydown_autorepeat_idempotency(h: QQHallTestHarness) -> None:
  _reset_hall(h)
  h.key_down("ArrowRight", auto_repeat=False)
  st0 = h.get_state()
  unlock_count_0 = st0["audio"]["unlockCallCount"]
  selected_0 = st0["selectedGameId"]

  for _ in range(20):
    h.key_down("ArrowRight", auto_repeat=True)
  h.key_up("ArrowRight")

  st1 = h.get_state()
  assert st1["audio"]["unlockCallCount"] == unlock_count_0, (unlock_count_0, st1["audio"])
  assert st1["selectedGameId"] == selected_0, (selected_0, st1["selectedGameId"])


# ============================================================================
# TIER 4: Multi-Viewport Kid-UX Cap (<= 6 Controls, >= 64px), Safari & Subpath
# ============================================================================

def _verify_viewport_layout(
    h: QQHallTestHarness, width: int, height: int, mobile: bool, touch: bool
) -> None:
  dims = h.set_viewport(width, height, mobile=mobile, touch=touch)
  assert dims["innerWidth"] == width and dims["innerHeight"] == height, dims

  # 1. Audit Hall Plaza Mode
  _reset_hall(h)
  audit_hall = h.audit_viewport_and_hud()
  assert audit_hall["scrollWidth"] <= width, audit_hall
  assert audit_hall["scrollHeight"] <= height, audit_hall
  assert 1 <= audit_hall["controlCount"] <= 6, audit_hall
  assert audit_hall["overlaps"] == [], audit_hall
  for c in audit_hall["controls"]:
    assert c["width"] >= 64 and c["height"] >= 64, (width, height, c)
    assert c["left"] >= -0.5 and c["right"] <= width + 0.5, (width, height, c)
    assert c["top"] >= -0.5 and c["bottom"] <= height + 0.5, (width, height, c)

  st_hall = h.get_state()
  assert st_hall["render"]["dioramaViewportRatio"] >= 0.55, st_hall["render"]
  for g in st_hall["games"]:
    assert g["screenPos"]["visible"] is True, (width, height, g)

  # 2. Audit Embedded Game Mode (Non-overlapping 84px rail/strip + single Return Pill >= 68x68px)
  st_emb = h.eval_js("window.__QQ_HALL__.openEmbedded('tang')")
  h.pump_cdp(0.25)
  audit_emb = h.audit_viewport_and_hud()
  assert audit_emb["scrollWidth"] <= width, audit_emb
  assert audit_emb["scrollHeight"] <= height, audit_emb
  assert audit_emb["controlCount"] == 1, audit_emb
  assert audit_emb["overlaps"] == [], audit_emb
  assert st_emb["embedded"]["dockIframeOverlapArea"] == 0, (width, height, st_emb["embedded"])
  for c in audit_emb["controls"]:
    assert c["width"] >= 68 and c["height"] >= 68, (width, height, c)

  h.eval_js("window.__QQ_HALL__.closeEmbedded()")


def test_t4_01_viewport_1280x800_desktop_audit(h: QQHallTestHarness) -> None:
  _verify_viewport_layout(h, 1280, 800, mobile=False, touch=False)


def test_t4_02_viewport_1024x768_ipad_landscape_audit(h: QQHallTestHarness) -> None:
  _verify_viewport_layout(h, 1024, 768, mobile=True, touch=True)


def test_t4_03_viewport_844x390_mobile_landscape_audit(h: QQHallTestHarness) -> None:
  _verify_viewport_layout(h, 844, 390, mobile=True, touch=True)


def test_t4_04_viewport_390x844_mobile_portrait_and_touch_swipe(h: QQHallTestHarness) -> None:
  _verify_viewport_layout(h, 390, 844, mobile=True, touch=True)
  # Verify touch swipe rotation on 390x844 portrait
  h.drag_canvas(start_x=290, start_y=420, dx=-180, dy=0, steps=8)
  st = h.eval_js("window.__QQ_HALL__.stepFrames(40)")
  assert st["selectedGameId"] == "watermelon", st
  # Restore default viewport
  h.set_viewport(1280, 800, mobile=False, touch=False)


def test_t4_05_safari_zero_importmap_bare_specifiers_and_tts_audit(h: QQHallTestHarness) -> None:
  root = h.root_dir
  html_files = list(root.glob("*.html"))
  js_files = list((root / "src").rglob("*.js"))
  assert html_files and js_files

  for hf in html_files:
    txt = hf.read_text(encoding="utf-8")
    assert "importmap" not in txt.lower(), f"Forbidden importmap in {hf}"

  import_re = re.compile(r"""(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]""")
  for jf in js_files:
    txt = jf.read_text(encoding="utf-8")
    assert "speechSynthesis" not in txt, f"Forbidden speechSynthesis TTS in {jf}"
    for match in import_re.finditer(txt):
      spec = match.group(1)
      assert spec.startswith("./") or spec.startswith("../"), (
          f"Forbidden non-relative import specifier {spec!r} in {jf}"
      )


def test_t4_06_subpath_hosting_and_webgl2_screenshot_variance(h: QQHallTestHarness) -> None:
  sub_srv = RecordedStaticHTTPServer(h.root_dir, strict_subpath="/qq-game-hall-3d").start()
  try:
    h.set_viewport(1280, 800, mobile=False, touch=False)
    h.clear_diagnostics()
    h.navigate(sub_srv.base_url, wait_hall=True)
    h.eval_js("window.__QQ_HALL__.stepFrames(30)")
    h.assert_zero_errors("subpath-qq-game-hall-3d", ignore_favicon=False)
    assert sub_srv.get_error_records(ignore_favicon=False) == []

    shot = h.capture_screenshot()
    stats = h.inspect_image(shot)
    assert stats["width"] == 1280 and stats["height"] == 800, stats
    assert stats["std_dev"] > 0.08, stats
  finally:
    sub_srv.close()
    h.navigate(h.http_server.base_url, wait_hall=True)


ALL_TESTS: list[TestCaseSpec] = [
    TestCaseSpec(1, "T1.01_frozen_api_and_deep_clone", "plaza_core", test_t1_01_frozen_api_and_deep_clone),
    TestCaseSpec(1, "T1.02_webgl2_plaza_and_viewport_coverage", "plaza_core", test_t1_02_webgl2_plaza_and_viewport_coverage),
    TestCaseSpec(1, "T1.03_penguin_host_rig_and_raycast_cheer", "plaza_core", test_t1_03_penguin_host_rig_and_raycast_cheer),
    TestCaseSpec(1, "T1.04_tang_island_3d_diorama_animation", "island_dioramas", test_t1_04_tang_island_3d_diorama_animation),
    TestCaseSpec(1, "T1.05_watermelon_island_3d_jar_physics", "island_dioramas", test_t1_05_watermelon_island_3d_jar_physics),
    TestCaseSpec(1, "T1.06_aeroplane_island_3d_biplanes_and_die", "island_dioramas", test_t1_06_aeroplane_island_3d_biplanes_and_die),
    TestCaseSpec(1, "T1.07_bubbledragon_island_3d_cannon_and_hex_pop", "island_dioramas", test_t1_07_bubbledragon_island_3d_cannon_and_hex_pop),
    TestCaseSpec(1, "T1.08_all_four_catalog_live_and_repo_urls", "catalog", test_t1_08_all_four_catalog_live_and_repo_urls),
    TestCaseSpec(2, "T2.01_select_game_by_id_slug_and_index", "carousel_nav", test_t2_01_select_game_by_id_slug_and_index),
    TestCaseSpec(2, "T2.02_rotate_carousel_discrete_steps_and_wraparound", "carousel_nav", test_t2_02_rotate_carousel_discrete_steps_and_wraparound),
    TestCaseSpec(2, "T2.03_rotate_carousel_continuous_radians_and_spring_snap", "carousel_nav", test_t2_03_rotate_carousel_continuous_radians_and_spring_snap),
    TestCaseSpec(2, "T2.04_pointer_drag_swipe_rotates_carousel", "carousel_nav", test_t2_04_pointer_drag_swipe_rotates_carousel),
    TestCaseSpec(2, "T2.05_3d_raycast_click_off_center_island_selects_it", "raycast_3d", test_t2_05_3d_raycast_click_off_center_island_selects_it),
    TestCaseSpec(2, "T2.06_3d_raycast_click_centered_island_opens_embedded", "raycast_3d", test_t2_06_3d_raycast_click_centered_island_opens_embedded),
    TestCaseSpec(2, "T2.07_keyboard_arrows_enter_and_escape", "keyboard_nav", test_t2_07_keyboard_arrows_enter_and_escape),
    TestCaseSpec(2, "T2.08_url_hash_deep_linking", "deep_linking", test_t2_08_url_hash_deep_linking),
    TestCaseSpec(3, "T3.01_play_button_mounts_embedded_iframe_and_return_pill", "embedded_play", test_t3_01_play_button_mounts_embedded_iframe_and_return_pill),
    TestCaseSpec(3, "T3.02_switch_all_four_games_in_embedded_player", "embedded_play", test_t3_02_switch_all_four_games_in_embedded_player),
    TestCaseSpec(3, "T3.03_bgm_auto_pauses_in_embedded_and_resumes_on_return", "audio_bgm", test_t3_03_bgm_auto_pauses_in_embedded_and_resumes_on_return),
    TestCaseSpec(3, "T3.04_standalone_launch_buttons_in_hall_and_embedded", "standalone_launch", test_t3_04_standalone_launch_buttons_in_hall_and_embedded),
    TestCaseSpec(3, "T3.05_audio_mute_button_and_key_m", "audio_bgm", test_t3_05_audio_mute_button_and_key_m),
    TestCaseSpec(3, "T3.06_webaudio_keydown_autorepeat_idempotency", "audio_bgm", test_t3_06_webaudio_keydown_autorepeat_idempotency),
    TestCaseSpec(4, "T4.01_viewport_1280x800_desktop_audit", "viewport_ux", test_t4_01_viewport_1280x800_desktop_audit),
    TestCaseSpec(4, "T4.02_viewport_1024x768_ipad_landscape_audit", "viewport_ux", test_t4_02_viewport_1024x768_ipad_landscape_audit),
    TestCaseSpec(4, "T4.03_viewport_844x390_mobile_landscape_audit", "viewport_ux", test_t4_03_viewport_844x390_mobile_landscape_audit),
    TestCaseSpec(4, "T4.04_viewport_390x844_mobile_portrait_and_touch_swipe", "viewport_ux", test_t4_04_viewport_390x844_mobile_portrait_and_touch_swipe),
    TestCaseSpec(4, "T4.05_safari_zero_importmap_bare_specifiers_and_tts_audit", "safari_compat", test_t4_05_safari_zero_importmap_bare_specifiers_and_tts_audit),
    TestCaseSpec(4, "T4.06_subpath_hosting_and_webgl2_screenshot_variance", "subpath_hosting", test_t4_06_subpath_hosting_and_webgl2_screenshot_variance),
]


def main(argv: list[str] | None = None) -> int:
  parser = argparse.ArgumentParser(description="Run QQ Game Hall 3D E2E Test Suite")
  parser.add_argument("--tier", default="all", choices=["1", "2", "3", "4", "all"])
  parser.add_argument("--root-dir", default=str(DEFAULT_PROJECT_ROOT))
  parser.add_argument("--filter", default="")
  parser.add_argument("--list", action="store_true")
  parser.add_argument("--fail-fast", action="store_true")
  parser.add_argument("--json-report", default="")
  args = parser.parse_args(argv)

  selected = [
      t
      for t in ALL_TESTS
      if args.tier == "all" or str(t.tier) == args.tier
  ]
  if args.filter:
    needle = args.filter.lower()
    selected = [t for t in selected if needle in t.name.lower() or needle in t.group.lower()]

  if args.list:
    for s in selected:
      print(f"[Tier {s.tier}] {s.group} :: {s.name}")
    print(f"Total registered tests: {len(selected)}")
    return 0

  root_dir = Path(args.root_dir).resolve()
  results: list[TestResult] = []
  t0_suite = time.perf_counter()

  print(
      f"=== QQ Game Hall 3D E2E Runner | root={root_dir} | tier={args.tier} | "
      f"tests={len(selected)} ==="
  )

  with QQHallTestHarness(root_dir=root_dir) as harness:
    harness.set_viewport(1280, 800, mobile=False, touch=False)
    harness.navigate(wait_hall=True)
    harness.assert_zero_errors("initial_boot_load")

    for idx, spec in enumerate(selected, start=1):
      t0 = time.perf_counter()
      passed = False
      err_msg = ""
      try:
        harness.clear_diagnostics()
        spec.fn(harness)
        harness.assert_zero_errors(spec.name)
        passed = True
      except Exception as exc:  # pylint: disable=broad-except
        tb_lines = traceback.format_exception(type(exc), exc, exc.__traceback__)
        err_msg = "".join(tb_lines[-6:]).strip()
        try:
          harness.set_viewport(1280, 800, mobile=False, touch=False)
          harness.navigate(wait_hall=True)
        except Exception:  # pylint: disable=broad-except
          pass

      dt_ms = (time.perf_counter() - t0) * 1000.0
      results.append(
          TestResult(
              tier=spec.tier,
              name=spec.name,
              group=spec.group,
              passed=passed,
              duration_ms=round(dt_ms, 1),
              error=err_msg,
          )
      )
      status = "PASS" if passed else "FAIL"
      print(
          f"[{idx:03d}/{len(selected):03d}] [{status}] "
          f"(T{spec.tier}:{spec.group}) {spec.name} ({dt_ms:.1f} ms)"
      )
      if not passed:
        print(f"    -> {err_msg}")
        if args.fail_fast:
          break

  suite_sec = time.perf_counter() - t0_suite
  passed_count = sum(1 for r in results if r.passed)
  failed_count = sum(1 for r in results if not r.passed)

  print("\n" + "=" * 76)
  for tid in sorted({r.tier for r in results}):
    t_res = [r for r in results if r.tier == tid]
    t_pass = sum(1 for r in t_res if r.passed)
    print(f"  Tier {tid}: {t_pass}/{len(t_res)} passed")
  print("-" * 76)
  print(f"  TOTAL : {passed_count}/{len(results)} passed | {failed_count} failed | {suite_sec:.2f}s")
  print("=" * 76)

  if args.json_report:
    out_path = Path(args.json_report)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(
            {
                "total": len(results),
                "passed": passed_count,
                "failed": failed_count,
                "duration_sec": round(suite_sec, 3),
                "results": [dataclasses.asdict(r) for r in results],
            },
            indent=2,
        ),
        encoding="utf-8",
    )

  return 0 if failed_count == 0 else 1


if __name__ == "__main__":
  sys.exit(main())
