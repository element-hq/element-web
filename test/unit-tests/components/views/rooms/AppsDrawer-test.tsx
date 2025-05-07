/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type MatrixClient, PendingEventOrdering, Room } from "matrix-js-sdk/src/matrix";
import { render } from "jest-matrix-react";

import { stubClient } from "../../../../test-utils";
import AppsDrawer from "../../../../../src/components/views/rooms/AppsDrawer";
import SdkConfig from "../../../../../src/SdkConfig";
import ResizeNotifier from "../../../../../src/utils/ResizeNotifier";
import { WidgetLayoutStore } from "../../../../../src/stores/widgets/WidgetLayoutStore";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";

const ROOM_ID = "!room:id";

describe("AppsDrawer", () => {
    let client: MatrixClient;
    let room: Room;
    let dummyResizeNotifier: ResizeNotifier;

    beforeEach(async () => {
        client = stubClient();
        room = new Room(ROOM_ID, client, client.getUserId()!, {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        dummyResizeNotifier = new ResizeNotifier();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("honours default_widget_container_height", () => {
        jest.spyOn(SdkConfig, "get").mockImplementation((key) => {
            if (!key) {
                return {
                    default_widget_container_height: 500,
                };
            }
        });
        jest.spyOn(WidgetLayoutStore.instance, "getContainerWidgets").mockImplementation((room, container) => {
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

        const { container } = render(
            <AppsDrawer
                userId={client.getUserId()!}
                room={room}
                resizeNotifier={dummyResizeNotifier}
                showApps={true}
            />,
            {
                wrapper: ({ ...rest }) => <MatrixClientContext.Provider value={client} {...rest} />,
            },
        );

        const appsDrawerResizer = container.getElementsByClassName("mx_AppsDrawer_resizer")[0] as HTMLElement;
        expect(appsDrawerResizer.style.height).toBe("500px");
    });
});
