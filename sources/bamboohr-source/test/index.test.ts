import axios from 'axios';
import {
  AirbyteLogger,
  AirbyteLogLevel,
  AirbyteSpec,
  SyncMode,
} from 'faros-airbyte-cdk';
import fs from 'fs-extra';
import {VError} from 'verror';

import {BambooHR} from '../src/bamboohr';
import * as sut from '../src/index';

const bambooHRInstance = BambooHR.instance;

jest.mock('axios');

describe('index', () => {
  const logger = new AirbyteLogger(
    // Shush messages in tests, unless in debug
    process.env.LOG_LEVEL === 'debug'
      ? AirbyteLogLevel.DEBUG
      : AirbyteLogLevel.FATAL
  );

  beforeEach(() => {
    BambooHR.instance = bambooHRInstance;
  });

  function readResourceFile(fileName: string): any {
    return JSON.parse(fs.readFileSync(`resources/${fileName}`, 'utf8'));
  }

  function readTestResourceFile(fileName: string): any {
    return JSON.parse(fs.readFileSync(`test_files/${fileName}`, 'utf8'));
  }

  test('spec', async () => {
    const source = new sut.BambooHRSource(logger);
    await expect(source.spec()).resolves.toStrictEqual(
      new AirbyteSpec(readResourceFile('spec.json'))
    );
  });

  test('check connection - no client_secret', async () => {
    const source = new sut.BambooHRSource(logger);
    await expect(
      source.checkConnection({
        client_id: 'client_id',
        tenant_id: 'tenant_id',
      } as any)
    ).resolves.toStrictEqual([
      false,
      new VError('client_secret must be a not empty string'),
    ]);
  });

  test('streams - users, use full_refresh sync mode', async () => {
    const fnUsersFunc = jest.fn();

    BambooHR.instance = jest.fn().mockImplementation(() => {
      const usersResource: any[] = readTestResourceFile('users.json');
      return new BambooHR(
        {
          get: fnUsersFunc.mockResolvedValue({
            data: {value: usersResource},
          }),
        } as any,
        null
      );
    });
    const source = new sut.BambooHRSource(logger);
    const streams = source.streams({} as any);

    const usersStream = streams[0];
    const userIter = usersStream.readRecords(SyncMode.FULL_REFRESH);
    const users = [];
    for await (const user of userIter) {
      users.push(user);
    }

    expect(fnUsersFunc).toHaveBeenCalledTimes(3);
    expect(users).toStrictEqual(readTestResourceFile('users.json'));
  });
});
