/*
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

import { Landmark, LandmarkNavigation } from "../../src/accessibility/LandmarkNavigation";
import defaultDispatcher from "../../src/dispatcher/dispatcher";

describe("KeyboardLandmarkUtils", () => {
    it("Landmarks are cycled through correctly without an opened room", () => {
        render(
            <div>
                <div tabIndex={0} className="mx_SpaceButton_active" data-testid="mx_SpaceButton_active">
                    SPACE_BUTTON
                </div>
                <div tabIndex={0} className="mx_RoomSearch" data-testid="mx_RoomSearch">
                    ROOM_SEARCH
                </div>
                <div tabIndex={0} className="mx_RoomTile" data-testid="mx_RoomTile">
                    ROOM_TILE
                </div>
                <div tabIndex={0} className="mx_HomePage" data-testid="mx_HomePage">
                    HOME_PAGE
                </div>
            </div>,
        );
        // ACTIVE_SPACE_BUTTON <-> ROOM_SEARCH <-> ROOM_LIST <-> HOME <-> ACTIVE_SPACE_BUTTON
        // ACTIVE_SPACE_BUTTON -> ROOM_SEARCH
        LandmarkNavigation.findAndFocusNextLandmark(Landmark.ACTIVE_SPACE_BUTTON);
        expect(screen.getByTestId("mx_RoomSearch")).toHaveFocus();

        // ROOM_SEARCH -> ROOM_LIST
        LandmarkNavigation.findAndFocusNextLandmark(Landmark.ROOM_SEARCH);
        expect(screen.getByTestId("mx_RoomTile")).toHaveFocus();

        // ROOM_LIST -> HOME_PAGE
        LandmarkNavigation.findAndFocusNextLandmark(Landmark.ROOM_LIST);
        expect(screen.getByTestId("mx_HomePage")).toHaveFocus();

        // HOME_PAGE -> ACTIVE_SPACE_BUTTON
        LandmarkNavigation.findAndFocusNextLandmark(Landmark.MESSAGE_COMPOSER_OR_HOME);
        expect(screen.getByTestId("mx_SpaceButton_active")).toHaveFocus();

        // HOME_PAGE <- ACTIVE_SPACE_BUTTON
        LandmarkNavigation.findAndFocusNextLandmark(Landmark.ACTIVE_SPACE_BUTTON, true);
        expect(screen.getByTestId("mx_HomePage")).toHaveFocus();

        // ROOM_LIST <- HOME_PAGE
        LandmarkNavigation.findAndFocusNextLandmark(Landmark.MESSAGE_COMPOSER_OR_HOME, true);
        expect(screen.getByTestId("mx_RoomTile")).toHaveFocus();

        // ROOM_SEARCH <- ROOM_LIST
        LandmarkNavigation.findAndFocusNextLandmark(Landmark.ROOM_LIST, true);
        expect(screen.getByTestId("mx_RoomSearch")).toHaveFocus();

        // ACTIVE_SPACE_BUTTON <- ROOM_SEARCH
        LandmarkNavigation.findAndFocusNextLandmark(Landmark.ROOM_SEARCH, true);
        expect(screen.getByTestId("mx_SpaceButton_active")).toHaveFocus();
    });

    it("Landmarks are cycled through correctly with an opened room", async () => {
        const callback = jest.fn();
        defaultDispatcher.register(callback);
        render(
            <div>
                <div tabIndex={0} className="mx_SpaceButton_active" data-testid="mx_SpaceButton_active">
                    SPACE_BUTTON
                </div>
                <div tabIndex={0} className="mx_RoomSearch" data-testid="mx_RoomSearch">
                    ROOM_SEARCH
                </div>
                <div tabIndex={0} className="mx_RoomTile_selected" data-testid="mx_RoomTile_selected">
                    ROOM_TILE
                </div>
                <div tabIndex={0} className="mx_Room" data-testid="mx_Room">
                    ROOM
                    <div tabIndex={0} className="mx_MessageComposer">
                        COMPOSER
                    </div>
                </div>
            </div>,
        );
        // ACTIVE_SPACE_BUTTON <-> ROOM_SEARCH <-> ROOM_LIST <-> MESSAGE_COMPOSER <-> ACTIVE_SPACE_BUTTON
        // ACTIVE_SPACE_BUTTON -> ROOM_SEARCH
        LandmarkNavigation.findAndFocusNextLandmark(Landmark.ACTIVE_SPACE_BUTTON);
        expect(screen.getByTestId("mx_RoomSearch")).toHaveFocus();

        // ROOM_SEARCH -> ROOM_LIST
        LandmarkNavigation.findAndFocusNextLandmark(Landmark.ROOM_SEARCH);
        expect(screen.getByTestId("mx_RoomTile_selected")).toHaveFocus();

        // ROOM_LIST -> MESSAGE_COMPOSER
        LandmarkNavigation.findAndFocusNextLandmark(Landmark.ROOM_LIST);
        await waitFor(() => expect(callback).toHaveBeenCalledTimes(1));

        // MESSAGE_COMPOSER -> ACTIVE_SPACE_BUTTON
        LandmarkNavigation.findAndFocusNextLandmark(Landmark.MESSAGE_COMPOSER_OR_HOME);
        expect(screen.getByTestId("mx_SpaceButton_active")).toHaveFocus();

        // MESSAGE_COMPOSER <- ACTIVE_SPACE_BUTTON
        LandmarkNavigation.findAndFocusNextLandmark(Landmark.ACTIVE_SPACE_BUTTON, true);
        await waitFor(() => expect(callback).toHaveBeenCalledTimes(2));

        // ROOM_LIST <- MESSAGE_COMPOSER
        LandmarkNavigation.findAndFocusNextLandmark(Landmark.MESSAGE_COMPOSER_OR_HOME, true);
        expect(screen.getByTestId("mx_RoomTile_selected")).toHaveFocus();

        // ROOM_SEARCH <- ROOM_LIST
        LandmarkNavigation.findAndFocusNextLandmark(Landmark.ROOM_LIST, true);
        expect(screen.getByTestId("mx_RoomSearch")).toHaveFocus();

        // ACTIVE_SPACE_BUTTON <- ROOM_SEARCH
        LandmarkNavigation.findAndFocusNextLandmark(Landmark.ROOM_SEARCH, true);
        expect(screen.getByTestId("mx_SpaceButton_active")).toHaveFocus();
    });
});
