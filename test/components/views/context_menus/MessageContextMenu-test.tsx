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

import React from 'react';
import { mount } from 'enzyme';
import { EventStatus, MatrixEvent } from 'matrix-js-sdk/src/models/event';
import { Room } from 'matrix-js-sdk/src/models/room';
import { PendingEventOrdering } from 'matrix-js-sdk/src/matrix';
import { ExtensibleEvent, MessageEvent, M_POLL_KIND_DISCLOSED, PollStartEvent } from 'matrix-events-sdk';

import '../../../skinned-sdk';
import * as TestUtils from '../../../test-utils';
import MessageContextMenu from '../../../../src/components/views/context_menus/MessageContextMenu';
import { MatrixClientPeg } from '../../../../src/MatrixClientPeg';

describe('MessageContextMenu>', () => {
    it('allows forwarding a room message', () => {
        const eventContent = MessageEvent.from("hello");
        const menu = createMessageContextMenu(eventContent);
        expect(menu.find('div[aria-label="Forward"]')).toHaveLength(1);
    });

    it('does not allow forwarding a poll', () => {
        const eventContent = PollStartEvent.from("why?", ["42"], M_POLL_KIND_DISCLOSED);
        const menu = createMessageContextMenu(eventContent);
        expect(menu.find('div[aria-label="Forward"]')).toHaveLength(0);
    });
});

function createMessageContextMenu(eventContent: ExtensibleEvent) {
    TestUtils.stubClient();
    const client = MatrixClientPeg.get();

    const room = new Room(
        "roomid",
        client,
        "@user:example.com",
        {
            pendingEventOrdering: PendingEventOrdering.Detached,
        },
    );

    const mxEvent = new MatrixEvent(eventContent.serialize());
    mxEvent.setStatus(EventStatus.SENT);

    client.getUserId = jest.fn().mockReturnValue("@user:example.com");
    client.getRoom = jest.fn().mockReturnValue(room);

    return mount(
        <MessageContextMenu
            chevronFace={null}
            mxEvent={mxEvent}
            onFinished={jest.fn(() => {})}
        />,
    );
}
