#!/usr/bin/env python3
"""Restore only this run's verified publication inputs, including failed-job retries."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import zipfile

REPO = 'HallelujahHomeChurch/frontend-platform'
HASH = re.compile(r'^[a-f0-9]{64}$')
SHA = re.compile(r'^[a-f0-9]{40}$')


def validate_origin(env, run):
    head, run_id = env['GITHUB_SHA'], env['GITHUB_RUN_ID']
    if not SHA.fullmatch(head) or env['GITHUB_REPOSITORY'] != REPO:
        raise ValueError('invalid publication identity')
    prepared, verified, current = (int(env[k]) for k in ['PREPARED_ATTEMPT', 'VERIFIED_ATTEMPT', 'GITHUB_RUN_ATTEMPT'])
    if env['PREPARED_RUN_ID'] != run_id or not 1 <= prepared == verified <= current:
        raise ValueError('untrusted preparation attempt')
    if (str(run['id']) != run_id or run['head_sha'] != head or run['event'] != 'push'
            or run['path'] != '.github/workflows/release.yml'
            or run['head_repository']['full_name'] != REPO or run['run_attempt'] != current):
        raise ValueError('untrusted publication run')
    return {'head': head, 'runId': run_id, 'preparedAttempt': str(prepared), 'verifiedAttempt': str(verified), 'publicationAttempt': str(current)}


def validate_artifact(metadata, artifact_id, expected_digest, name, identity):
    expected_digest = expected_digest.removeprefix('sha256:')
    if not HASH.fullmatch(expected_digest):
        raise ValueError('invalid prepared artifact digest')
    if (str(metadata['id']) != artifact_id or metadata['name'] != name or metadata['expired']
            or metadata['digest'] != f'sha256:{expected_digest}'
            or str(metadata['workflow_run']['id']) != identity['runId']
            or metadata['workflow_run']['head_sha'] != identity['head']):
        raise ValueError('prepared artifact metadata mismatch')
    return expected_digest


def file_digest(path):
    value = hashlib.sha256()
    with open(path, 'rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def extract_verified(archive, expected_digest, destination, names):
    if file_digest(archive) != expected_digest:
        raise ValueError('prepared artifact archive digest mismatch')
    with zipfile.ZipFile(archive) as zipped:
        if sorted(zipped.namelist()) != sorted(names) or any((x.external_attr >> 16) & 0o170000 == 0o120000 for x in zipped.infolist()):
            raise ValueError('unexpected publication archive entries')
        for name in names:
            zipped.extract(name, destination)


def verify_receipts(bundle, identity):
    if (bundle.get('head') != identity['head'] or str(bundle.get('runId')) != identity['runId']
            or str(bundle.get('runAttempt')) != identity['verifiedAttempt']):
        raise ValueError('receipt bundle identity mismatch')
    receipts = bundle.get('receipts')
    if not isinstance(receipts, list) or not receipts:
        raise ValueError('receipt bundle missing')
    for receipt in receipts:
        if (receipt.get('sha') != identity['head'] or str(receipt.get('runId')) != identity['runId']
                or str(receipt.get('runAttempt')) != identity['verifiedAttempt'] or receipt.get('mode') != 'release'):
            raise ValueError('receipt origin mismatch')
    return receipts


def api(path):
    return json.loads(subprocess.check_output(['gh', 'api', f'repos/{REPO}/{path}'], stderr=subprocess.DEVNULL, timeout=45))


def restore(env=os.environ):
    identity = validate_origin(env, api(f"actions/runs/{env['GITHUB_RUN_ID']}"))
    destination = Path(env['RUNNER_TEMP']) / 'renderer-inputs'
    destination.mkdir(parents=True, exist_ok=True)
    for prefix, name, files in [
        ('INPUT', f"renderer-inputs-{identity['head']}-{identity['preparedAttempt']}", ['renderer-workspace.tar', 'renderer-image.tar']),
        ('RECEIPT', f"renderer-publication-receipts-{identity['head']}-{identity['verifiedAttempt']}", ['verified-receipts.json']),
    ]:
        artifact_id = env[f'{prefix}_ARTIFACT_ID']
        if not re.fullmatch(r'[1-9][0-9]*', artifact_id):
            raise ValueError('invalid artifact identity')
        metadata = api(f'actions/artifacts/{artifact_id}')
        digest = validate_artifact(metadata, artifact_id, env[f'{prefix}_ARTIFACT_DIGEST'], name, identity)
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary) / 'artifact.zip'
            with archive.open('wb') as target:
                subprocess.run(['gh', 'api', f'repos/{REPO}/actions/artifacts/{artifact_id}/zip'], stdout=target,
                               stderr=subprocess.DEVNULL, check=True, timeout=300)
            extract_verified(archive, digest, destination, files)
    for file, variable in [('renderer-workspace.tar', 'WORKSPACE_SHA'), ('renderer-image.tar', 'IMAGE_SHA')]:
        if not HASH.fullmatch(env[variable]):
            raise ValueError('prepared input content digest mismatch')
    receipts = verify_receipts(json.loads((destination / 'verified-receipts.json').read_text()), identity)
    results = Path('renderer-results')
    results.mkdir(exist_ok=False)
    for index, receipt in enumerate(receipts):
        (results / f'{index}.json').write_text(json.dumps(receipt))
    Path('artifacts/release-evidence').mkdir(parents=True, exist_ok=True)
    identity['artifacts'] = {prefix.lower(): {'id': env[f'{prefix}_ARTIFACT_ID'], 'digest': env[f'{prefix}_ARTIFACT_DIGEST']} for prefix in ['INPUT', 'RECEIPT']}
    identity['contentDigests'] = {'workspace': env['WORKSPACE_SHA'], 'image': env['IMAGE_SHA']}
    Path('artifacts/release-evidence/prepared.json').write_text(json.dumps(identity))
    print('Exact prepared image, workspace and verification receipts restored')


if __name__ == '__main__':
    try:
        restore()
    except Exception:
        raise SystemExit('Publication inputs could not be verified; no registry write is permitted')
