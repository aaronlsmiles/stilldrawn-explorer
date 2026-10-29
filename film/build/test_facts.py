"""Facts the films may quote: python3 -m unittest discover -s film/build"""
import unittest

import facts


class Goldens(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.f = facts.build()

    def test_hook_pair(self):
        self.assertEqual((self.f["hook_wan_line"], self.f["hook_g45_line"]), ("0.96", "7.58"))
        self.assertEqual((self.f["hook_wan_flow"], self.f["hook_g45_flow"]), ("0.27", "11.04"))

    def test_interaction_clip(self):
        self.assertEqual((self.f["pick_line"], self.f["pick_wan_line"]), ("7.89", "0.17"))

    def test_engine_level(self):
        self.assertEqual((self.f["rho"], self.f["p_exact"], self.f["n_engines"]), ("0.90", "0.083", "5"))

    def test_crossovers(self):
        self.assertEqual((self.f["x_ltx"], self.f["x_g45"]), ("1.23", "1.27"))

    def test_human_check(self):
        self.assertEqual((self.f["alpha_register"], self.f["alpha_sameness"]), ("0.21", "0.48"))
        self.assertEqual((self.f["n_raters"], self.f["n_study_clips"], self.f["session_size"]), ("6", "20", "8"))

    def test_doi(self):
        self.assertEqual(self.f["doi"], "10.5281/zenodo.23072784")


class CheckCaption(unittest.TestCase):
    def setUp(self):
        self.f = facts.build()

    def test_accepts_facts_and_names(self):
        facts.check_caption("Wan 2.2 drifts 0.96 px; Gen-4.5 drifts 7.58 px.", self.f)
        facts.check_caption("Data CC BY 4.0, Aaron Smiles 2026", self.f)
        facts.check_caption("LTX-2.3 and Gen-4 Turbo; H3", self.f)
        facts.check_caption("Line drift from frame 0; at price 0, Wan 2.2 leads (A6).", self.f)

    def test_rejects_unknown_figure(self):
        with self.assertRaises(ValueError):
            facts.check_caption("Gen-4.5 drifts 9.9 px.", self.f)

    def test_rejects_altered_precision(self):
        with self.assertRaises(ValueError):
            facts.check_caption("Wan 2.2 drifts 0.962 px.", self.f)


if __name__ == "__main__":
    unittest.main()
