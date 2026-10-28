import re
import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).parent

class IdParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'):
            self.ids.append(attrs['id'])

class ToolkitStaticTests(unittest.TestCase):
    def setUp(self):
        self.html = (ROOT / 'index.html').read_text(encoding='utf-8')
        self.personal = (ROOT / 'js' / 'personal-support.js').read_text(encoding='utf-8')
        self.auth = (ROOT / 'js' / 'index-auth.js').read_text(encoding='utf-8')

    def test_unique_html_ids(self):
        parser = IdParser(); parser.feed(self.html)
        duplicates = sorted({value for value in parser.ids if parser.ids.count(value) > 1})
        self.assertEqual(duplicates, [])

    def test_backup_selectors_exist(self):
        required = ['backup-manager', 'backup-heading', 'backup-table-body', 'backup-feedback', 'import-backup-file', 'create-backup-button']
        for element_id in required:
            self.assertIn(f'id="{element_id}"', self.html)

    def test_personal_query_selectors_exist(self):
        ids = set(re.findall(r'querySelector\("#([A-Za-z0-9_-]+)', self.personal))
        missing = sorted(value for value in ids if f'id="{value}"' not in self.html)
        self.assertEqual(missing, [])

    def test_auth_loads_personal_only_after_toolkit(self):
        toolkit_position = self.auth.find('import(scriptUrl.href)')
        personal_position = self.auth.find('PERSONAL_SUPPORT_SCRIPT_URL.href')
        self.assertGreater(toolkit_position, -1)
        self.assertGreater(personal_position, toolkit_position)
        self.assertIn('personal-support.js?v=', self.auth)
        self.assertIn('script.js?v=', self.auth)
        self.assertNotIn('toolkit-data.js', self.auth)
        self.assertNotIn('localStorage', self.auth)

    def test_no_local_storage_to_supabase_auth(self):
        auth_files = ['js/auth.js', 'js/login.js', 'js/index-auth.js']
        for filename in auth_files:
            content = (ROOT / filename).read_text(encoding='utf-8')
            self.assertNotIn('networkToolkitData', content)
            self.assertNotIn('localStorage.setItem', content)

    def test_backup_validation_and_restore_paths(self):
        self.assertIn('validateToolkitData', self.personal)
        self.assertIn('function restoreBackup', self.personal)
        self.assertIn('createBackupEnvelope', self.personal)
        self.assertIn('from "./toolkit-data.js"', self.personal)
        self.assertIn('previousRaw = localStorage.getItem(STORAGE_KEY)', self.personal)
        self.assertIn('restore verification failed', self.personal)

    def test_consolidated_case_and_inventory_controls(self):
        self.assertNotIn('id="saved-cases"', self.html)
        self.assertIn('เพิ่มผลตรวจเข้ารายการเคส', self.html)
        self.assertIn('id="daily-report-open">ไปยังรายงานประจำวัน', self.html)
        self.assertNotIn('id="network-info-form"', self.html)
        self.assertNotIn('id="device-info"', self.html)
        self.assertNotIn('id="checklist"', self.html)
        self.assertNotIn('id="notes-section"', self.html)
        self.assertIn('toolkit:create-case', self.personal)
        self.assertIn('toolkit:add-inventory', self.personal)
        self.assertIn('symptomDetail', (ROOT / 'script.js').read_text(encoding='utf-8'))
        self.assertIn('resolution:', (ROOT / 'script.js').read_text(encoding='utf-8'))

    def test_cache_versions(self):
        html = self.html
        auth = self.auth
        self.assertIn('style.css?v=', html)
        self.assertIn('js/index-auth.js?v=', html)
        self.assertIn('script.js?v=', auth)
        self.assertIn('personal-support.js?v=', auth)
        self.assertIn('../script.js?v=5', auth)
        self.assertIn('./personal-support.js?v=3', auth)

    def test_no_service_role_or_secret_keys(self):
        text = '\n'.join((ROOT / file).read_text(encoding='utf-8', errors='ignore') for file in ['js/supabase-config.js', 'js/auth.js', 'js/login.js'])
        lowered = text.lower()
        self.assertNotIn('service_role', lowered)
        self.assertNotIn('service-role', lowered)
        self.assertNotIn('password = "', lowered)

if __name__ == '__main__':
    unittest.main()
