/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { act, render } from "jest-matrix-react";
import React from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import SdkConfig from "../../../../../src/SdkConfig";
import SearchWarning, { WarningKind } from "../../../../../src/components/views/elements/SearchWarning";
import EventIndexPeg from "../../../../../src/indexing/EventIndexPeg";
import { type default as EventIndex } from "../../../../../src/indexing/EventIndex";

/**
 * A minimal fake EventIndex exposing only the surface that SearchWarning consumes:
 * `currentRoom()` (null once the crawl is complete) and the `changedCheckpoint` emitter.
 */
class FakeEventIndex {
    private listeners = new Map<string, Set<(...args: any[]) => void>>();

    public constructor(private current: Room | null) {}

    public currentRoom(): Room | null {
        return this.current;
    }

    public on(event: string, listener: (...args: any[]) => void): void {
        if (!this.listeners.has(event)) this.listeners.set(event, new Set());
        this.listeners.get(event)!.add(listener);
    }

    public removeListener(event: string, listener: (...args: any[]) => void): void {
        this.listeners.get(event)?.delete(listener);
    }

    /** Test helper: simulate the crawler advancing (or finishing, when `current` is null). */
    public emitChangedCheckpoint(current: Room | null): void {
        this.current = current;
        this.listeners.get("changedCheckpoint")?.forEach((listener) => listener(current));
    }
}

describe("<SearchWarning />", () => {
    afterEach(() => {
        EventIndexPeg.index = null;
        EventIndexPeg.error = undefined;
    });

    describe("with desktop builds available", () => {
        beforeEach(() => {
            EventIndexPeg.index = null;
            SdkConfig.put({
                brand: "Element",
                desktop_builds: {
                    available: true,
                    logo: "https://logo",
                    url: "https://url",
                },
            });
        });

        it("renders with a logo by default", () => {
            const { asFragment, getByRole } = render(
                <SearchWarning isRoomEncrypted={true} kind={WarningKind.Search} />,
            );
            expect(getByRole("presentation")).toHaveAttribute("src", "https://logo");
            expect(asFragment()).toMatchSnapshot();
        });

        it("renders without a logo when showLogo=false", () => {
            const { asFragment, queryByRole } = render(
                <SearchWarning isRoomEncrypted={true} kind={WarningKind.Search} showLogo={false} />,
            );

            expect(queryByRole("img")).not.toBeInTheDocument();
            expect(asFragment()).toMatchSnapshot();
        });
    });

    describe("with the event index present", () => {
        const setIndex = (index: FakeEventIndex): void => {
            EventIndexPeg.index = index as unknown as EventIndex;
        };

        it("renders the partial-index warning while the crawl is still in progress", () => {
            setIndex(new FakeEventIndex({ name: "Encrypted room" } as Room));

            const { queryByText, queryByRole } = render(
                <SearchWarning isRoomEncrypted={true} kind={WarningKind.Search} />,
            );

            expect(
                queryByText("Results may be incomplete because your search index is still being built."),
            ).toBeInTheDocument();
            // The notice appears dynamically while the panel is open, so it must be a live region (#32253).
            expect(queryByRole("status")).toBeInTheDocument();
        });

        it("renders nothing once the index has finished crawling", () => {
            // currentRoom() returns null when the crawl is complete (fully indexed).
            setIndex(new FakeEventIndex(null));

            const { container } = render(<SearchWarning isRoomEncrypted={true} kind={WarningKind.Search} />);

            expect(container).toBeEmptyDOMElement();
        });

        it("does not warn for the Files kind even while crawling", () => {
            setIndex(new FakeEventIndex({ name: "Encrypted room" } as Room));

            const { container } = render(<SearchWarning isRoomEncrypted={true} kind={WarningKind.Files} />);

            expect(container).toBeEmptyDOMElement();
        });

        it("clears the warning when a changedCheckpoint event reports completion", () => {
            const index = new FakeEventIndex({ name: "Encrypted room" } as Room);
            setIndex(index);

            const { queryByText } = render(<SearchWarning isRoomEncrypted={true} kind={WarningKind.Search} />);

            expect(
                queryByText("Results may be incomplete because your search index is still being built."),
            ).toBeInTheDocument();

            // The crawler drains its last checkpoint: currentRoom() becomes null.
            act(() => {
                index.emitChangedCheckpoint(null);
            });

            expect(
                queryByText("Results may be incomplete because your search index is still being built."),
            ).not.toBeInTheDocument();
        });

        it("renders nothing when the room is not encrypted even while crawling", () => {
            setIndex(new FakeEventIndex({ name: "Encrypted room" } as Room));

            const { container } = render(<SearchWarning isRoomEncrypted={false} kind={WarningKind.Search} />);

            expect(container).toBeEmptyDOMElement();
        });
    });

    describe("with no event index (web build)", () => {
        beforeEach(() => {
            EventIndexPeg.index = null;
            EventIndexPeg.error = undefined;
            SdkConfig.put({
                brand: "Element",
                desktop_builds: {
                    available: true,
                    logo: "https://logo",
                    url: "https://url",
                },
            });
        });

        it("still renders the desktop/enable-search warning", () => {
            const { container } = render(<SearchWarning isRoomEncrypted={true} kind={WarningKind.Search} />);

            expect(container.querySelector(".mx_SearchWarning")).toBeInTheDocument();
            expect(container.textContent).toContain("to search encrypted messages");
            // It is the desktop/enable-search affordance, not the partial-index notice.
            expect(container.textContent).not.toContain("your search index is still being built");
        });
    });
});
