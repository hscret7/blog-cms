#!/usr/bin/env python3
"""Discover only this Compose project's application logs; never read container env."""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SERVICES = ('app', 'nginx', 'mysql', 'phpmyadmin')


def run(args):
    return subprocess.check_output(args, cwd=PROJECT_ROOT, text=True).strip()


def build_targets(container_ids, metadata, docker_root):
    expected_root = Path(docker_root) / 'containers'
    targets = []
    project = None
    seen = set()
    for container_id in container_ids:
        if not re.fullmatch(r'[a-f0-9]{64}', container_id):
            raise ValueError('ID container không hợp lệ.')
        labels, log_path, driver = metadata(container_id)
        service = labels.get('com.docker.compose.service')
        compose_project = labels.get('com.docker.compose.project')
        if service not in SERVICES or not compose_project:
            raise ValueError('Container không thuộc nhóm dịch vụ đã cho phép.')
        if project is None:
            project = compose_project
        if compose_project != project:
            raise ValueError('Không được trộn log giữa các Compose project.')
        if driver != 'json-file':
            raise ValueError(f'{service}: cần logging driver json-file.')
        expected = expected_root / container_id / (container_id + '-json.log')
        if Path(log_path) != expected:
            raise ValueError(f'{service}: đường dẫn log khác Docker Root Dir.')
        targets.append({'targets': ['localhost'], 'labels': {
            'job': 'blog-cms-containers', 'project': 'blog-cms',
            'service': service, 'environment': 'local',
            '__path__': '/var/log/docker/' + container_id + '/' + container_id + '-json.log'
        }})
        seen.add(service)
    missing = set(SERVICES) - seen
    if missing:
        raise ValueError('Thiếu container: ' + ', '.join(sorted(missing)) + '. Hãy khởi động các dịch vụ trước.')
    return targets


def main():
    ids = run(['docker', 'compose', 'ps', '--all', '--quiet', *SERVICES]).splitlines()
    if not ids:
        raise ValueError('Chưa tìm thấy container trong Compose project hiện tại.')
    docker_root = run(['docker', 'info', '--format', '{{.DockerRootDir}}'])

    def metadata(container_id):
        # Only labels, log path and log driver; no full docker inspect/config/env.
        raw = run(['docker', 'inspect', '--format',
                   '{{json .Config.Labels}}\t{{.LogPath}}\t{{.HostConfig.LogConfig.Type}}', container_id])
        labels, log_path, driver = raw.split('\t')
        return json.loads(labels), log_path, driver

    targets = build_targets(ids, metadata, docker_root)
    directory = PROJECT_ROOT / 'runtime' / 'promtail-targets'
    directory.mkdir(parents=True, exist_ok=True)
    # Mount the directory so atomic replacement is visible to Promtail file discovery.
    os.chmod(directory, 0o755)
    temp = directory / 'containers.json.tmp'
    temp.write_text(json.dumps(targets, ensure_ascii=False, indent=2) + '\n')
    os.chmod(temp, 0o644)
    temp.replace(directory / 'containers.json')
    print('PASS: Đã tạo danh sách nguồn log: ' + ', '.join(SERVICES))
    print('Docker log root thực tế: ' + str(Path(docker_root) / 'containers'))
    print('Nếu khác /var/lib/docker/containers, đặt DOCKER_LOG_ROOT trong .env theo đường dẫn trên.')
    print('Chạy lại script sau khi tạo lại container app/nginx/mysql/phpmyadmin.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, subprocess.CalledProcessError, OSError) as error:
        print('Không tạo được nguồn log: ' + str(error), file=sys.stderr)
        sys.exit(1)
