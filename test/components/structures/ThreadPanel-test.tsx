/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import { shallow, mount } from "enzyme";
import {
    MatrixClient,
    RelationType,
    Room,
    UNSTABLE_FILTER_RELATED_BY_REL_TYPES,
    UNSTABLE_FILTER_RELATED_BY_SENDERS,
} from 'matrix-js-sdk/src/matrix';
import { mocked } from 'jest-mock';
import '../../skinned-sdk';
import { Thread } from 'matrix-js-sdk/src/models/thread';

import {
    ThreadFilterType,
    ThreadPanelHeader,
    ThreadPanelHeaderFilterOptionItem,
    getThreadTimelineSet,
} from '../../../src/components/structures/ThreadPanel';
import { ContextMenuButton } from '../../../src/accessibility/context_menu/ContextMenuButton';
import ContextMenu from '../../../src/components/structures/ContextMenu';
import { _t } from '../../../src/languageHandler';
import { makeThread } from '../../test-utils/threads';

describe('ThreadPanel', () => {
    describe('Header', () => {
        it('expect that All filter for ThreadPanelHeader properly renders Show: All threads', () => {
            const wrapper = shallow(
                <ThreadPanelHeader
                    empty={false}
                    filterOption={ThreadFilterType.All}
                    setFilterOption={() => undefined} />,
            );
            expect(wrapper).toMatchSnapshot();
        });

        it('expect that My filter for ThreadPanelHeader properly renders Show: My threads', () => {
            const wrapper = shallow(
                <ThreadPanelHeader
                    empty={false}
                    filterOption={ThreadFilterType.My}
                    setFilterOption={() => undefined} />,
            );
            expect(wrapper).toMatchSnapshot();
        });

        it('expect that ThreadPanelHeader properly opens a context menu when clicked on the button', () => {
            const wrapper = mount(
                <ThreadPanelHeader
                    empty={false}
                    filterOption={ThreadFilterType.All}
                    setFilterOption={() => undefined} />,
            );
            const found = wrapper.find(ContextMenuButton);
            expect(found).not.toBe(undefined);
            expect(found).not.toBe(null);
            expect(wrapper.exists(ContextMenu)).toEqual(false);
            found.simulate('click');
            expect(wrapper.exists(ContextMenu)).toEqual(true);
        });

        it('expect that ThreadPanelHeader has the correct option selected in the context menu', () => {
            const wrapper = mount(
                <ThreadPanelHeader
                    empty={false}
                    filterOption={ThreadFilterType.All}
                    setFilterOption={() => undefined} />,
            );
            wrapper.find(ContextMenuButton).simulate('click');
            const found = wrapper.find(ThreadPanelHeaderFilterOptionItem);
            expect(found.length).toEqual(2);
            const foundButton = found.find('[aria-checked=true]').first();
            expect(foundButton.text()).toEqual(`${_t("All threads")}${_t('Shows all threads from current room')}`);
            expect(foundButton).toMatchSnapshot();
        });
    });

    describe('getThreadTimelineSet()', () => {
        const filterId = '123';
        const client = {
            getUserId: jest.fn(),
            doesServerSupportUnstableFeature: jest.fn().mockResolvedValue(false),
            decryptEventIfNeeded: jest.fn().mockResolvedValue(undefined),
            getOrCreateFilter: jest.fn().mockResolvedValue(filterId),
            paginateEventTimeline: jest.fn().mockResolvedValue(undefined),
        } as unknown as MatrixClient;

        const aliceId = '@alice:server.org';
        const bobId = '@bob:server.org';
        const charlieId = '@charlie:server.org';
        const room = new Room('!room1:server.org', client, aliceId);

        const roomWithThreads = new Room('!room2:server.org', client, aliceId);
        const aliceAndBobThread = makeThread(client, roomWithThreads, {
            authorId: aliceId,
            participantUserIds: [aliceId, bobId],
            roomId: roomWithThreads.roomId,
        });
        const justBobThread = makeThread(client, roomWithThreads, {
            authorId: bobId,
            participantUserIds: [bobId],
            roomId: roomWithThreads.roomId,
        });
        const everyoneThread = makeThread(client, roomWithThreads, {
            authorId: charlieId,
            participantUserIds: [aliceId, bobId, charlieId],
            length: 5,
            roomId: roomWithThreads.roomId,
        });
        roomWithThreads.threads.set(aliceAndBobThread.id, aliceAndBobThread);
        roomWithThreads.threads.set(justBobThread.id, justBobThread);
        roomWithThreads.threads.set(everyoneThread.id, everyoneThread);

        beforeEach(() => {
            mocked(client.getUserId).mockReturnValue(aliceId);
            mocked(client.doesServerSupportUnstableFeature).mockResolvedValue(false);
        });

        describe('when extra capabilities are not enabled on server', () => {
            it('returns an empty timelineset when room has no threads', async () => {
                const result = await getThreadTimelineSet(client, room);

                expect(result.getLiveTimeline().getEvents()).toEqual([]);
            });

            it('returns a timelineset with thread root events for room when filter is All', async () => {
                const result = await getThreadTimelineSet(client, roomWithThreads);

                const resultEvents = result.getLiveTimeline().getEvents();
                expect(resultEvents.length).toEqual(3);
                expect(resultEvents).toEqual(expect.arrayContaining([
                    justBobThread.rootEvent,
                    aliceAndBobThread.rootEvent,
                    everyoneThread.rootEvent,
                ]));
            });

            it('returns a timelineset with threads user has participated in when filter is My', async () => {
                // current user is alice
                mocked(client).getUserId.mockReturnValue(aliceId);

                const result = await getThreadTimelineSet(client, roomWithThreads, ThreadFilterType.My);
                const resultEvents = result.getLiveTimeline().getEvents();
                expect(resultEvents).toEqual(expect.arrayContaining([
                    // alice authored root event
                    aliceAndBobThread.rootEvent,
                    // alive replied to this thread
                    everyoneThread.rootEvent,
                ]));
            });
        });

        describe('when extra capabilities are enabled on server', () => {
            beforeEach(() => {
                jest.clearAllMocks();
                Thread.hasServerSideSupport = true;
                mocked(client.doesServerSupportUnstableFeature).mockResolvedValue(true);
            });

            it('creates a filter with correct definition when filterType is All', async () => {
                await getThreadTimelineSet(client, room);

                const [filterKey, filter] = mocked(client).getOrCreateFilter.mock.calls[0];
                expect(filterKey).toEqual(`THREAD_PANEL_${room.roomId}_${ThreadFilterType.All}`);
                expect(filter.getDefinition().room.timeline).toEqual({
                    [UNSTABLE_FILTER_RELATED_BY_REL_TYPES.name]: [RelationType.Thread],
                });
            });

            it('creates a filter with correct definition when filterType is My', async () => {
                await getThreadTimelineSet(client, room, ThreadFilterType.My);

                const [filterKey, filter] = mocked(client).getOrCreateFilter.mock.calls[0];
                expect(filterKey).toEqual(`THREAD_PANEL_${room.roomId}_${ThreadFilterType.My}`);
                expect(filter.getDefinition().room.timeline).toEqual({
                    [UNSTABLE_FILTER_RELATED_BY_REL_TYPES.name]: [RelationType.Thread],
                    [UNSTABLE_FILTER_RELATED_BY_SENDERS.name]: [aliceId],
                });
            });
        });
    });
});
