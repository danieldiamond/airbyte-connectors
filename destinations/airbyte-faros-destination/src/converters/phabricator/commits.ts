import {AirbyteRecord} from 'faros-airbyte-cdk';
import {Utils} from 'faros-feeds-sdk';

import {DestinationModel, DestinationRecord, StreamContext} from '../converter';
import {PhabricatorCommon, PhabricatorConverter} from './common';

export class Commits extends PhabricatorConverter {
  readonly destinationModels: ReadonlyArray<DestinationModel> = [
    'vcs_BranchCommitAssociation',
    'vcs_Commit',
  ];

  id(record: AirbyteRecord): any {
    return record?.record?.data?.fields?.identifier;
  }

  async convert(
    record: AirbyteRecord,
    ctx: StreamContext
  ): Promise<ReadonlyArray<DestinationRecord>> {
    const source = this.streamName.source;
    const commit = record.record.data;
    const res: DestinationRecord[] = [];
    const sha = commit.fields?.identifier;
    const repository = PhabricatorCommon.repositoryKey(
      commit.repository,
      source
    );
    if (!sha || !repository) return res;

    const author = commit.fields?.author;
    const fullMessage = commit.fields?.message;
    const commitMessage = PhabricatorCommon.parseCommitMessage(fullMessage);

    res.push({
      model: 'vcs_Commit',
      record: {
        uid: sha,
        sha,
        message: fullMessage,
        author: author?.userPHID ? {uid: author.userPHID, source} : null,
        htmlUrl: null,
        createdAt: author?.epoch ? Utils.toDate(author?.epoch) : null,
        repository,
        source,
      },
    });

    // TODO: figure out how to get the actual commit branch
    // Until then we assume the default repository branch for all commits
    const branch = commit.repository.fields?.defaultBranch;
    if (branch) {
      res.push({
        model: 'vcs_BranchCommitAssociation',
        record: {
          commit: {sha, repository, uid: sha},
          branch: {name: branch, uid: branch, repository},
        },
      });
    }

    if (commitMessage?.revisionId) {
      res.push({
        model: 'vcs_PullRequest__Update',
        record: {
          at: Date.now(),
          where: {
            number: commitMessage?.revisionId,
            uid: commitMessage?.revisionId.toString(),
            repository,
          },
          mask: ['mergeCommit'],
          patch: {
            mergeCommit: {repository, sha, uid: sha},
          },
        },
      });
    }

    return res;
  }
}
