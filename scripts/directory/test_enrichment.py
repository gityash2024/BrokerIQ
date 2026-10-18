import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('enrich', Path(__file__).with_name('enrich-public.py'))
enrich = importlib.util.module_from_spec(spec)
spec.loader.exec_module(enrich)

class PublicFormTests(unittest.TestCase):
    def test_only_project_facts_leave_private_cache(self):
        html = '''<table><tr><td>Land area of the project</td><td>2 Acres</td></tr>
        <tr><td>Promoter PAN</td><td>DO-NOT-EXPORT</td></tr></table>
        <table><tr><th>Number of apartments</th><th>Carpet area</th></tr><tr><td>20</td><td>80 sq m</td></tr></table>
        <table><tr><td>Bank account</td><td>DO-NOT-EXPORT</td></tr></table>
        <img src="personal-portrait.jpg"><script>DO-NOT-EXPORT</script>'''
        result = enrich.parse_form(html, 'https://haryanarera.gov.in/view_project/project_preview_open/1')
        self.assertEqual(result['facts'], {'landArea': '2 Acres'})
        self.assertEqual(result['tables'][0]['key'], 'unitMix')
        self.assertNotIn('DO-NOT-EXPORT', str(result))
        self.assertEqual(result['photos'], [])

if __name__ == '__main__': unittest.main()
