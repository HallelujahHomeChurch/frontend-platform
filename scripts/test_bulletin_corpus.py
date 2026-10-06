import unittest

from generate_bulletin_corpus import sanitize_character, font_role, source_tracking


class CorpusPrivacyTests(unittest.TestCase):
    def test_no_source_characters_or_proprietary_font_names_survive(self):
        chars = [('私', 14), ('密', 14), ('R', 9), ('a', 7), ('y', 7), ('3', 7)]
        value = ''.join(sanitize_character({'text': text, 'adv': advance, 'size': 14}) for text, advance in chars)
        self.assertEqual(value, '測測aaa0')
        self.assertNotIn('私密', value)
        self.assertEqual(font_role('BCDEEE+DFXingShu-Bd-HK-BF'), 'emphasis')
        self.assertEqual(font_role('BCEEEE+DFGirl-W5-HK-BF'), 'emphasis')
        self.assertEqual(font_role('BCEEEE+DFKaiShu-SB-Estd-BF'), 'scripture')
        self.assertEqual(font_role('BCEEEE+PMingLiU'), 'body')

    def test_source_tracking_is_explicit_not_an_edit_fit_algorithm(self):
        chars = [{'size': 10, 'x0': 0, 'x1': 10}, {'size': 10, 'x0': 8, 'x1': 18}]
        self.assertEqual(source_tracking(chars), -.2)


if __name__ == '__main__':
    unittest.main()
