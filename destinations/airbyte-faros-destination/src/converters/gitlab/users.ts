import {AirbyteRecord} from 'faros-airbyte-cdk';

import {GitlabConverter} from '../common/gitlab';
import {DestinationModel, DestinationRecord, StreamContext} from '../converter';

export class Users extends GitlabConverter {
  readonly destinationModels: ReadonlyArray<DestinationModel> = ['vcs_User'];

  async convert(
    record: AirbyteRecord,
    ctx: StreamContext
  ): Promise<ReadonlyArray<DestinationRecord>> {
    const source = this.streamName.source;
    const user = record.record.data;

    // User has no username defined. Skipping saving.
    if (!user?.username) return [];

    // GitLab doesn't indicate user type
    const type = {category: 'User', detail: 'user'};
    return [
      {
        model: 'vcs_User',
        record: {
          uid: user.username,
          name: user.name ?? null,
          htmlUrl: user.web_url ?? null,
          type,
          source,
        },
      },
    ];
  }
}
