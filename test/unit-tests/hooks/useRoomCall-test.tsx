import { renderHook, waitFor } from "jest-matrix-react";
import { PlatformCallType, useRoomCall } from "../../../src/hooks/room/useRoomCall";
import { getMockClientWithEventEmitter, mkRoom, mockClientMethodsRooms, mockClientMethodsServer, mockClientMethodsUser, MockEventEmitter, setupAsyncStoreWithClient } from "../../test-utils";
import { ScopedRoomContextProvider } from "../../../src/contexts/ScopedRoomContext";
import RoomContext, { RoomContextType } from "../../../src/contexts/RoomContext";
import React from "react";
import { MatrixClientContextProvider } from "../../../src/components/structures/MatrixClientContextProvider";
import LegacyCallHandler from "../../../src/LegacyCallHandler";
import { SdkContextClass } from "../../../src/contexts/SDKContext";
import SettingsStore from "../../../src/settings/SettingsStore";
import { CallStore } from "../../../src/stores/CallStore";

describe("useRoomCall", () => {
    const client = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(),
        ...mockClientMethodsServer(),
        ...mockClientMethodsRooms(),
        matrixRTC: new MockEventEmitter(),
        _unstable_getRTCTransports: jest.fn().mockResolvedValue([]),
        getCrypto: () => null,
    });
    const room = mkRoom(client, "!test-room");
    // Create a stable room context for this test
    const mockRoomViewStore = {
        isViewingCall: jest.fn().mockReturnValue(false),
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
    };

    const roomContext = {
        ...RoomContext,
        roomId: room.roomId,
        roomViewStore: mockRoomViewStore,
    } as unknown as RoomContextType;


    beforeEach(() => {
        const callHandler = {
            getCallForRoom: jest.fn().mockReturnValue(null),
            isCallSidebarShown: jest.fn().mockReturnValue(true),
            addListener: jest.fn(),
            removeListener: jest.fn(),
            on: jest.fn(),
            off: jest.fn(),
        };
        jest.spyOn(SdkContextClass.instance, "legacyCallHandler",  "get").mockReturnValue(
            callHandler as unknown as LegacyCallHandler,
        );
        const origGetValue = SettingsStore.getValue;
        jest.spyOn(SettingsStore, "getValue").mockImplementation((name, ...params): any => {
            if (name === "feature_group_calls") return true;
            return origGetValue(name, ...params);
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function render() {
        return renderHook(() => useRoomCall(room), { wrapper: ({children}) => 
            <MatrixClientContextProvider client={client}>
                <ScopedRoomContextProvider {...roomContext}>
                {children}
                </ScopedRoomContextProvider>
            </MatrixClientContextProvider>});
    }

    describe('Element Call focus detection', () => {
        it('Blocks Element Call if required foci are not configured', async () => {
            await setupAsyncStoreWithClient(CallStore.instance, client);
            const { result } = render();
            await waitFor(() => expect(result.current.callOptions).toEqual([PlatformCallType.LegacyCall]));
        });
        it('Blocks Element Call if transport foci are the wrong type', async () => {
            client._unstable_getRTCTransports.mockResolvedValue([{type: "anything-else"}]);
            await setupAsyncStoreWithClient(CallStore.instance, client);
            const { result } = render();
            await waitFor(() => expect(result.current.callOptions).toEqual([PlatformCallType.LegacyCall]));
        });
        it('Blocks Element Call if well-known foci are the wrong type', async () => {
            client.getClientWellKnown.mockReturnValue({
                "org.matrix.msc4143.rtc_foci": {
                    type: "anything-else"
                }
            })
            await setupAsyncStoreWithClient(CallStore.instance, client);
            const { result } = render();
            await waitFor(() => expect(result.current.callOptions).toEqual([PlatformCallType.LegacyCall]));
        });
        it('Allows Element Call if foci is provided via getRTCTransports', async () => {
            client._unstable_getRTCTransports.mockResolvedValue([{type: "livekit", livekit_service_url: "https://example.org"}]);
            await setupAsyncStoreWithClient(CallStore.instance, client);
            
            const { result } = render();
            await waitFor(() => expect(result.current.callOptions).toEqual([PlatformCallType.ElementCall, PlatformCallType.LegacyCall]));
        });
        it('Allows Element Call if foci is provided via .well-known', async () => {
            client.getClientWellKnown.mockReturnValue({
                "org.matrix.msc4143.rtc_foci": {
                    type: "livekit",
                    livekit_service_url: "https://example.org"
                }
            })
            await setupAsyncStoreWithClient(CallStore.instance, client);
            const { result } = render();
            await waitFor(() => expect(result.current.callOptions).toEqual([PlatformCallType.ElementCall, PlatformCallType.LegacyCall]));
        });
    });
});