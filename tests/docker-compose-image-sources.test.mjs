import assert from 'node:assert/strict';
import test from 'node:test';

import {
  findImageSourceViolations,
  verifyDockerComposeImageSources,
} from '../scripts/verify-docker-compose-image-sources.mjs';

test('rejects Aliyun ACR addresses and deployment instructions', () => {
  assert.deepEqual(
    findImageSourceViolations(
      'Use Alibaba Cloud Container Registry (ACR): registry.cn-hangzhou.aliyuncs.com/hagicode/hagicode:latest',
    ),
    [
      'Aliyun ACR registry address',
      'ACR deployment instruction',
      'Alibaba Cloud container registry instruction',
    ],
  );
  assert.deepEqual(findImageSourceViolations('使用阿里云容器镜像服务部署 HagiCode'), [
    'Aliyun container image registry instruction',
  ]);
});

test('does not treat unrelated Aliyun AI guidance as a container registry instruction', () => {
  assert.deepEqual(
    findImageSourceViolations(
      'Use Alibaba Cloud DashScope at https://coding.dashscope.aliyuncs.com/apps/anthropic.',
    ),
    [],
  );
});

test('maintained Docker Compose installation pages contain Docker Hub-only guidance', async () => {
  const result = await verifyDockerComposeImageSources();

  assert.equal(result.files.length, 10);
  assert.deepEqual(result.violations, []);
});
