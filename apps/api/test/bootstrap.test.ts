import 'reflect-metadata';

import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';

import { Controller, Get, Module, UnauthorizedException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { configureApp } from '../src/app.setup';

@Controller()
class ProbeController {
  @Get('probe')
  getProbe() {
    return { ok: true };
  }

  @Get('fail')
  fail() {
    throw new UnauthorizedException({
      code: 'UNAUTHORIZED',
      message: 'Missing or invalid JWT',
    });
  }
}

@Module({
  controllers: [ProbeController],
})
class ProbeModule {}

test('configureApp applies the v1 prefix and standard response envelopes', async () => {
  const app = await NestFactory.create(ProbeModule, {
    logger: false,
  });

  configureApp(app);
  await app.listen(0);

  const { port } = app.getHttpServer().address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const unprefixedResponse = await fetch(`${baseUrl}/probe`);
    assert.equal(unprefixedResponse.status, 404);

    const successResponse = await fetch(`${baseUrl}/v1/probe`);
    assert.equal(successResponse.status, 200);
    assert.deepEqual(await successResponse.json(), {
      data: { ok: true },
      meta: {},
      error: null,
    });

    const errorResponse = await fetch(`${baseUrl}/v1/fail`);
    assert.equal(errorResponse.status, 401);
    assert.deepEqual(await errorResponse.json(), {
      data: null,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid JWT',
        statusCode: 401,
      },
    });
  } finally {
    await app.close();
  }
});
