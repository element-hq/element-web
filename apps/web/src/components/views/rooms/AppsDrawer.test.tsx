/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { type MatrixClient, PendingEventOrdering, Room } from "matrix-js-sdk/src/matrix";
import { render } from "test-utils-rtl";
import { stubClient } from "test-utils";

import AppsDrawer from "./AppsDrawer";
import SdkConfig from "../../../SdkConfig";
import { WidgetLayoutStore } from "../../../stores/widgets/WidgetLayoutStore";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { SDKContext } from "../../../contexts/SDKContext";
import { SDKContextClass } from "../../../contexts/SDKContextClass";

const ROOM_ID = "!room:id";

describe("AppsDrawer", () => {
    let client: MatrixClient;
    let room: Room;
    let sdkContext: SDKContextClass;

    beforeEach(async () => {
        client = stubClient();
        room = new Room(ROOM_ID, client, client.getUserId()!, {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        sdkContext = new SDKContextClass();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("honours default_widget_container_height", () => {
        vi.spyOn(SdkConfig, "get").mockImplementation((key) => {
            if (!key) {
                return {
                    default_widget_container_height: 500,
                };
            }
        });
        vi.spyOn(WidgetLayoutStore.instance, "getContainerWidgets").mockImplementation((room, container) => {
            if (container === "top") {
                return [
                    {
                        id: "testwidget",
                        creatorUserId: client.getUserId()!,
                        type: "test",
                        url: "https://nowhere.dummy/notawidget",
                    },
                ];
            }
            return [];
        });

        const { container } = render(<AppsDrawer userId={client.getUserId()!} room={room} showApps={true} />, {
            wrapper: ({ ...rest }) => (
                <SDKContext.Provider value={sdkContext}>
                    <MatrixClientContext.Provider value={client} {...rest} />
                </SDKContext.Provider>
            ),
        });

        const appsDrawerResizer = container.getElementsByClassName("mx_AppsDrawer_resizer")[0] as HTMLElement;
        expect(appsDrawerResizer.style.height).toBe("500px");
    });
});
