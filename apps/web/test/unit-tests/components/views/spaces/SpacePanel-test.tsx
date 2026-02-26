/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, fireEvent, act, cleanup } from "jest-matrix-react";
import { mocked } from "jest-mock";
import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import { MetaSpace, type SpaceKey } from "../../../../../src/stores/spaces";
import { shouldShowComponent } from "../../../../../src/customisations/helpers/UIComponents";
import { UIComponent } from "../../../../../src/settings/UIFeature";
import { mkStubRoom, wrapInMatrixClientContext, wrapInSdkContext } from "../../../../test-utils";
import { SdkContextClass } from "../../../../../src/contexts/SDKContext";
import SpaceStore from "../../../../../src/stores/spaces/SpaceStore";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import { type SpaceNotificationState } from "../../../../../src/stores/notifications/SpaceNotificationState";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import UnwrappedSpacePanel from "../../../../../src/components/views/spaces/SpacePanel";

// DND test utilities based on
// https://github.com/colinrobertbrooks/react-beautiful-dnd-test-utils/issues/18#issuecomment-1373388693
enum Keys {
    SPACE = 32,
    ARROW_LEFT = 37,
    ARROW_UP = 38,
    ARROW_RIGHT = 39,
    ARROW_DOWN = 40,
}

enum DragDirection {
    LEFT = Keys.ARROW_LEFT,
    UP = Keys.ARROW_UP,
    RIGHT = Keys.ARROW_RIGHT,
    DOWN = Keys.ARROW_DOWN,
}

// taken from https://github.com/hello-pangea/dnd/blob/main/test/unit/integration/util/controls.ts#L20
const createTransitionEndEvent = (): Event => {
    const event = new Event("transitionend", {
        bubbles: true,
        cancelable: true,
    }) as TransitionEvent;

    // cheating and adding property to event as
    // TransitionEvent constructor does not exist.
    // This is needed because of the following check
    //   https://github.com/atlassian/react-beautiful-dnd/blob/master/src/view/draggable/draggable.jsx#L130
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event as any).propertyName = "transform";

    return event;
};

const pickUp = async (element: HTMLElement) => {
    fireEvent.keyDown(element, {
        keyCode: Keys.SPACE,
    });
    await screen.findByText(/You have lifted an item/i);

    act(() => {
        jest.runOnlyPendingTimers();
    });
};

const move = async (element: HTMLElement, direction: DragDirection) => {
    fireEvent.keyDown(element, {
        keyCode: direction,
    });
    await screen.findByText(/(You have moved the item | has been combined with)/i);
};

const drop = async (element: HTMLElement) => {
    fireEvent.keyDown(element, {
        keyCode: Keys.SPACE,
    });
    fireEvent(element.parentElement!, createTransitionEndEvent());

    await screen.findByText(/You have dropped the item/i);
};

jest.mock("../../../../../src/stores/spaces/SpaceStore", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const EventEmitter = require("events");
    class MockSpaceStore extends EventEmitter {
        invitedSpaces: SpaceKey[] = [];
        enabledMetaSpaces: MetaSpace[] = [];
        spacePanelSpaces: string[] = [];
        activeSpace: SpaceKey = "!space1";
        getChildSpaces = () => [] as Room[];
        getNotificationState = () => null as SpaceNotificationState | null;
        setActiveSpace = jest.fn();
        moveRootSpace = jest.fn();
    }
    return {
        instance: new MockSpaceStore(),
    };
});

jest.mock("../../../../../src/customisations/helpers/UIComponents", () => ({
    shouldShowComponent: jest.fn(),
}));

describe("<SpacePanel />", () => {
    const mockClient = {
        getUserId: jest.fn().mockReturnValue("@test:test"),
        getSafeUserId: jest.fn().mockReturnValue("@test:test"),
        mxcUrlToHttp: jest.fn(),
        getRoom: jest.fn(),
        isGuest: jest.fn(),
        getAccountData: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        removeListener: jest.fn(),
        isVersionSupported: jest.fn().mockResolvedValue(true),
        doesServerSupportUnstableFeature: jest.fn().mockResolvedValue(false),
    } as unknown as MatrixClient;
    const SpacePanel = wrapInSdkContext(wrapInMatrixClientContext(UnwrappedSpacePanel), SdkContextClass.instance);

    beforeAll(() => {
        jest.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);
        jest.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(mockClient);
    });

    beforeEach(() => {
        SpaceStore.instance.enabledMetaSpaces.push(
            MetaSpace.Home,
            MetaSpace.Favourites,
            MetaSpace.People,
            MetaSpace.Orphans,
            MetaSpace.VideoRooms,
        );
        mocked(shouldShowComponent).mockClear().mockReturnValue(true);
    });
    afterEach(() => {
        cleanup();
    });

    it("should show all activated MetaSpaces in the correct order", async () => {
        const originalGetValue = SettingsStore.getValue;
        const spySettingsStore = jest.spyOn(SettingsStore, "getValue").mockImplementation((setting) => {
            return setting === "feature_video_rooms" ? true : originalGetValue(setting);
        });
        const renderResult = render(<SpacePanel />);
        expect(renderResult.asFragment()).toMatchSnapshot();
        spySettingsStore.mockRestore();
    });

    describe("create new space button", () => {
        it("renders create space button when UIComponent.CreateSpaces component should be shown", () => {
            render(<SpacePanel />);
            screen.getByTestId("create-space-button");
        });

        it("does not render create space button when UIComponent.CreateSpaces component should not be shown", () => {
            mocked(shouldShowComponent).mockReturnValue(false);
            render(<SpacePanel />);
            expect(shouldShowComponent).toHaveBeenCalledWith(UIComponent.CreateSpaces);
            expect(screen.queryByTestId("create-space-button")).toBeFalsy();
        });

        it("opens context menu on create space button click", () => {
            render(<SpacePanel />);
            fireEvent.click(screen.getByTestId("create-space-button"));
            screen.getByTestId("create-space-button");
        });
    });

    it("should allow rearranging via drag and drop", async () => {
        (SpaceStore.instance.spacePanelSpaces as any) = [
            mkStubRoom("!room1:server", "Room 1", mockClient),
            mkStubRoom("!room2:server", "Room 2", mockClient),
            mkStubRoom("!room3:server", "Room 3", mockClient),
        ];
        DMRoomMap.makeShared(mockClient);
        jest.useFakeTimers();

        const { getByLabelText } = render(<SpacePanel />);

        const room1 = getByLabelText("Room 1");
        await pickUp(room1);
        await move(room1, DragDirection.DOWN);
        await drop(room1);

        expect(SpaceStore.instance.moveRootSpace).toHaveBeenCalledWith(0, 1);
    });
});
