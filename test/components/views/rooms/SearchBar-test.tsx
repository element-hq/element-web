/*
Copyright 2022 Emmanuel Ezeka <eec.studies@gmail.com>

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

import React from "react";
import { fireEvent, render } from "@testing-library/react";

import SearchBar, { SearchScope } from "../../../../src/components/views/rooms/SearchBar";
import { KeyBindingAction } from "../../../../src/accessibility/KeyboardShortcuts";

let mockCurrentEvent = KeyBindingAction.Enter;

const searchProps = {
    onCancelClick: jest.fn(),
    onSearch: jest.fn(),
    searchInProgress: false,
    isRoomEncrypted: false,
};

jest.mock("../../../../src/KeyBindingsManager", () => ({
    __esModule: true,
    getKeyBindingsManager: jest.fn(() => ({ getAccessibilityAction: jest.fn(() => mockCurrentEvent) })),
}));

describe("SearchBar", () => {
    afterEach(() => {
        searchProps.onCancelClick.mockClear();
        searchProps.onSearch.mockClear();
    });

    it("must not search when input value is empty", () => {
        const { container } = render(<SearchBar {...searchProps} />);
        const roomButtons = container.querySelectorAll(".mx_SearchBar_button");
        const searchButton = container.querySelectorAll(".mx_SearchBar_searchButton");

        expect(roomButtons.length).toEqual(2);

        fireEvent.click(searchButton[0]);
        fireEvent.click(roomButtons[0]);
        fireEvent.click(roomButtons[1]);

        expect(searchProps.onSearch).not.toHaveBeenCalled();
    });

    it("must trigger onSearch when value is not empty", () => {
        const { container } = render(<SearchBar {...searchProps} />);
        const searchValue = "abcd";

        const roomButtons = container.querySelectorAll(".mx_SearchBar_button");
        const searchButton = container.querySelectorAll(".mx_SearchBar_searchButton");
        const input = container.querySelector<HTMLInputElement>(".mx_SearchBar_input input");
        input!.value = searchValue;

        expect(roomButtons.length).toEqual(2);

        fireEvent.click(searchButton[0]);

        expect(searchProps.onSearch).toHaveBeenCalledTimes(1);
        expect(searchProps.onSearch).toHaveBeenNthCalledWith(1, searchValue, SearchScope.Room);

        fireEvent.click(roomButtons[0]);

        expect(searchProps.onSearch).toHaveBeenCalledTimes(2);
        expect(searchProps.onSearch).toHaveBeenNthCalledWith(2, searchValue, SearchScope.Room);

        fireEvent.click(roomButtons[1]);

        expect(searchProps.onSearch).toHaveBeenCalledTimes(3);
        expect(searchProps.onSearch).toHaveBeenNthCalledWith(3, searchValue, SearchScope.All);
    });

    it("cancel button and esc key should trigger onCancelClick", async () => {
        mockCurrentEvent = KeyBindingAction.Escape;
        const { container } = render(<SearchBar {...searchProps} />);
        const cancelButton = container.querySelector(".mx_SearchBar_cancel");
        const input = container.querySelector(".mx_SearchBar_input input");
        fireEvent.click(cancelButton!);
        expect(searchProps.onCancelClick).toHaveBeenCalledTimes(1);

        fireEvent.focus(input!);
        fireEvent.keyDown(input!, { key: "Escape", code: "Escape", charCode: 27 });

        expect(searchProps.onCancelClick).toHaveBeenCalledTimes(2);
    });
});
