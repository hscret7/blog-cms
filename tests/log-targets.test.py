import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('log_targets', Path(__file__).resolve().parents[1] / 'scripts/prepare-log-targets.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class TargetIsolationTest(unittest.TestCase):
    def setUp(self):
        self.ids = [str(i) * 64 for i in range(1, 5)]
        self.records = {cid: ({'com.docker.compose.project': 'blog-cms', 'com.docker.compose.service': service},
                              '/var/lib/docker/containers/' + cid + '/' + cid + '-json.log', 'json-file')
                        for cid, service in zip(self.ids, module.SERVICES)}

    def build(self):
        return module.build_targets(self.ids, self.records.__getitem__, '/var/lib/docker')

    def test_exact_container_paths_no_wildcard(self):
        rows = self.build()
        self.assertEqual({r['labels']['service'] for r in rows}, set(module.SERVICES))
        self.assertTrue(all('*' not in r['labels']['__path__'] for r in rows))
        self.assertTrue(all(r['labels']['project'] == 'blog-cms' for r in rows))

    def test_foreign_project_is_rejected(self):
        self.records[self.ids[-1]][0]['com.docker.compose.project'] = 'wordpress-monitoring'
        with self.assertRaises(ValueError):
            self.build()

    def test_foreign_service_is_rejected(self):
        self.records[self.ids[0]][0]['com.docker.compose.service'] = 'grafana'
        with self.assertRaises(ValueError):
            self.build()

    def test_driver_mismatch_is_rejected(self):
        cid = self.ids[0]
        labels, log_path, _ = self.records[cid]
        self.records[cid] = labels, log_path, 'local'
        with self.assertRaises(ValueError):
            self.build()

    def test_path_outside_docker_root_is_rejected(self):
        cid = self.ids[0]
        labels, _, driver = self.records[cid]
        self.records[cid] = labels, '/etc/passwd', driver
        with self.assertRaises(ValueError):
            self.build()

    def test_missing_service_is_rejected(self):
        self.ids.pop()
        with self.assertRaises(ValueError):
            self.build()

    def test_invalid_container_id_is_rejected(self):
        self.ids[0] = '../foreign'
        with self.assertRaises(ValueError):
            self.build()

    def test_custom_docker_root_maps_to_readonly_mount(self):
        custom = '/srv/docker'
        metadata = lambda cid: (self.records[cid][0], custom + '/containers/' + cid + '/' + cid + '-json.log', 'json-file')
        rows = module.build_targets(self.ids, metadata, custom)
        self.assertTrue(all(r['labels']['__path__'].startswith('/var/log/docker/') for r in rows))


if __name__ == '__main__':
    unittest.main()
