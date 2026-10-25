import copy
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

spec = importlib.util.spec_from_file_location('checkpoint', Path(__file__).with_name('renderer-checkpoint.py'))
checkpoint = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checkpoint)


class CheckpointTests(unittest.TestCase):
    def setUp(self):
        self.run = dict(id=123, run_attempt=2, updated_at='2026-10-25T00:00:00Z', head_sha='a' * 40, event='push', status='completed',
                        conclusion='success', path='.github/workflows/release.yml', head_repository={'full_name': checkpoint.REPO})
        self.full = {'container/' + v: dict(runtime='b' * 64, verification='c' * 64, head='a' * 40, runId='123', runAttempt='2')
                     for v in ['default', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10', 'v11']}

    def response(self, data, names=None):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w') as z:
            for name in names or ['checkpoint.json']:
                z.writestr(name, json.dumps(data))
        archive = buffer.getvalue()
        artifact = dict(id=99, name='renderer-release-evidence-123-2', expired=False, size_in_bytes=len(archive),
                        digest='sha256:' + hashlib.sha256(archive).hexdigest())
        return artifact, archive

    def test_only_trusted_successful_release_is_evidence(self):
        self.assertTrue(checkpoint.trusted_run(self.run))
        for key, value in [('event', 'pull_request'), ('status', 'in_progress'), ('conclusion', 'failure'),
                           ('path', '.github/workflows/ci.yml'), ('head_repository', {'full_name': 'other/repo'})]:
            with self.subTest(key=key):
                self.assertFalse(checkpoint.trusted_run({**self.run, key: value}))

    def test_archive_digest_coverage_and_identity(self):
        good = dict(schema=1, head='a' * 40, runId='123', runAttempt='2', full=self.full)
        for mutate in [None, lambda d: d.update(head='d' * 40), lambda d: d.update(runAttempt='1'),
                       lambda d: d['full'].pop('container/v10'), lambda d: d['full']['container/v10'].update(runtime='bad')]:
            data = copy.deepcopy(good)
            if mutate:
                mutate(data)
            artifact, archive = self.response(data)
            with patch.object(checkpoint, 'api', side_effect=[{'artifacts': [artifact]}, archive]):
                if mutate:
                    with self.assertRaises(ValueError):
                        checkpoint.evidence(self.run)
                else:
                    self.assertEqual(checkpoint.evidence(self.run), good)
        for names in [['../checkpoint.json'], ['checkpoint.json', 'extra']]:
            artifact, archive = self.response(good, names)
            with patch.object(checkpoint, 'api', side_effect=[{'artifacts': [artifact]}, archive]):
                with self.assertRaises(ValueError):
                    checkpoint.evidence(self.run)
        artifact, archive = self.response(good)
        artifact['digest'] = 'sha256:' + '0' * 64
        with patch.object(checkpoint, 'api', side_effect=[{'artifacts': [artifact]}, archive]):
            with self.assertRaises(ValueError):
                checkpoint.evidence(self.run)

    def test_release_history_is_paginated(self):
        with patch.object(checkpoint, 'api', side_effect=[{'workflow_runs': [self.run] * 100}, {'workflow_runs': [self.run]}]) as api:
            self.assertEqual(len(checkpoint.release_runs('completed')), 101)
            self.assertIn('page=2', api.call_args.args[0])

    def test_restore_requires_original_full_evidence_and_ancestor(self):
        good = dict(schema=1, head='a' * 40, runId='123', runAttempt='2', full=self.full)
        old_cwd = os.getcwd()
        try:
            with tempfile.TemporaryDirectory() as directory:
                os.chdir(directory)
                for mismatch in [False, True]:
                    origin = copy.deepcopy(good)
                    if mismatch:
                        origin['full']['container/v10']['runId'] = '122'
                    with patch.object(checkpoint, 'release_runs', return_value=[self.run]), \
                         patch.object(checkpoint, 'api', return_value=self.run), \
                         patch.object(checkpoint, 'evidence', side_effect=[good, origin]), \
                         patch.object(checkpoint.subprocess, 'run') as git:
                        if mismatch:
                            with self.assertRaises(ValueError):
                                checkpoint.restore()
                            self.assertFalse(Path('artifacts/renderer-checkpoint/checkpoint.json').exists())
                        else:
                            checkpoint.restore()
                            self.assertEqual(json.loads(Path('artifacts/renderer-checkpoint/checkpoint.json').read_text()), good)
                            git.assert_called_once_with(['git', 'merge-base', '--is-ancestor', 'a' * 40, 'HEAD'], check=True, capture_output=True)
        finally:
            os.chdir(old_cwd)


if __name__ == '__main__':
    unittest.main()
