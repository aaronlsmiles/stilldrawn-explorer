"""The five frozen headline scalars, exactly as analysis/build_table.py defines them.

Lower is "more stable" for every one of them.
"""

HEADLINE_KEYS = ("line", "tone", "edge", "style", "closure")
# build_table.py column names, for joining against results_table.csv
TABLE_COLUMNS = {
    "line": "line_chamfer_mean_px",
    "tone": "tone_variance",
    "edge": "edge_abs_slope",
    "style": "style_terminal",
    "closure": "closure_abs_terminal",
}


def headlines(metrics_json: dict) -> dict:
    m = metrics_json["metrics"]
    style = m["style_drift"]
    if "error" in style:
        style = {}
    return {
        "line": m["line_drift"]["vs_frame0"]["chamfer_px"]["mean"],
        "tone": m["tone_spectral_drift"].get("variance"),
        "edge": m["edge_decay"]["abs_slope_norm"],
        "style": style.get("terminal"),
        "closure": abs(m["closure_proxy"]["drift_terminal"]),
    }
