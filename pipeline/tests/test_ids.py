import pytest

from stilldrawn_web.ids import parse_clip_id


def test_repeat_draw():
    c = parse_clip_id("act-black-1_campush_gen45-r2")
    assert (c.engine, c.arm, c.draw, c.cell) == ("gen4.5", "repeat", "r2", "act-black-1_campush_gen45")
    assert (c.panel, c.motion_class) == ("act-black-1", "CAMPUSH")


def test_primary_draw():
    c = parse_clip_id("cu-line-1_idle_gen4t")
    assert (c.engine, c.arm, c.draw, c.cell) == ("gen4_turbo", "primary", "r1", "cu-line-1_idle_gen4t")


@pytest.mark.parametrize("clip,arm,engine", [
    ("act-black-3_burst_h3-h4", "hazard", "h3-fal"),
    ("act-black-3_burst_sd2-h1", "seedance", "seedance"),
    ("flint-act-line-2--act-tone-3_h3", "flint", "h3-fal"),
    ("ground-cu-line-1-v052_idle_gen45", "ground", "gen4.5"),
    ("est-tone-1_burst_wan22", "primary", "wan22"),
    ("est-tone-1_burst_ltx23", "primary", "ltx23"),
])
def test_arms(clip, arm, engine):
    c = parse_clip_id(clip)
    assert (c.arm, c.engine) == (arm, engine)


def test_flint_pair():
    c = parse_clip_id("flint-act-line-2--act-tone-3_h3")
    assert c.flint_pair == ("act-line-2", "act-tone-3")
    assert (c.panel, c.motion_class) == ("act-line-2", "FLINT")


def test_unknown_suffix_raises():
    with pytest.raises(ValueError):
        parse_clip_id("cu-line-1_idle_sora")
