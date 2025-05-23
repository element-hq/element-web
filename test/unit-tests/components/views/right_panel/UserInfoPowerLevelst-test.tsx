import React from "react";
import { EventType } from "@rrweb/types";
import userEvent from "@testing-library/user-event";
import { fireEvent } from "jest-matrix-react";
import { Mocked, mocked } from "jest-mock";
import { render } from "katex";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { RoomMember, MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";

import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";

describe("<PowerLevelEditor />", () => {
    const defaultRoomId = "!fkfk";
    const defaultUserId = "@user:example.com";
    const defaultMember = new RoomMember(defaultRoomId, defaultUserId);

    let mockClient: Mocked<MatrixClient>;
    let mockRoom: Mocked<Room>;
    let defaultProps: Parameters<typeof PowerLevelEditor>[0];

    beforeEach(() => {
        defaultProps = {
            user: defaultMember,
            room: mockRoom,
            roomPermissions: {
                modifyLevelMax: 100,
                canEdit: false,
                canInvite: false,
            },
        };

        mockRoom = mocked({
            roomId: defaultRoomId,
            getType: jest.fn().mockReturnValue(undefined),
            isSpaceRoom: jest.fn().mockReturnValue(false),
            getMember: jest.fn().mockReturnValue(undefined),
            getMxcAvatarUrl: jest.fn().mockReturnValue("mock-avatar-url"),
            name: "test room",
            on: jest.fn(),
            off: jest.fn(),
            currentState: {
                getStateEvents: jest.fn(),
                on: jest.fn(),
                off: jest.fn(),
            },
            getEventReadUpTo: jest.fn(),
        } as unknown as Room);

        
         mockClient = mocked({
             getUser: jest.fn(),
             isGuest: jest.fn().mockReturnValue(false),
             isUserIgnored: jest.fn(),
             getIgnoredUsers: jest.fn(),
             setIgnoredUsers: jest.fn(),
             getUserId: jest.fn(),
             getSafeUserId: jest.fn(),
             getDomain: jest.fn(),
             on: jest.fn(),
             off: jest.fn(),
             isSynapseAdministrator: jest.fn().mockResolvedValue(false),
             doesServerSupportUnstableFeature: jest.fn().mockReturnValue(false),
             doesServerSupportExtendedProfiles: jest.fn().mockResolvedValue(false),
             getExtendedProfileProperty: jest.fn().mockRejectedValue(new Error("Not supported")),
             mxcUrlToHttp: jest.fn().mockReturnValue("mock-mxcUrlToHttp"),
             removeListener: jest.fn(),
             currentState: {
                 on: jest.fn(),
             },
             getRoom: jest.fn(),
             credentials: {},
             setPowerLevel: jest.fn(),
             getCrypto: jest.fn().mockReturnValue(mockCrypto),
         } as unknown as MatrixClient);

         jest.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);
         jest.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(mockClient);
    });

    const renderComponent = (props = {}) => {
        const Wrapper = (wrapperProps = {}) => {
            return <MatrixClientContext.Provider value={mockClient} {...wrapperProps} />;
        };

        return render(<PowerLevelEditor {...defaultProps} {...props} />, {
            wrapper: Wrapper,
        });
    };

    it("renders a power level combobox", () => {
        renderComponent();

        expect(screen.getByRole("combobox", { name: "Power level" })).toBeInTheDocument();
    });

    it("renders a combobox and attempts to change power level on change of the combobox", async () => {
        const startPowerLevel = 999;
        const powerLevelEvent = new MatrixEvent({
            type: EventType.RoomPowerLevels,
            content: { users: { [defaultUserId]: startPowerLevel }, users_default: 1 },
        });
        mockRoom.currentState.getStateEvents.mockReturnValue(powerLevelEvent);
        mockClient.getSafeUserId.mockReturnValueOnce(defaultUserId);
        mockClient.getUserId.mockReturnValueOnce(defaultUserId);
        mockClient.setPowerLevel.mockResolvedValueOnce({ event_id: "123" });
        renderComponent();

        const changedPowerLevel = 100;

        fireEvent.change(screen.getByRole("combobox", { name: "Power level" }), {
            target: { value: changedPowerLevel },
        });

        await screen.findByText("Demote", { exact: true });

        // firing the event will raise a dialog warning about self demotion, wait for this to appear then click on it
        await userEvent.click(await screen.findByText("Demote", { exact: true }));
        expect(mockClient.setPowerLevel).toHaveBeenCalledTimes(1);
        expect(mockClient.setPowerLevel).toHaveBeenCalledWith(mockRoom.roomId, defaultMember.userId, changedPowerLevel);
    });
});
