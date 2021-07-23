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

import './skinned-sdk';

import CallHandler, { PlaceCallType, CallHandlerEvent } from '../src/CallHandler';
import { stubClient, mkStubRoom } from './test-utils';
import { MatrixClientPeg } from '../src/MatrixClientPeg';
import dis from '../src/dispatcher/dispatcher';
import { CallEvent, CallState } from 'matrix-js-sdk/src/webrtc/call';
import DMRoomMap from '../src/utils/DMRoomMap';
import EventEmitter from 'events';
import SdkConfig from '../src/SdkConfig';
import { ActionPayload } from '../src/dispatcher/payloads';
import { Action } from '../src/dispatcher/actions';

const REAL_ROOM_ID = '$room1:example.org';
const MAPPED_ROOM_ID = '$room2:example.org';
const MAPPED_ROOM_ID_2 = '$room3:example.org';

function mkStubDM(roomId, userId) {
    const room = mkStubRoom(roomId);
    room.getJoinedMembers = jest.fn().mockReturnValue([
        {
            userId: '@me:example.org',
            name: 'Member',
            rawDisplayName: 'Member',
            roomId: roomId,
            membership: 'join',
            getAvatarUrl: () => 'mxc://avatar.url/image.png',
            getMxcAvatarUrl: () => 'mxc://avatar.url/image.png',
        },
        {
            userId: userId,
            name: 'Member',
            rawDisplayName: 'Member',
            roomId: roomId,
            membership: 'join',
            getAvatarUrl: () => 'mxc://avatar.url/image.png',
            getMxcAvatarUrl: () => 'mxc://avatar.url/image.png',
        },
    ]);
    room.currentState.getMembers = room.getJoinedMembers;

    return room;
}

class FakeCall extends EventEmitter {
    roomId: string;
    callId = "fake call id";

    constructor(roomId) {
        super();

        this.roomId = roomId;
    }

    setRemoteOnHold() {}
    setRemoteAudioElement() {}

    placeVoiceCall() {
        this.emit(CallEvent.State, CallState.Connected, null);
    }
}

function untilDispatch(waitForAction: string): Promise<ActionPayload> {
    let dispatchHandle;
    return new Promise<ActionPayload>(resolve => {
        dispatchHandle = dis.register(payload => {
            if (payload.action === waitForAction) {
                dis.unregister(dispatchHandle);
                resolve(payload);
            }
        });
    });
}

describe('CallHandler', () => {
    let dmRoomMap;
    let callHandler;
    let audioElement;
    let fakeCall;

    beforeEach(() => {
        stubClient();
        MatrixClientPeg.get().createCall = roomId => {
            if (fakeCall && fakeCall.roomId !== roomId) {
                throw new Error("Only one call is supported!");
            }
            fakeCall = new FakeCall(roomId);
            return fakeCall;
        };

        callHandler = new CallHandler();
        callHandler.start();

        const realRoom = mkStubDM(REAL_ROOM_ID, '@user1:example.org');
        const mappedRoom = mkStubDM(MAPPED_ROOM_ID, '@user2:example.org');
        const mappedRoom2 = mkStubDM(MAPPED_ROOM_ID_2, '@user3:example.org');

        MatrixClientPeg.get().getRoom = roomId => {
            switch (roomId) {
                case REAL_ROOM_ID:
                    return realRoom;
                case MAPPED_ROOM_ID:
                    return mappedRoom;
                case MAPPED_ROOM_ID_2:
                    return mappedRoom2;
            }
        };

        dmRoomMap = {
            getUserIdForRoomId: roomId => {
                if (roomId === REAL_ROOM_ID) {
                    return '@user1:example.org';
                } else if (roomId === MAPPED_ROOM_ID) {
                    return '@user2:example.org';
                } else if (roomId === MAPPED_ROOM_ID_2) {
                    return '@user3:example.org';
                } else {
                    return null;
                }
            },
            getDMRoomsForUserId: userId => {
                if (userId === '@user2:example.org') {
                    return [MAPPED_ROOM_ID];
                } else if (userId === '@user3:example.org') {
                    return [MAPPED_ROOM_ID_2];
                } else {
                    return [];
                }
            },
        };
        DMRoomMap.setShared(dmRoomMap);

        audioElement = document.createElement('audio');
        audioElement.id = "remoteAudio";
        document.body.appendChild(audioElement);
    });

    afterEach(() => {
        callHandler.stop();
        DMRoomMap.setShared(null);
        // @ts-ignore
        window.mxCallHandler = null;
        MatrixClientPeg.unset();

        document.body.removeChild(audioElement);
        SdkConfig.unset();
    });

    it('should look up the correct user and open the room when a phone number is dialled', async () => {
        MatrixClientPeg.get().getThirdpartyUser = jest.fn().mockResolvedValue([{
            userid: '@user2:example.org',
            protocol: "im.vector.protocol.sip_native",
            fields: {
                is_native: true,
                lookup_success: true,
            },
        }]);

        dis.dispatch({
            action: Action.DialNumber,
            number: '01818118181',
        }, true);

        const viewRoomPayload = await untilDispatch('view_room');
        expect(viewRoomPayload.room_id).toEqual(MAPPED_ROOM_ID);
    });

    it('should move calls between rooms when remote asserted identity changes', async () => {
        dis.dispatch({
            action: 'place_call',
            type: PlaceCallType.Voice,
            room_id: REAL_ROOM_ID,
        }, true);

        // wait for the call to be set up
        await untilDispatch('call_state');

        // should start off in the actual room ID it's in at the protocol level
        expect(callHandler.getCallForRoom(REAL_ROOM_ID)).toBe(fakeCall);

        let callRoomChangeEventCount = 0;
        const roomChangePromise = new Promise<void>(resolve => {
            callHandler.addListener(CallHandlerEvent.CallChangeRoom, () => {
                ++callRoomChangeEventCount;
                resolve();
            });
        });

        // Now emit an asserted identity for user2: this should be ignored
        // because we haven't set the config option to obey asserted identity
        fakeCall.getRemoteAssertedIdentity = jest.fn().mockReturnValue({
            id: "@user2:example.org",
        });
        fakeCall.emit(CallEvent.AssertedIdentityChanged);

        // Now set the config option
        SdkConfig.put({
            voip: {
                obeyAssertedIdentity: true,
            },
        });

        // ...and send another asserted identity event for a different user
        fakeCall.getRemoteAssertedIdentity = jest.fn().mockReturnValue({
            id: "@user3:example.org",
        });
        fakeCall.emit(CallEvent.AssertedIdentityChanged);

        await roomChangePromise;
        callHandler.removeAllListeners();

        // If everything's gone well, we should have seen only one room change
        // event and the call should now be in user 3's room.
        // If it's not obeying any, the call will still be in REAL_ROOM_ID.
        // If it incorrectly obeyed both asserted identity changes, either it will
        // have just processed one and the call will be in the wrong room, or we'll
        // have seen two room change dispatches.
        expect(callRoomChangeEventCount).toEqual(1);
        expect(callHandler.getCallForRoom(REAL_ROOM_ID)).toBeNull();
        expect(callHandler.getCallForRoom(MAPPED_ROOM_ID_2)).toBe(fakeCall);
    });
});
