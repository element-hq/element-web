/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { act } from "react";
import userEvent from "@testing-library/user-event";
import { type CryptoApi } from "matrix-js-sdk/src/crypto-api";
import { type Mocked, mocked } from "jest-mock";
import { type MatrixClient, type Room, RoomMember, User } from "matrix-js-sdk/src/matrix";
import { render, screen } from "jest-matrix-react";

import { ShareDialog } from "../../../../../../src/components/views/dialogs/ShareDialog";
import MatrixClientContext from "../../../../../../src/contexts/MatrixClientContext";
import { Action } from "../../../../../../src/dispatcher/actions";
import Modal from "../../../../../../src/Modal";
import { startDmOnFirstMessage, DirectoryMember } from "../../../../../../src/utils/direct-messages";
import MultiInviter from "../../../../../../src/utils/MultiInviter";
import { clearAllModals, flushPromises } from "../../../../../test-utils";
import { UserOptionsSection } from "../../../../../../src/components/views/right_panel/user_info/UserInfoBasic";
import dis from "../../../../../../src/dispatcher/dispatcher";
import { MatrixClientPeg } from "../../../../../../src/MatrixClientPeg";

jest.mock("../../../../../src/dispatcher/dispatcher");

const defaultRoomId = "!fkfk";
const defaultUserId = "@user:example.com";
const defaultUser = new User(defaultUserId);

let mockRoom: Mocked<Room>;
let mockClient: Mocked<MatrixClient>;
let mockCrypto: Mocked<CryptoApi>;

beforeEach(() => {
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

    mockCrypto = mocked({
        getDeviceVerificationStatus: jest.fn(),
        getUserDeviceInfo: jest.fn(),
        userHasCrossSigningKeys: jest.fn().mockResolvedValue(false),
        getUserVerificationStatus: jest.fn(),
        isEncryptionEnabledInRoom: jest.fn().mockResolvedValue(false),
    } as unknown as CryptoApi);

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

describe("<UserInfoBasic />", () => {});
