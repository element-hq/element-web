/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { mocked } from 'jest-mock';
import { MatrixClient } from 'matrix-js-sdk/src/matrix';

import { MatrixClientPeg } from '../../src/MatrixClientPeg';
import Modal, { ModalManager } from '../../src/Modal';
import SettingsStore from '../../src/settings/SettingsStore';
import MultiInviter, { CompletionStates } from '../../src/utils/MultiInviter';
import * as TestUtilsMatrix from '../test-utils';

const ROOMID = '!room:server';

const MXID1 = '@user1:server';
const MXID2 = '@user2:server';
const MXID3 = '@user3:server';

const MXID_PROFILE_STATES = {
    [MXID1]: Promise.resolve({}),
    [MXID2]: Promise.reject({ errcode: 'M_FORBIDDEN' }),
    [MXID3]: Promise.reject({ errcode: 'M_NOT_FOUND' }),
};

jest.mock('../../src/Modal', () => ({
    createDialog: jest.fn(),
}));

jest.mock('../../src/settings/SettingsStore', () => ({
    getValue: jest.fn(),
}));

const mockPromptBeforeInviteUnknownUsers = (value: boolean) => {
    mocked(SettingsStore.getValue).mockImplementation(
        (settingName: string, roomId: string = null, _excludeDefault = false): any => {
            if (settingName === 'promptBeforeInviteUnknownUsers' && roomId === ROOMID) {
                return value;
            }
        },
    );
};

const mockCreateTrackedDialog = (callbackName: 'onInviteAnyways'|'onGiveUp') => {
    mocked(Modal.createDialog).mockImplementation(
        (...rest: Parameters<ModalManager['createDialog']>): any => {
            rest[1][callbackName]();
        },
    );
};

const expectAllInvitedResult = (result: CompletionStates) => {
    expect(result).toEqual({
        [MXID1]: 'invited',
        [MXID2]: 'invited',
        [MXID3]: 'invited',
    });
};

describe('MultiInviter', () => {
    let client: jest.Mocked<MatrixClient>;
    let inviter: MultiInviter;

    beforeEach(() => {
        jest.resetAllMocks();

        TestUtilsMatrix.stubClient();
        client = MatrixClientPeg.get() as jest.Mocked<MatrixClient>;

        client.invite = jest.fn();
        client.invite.mockResolvedValue({});

        client.getProfileInfo = jest.fn();
        client.getProfileInfo.mockImplementation((userId: string) => {
            return MXID_PROFILE_STATES[userId] || Promise.reject();
        });

        inviter = new MultiInviter(ROOMID);
    });

    describe('invite', () => {
        describe('with promptBeforeInviteUnknownUsers = false', () => {
            beforeEach(() => mockPromptBeforeInviteUnknownUsers(false));

            it('should invite all users', async () => {
                const result = await inviter.invite([MXID1, MXID2, MXID3]);

                expect(client.invite).toHaveBeenCalledTimes(3);
                expect(client.invite).toHaveBeenNthCalledWith(1, ROOMID, MXID1, undefined, undefined);
                expect(client.invite).toHaveBeenNthCalledWith(2, ROOMID, MXID2, undefined, undefined);
                expect(client.invite).toHaveBeenNthCalledWith(3, ROOMID, MXID3, undefined, undefined);

                expectAllInvitedResult(result);
            });
        });

        describe('with promptBeforeInviteUnknownUsers = true and', () => {
            beforeEach(() => mockPromptBeforeInviteUnknownUsers(true));

            describe('confirming the unknown user dialog', () => {
                beforeEach(() => mockCreateTrackedDialog('onInviteAnyways'));

                it('should invite all users', async () => {
                    const result = await inviter.invite([MXID1, MXID2, MXID3]);

                    expect(client.invite).toHaveBeenCalledTimes(3);
                    expect(client.invite).toHaveBeenNthCalledWith(1, ROOMID, MXID1, undefined, undefined);
                    expect(client.invite).toHaveBeenNthCalledWith(2, ROOMID, MXID2, undefined, undefined);
                    expect(client.invite).toHaveBeenNthCalledWith(3, ROOMID, MXID3, undefined, undefined);

                    expectAllInvitedResult(result);
                });
            });

            describe('declining the unknown user dialog', () => {
                beforeEach(() => mockCreateTrackedDialog('onGiveUp'));

                it('should only invite existing users', async () => {
                    const result = await inviter.invite([MXID1, MXID2, MXID3]);

                    expect(client.invite).toHaveBeenCalledTimes(1);
                    expect(client.invite).toHaveBeenNthCalledWith(1, ROOMID, MXID1, undefined, undefined);

                    // The resolved state is 'invited' for all users.
                    // With the above client expectations, the test ensures that only the first user is invited.
                    expectAllInvitedResult(result);
                });
            });
        });
    });
});
