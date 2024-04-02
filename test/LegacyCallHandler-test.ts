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

import {
    IProtocol,
    LOCAL_NOTIFICATION_SETTINGS_PREFIX,
    MatrixEvent,
    PushRuleKind,
    Room,
    RuleId,
    TweakName,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { CallEvent, CallState, CallType, MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import EventEmitter from "events";
import { mocked } from "jest-mock";
import { CallEventHandlerEvent } from "matrix-js-sdk/src/webrtc/callEventHandler";

import LegacyCallHandler, {
    LegacyCallHandlerEvent,
    AudioID,
    PROTOCOL_PSTN,
    PROTOCOL_PSTN_PREFIXED,
    PROTOCOL_SIP_NATIVE,
    PROTOCOL_SIP_VIRTUAL,
} from "../src/LegacyCallHandler";
import { stubClient, mkStubRoom, untilDispatch } from "./test-utils";
import { MatrixClientPeg } from "../src/MatrixClientPeg";
import DMRoomMap from "../src/utils/DMRoomMap";
import SdkConfig from "../src/SdkConfig";
import { Action } from "../src/dispatcher/actions";
import { getFunctionalMembers } from "../src/utils/room/getFunctionalMembers";
import SettingsStore from "../src/settings/SettingsStore";
import { UIFeature } from "../src/settings/UIFeature";
import { VoiceBroadcastInfoState, VoiceBroadcastPlayback, VoiceBroadcastRecording } from "../src/voice-broadcast";
import { mkVoiceBroadcastInfoStateEvent } from "./voice-broadcast/utils/test-utils";
import { SdkContextClass } from "../src/contexts/SDKContext";
import Modal from "../src/Modal";

jest.mock("../src/Modal");

// mock VoiceRecording because it contains all the audio APIs
jest.mock("../src/audio/VoiceRecording", () => ({
    VoiceRecording: jest.fn().mockReturnValue({
        disableMaxLength: jest.fn(),
        liveData: {
            onUpdate: jest.fn(),
        },
        off: jest.fn(),
        on: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        destroy: jest.fn(),
        contentType: "audio/ogg",
    }),
}));

jest.mock("../src/utils/room/getFunctionalMembers", () => ({
    getFunctionalMembers: jest.fn(),
}));

// The Matrix IDs that the user sees when talking to Alice & Bob
const NATIVE_ALICE = "@alice:example.org";
const NATIVE_BOB = "@bob:example.org";
const NATIVE_CHARLIE = "@charlie:example.org";

// Virtual user for Bob
const VIRTUAL_BOB = "@virtual_bob:example.org";

//const REAL_ROOM_ID = "$room1:example.org";
// The rooms the user sees when they're communicating with these users
const NATIVE_ROOM_ALICE = "$alice_room:example.org";
const NATIVE_ROOM_BOB = "$bob_room:example.org";
const NATIVE_ROOM_CHARLIE = "$charlie_room:example.org";

const FUNCTIONAL_USER = "@bot:example.com";

// The room we use to talk to virtual Bob (but that the user does not see)
// Bob has a virtual room, but Alice doesn't
const VIRTUAL_ROOM_BOB = "$virtual_bob_room:example.org";

// Bob's phone number
const BOB_PHONE_NUMBER = "01818118181";

function mkStubDM(roomId: string, userId: string) {
    const room = mkStubRoom(roomId, "room", MatrixClientPeg.safeGet());
    room.getJoinedMembers = jest.fn().mockReturnValue([
        {
            userId: "@me:example.org",
            name: "Member",
            rawDisplayName: "Member",
            roomId: roomId,
            membership: KnownMembership.Join,
            getAvatarUrl: () => "mxc://avatar.url/image.png",
            getMxcAvatarUrl: () => "mxc://avatar.url/image.png",
        },
        {
            userId: userId,
            name: "Member",
            rawDisplayName: "Member",
            roomId: roomId,
            membership: KnownMembership.Join,
            getAvatarUrl: () => "mxc://avatar.url/image.png",
            getMxcAvatarUrl: () => "mxc://avatar.url/image.png",
        },
        {
            userId: FUNCTIONAL_USER,
            name: "Bot user",
            rawDisplayName: "Bot user",
            roomId: roomId,
            membership: KnownMembership.Join,
            getAvatarUrl: () => "mxc://avatar.url/image.png",
            getMxcAvatarUrl: () => "mxc://avatar.url/image.png",
        },
    ]);
    room.currentState.getMembers = room.getJoinedMembers;
    return room;
}

class FakeCall extends EventEmitter {
    roomId: string;
    callId = "fake call id";

    constructor(roomId: string) {
        super();

        this.roomId = roomId;
    }

    setRemoteOnHold() {}
    setRemoteAudioElement() {}

    placeVoiceCall() {
        this.emit(CallEvent.State, CallState.Connected, null);
    }
}

function untilCallHandlerEvent(callHandler: LegacyCallHandler, event: LegacyCallHandlerEvent): Promise<void> {
    return new Promise<void>((resolve) => {
        callHandler.addListener(event, () => {
            resolve();
        });
    });
}

describe("LegacyCallHandler", () => {
    let dmRoomMap;
    let callHandler: LegacyCallHandler;
    let audioElement: HTMLAudioElement;
    let fakeCall: MatrixCall | null;

    // what addresses the app has looked up via pstn and native lookup
    let pstnLookup: string | null;
    let nativeLookup: string | null;
    const deviceId = "my-device";

    beforeEach(async () => {
        stubClient();
        fakeCall = null;
        MatrixClientPeg.safeGet().createCall = (roomId: string): MatrixCall | null => {
            if (fakeCall && fakeCall.roomId !== roomId) {
                throw new Error("Only one call is supported!");
            }
            fakeCall = new FakeCall(roomId) as unknown as MatrixCall;
            return fakeCall as unknown as MatrixCall;
        };
        MatrixClientPeg.safeGet().deviceId = deviceId;

        MatrixClientPeg.safeGet().getThirdpartyProtocols = () => {
            return Promise.resolve({
                "m.id.phone": {} as IProtocol,
                "im.vector.protocol.sip_native": {} as IProtocol,
                "im.vector.protocol.sip_virtual": {} as IProtocol,
            });
        };

        callHandler = new LegacyCallHandler();
        callHandler.start();

        mocked(getFunctionalMembers).mockReturnValue([FUNCTIONAL_USER]);

        const nativeRoomAlice = mkStubDM(NATIVE_ROOM_ALICE, NATIVE_ALICE);
        const nativeRoomBob = mkStubDM(NATIVE_ROOM_BOB, NATIVE_BOB);
        const nativeRoomCharie = mkStubDM(NATIVE_ROOM_CHARLIE, NATIVE_CHARLIE);
        const virtualBobRoom = mkStubDM(VIRTUAL_ROOM_BOB, VIRTUAL_BOB);

        MatrixClientPeg.safeGet().getRoom = (roomId: string): Room | null => {
            switch (roomId) {
                case NATIVE_ROOM_ALICE:
                    return nativeRoomAlice;
                case NATIVE_ROOM_BOB:
                    return nativeRoomBob;
                case NATIVE_ROOM_CHARLIE:
                    return nativeRoomCharie;
                case VIRTUAL_ROOM_BOB:
                    return virtualBobRoom;
            }

            return null;
        };

        dmRoomMap = {
            getUserIdForRoomId: (roomId: string) => {
                if (roomId === NATIVE_ROOM_ALICE) {
                    return NATIVE_ALICE;
                } else if (roomId === NATIVE_ROOM_BOB) {
                    return NATIVE_BOB;
                } else if (roomId === NATIVE_ROOM_CHARLIE) {
                    return NATIVE_CHARLIE;
                } else if (roomId === VIRTUAL_ROOM_BOB) {
                    return VIRTUAL_BOB;
                } else {
                    return null;
                }
            },
            getDMRoomsForUserId: (userId: string) => {
                if (userId === NATIVE_ALICE) {
                    return [NATIVE_ROOM_ALICE];
                } else if (userId === NATIVE_BOB) {
                    return [NATIVE_ROOM_BOB];
                } else if (userId === NATIVE_CHARLIE) {
                    return [NATIVE_ROOM_CHARLIE];
                } else if (userId === VIRTUAL_BOB) {
                    return [VIRTUAL_ROOM_BOB];
                } else {
                    return [];
                }
            },
        } as unknown as DMRoomMap;
        DMRoomMap.setShared(dmRoomMap);

        pstnLookup = null;
        nativeLookup = null;

        MatrixClientPeg.safeGet().getThirdpartyUser = (proto: string, params: any) => {
            if ([PROTOCOL_PSTN, PROTOCOL_PSTN_PREFIXED].includes(proto)) {
                pstnLookup = params["m.id.phone"];
                return Promise.resolve([
                    {
                        userid: VIRTUAL_BOB,
                        protocol: "m.id.phone",
                        fields: {
                            is_native: true,
                            lookup_success: true,
                        },
                    },
                ]);
            } else if (proto === PROTOCOL_SIP_NATIVE) {
                nativeLookup = params["virtual_mxid"];
                if (params["virtual_mxid"] === VIRTUAL_BOB) {
                    return Promise.resolve([
                        {
                            userid: NATIVE_BOB,
                            protocol: "im.vector.protocol.sip_native",
                            fields: {
                                is_native: true,
                                lookup_success: true,
                            },
                        },
                    ]);
                }
                return Promise.resolve([]);
            } else if (proto === PROTOCOL_SIP_VIRTUAL) {
                if (params["native_mxid"] === NATIVE_BOB) {
                    return Promise.resolve([
                        {
                            userid: VIRTUAL_BOB,
                            protocol: "im.vector.protocol.sip_virtual",
                            fields: {
                                is_virtual: true,
                                lookup_success: true,
                            },
                        },
                    ]);
                }
                return Promise.resolve([]);
            }

            return Promise.resolve([]);
        };

        audioElement = document.createElement("audio");
        audioElement.id = "remoteAudio";
        document.body.appendChild(audioElement);
    });

    afterEach(() => {
        callHandler.stop();
        // @ts-ignore
        DMRoomMap.setShared(null);
        // @ts-ignore
        window.mxLegacyCallHandler = null;
        MatrixClientPeg.unset();

        document.body.removeChild(audioElement);
        SdkConfig.reset();
    });

    it("should look up the correct user and start a call in the room when a phone number is dialled", async () => {
        await callHandler.dialNumber(BOB_PHONE_NUMBER);

        expect(pstnLookup).toEqual(BOB_PHONE_NUMBER);
        expect(nativeLookup).toEqual(VIRTUAL_BOB);

        // we should have switched to the native room for Bob
        const viewRoomPayload = await untilDispatch(Action.ViewRoom);
        expect(viewRoomPayload.room_id).toEqual(NATIVE_ROOM_BOB);

        // Check that a call was started: its room on the protocol level
        // should be the virtual room
        expect(fakeCall).not.toBeNull();
        expect(fakeCall?.roomId).toEqual(VIRTUAL_ROOM_BOB);

        // but it should appear to the user to be in thw native room for Bob
        expect(callHandler.roomIdForCall(fakeCall!)).toEqual(NATIVE_ROOM_BOB);
    });

    it("should look up the correct user and start a call in the room when a call is transferred", async () => {
        // we can pass a very minimal object as as the call since we pass consultFirst=true:
        // we don't need to actually do any transferring
        const mockTransferreeCall = { type: CallType.Voice } as unknown as MatrixCall;
        await callHandler.startTransferToPhoneNumber(mockTransferreeCall, BOB_PHONE_NUMBER, true);

        // same checks as above
        const viewRoomPayload = await untilDispatch(Action.ViewRoom);
        expect(viewRoomPayload.room_id).toEqual(NATIVE_ROOM_BOB);

        expect(fakeCall).not.toBeNull();
        expect(fakeCall!.roomId).toEqual(VIRTUAL_ROOM_BOB);

        expect(callHandler.roomIdForCall(fakeCall!)).toEqual(NATIVE_ROOM_BOB);
    });

    it("should move calls between rooms when remote asserted identity changes", async () => {
        callHandler.placeCall(NATIVE_ROOM_ALICE, CallType.Voice);

        await untilCallHandlerEvent(callHandler, LegacyCallHandlerEvent.CallState);

        // We placed the call in Alice's room so it should start off there
        expect(callHandler.getCallForRoom(NATIVE_ROOM_ALICE)).toBe(fakeCall);

        let callRoomChangeEventCount = 0;
        const roomChangePromise = new Promise<void>((resolve) => {
            callHandler.addListener(LegacyCallHandlerEvent.CallChangeRoom, () => {
                ++callRoomChangeEventCount;
                resolve();
            });
        });

        // Now emit an asserted identity for Bob: this should be ignored
        // because we haven't set the config option to obey asserted identity
        expect(fakeCall).not.toBeNull();
        fakeCall!.getRemoteAssertedIdentity = jest.fn().mockReturnValue({
            id: NATIVE_BOB,
        });
        fakeCall!.emit(CallEvent.AssertedIdentityChanged, fakeCall!);

        // Now set the config option
        SdkConfig.add({
            voip: {
                obey_asserted_identity: true,
            },
        });

        // ...and send another asserted identity event for a different user
        fakeCall!.getRemoteAssertedIdentity = jest.fn().mockReturnValue({
            id: NATIVE_CHARLIE,
        });
        fakeCall!.emit(CallEvent.AssertedIdentityChanged, fakeCall!);

        await roomChangePromise;
        callHandler.removeAllListeners();

        // If everything's gone well, we should have seen only one room change
        // event and the call should now be in Charlie's room.
        // If it's not obeying any, the call will still be in NATIVE_ROOM_ALICE.
        // If it incorrectly obeyed both asserted identity changes, either it will
        // have just processed one and the call will be in the wrong room, or we'll
        // have seen two room change dispatches.
        expect(callRoomChangeEventCount).toEqual(1);
        expect(callHandler.getCallForRoom(NATIVE_ROOM_BOB)).toBeNull();
        expect(callHandler.getCallForRoom(NATIVE_ROOM_CHARLIE)).toBe(fakeCall);
    });

    describe("when listening to a voice broadcast", () => {
        let voiceBroadcastPlayback: VoiceBroadcastPlayback;

        beforeEach(() => {
            voiceBroadcastPlayback = new VoiceBroadcastPlayback(
                mkVoiceBroadcastInfoStateEvent(
                    "!room:example.com",
                    VoiceBroadcastInfoState.Started,
                    MatrixClientPeg.safeGet().getSafeUserId(),
                    "d42",
                ),
                MatrixClientPeg.safeGet(),
                SdkContextClass.instance.voiceBroadcastRecordingsStore,
            );
            SdkContextClass.instance.voiceBroadcastPlaybacksStore.setCurrent(voiceBroadcastPlayback);
            jest.spyOn(voiceBroadcastPlayback, "pause").mockImplementation();
        });

        it("and placing a call should pause the broadcast", async () => {
            callHandler.placeCall(NATIVE_ROOM_ALICE, CallType.Voice);
            await untilCallHandlerEvent(callHandler, LegacyCallHandlerEvent.CallState);

            expect(voiceBroadcastPlayback.pause).toHaveBeenCalled();
        });
    });

    describe("when recording a voice broadcast", () => {
        beforeEach(() => {
            SdkContextClass.instance.voiceBroadcastRecordingsStore.setCurrent(
                new VoiceBroadcastRecording(
                    mkVoiceBroadcastInfoStateEvent(
                        "!room:example.com",
                        VoiceBroadcastInfoState.Started,
                        MatrixClientPeg.safeGet().getSafeUserId(),
                        "d42",
                    ),
                    MatrixClientPeg.safeGet(),
                ),
            );
        });

        it("and placing a call should show the info dialog", async () => {
            callHandler.placeCall(NATIVE_ROOM_ALICE, CallType.Voice);
            expect(Modal.createDialog).toMatchSnapshot();
        });
    });
});

describe("LegacyCallHandler without third party protocols", () => {
    let dmRoomMap;
    let callHandler: LegacyCallHandler;
    let audioElement: HTMLAudioElement;
    let fakeCall: MatrixCall | null;

    beforeEach(() => {
        stubClient();
        fakeCall = null;
        MatrixClientPeg.safeGet().createCall = (roomId) => {
            if (fakeCall && fakeCall.roomId !== roomId) {
                throw new Error("Only one call is supported!");
            }
            fakeCall = new FakeCall(roomId) as unknown as MatrixCall;
            return fakeCall;
        };

        MatrixClientPeg.safeGet().getThirdpartyProtocols = () => {
            throw new Error("Endpoint unsupported.");
        };

        callHandler = new LegacyCallHandler();
        callHandler.start();

        const nativeRoomAlice = mkStubDM(NATIVE_ROOM_ALICE, NATIVE_ALICE);

        MatrixClientPeg.safeGet().getRoom = (roomId: string): Room | null => {
            switch (roomId) {
                case NATIVE_ROOM_ALICE:
                    return nativeRoomAlice;
            }

            return null;
        };

        dmRoomMap = {
            getUserIdForRoomId: (roomId: string) => {
                if (roomId === NATIVE_ROOM_ALICE) {
                    return NATIVE_ALICE;
                } else {
                    return null;
                }
            },
            getDMRoomsForUserId: (userId: string) => {
                if (userId === NATIVE_ALICE) {
                    return [NATIVE_ROOM_ALICE];
                } else {
                    return [];
                }
            },
        } as DMRoomMap;
        DMRoomMap.setShared(dmRoomMap);

        MatrixClientPeg.safeGet().getThirdpartyUser = (_proto, _params) => {
            throw new Error("Endpoint unsupported.");
        };

        audioElement = document.createElement("audio");
        audioElement.id = "remoteAudio";
        document.body.appendChild(audioElement);

        SdkContextClass.instance.voiceBroadcastPlaybacksStore.clearCurrent();
        SdkContextClass.instance.voiceBroadcastRecordingsStore.clearCurrent();
    });

    afterEach(() => {
        callHandler.stop();
        // @ts-ignore
        DMRoomMap.setShared(null);
        // @ts-ignore
        window.mxLegacyCallHandler = null;
        MatrixClientPeg.unset();

        document.body.removeChild(audioElement);
        SdkConfig.reset();
    });

    it("should still start a native call", async () => {
        callHandler.placeCall(NATIVE_ROOM_ALICE, CallType.Voice);

        await untilCallHandlerEvent(callHandler, LegacyCallHandlerEvent.CallState);

        // Check that a call was started: its room on the protocol level
        // should be the virtual room
        expect(fakeCall).not.toBeNull();
        expect(fakeCall!.roomId).toEqual(NATIVE_ROOM_ALICE);

        // but it should appear to the user to be in thw native room for Bob
        expect(callHandler.roomIdForCall(fakeCall!)).toEqual(NATIVE_ROOM_ALICE);
    });

    describe("incoming calls", () => {
        const roomId = "test-room-id";

        const mockAudioElement = {
            play: jest.fn(),
            pause: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            muted: false,
        } as unknown as HTMLMediaElement;
        beforeEach(() => {
            jest.clearAllMocks();
            jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => setting === UIFeature.Voip);

            jest.spyOn(MatrixClientPeg.safeGet(), "supportsVoip").mockReturnValue(true);

            MatrixClientPeg.safeGet().isFallbackICEServerAllowed = jest.fn();
            MatrixClientPeg.safeGet().prepareToEncrypt = jest.fn();

            MatrixClientPeg.safeGet().pushRules = {
                global: {
                    [PushRuleKind.Override]: [
                        {
                            rule_id: RuleId.IncomingCall,
                            default: false,
                            enabled: true,
                            actions: [
                                {
                                    set_tweak: TweakName.Sound,
                                    value: "ring",
                                },
                            ],
                        },
                    ],
                },
            };

            jest.spyOn(document, "getElementById").mockReturnValue(mockAudioElement);

            // silence local notifications by default
            jest.spyOn(MatrixClientPeg.safeGet(), "getAccountData").mockImplementation((eventType) => {
                if (eventType.includes(LOCAL_NOTIFICATION_SETTINGS_PREFIX.name)) {
                    return new MatrixEvent({
                        type: eventType,
                        content: {
                            is_silenced: true,
                        },
                    });
                }
            });
        });

        it("should unmute <audio> before playing", () => {
            // Test setup: set the audio element as muted
            mockAudioElement.muted = true;
            expect(mockAudioElement.muted).toStrictEqual(true);

            callHandler.play(AudioID.Ring);

            // Ensure audio is no longer muted
            expect(mockAudioElement.muted).toStrictEqual(false);
            // Ensure the audio was played
            expect(mockAudioElement.play).toHaveBeenCalled();
        });

        it("listens for incoming call events when voip is enabled", () => {
            const call = new MatrixCall({
                client: MatrixClientPeg.safeGet(),
                roomId,
            });
            const cli = MatrixClientPeg.safeGet();

            cli.emit(CallEventHandlerEvent.Incoming, call);

            // call added to call map
            expect(callHandler.getCallForRoom(roomId)).toEqual(call);
        });

        it("rings when incoming call state is ringing and notifications set to ring", () => {
            // remove local notification silencing mock for this test
            jest.spyOn(MatrixClientPeg.safeGet(), "getAccountData").mockReturnValue(undefined);
            const call = new MatrixCall({
                client: MatrixClientPeg.safeGet(),
                roomId,
            });
            const cli = MatrixClientPeg.safeGet();

            cli.emit(CallEventHandlerEvent.Incoming, call);

            // call added to call map
            expect(callHandler.getCallForRoom(roomId)).toEqual(call);
            call.emit(CallEvent.State, CallState.Ringing, CallState.Connected, fakeCall!);

            // ringer audio element started
            expect(mockAudioElement.play).toHaveBeenCalled();
        });

        it("does not ring when incoming call state is ringing but local notifications are silenced", () => {
            const call = new MatrixCall({
                client: MatrixClientPeg.safeGet(),
                roomId,
            });
            const cli = MatrixClientPeg.safeGet();

            cli.emit(CallEventHandlerEvent.Incoming, call);

            // call added to call map
            expect(callHandler.getCallForRoom(roomId)).toEqual(call);
            call.emit(CallEvent.State, CallState.Ringing, CallState.Connected, fakeCall!);

            // ringer audio element started
            expect(mockAudioElement.play).not.toHaveBeenCalled();
            expect(callHandler.isCallSilenced(call.callId)).toEqual(true);
        });

        it("should force calls to silent when local notifications are silenced", async () => {
            const call = new MatrixCall({
                client: MatrixClientPeg.safeGet(),
                roomId,
            });
            const cli = MatrixClientPeg.safeGet();

            cli.emit(CallEventHandlerEvent.Incoming, call);

            expect(callHandler.isForcedSilent()).toEqual(true);
            expect(callHandler.isCallSilenced(call.callId)).toEqual(true);
        });

        it("does not unsilence calls when local notifications are silenced", async () => {
            const call = new MatrixCall({
                client: MatrixClientPeg.safeGet(),
                roomId,
            });
            const cli = MatrixClientPeg.safeGet();
            const callHandlerEmitSpy = jest.spyOn(callHandler, "emit");

            cli.emit(CallEventHandlerEvent.Incoming, call);
            // reset emit call count
            callHandlerEmitSpy.mockClear();

            callHandler.unSilenceCall(call.callId);
            expect(callHandlerEmitSpy).not.toHaveBeenCalled();
            // call still silenced
            expect(callHandler.isCallSilenced(call.callId)).toEqual(true);
            // ringer not played
            expect(mockAudioElement.play).not.toHaveBeenCalled();
        });
    });
});
