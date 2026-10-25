#!/usr/bin/env python3
"""Read only release evidence from successful trusted workflow runs; uncertainty runs full."""
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import zipfile

REPO = 'HallelujahHomeChurch/frontend-platform'
SHA = re.compile(r'^[a-f0-9]{40}$')
HASH = re.compile(r'^[a-f0-9]{64}$')


def api(path, raw=False):
    result = subprocess.check_output(['gh', 'api', f'repos/{REPO}/{path}'], stderr=subprocess.DEVNULL, timeout=45)
    return result if raw else json.loads(result)


def trusted_run(run):
    return (run.get('status') == 'completed' and run.get('conclusion') == 'success'
            and run.get('event') == 'push' and run.get('path') == '.github/workflows/release.yml'
            and run.get('head_repository', {}).get('full_name') == REPO
            and SHA.fullmatch(run.get('head_sha', '')) is not None)


def release_runs(status):
    runs, page = [], 1
    while True:
        batch = api(f'actions/workflows/release.yml/runs?event=push&status={status}&per_page=100&page={page}')['workflow_runs']
        runs.extend(batch)
        if len(batch) < 100:
            return runs
        page += 1


def evidence(run):
    if not trusted_run(run):
        raise ValueError('untrusted release run')
    run_id, attempt = run['id'], run['run_attempt']
    artifacts = api(f'actions/runs/{run_id}/artifacts?per_page=100')['artifacts']
    matches = [a for a in artifacts if a['name'] == f'renderer-release-evidence-{run_id}-{attempt}' and not a['expired']]
    if len(matches) != 1 or matches[0]['size_in_bytes'] > 1024 * 1024:
        raise ValueError('missing or oversized release evidence')
    artifact = matches[0]
    archive = api(f"actions/artifacts/{artifact['id']}/zip", raw=True)
    if len(archive) > 1024 * 1024 or artifact.get('digest') != 'sha256:' + hashlib.sha256(archive).hexdigest():
        raise ValueError('release evidence digest mismatch')
    with zipfile.ZipFile(io.BytesIO(archive)) as z:
        if z.namelist() != ['checkpoint.json'] or z.getinfo('checkpoint.json').file_size > 512 * 1024:
            raise ValueError('invalid release archive')
        result = json.loads(z.read('checkpoint.json'))
    if (result.get('schema') != 1 or result.get('head') != run['head_sha']
            or str(result.get('runId')) != str(run_id) or str(result.get('runAttempt')) != str(attempt)):
        raise ValueError('release evidence identity mismatch')
    expected = {'container/' + v for v in ['default', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10']}
    if set(result.get('full', {})) != expected:
        raise ValueError('release evidence coverage mismatch')
    for entry in result['full'].values():
        if not HASH.fullmatch(entry.get('runtime', '')) or not HASH.fullmatch(entry.get('verification', '')):
            raise ValueError('invalid evidence fingerprints')
        if not re.fullmatch(r'[1-9][0-9]*', str(entry.get('runId', ''))) or not SHA.fullmatch(entry.get('head', '')):
            raise ValueError('invalid full evidence origin')
    return result


def restore():
    target = Path('artifacts/renderer-checkpoint/checkpoint.json')
    target.unlink(missing_ok=True)
    runs = release_runs('completed')
    runs = [r for r in runs if str(r['id']) != os.environ.get('GITHUB_RUN_ID')]
    if not runs:
        raise ValueError('first release')
    # Latest completed attempt matters; never silently use an older artifact after a failed publication.
    run = max(runs, key=lambda r: r['updated_at'])
    checkpoint = evidence(run)
    origins = {}
    for command, entry in checkpoint['full'].items():
        origin_id = str(entry['runId'])
        if origin_id not in origins:
            origins[origin_id] = evidence(api(f'actions/runs/{origin_id}'))
        original = origins[origin_id]['full'][command]
        if original != entry or str(original['runId']) != origin_id:
            raise ValueError('full evidence is missing or was only smoke')
    subprocess.run(['git', 'merge-base', '--is-ancestor', checkpoint['head'], 'HEAD'], check=True, capture_output=True)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(checkpoint))
    print('Trusted release checkpoint restored')


if __name__ == '__main__':
    if sys.argv[1:] == ['guard']:
        runs = release_runs('success')
        for run in runs:
            if str(run['id']) != os.environ.get('GITHUB_RUN_ID') and trusted_run(run):
                subprocess.run(['git', 'merge-base', '--is-ancestor', run['head_sha'], 'HEAD'], check=True)
        sys.exit(0)
    try:
        restore()
    except (KeyError, ValueError, TypeError, OSError, subprocess.SubprocessError, zipfile.BadZipFile):
        print('No usable trusted release checkpoint; release verification will run in full')
