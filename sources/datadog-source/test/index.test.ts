import {v2} from '@datadog/datadog-api-client';
import {
  AirbyteLogger,
  AirbyteLogLevel,
  AirbyteSpec,
  SyncMode,
} from 'faros-airbyte-cdk';
import fs from 'fs-extra';
import {VError} from 'verror';

import {Datadog, DatadogClient, DatadogConfig} from '../src/datadog';
import * as sut from '../src/index';

function readResourceFile(fileName: string): any {
  return JSON.parse(fs.readFileSync(`resources/${fileName}`, 'utf8'));
}

function readTestResourceFile(fileName: string): any {
  return JSON.parse(fs.readFileSync(`test_files/${fileName}`, 'utf8'));
}

describe('index', () => {
  const logger = new AirbyteLogger(
    // Shush messages in tests, unless in debug
    process.env.LOG_LEVEL === 'debug'
      ? AirbyteLogLevel.DEBUG
      : AirbyteLogLevel.FATAL
  );

  test('spec', async () => {
    const source = new sut.DatadogSource(logger);
    await expect(source.spec()).resolves.toStrictEqual(
      new AirbyteSpec(readResourceFile('spec.json'))
    );
  });

  test('check connection bad token', async () => {
    const source = new sut.DatadogSource(logger);
    const expectedError = new VError('Bad Connection');
    Datadog.instance = jest.fn().mockReturnValue({
      checkConnection: jest.fn().mockRejectedValue(expectedError),
    });
    await expect(
      source.checkConnection({
        apiKey: 'bad',
        applicationKey: 'bad',
      })
    ).resolves.toStrictEqual([false, expectedError]);
  });

  test('check connection good token', async () => {
    const source = new sut.DatadogSource(logger);
    Datadog.instance = jest.fn().mockReturnValue({
      checkConnection: jest.fn().mockResolvedValue({}),
    });
    await expect(
      source.checkConnection({apiKey: 'good', applicationKey: 'good'})
    ).resolves.toStrictEqual([true, undefined]);
  });

  test('streams - incidents, use full_refresh sync mode', async () => {
    const incidents = readTestResourceFile('incidents.json');
    Datadog.instance = jest.fn().mockReturnValue(
      new Datadog(
        {
          incidents: {
            listIncidents: jest.fn().mockReturnValue(incidents),
          } as unknown as v2.IncidentsApi,
        } as DatadogClient,
        {page_size: 10} as DatadogConfig,
        logger
      )
    );

    const source = new sut.DatadogSource(logger);
    const streams = source.streams({
      apiKey: '',
      applicationKey: '',
    });
    const stream = streams[0];
    const itemIter = stream.readRecords(SyncMode.FULL_REFRESH);
    const items = [];
    for await (const item of itemIter) {
      items.push(item);
    }
    expect(items).toStrictEqual(incidents.data);
  });

  test('streams - incidents, use incremental sync mode', async () => {
    const incidents = readTestResourceFile('incidents.json');
    Datadog.instance = jest.fn().mockReturnValue(
      new Datadog(
        {
          incidents: {
            listIncidents: jest.fn().mockReturnValue(incidents),
          } as unknown as v2.IncidentsApi,
        } as DatadogClient,
        {} as DatadogConfig,
        logger
      )
    );

    const source = new sut.DatadogSource(logger);
    const streams = source.streams({
      apiKey: '',
      applicationKey: '',
    });
    const stream = streams[0];
    const itemIter = stream.readRecords(
      SyncMode.INCREMENTAL,
      undefined,
      undefined,
      {lastModified: '2022-02-27T21:00:44.706Z'}
    );
    const items = [];
    for await (const item of itemIter) {
      items.push(item);
    }
    expect(items).toStrictEqual([incidents.data[1]]);
  });

  test('streams - users, use full_refresh sync mode', async () => {
    const users = readTestResourceFile('users.json');
    Datadog.instance = jest.fn().mockReturnValue(
      new Datadog(
        {
          users: {
            listUsers: jest.fn().mockReturnValue(users),
          } as unknown as v2.UsersApi,
        } as DatadogClient,
        {} as DatadogConfig,
        logger
      )
    );

    const source = new sut.DatadogSource(logger);
    const streams = source.streams({
      apiKey: '',
      applicationKey: '',
    });
    const stream = streams[1];
    const itemIter = stream.readRecords(SyncMode.FULL_REFRESH);
    const items = [];
    for await (const item of itemIter) {
      items.push(item);
    }
    expect(items).toStrictEqual(users.data);
  });

  test('streams - users, use incremental sync mode', async () => {
    const users = readTestResourceFile('users.json');
    Datadog.instance = jest.fn().mockReturnValue(
      new Datadog(
        {
          users: {
            listUsers: jest.fn().mockReturnValue(users),
          } as unknown as v2.UsersApi,
        } as DatadogClient,
        {} as DatadogConfig,
        logger
      )
    );

    const source = new sut.DatadogSource(logger);
    const streams = source.streams({
      apiKey: '',
      applicationKey: '',
    });
    const stream = streams[1];
    const itemIter = stream.readRecords(
      SyncMode.INCREMENTAL,
      undefined,
      undefined,
      {lastModifiedAt: '2022-02-27T21:00:44.706Z'}
    );
    const items = [];
    for await (const item of itemIter) {
      items.push(item);
    }
    expect(items).toStrictEqual([users.data[1]]);
  });
});
