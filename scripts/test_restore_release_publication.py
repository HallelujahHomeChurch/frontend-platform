import copy
import hashlib
import json
import os
import shutil
from unittest.mock import patch
import importlib.util
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('restore', Path(__file__).with_name('restore-release-publication.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PublicationRecovery(unittest.TestCase):
    def setUp(self):
        self.env = {'GITHUB_REPOSITORY': module.REPO, 'GITHUB_SHA': 'a' * 40, 'GITHUB_RUN_ID': '42',
                    'PREPARED_RUN_ID': '42', 'PREPARED_ATTEMPT': '1', 'VERIFIED_ATTEMPT': '1', 'GITHUB_RUN_ATTEMPT': '2'}
        self.run = {'id': 42, 'head_sha': 'a' * 40, 'event': 'push', 'path': '.github/workflows/release.yml',
                    'head_repository': {'full_name': module.REPO}, 'run_attempt': 2}
        self.identity = module.validate_origin(self.env, self.run)

    def test_same_run_failed_publication_retry_preserves_original_verified_attempt(self):
        self.assertEqual(self.identity['preparedAttempt'], '1')
        self.assertEqual(self.identity['verifiedAttempt'], '1')
        self.assertEqual(self.identity['publicationAttempt'], '2')

    def test_other_run_sha_repo_workflow_or_spoofed_attempt_rejected(self):
        for key, value in [('PREPARED_RUN_ID', '99'), ('VERIFIED_ATTEMPT', '2'), ('PREPARED_ATTEMPT', '3'), ('GITHUB_REPOSITORY', 'other/repo')]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                module.validate_origin({**self.env, key: value}, self.run)
        for key, value in [('head_sha', 'b' * 40), ('event', 'pull_request'), ('path', '.github/workflows/ci.yml'), ('run_attempt', 1)]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                module.validate_origin(self.env, {**self.run, key: value})

    def test_artifact_id_name_digest_run_head_and_expiry_bound(self):
        metadata = {'id': 7, 'name': 'inputs-a-1', 'expired': False, 'digest': 'sha256:' + 'b' * 64,
                    'workflow_run': {'id': 42, 'head_sha': 'a' * 40}}
        self.assertEqual(module.validate_artifact(metadata, '7', 'b' * 64, 'inputs-a-1', self.identity), 'b' * 64)
        for key, value in [('id', 8), ('name', 'inputs-a-2'), ('digest', 'sha256:' + 'c' * 64), ('expired', True), ('workflow_run', {'id': 99, 'head_sha': 'a' * 40})]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                module.validate_artifact({**metadata, key: value}, '7', 'b' * 64, 'inputs-a-1', self.identity)

    def test_archive_digest_and_exact_entry_inventory_checked_before_extraction(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            archive = root / 'inputs.zip'
            with zipfile.ZipFile(archive, 'w') as zipped:
                zipped.writestr('renderer-image.tar', b'verified image')
            digest = hashlib.sha256(archive.read_bytes()).hexdigest()
            module.extract_verified(archive, digest, root / 'restored', ['renderer-image.tar'])
            self.assertEqual((root / 'restored/renderer-image.tar').read_bytes(), b'verified image')
            with self.assertRaises(ValueError):
                module.extract_verified(archive, '0' * 64, root / 'bad', ['renderer-image.tar'])
            self.assertFalse((root / 'bad').exists())
            with self.assertRaises(ValueError):
                module.extract_verified(archive, digest, root / 'bad', ['renderer-workspace.tar'])
            with zipfile.ZipFile(archive, 'w') as zipped:
                zipped.writestr('../outside', 'untrusted')
            with self.assertRaises(ValueError):
                module.extract_verified(archive, module.file_digest(archive), root / 'bad', ['renderer-image.tar'])

    def test_verified_receipts_cannot_be_relabelled_as_newer_checks(self):
        receipt = {'sha': 'a' * 40, 'runId': '42', 'runAttempt': '1', 'mode': 'release'}
        bundle = {'head': 'a' * 40, 'runId': '42', 'runAttempt': '1', 'receipts': [receipt]}
        self.assertEqual(module.verify_receipts(bundle, self.identity), [receipt])
        for key, value in [('runAttempt', '2'), ('runId', '99'), ('head', 'b' * 40), ('receipts', [])]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                module.verify_receipts({**bundle, key: value}, self.identity)
        modified = copy.deepcopy(bundle)
        modified['receipts'][0]['runAttempt'] = '2'
        with self.assertRaises(ValueError):
            module.verify_receipts(modified, self.identity)

    def test_failed_upload_retry_restores_exact_inputs_without_rebuilding(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / 'source'
            source.mkdir()
            receipt = {'sha': 'a' * 40, 'runId': '42', 'runAttempt': '1', 'mode': 'release'}
            bundle = {'head': 'a' * 40, 'runId': '42', 'runAttempt': '1', 'receipts': [receipt]}
            archives, metadata = {}, {}
            for prefix, artifact_id, name, entries in [
                ('INPUT', '7', 'renderer-inputs-' + 'a' * 40 + '-1', {'renderer-workspace.tar': b'workspace', 'renderer-image.tar': b'exact image'}),
                ('RECEIPT', '8', 'renderer-publication-receipts-' + 'a' * 40 + '-1', {'verified-receipts.json': json.dumps(bundle).encode()}),
            ]:
                archive = source / (artifact_id + '.zip')
                with zipfile.ZipFile(archive, 'w') as zipped:
                    for file, content in entries.items():
                        zipped.writestr(file, content)
                digest = module.file_digest(archive)
                self.env[prefix + '_ARTIFACT_ID'] = artifact_id
                self.env[prefix + '_ARTIFACT_DIGEST'] = digest
                archives[artifact_id] = archive
                metadata[artifact_id] = {'id': int(artifact_id), 'name': name, 'expired': False, 'digest': 'sha256:' + digest,
                                         'workflow_run': {'id': 42, 'head_sha': 'a' * 40}}
            self.env.update({'RUNNER_TEMP': str(root / 'runner'), 'WORKSPACE_SHA': hashlib.sha256(b'workspace').hexdigest(), 'IMAGE_SHA': hashlib.sha256(b'exact image').hexdigest()})
            def api(path):
                return self.run if path.startswith('actions/runs/') else metadata[path.rsplit('/', 1)[1]]
            def download(args, stdout, **kwargs):
                with archives[args[-1].split('/')[-2]].open('rb') as src:
                    shutil.copyfileobj(src, stdout)
            previous = Path.cwd()
            os.chdir(root)
            try:
                with patch.object(module, 'api', side_effect=api), patch.object(module.subprocess, 'run', side_effect=download):
                    module.restore(self.env)
                self.assertEqual((root / 'runner/renderer-inputs/renderer-image.tar').read_bytes(), b'exact image')
                proof = json.loads(Path('artifacts/release-evidence/prepared.json').read_text())
                self.assertEqual(proof['artifacts']['input']['id'], '7')
                self.assertEqual(proof['verifiedAttempt'], '1')
                self.assertEqual(proof['publicationAttempt'], '2')
                self.assertEqual(json.loads(Path('renderer-results/0.json').read_text()), receipt)
            finally:
                os.chdir(previous)


if __name__ == '__main__':
    unittest.main()
