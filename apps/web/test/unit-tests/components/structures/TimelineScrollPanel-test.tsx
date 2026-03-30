/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { EventEmitter } from "events";
import { type MatrixEvent, Room, RoomMember, type Thread, ReceiptType } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { act, render as baseRender, within, type RenderOptions } from "jest-matrix-react";
import { VirtuosoMockContext } from "react-virtuoso";

import MessagePanel, {
    shouldFormContinuation,
    type TimelineRow,
} from "../../../../src/components/structures/MessagePanel.tsx";
import TimelineScrollPanel from "../../../../src/components/structures/TimelineScrollPanel.tsx";
import { type IScrollHandle } from "../../../../src/components/structures/ScrollPanel.tsx";
import {
    TimelineScrollPanelListView,
    type TimelineScrollPanelItem,
} from "../../../../src/components/structures/TimelineScrollPanelView.tsx";
import { getKeyBindingsManager } from "../../../../src/KeyBindingsManager.ts";
import { KeyBindingAction } from "../../../../src/accessibility/KeyboardShortcuts.ts";
import SettingsStore from "../../../../src/settings/SettingsStore.ts";
import RoomContext, { type RoomContextType, TimelineRenderingType } from "../../../../src/contexts/RoomContext.ts";
import DMRoomMap from "../../../../src/utils/DMRoomMap.ts";
import * as TestUtilsMatrix from "../../../test-utils/index.ts";
import {
    clientAndSDKContextRenderOptions,
    createTestClient,
    getMockClientWithEventEmitter,
    makeBeaconInfoEvent,
    mockClientMethodsCrypto,
    mockClientMethodsEvents,
    mockClientMethodsUser,
    mockClientPushProcessor,
} from "../../../test-utils/index.ts";
import type ResizeNotifier from "../../../../src/utils/ResizeNotifier.ts";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg.ts";
import { ScopedRoomContextProvider } from "../../../../src/contexts/ScopedRoomContext.tsx";
import { SdkContextClass } from "../../../../src/contexts/SDKContext.ts";
import { TimelineScrollPanelViewModel } from "../../../../src/viewmodels/timeline/TimelineScrollPanelViewModel.ts";

jest.mock("../../../../src/utils/beacon", () => ({
    useBeacon: jest.fn(),
}));

const roomId = "!roomId:server_name";
const render = (ui: React.ReactElement, options: RenderOptions = {}) => {
    const ExistingWrapper = options.wrapper;

    return baseRender(ui, {
        ...options,
        wrapper: ({ children }) => (
            <VirtuosoMockContext.Provider value={{ viewportHeight: 600, itemHeight: 56 }}>
                {ExistingWrapper ? <ExistingWrapper>{children}</ExistingWrapper> : children}
            </VirtuosoMockContext.Provider>
        ),
    });
};
const installScrollByShim = (): void => {
    const scrollBy = function (this: HTMLElement, x: number, y?: number): void {
        const deltaY = typeof y === "number" ? y : x;
        this.scrollTop = (this.scrollTop ?? 0) + deltaY;
    };

    Object.defineProperty(Element.prototype, "scrollBy", {
        configurable: true,
        writable: true,
        value: scrollBy,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollBy", {
        configurable: true,
        writable: true,
        value: scrollBy,
    });
    Object.defineProperty(HTMLDivElement.prototype, "scrollBy", {
        configurable: true,
        writable: true,
        value: scrollBy,
    });
};

beforeEach(() => {
    installScrollByShim();
});

describe("TimelineScrollPanel wrapper", () => {
    it("exposes the inner scroll container through the wrapper ref", () => {
        const ref = React.createRef<IScrollHandle>();
        render(
            <TimelineScrollPanel ref={ref}>
                <li data-scroll-tokens="event-a">A</li>
            </TimelineScrollPanel>,
        );

        expect(ref.current).not.toBeNull();
        expect(ref.current?.divScroll).toBeInstanceOf(HTMLDivElement);
    });

    it("exposes the full imperative scroll-handle contract", () => {
        const ref = React.createRef<IScrollHandle>();
        render(
            <TimelineScrollPanel ref={ref}>
                <li data-scroll-tokens="event-a">A</li>
            </TimelineScrollPanel>,
        );

        expect(ref.current).not.toBeNull();
        expect(typeof ref.current?.isAtBottom).toBe("function");
        expect(typeof ref.current?.getScrollState).toBe("function");
        expect(typeof ref.current?.scrollToTop).toBe("function");
        expect(typeof ref.current?.scrollToBottom).toBe("function");
        expect(typeof ref.current?.scrollToToken).toBe("function");
        expect(typeof ref.current?.handleScrollKey).toBe("function");
        expect(typeof ref.current?.checkScroll).toBe("function");
        expect(typeof ref.current?.preventShrinking).toBe("function");
        expect(typeof ref.current?.clearPreventShrinking).toBe("function");
        expect(typeof ref.current?.updatePreventShrinking).toBe("function");

        expect(() => ref.current?.isAtBottom()).not.toThrow();
        expect(() => ref.current?.getScrollState()).not.toThrow();
        expect(() => ref.current?.scrollToTop()).not.toThrow();
        expect(() =>
            act(() => {
                ref.current?.scrollToBottom();
            }),
        ).not.toThrow();
        expect(() => ref.current?.scrollToToken("event-a", 12, 0.5)).not.toThrow();
        expect(() => ref.current?.handleScrollKey({} as React.KeyboardEvent)).not.toThrow();
        expect(() => ref.current?.checkScroll(true)).not.toThrow();
        expect(() => ref.current?.preventShrinking()).not.toThrow();
        expect(() => ref.current?.clearPreventShrinking()).not.toThrow();
        expect(() => ref.current?.updatePreventShrinking()).not.toThrow();
    });

    it("keeps wrapper-owned scroll state until a sync point updates it", () => {
        const ref = React.createRef<IScrollHandle>();
        render(
            <TimelineScrollPanel ref={ref}>
                <li data-scroll-tokens="event-a">A</li>
            </TimelineScrollPanel>,
        );

        const firstState = ref.current?.getScrollState();
        const firstScrollNode = ref.current?.divScroll;
        ref.current?.checkScroll();
        const secondState = ref.current?.getScrollState();
        const secondScrollNode = ref.current?.divScroll;

        expect(firstState).toBeDefined();
        expect(firstScrollNode).toBeInstanceOf(HTMLDivElement);
        expect(secondState).toBeDefined();
        expect(typeof secondState).toBe("object");
        expect(secondScrollNode).toBe(firstScrollNode);
        expect(() =>
            act(() => {
                ref.current?.scrollToBottom();
            }),
        ).not.toThrow();
        expect(ref.current?.getScrollState()).toEqual(expect.any(Object));
    });

    it("handles keyboard scrolling through the wrapper", () => {
        const ref = React.createRef<IScrollHandle>();
        render(
            <TimelineScrollPanel ref={ref}>
                <li data-scroll-tokens="event-a">A</li>
            </TimelineScrollPanel>,
        );

        const scrollNode = ref.current?.divScroll;
        expect(scrollNode).toBeInstanceOf(HTMLDivElement);

        const scrollBySpy = jest.fn();
        Object.defineProperty(scrollNode!, "scrollBy", {
            value: scrollBySpy,
            configurable: true,
        });
        const getRoomActionSpy = jest
            .spyOn(getKeyBindingsManager(), "getRoomAction")
            .mockReturnValue(KeyBindingAction.ScrollDown);

        ref.current?.handleScrollKey({} as React.KeyboardEvent);

        expect(scrollBySpy).toHaveBeenCalledWith(0, scrollNode!.clientHeight * 0.9);

        getRoomActionSpy.mockRestore();
    });

    it("tracks bottom state from the wrapper-owned scroll container", () => {
        const ref = React.createRef<IScrollHandle>();
        render(
            <TimelineScrollPanel ref={ref}>
                <li data-scroll-tokens="event-a">A</li>
            </TimelineScrollPanel>,
        );

        const scrollNode = ref.current?.divScroll;
        expect(scrollNode).toBeInstanceOf(HTMLDivElement);

        Object.defineProperties(scrollNode!, {
            scrollHeight: {
                value: 400,
                configurable: true,
            },
            clientHeight: {
                value: 100,
                configurable: true,
            },
            scrollTop: {
                value: 300,
                configurable: true,
                writable: true,
            },
        });

        ref.current?.checkScroll();
        expect(ref.current?.isAtBottom()).toBe(true);

        scrollNode!.scrollTop = 250;
        act(() => {
            scrollNode!.dispatchEvent(new Event("scroll"));
        });
        expect(ref.current?.isAtBottom()).toBe(false);
    });

    it("keeps wrapper-owned state coherent when scrolling to a token", () => {
        const ref = React.createRef<IScrollHandle>();
        render(
            <TimelineScrollPanel ref={ref}>
                <li data-scroll-tokens="event-a">A</li>
            </TimelineScrollPanel>,
        );

        const firstState = ref.current?.getScrollState();
        const firstScrollNode = ref.current?.divScroll;

        ref.current?.scrollToToken("event-a", 12, 0.5);

        const secondState = ref.current?.getScrollState();
        const secondScrollNode = ref.current?.divScroll;

        expect(firstState).toBeDefined();
        expect(secondState).toBeDefined();
        expect(typeof secondState).toBe("object");
        expect(firstScrollNode).toBeInstanceOf(HTMLDivElement);
        expect(secondScrollNode).toBe(firstScrollNode);
    });

    it("keeps wrapper-owned state coherent when jumping to top and bottom", () => {
        const ref = React.createRef<IScrollHandle>();
        render(
            <TimelineScrollPanel ref={ref}>
                <li data-scroll-tokens="event-a">A</li>
                <li data-scroll-tokens="event-b">B</li>
            </TimelineScrollPanel>,
        );

        const firstScrollNode = ref.current?.divScroll;

        ref.current?.scrollToTop();
        const afterTopState = ref.current?.getScrollState();
        const afterTopScrollNode = ref.current?.divScroll;

        act(() => {
            ref.current?.scrollToBottom();
        });
        const afterBottomState = ref.current?.getScrollState();
        const afterBottomScrollNode = ref.current?.divScroll;

        expect(firstScrollNode).toBeInstanceOf(HTMLDivElement);
        expect(afterTopState).toEqual(expect.any(Object));
        expect(afterTopScrollNode).toBe(firstScrollNode);
        expect(afterBottomState).toEqual(expect.any(Object));
        expect(afterBottomScrollNode).toBeInstanceOf(HTMLDivElement);
    });

    it("assigns unique ids to rendered li timeline rows", () => {
        const firstEvent = TestUtilsMatrix.mkMessage({
            room: roomId,
            user: "@alice:server_name",
            msg: "First",
            event: true,
        });
        const secondEvent = TestUtilsMatrix.mkMessage({
            room: roomId,
            user: "@alice:server_name",
            msg: "Second",
            event: true,
        });
        const rows: TimelineRow[] = [firstEvent, secondEvent].map((event) => ({
            kind: "event",
            key: event.getId()!,
            eventId: event.getId()!,
            event,
            isEditing: false,
            continuation: false,
            last: false,
            lastInSection: false,
            highlight: false,
        }));
        rows.unshift({
            kind: "date-separator",
            key: "date-separator-0",
            roomId,
            ts: 0,
        });

        const { container } = render(
            <TimelineScrollPanel
                rows={rows}
                renderRow={(row) => {
                    switch (row.kind) {
                        case "date-separator":
                            return <li data-scroll-tokens="date-separator">Date separator</li>;
                        case "event":
                            return <li data-scroll-tokens={row.eventId}>{row.eventId}</li>;
                        default:
                            return null;
                    }
                }}
            />,
        );

        const renderedListItems = [...container.querySelectorAll<HTMLElement>("ol > li[id], ol > div > li[id]")];
        expect(renderedListItems).toHaveLength(3);
        expect(renderedListItems.map((node) => node.id)).toEqual([
            "mx_TimelinePanel_date-separator_date-separator-0",
            `mx_TimelinePanel_event_${firstEvent.getId()!.replace(/[^A-Za-z0-9_-]/g, "_")}`,
            `mx_TimelinePanel_event_${secondEvent.getId()!.replace(/[^A-Za-z0-9_-]/g, "_")}`,
        ]);
        expect(new Set(renderedListItems.map((node) => node.id)).size).toBe(3);
    });

    it("synthesizes unique virtual ids when source row keys collide", () => {
        const rows: TimelineRow[] = [
            {
                kind: "late-event-separator",
                key: "duplicate-key",
                text: "One",
            },
            {
                kind: "late-event-separator",
                key: "duplicate-key",
                text: "Two",
            },
        ];

        const { container } = render(
            <TimelineScrollPanel
                rows={rows}
                renderRow={(row) => {
                    if (row.kind !== "late-event-separator") {
                        return null;
                    }

                    return <li data-scroll-tokens={row.key}>{row.text}</li>;
                }}
            />,
        );

        const renderedListItems = [...container.querySelectorAll<HTMLElement>("ol > li[id], ol > div > li[id]")];
        expect(renderedListItems).toHaveLength(2);
        expect(renderedListItems.map((node) => node.id)).toEqual([
            "mx_TimelinePanel_late-event-separator_duplicate-key",
            "mx_TimelinePanel_late-event-separator_duplicate-key_2",
        ]);
    });

    it("keeps wrapper-owned state coherent when using shrinking prevention", () => {
        const ref = React.createRef<IScrollHandle>();
        render(
            <TimelineScrollPanel ref={ref}>
                <li data-scroll-tokens="event-a">A</li>
                <li data-scroll-tokens="event-b">B</li>
            </TimelineScrollPanel>,
        );

        const firstScrollNode = ref.current?.divScroll;

        ref.current?.preventShrinking();
        const afterPreventState = ref.current?.getScrollState();
        const afterPreventScrollNode = ref.current?.divScroll;

        ref.current?.updatePreventShrinking();
        const afterUpdateState = ref.current?.getScrollState();
        const afterUpdateScrollNode = ref.current?.divScroll;

        ref.current?.clearPreventShrinking();
        const afterClearState = ref.current?.getScrollState();
        const afterClearScrollNode = ref.current?.divScroll;

        expect(firstScrollNode).toBeInstanceOf(HTMLDivElement);
        expect(afterPreventState).toEqual(expect.any(Object));
        expect(afterPreventScrollNode).toBe(firstScrollNode);
        expect(afterUpdateState).toEqual(expect.any(Object));
        expect(afterUpdateScrollNode).toBe(firstScrollNode);
        expect(afterClearState).toEqual(expect.any(Object));
        expect(afterClearScrollNode).toBe(firstScrollNode);
    });

    it("requests backfill through the mounted virtualized path when the initial visible range is near the top", async () => {
        const onFillRequest = jest.fn().mockResolvedValue(false);
        const items = Array.from({ length: 50 }, (_value, index) => (
            <li key={`event-${index}`} data-scroll-tokens={`event-${index}`}>
                {index}
            </li>
        ));
        let TimelineScrollPanelWithMock: typeof TimelineScrollPanel | undefined;

        await jest.isolateModulesAsync(async () => {
            jest.doMock("react", () => React);
            jest.doMock("../../../../src/components/structures/TimelineScrollPanelView.tsx", () => {
                function MockTimelineScrollPanelView(props: {
                    items: TimelineScrollPanelItem[];
                    scrollContainerRef: (element: HTMLElement | Window | null) => void;
                    onVisibleRangeChange?: (range: { startIndex: number; endIndex: number }) => void;
                }): React.ReactNode {
                    const scrollRef = React.useRef<HTMLDivElement | null>(null);

                    React.useEffect(() => {
                        const element = scrollRef.current;
                        if (!element) return;

                        Object.defineProperties(element, {
                            scrollHeight: {
                                value: 10000,
                                configurable: true,
                            },
                            clientHeight: {
                                value: 500,
                                configurable: true,
                            },
                            scrollTop: {
                                value: 200,
                                configurable: true,
                                writable: true,
                            },
                        });
                        props.scrollContainerRef(element);
                        props.onVisibleRangeChange?.({ startIndex: 0, endIndex: 8 });
                    }, [props]);

                    return (
                        <div ref={scrollRef}>
                            {props.items.map((item) => item.node)}
                        </div>
                    );
                }

                return {
                    __esModule: true,
                    default: MockTimelineScrollPanelView,
                };
            });

            TimelineScrollPanelWithMock = (
                await import("../../../../src/components/structures/TimelineScrollPanel.tsx")
            ).default;
        });

        expect(TimelineScrollPanelWithMock).toBeDefined();
        const MockedTimelineScrollPanel = TimelineScrollPanelWithMock!;

        render(<MockedTimelineScrollPanel onFillRequest={onFillRequest}>{items}</MockedTimelineScrollPanel>);

        await Promise.resolve();
        expect(onFillRequest).toHaveBeenCalledWith(true);
        jest.dontMock("../../../../src/components/structures/TimelineScrollPanelView.tsx");
        jest.dontMock("react");
    });

    it("requests unfill through the mounted virtualized path when the visible range is far from the top", async () => {
        jest.useFakeTimers();

        const onUnfillRequest = jest.fn();
        const items = Array.from({ length: 50 }, (_value, index) => (
            <li key={`event-${index}`} data-scroll-tokens={`event-${index}`}>
                {index}
            </li>
        ));
        let TimelineScrollPanelWithMock: typeof TimelineScrollPanel | undefined;

        await jest.isolateModulesAsync(async () => {
            jest.doMock("react", () => React);
            jest.doMock("../../../../src/components/structures/TimelineScrollPanelView.tsx", () => {
                function MockTimelineScrollPanelView(props: {
                    items: TimelineScrollPanelItem[];
                    scrollContainerRef: (element: HTMLElement | Window | null) => void;
                    onVisibleRangeChange?: (range: { startIndex: number; endIndex: number }) => void;
                }): React.ReactNode {
                    const scrollRef = React.useRef<HTMLDivElement | null>(null);

                    React.useEffect(() => {
                        const element = scrollRef.current;
                        if (!element) return;

                        Object.defineProperties(element, {
                            scrollHeight: {
                                value: 10000,
                                configurable: true,
                            },
                            clientHeight: {
                                value: 500,
                                configurable: true,
                            },
                            scrollTop: {
                                value: 7000,
                                configurable: true,
                                writable: true,
                            },
                        });
                        props.scrollContainerRef(element);
                        props.onVisibleRangeChange?.({ startIndex: 25, endIndex: 30 });
                    }, [props]);

                    return (
                        <div ref={scrollRef}>
                            {props.items.map((item) => item.node)}
                        </div>
                    );
                }

                return {
                    __esModule: true,
                    default: MockTimelineScrollPanelView,
                };
            });

            TimelineScrollPanelWithMock = (
                await import("../../../../src/components/structures/TimelineScrollPanel.tsx")
            ).default;
        });

        expect(TimelineScrollPanelWithMock).toBeDefined();
        const MockedTimelineScrollPanel = TimelineScrollPanelWithMock!;

        render(<MockedTimelineScrollPanel onUnfillRequest={onUnfillRequest}>{items}</MockedTimelineScrollPanel>);

        jest.advanceTimersByTime(250);
        await Promise.resolve();

        expect(onUnfillRequest).toHaveBeenCalledWith(true, "event-49");

        jest.dontMock("../../../../src/components/structures/TimelineScrollPanelView.tsx");
        jest.dontMock("react");
        jest.useRealTimers();
    });

    it("suppresses forward unfill through the mounted virtualized path in sticky-bottom live mode", async () => {
        jest.useFakeTimers();

        const onUnfillRequest = jest.fn();
        const items = Array.from({ length: 50 }, (_value, index) => (
            <li key={`event-${index}`} data-scroll-tokens={`event-${index}`}>
                {index}
            </li>
        ));
        let TimelineScrollPanelWithMock: typeof TimelineScrollPanel | undefined;

        await jest.isolateModulesAsync(async () => {
            jest.doMock("react", () => React);
            jest.doMock("../../../../src/components/structures/TimelineScrollPanelView.tsx", () => {
                function MockTimelineScrollPanelView(props: {
                    items: TimelineScrollPanelItem[];
                    scrollContainerRef: (element: HTMLElement | Window | null) => void;
                    onVisibleRangeChange?: (range: { startIndex: number; endIndex: number }) => void;
                }): React.ReactNode {
                    const scrollRef = React.useRef<HTMLDivElement | null>(null);

                    React.useEffect(() => {
                        const element = scrollRef.current;
                        if (!element) return;

                        Object.defineProperties(element, {
                            scrollHeight: {
                                value: 10000,
                                configurable: true,
                            },
                            clientHeight: {
                                value: 500,
                                configurable: true,
                            },
                            scrollTop: {
                                value: 9500,
                                configurable: true,
                                writable: true,
                            },
                        });

                        props.scrollContainerRef(element);
                        window.setTimeout(() => {
                            props.onVisibleRangeChange?.({ startIndex: 25, endIndex: 28 });
                        }, 0);
                    }, [props]);

                    return (
                        <div ref={scrollRef}>
                            {props.items.map((item) => item.node)}
                        </div>
                    );
                }

                return {
                    __esModule: true,
                    default: MockTimelineScrollPanelView,
                };
            });

            TimelineScrollPanelWithMock = (
                await import("../../../../src/components/structures/TimelineScrollPanel.tsx")
            ).default;
        });

        expect(TimelineScrollPanelWithMock).toBeDefined();
        const MockedTimelineScrollPanel = TimelineScrollPanelWithMock!;
        const ref = React.createRef<IScrollHandle>();
        const { container } = render(
            <MockedTimelineScrollPanel ref={ref} stickyBottom={true} onUnfillRequest={onUnfillRequest}>
                {items}
            </MockedTimelineScrollPanel>,
        );

        const scrollNode = container.querySelector("div");
        expect(scrollNode).toBeInstanceOf(HTMLDivElement);
        Object.defineProperties(scrollNode!, {
            scrollHeight: {
                value: 10000,
                configurable: true,
            },
            clientHeight: {
                value: 500,
                configurable: true,
            },
            scrollTop: {
                value: 9500,
                configurable: true,
                writable: true,
            },
        });

        ref.current?.checkScroll();
        act(() => {
            scrollNode!.dispatchEvent(new Event("scroll"));
        });
        jest.advanceTimersByTime(250);
        await Promise.resolve();

        expect(onUnfillRequest).toHaveBeenCalledTimes(1);
        expect(onUnfillRequest).toHaveBeenCalledWith(true, "event-49");

        jest.dontMock("../../../../src/components/structures/TimelineScrollPanelView.tsx");
        jest.dontMock("react");
        jest.useRealTimers();
    });
});

describe("TimelineScrollPanelViewModel", () => {
    it("keeps scroll container state disabled by default", () => {
        const vm = new TimelineScrollPanelViewModel();

        expect(vm.getSnapshot().hasScrollContainer).toBe(false);
    });

    it("updates the scroll container flag through sync", () => {
        const vm = new TimelineScrollPanelViewModel();

        vm.sync({ hasScrollContainer: true });
        expect(vm.getSnapshot().hasScrollContainer).toBe(true);

        vm.sync({ hasScrollContainer: false });
        expect(vm.getSnapshot().hasScrollContainer).toBe(false);
    });
});

describe("TimelineScrollPanelView", () => {
    it("renders the virtualized list view with the message list class", () => {
        const items: TimelineScrollPanelItem[] = [
            {
                key: "event-a",
                node: <li data-scroll-tokens="event-a">A</li>,
            },
            {
                key: "event-b",
                node: <li data-scroll-tokens="event-b">B</li>,
            },
        ];

        const { container } = render(
            <TimelineScrollPanelListView
                items={items}
                renderItem={(item) => item.node}
                scrollContainerRef={jest.fn()}
            />,
        );

        expect(container.getElementsByClassName("mx_RoomView_MessageList").length).toBe(1);
        expect(container.querySelector("[data-virtuoso-scroller='true']")).not.toBeNull();
    });

    it("does not leak the virtuoso context prop to the DOM", () => {
        const items: TimelineScrollPanelItem[] = [
            {
                key: "event-a",
                node: <li data-scroll-tokens="event-a">A</li>,
            },
        ];

        const { container } = render(
            <TimelineScrollPanelListView
                items={items}
                renderItem={(item) => item.node}
                scrollContainerRef={jest.fn()}
            />,
        );

        expect(container.querySelector("[context]")).toBeNull();
    });

    it("exposes the virtuoso scroller through scrollContainerRef", () => {
        const items: TimelineScrollPanelItem[] = [
            {
                key: "event-a",
                node: <li data-scroll-tokens="event-a">A</li>,
            },
        ];
        const scrollContainerRef = jest.fn();

        const { container } = render(
            <TimelineScrollPanelListView
                items={items}
                renderItem={(item) => item.node}
                scrollContainerRef={scrollContainerRef}
            />,
        );

        const scroller = container.querySelector("[data-virtuoso-scroller='true']");

        expect(scroller).toBeInstanceOf(HTMLDivElement);
        expect(scrollContainerRef).toHaveBeenCalledWith(scroller);
    });

    it("forwards scroll events from the virtuoso scroller", () => {
        const items: TimelineScrollPanelItem[] = [
            {
                key: "event-a",
                node: <li data-scroll-tokens="event-a">A</li>,
            },
        ];
        const onScroll = jest.fn();

        const { container } = render(
            <TimelineScrollPanelListView
                items={items}
                renderItem={(item) => item.node}
                scrollContainerRef={jest.fn()}
                onScroll={onScroll}
            />,
        );

        const scroller = container.querySelector("[data-virtuoso-scroller='true']") as HTMLDivElement;
        act(() => {
            scroller.dispatchEvent(new Event("scroll"));
        });

        expect(onScroll).toHaveBeenCalled();
    });

    it("keeps scroll-container ownership in the list layer for virtualized mode", () => {
        const items: TimelineScrollPanelItem[] = [
            {
                key: "event-a",
                node: <li data-scroll-tokens="event-a">A</li>,
            },
        ];
        const scrollContainerRef = jest.fn();

        const { container } = render(
            <TimelineScrollPanelListView
                items={items}
                renderItem={(item) => item.node}
                scrollContainerRef={scrollContainerRef}
            />,
        );

        const scroller = container.querySelector("[data-virtuoso-scroller='true']");

        expect(scroller).toBeInstanceOf(HTMLDivElement);
        expect(scrollContainerRef).toHaveBeenCalledWith(scroller);
    });
});

describe("TimelineScrollPanel", function () {
    const events = mkEvents();
    const userId = "@me:here";
    const client = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsEvents(),
        ...mockClientMethodsCrypto(),
        ...mockClientPushProcessor(),
        getAccountData: jest.fn(),
        isUserIgnored: jest.fn().mockReturnValue(false),
        isRoomEncrypted: jest.fn().mockReturnValue(false),
        getRoom: jest.fn(),
        getClientWellKnown: jest.fn().mockReturnValue({}),
        supportsThreads: jest.fn().mockReturnValue(true),
    });
    let sdkContext: SdkContextClass;
    jest.spyOn(MatrixClientPeg, "get").mockReturnValue(client);

    const room = new Room(roomId, client, userId);

    const bobMember = new RoomMember(roomId, "@bob:id");
    bobMember.name = "Bob";
    jest.spyOn(bobMember, "getAvatarUrl").mockReturnValue("avatar.jpeg");
    jest.spyOn(bobMember, "getMxcAvatarUrl").mockReturnValue("mxc://avatar.url/image.png");

    const alice = "@alice:example.org";
    const aliceMember = new RoomMember(roomId, alice);
    aliceMember.name = "Alice";
    jest.spyOn(aliceMember, "getAvatarUrl").mockReturnValue("avatar.jpeg");
    jest.spyOn(aliceMember, "getMxcAvatarUrl").mockReturnValue("mxc://avatar.url/image.png");

    const defaultProps = {
        resizeNotifier: new EventEmitter() as unknown as ResizeNotifier,
        callEventGroupers: new Map(),
        room,
        className: "cls",
        events: [] as MatrixEvent[],
    };

    const defaultRoomContext = {
        ...RoomContext,
        timelineRenderingType: TimelineRenderingType.Room,
        room,
        roomId: room.roomId,
        canReact: true,
        canSendMessages: true,
        showReadReceipts: true,
        showRedactions: false,
        showJoinLeaves: false,
        showAvatarChanges: false,
        showDisplaynameChanges: true,
        showHiddenEvents: false,
    } as unknown as RoomContextType;

    const getComponent = (props = {}, roomContext: Partial<RoomContextType> = {}) => (
        <ScopedRoomContextProvider {...defaultRoomContext} {...roomContext}>
            <MessagePanel {...defaultProps} {...props} />
        </ScopedRoomContextProvider>
    );

    beforeEach(function () {
        jest.clearAllMocks();
        // HACK: We assume all settings want to be disabled
        jest.spyOn(SettingsStore, "getValue").mockImplementation((arg) => {
            return arg === "showDisplaynameChanges" || arg === "feature_new_timeline";
        });

        sdkContext = new SdkContextClass();

        DMRoomMap.makeShared(client);
    });

    function mkEvents() {
        const events: MatrixEvent[] = [];
        const ts0 = Date.now();
        for (let i = 0; i < 10; i++) {
            events.push(
                TestUtilsMatrix.mkMessage({
                    event: true,
                    room: "!room:id",
                    user: "@user:id",
                    ts: ts0 + i * 1000,
                }),
            );
        }
        return events;
    }

    // Just to avoid breaking Dateseparator tests that might run at 00hrs
    function mkOneDayEvents() {
        const events: MatrixEvent[] = [];
        const ts0 = Date.parse("09 May 2004 00:12:00 GMT");
        for (let i = 0; i < 10; i++) {
            events.push(
                TestUtilsMatrix.mkMessage({
                    event: true,
                    room: "!room:id",
                    user: "@user:id",
                    ts: ts0 + i * 1000,
                }),
            );
        }
        return events;
    }

    // make a collection of events with some member events that should be collapsed with an EventListSummary
    function mkMelsEvents() {
        const events: MatrixEvent[] = [];
        const ts0 = Date.now();

        let i = 0;
        events.push(
            TestUtilsMatrix.mkMessage({
                event: true,
                room: "!room:id",
                user: "@user:id",
                ts: ts0 + ++i * 1000,
            }),
        );

        for (i = 0; i < 10; i++) {
            events.push(
                TestUtilsMatrix.mkMembership({
                    event: true,
                    room: "!room:id",
                    user: "@user:id",
                    target: bobMember,
                    ts: ts0 + i * 1000,
                    mship: KnownMembership.Join,
                    prevMship: KnownMembership.Join,
                    name: "A user",
                }),
            );
        }

        events.push(
            TestUtilsMatrix.mkMessage({
                event: true,
                room: "!room:id",
                user: "@user:id",
                ts: ts0 + ++i * 1000,
            }),
        );

        return events;
    }

    // A list of membership events only with nothing else
    function mkMelsEventsOnly() {
        const events: MatrixEvent[] = [];
        const ts0 = Date.now();

        let i = 0;

        for (i = 0; i < 10; i++) {
            events.push(
                TestUtilsMatrix.mkMembership({
                    event: true,
                    room: "!room:id",
                    user: "@user:id",
                    target: bobMember,
                    ts: ts0 + i * 1000,
                    mship: KnownMembership.Join,
                    prevMship: KnownMembership.Join,
                    name: "A user",
                }),
            );
        }

        return events;
    }

    // A list of room creation, encryption, and invite events.
    function mkCreationEvents() {
        const mkEvent = TestUtilsMatrix.mkEvent;
        const mkMembership = TestUtilsMatrix.mkMembership;
        const roomId = "!someroom";

        const ts0 = Date.now();

        return [
            mkEvent({
                event: true,
                type: "m.room.create",
                room: roomId,
                user: alice,
                content: {
                    creator: alice,
                    room_version: "5",
                    predecessor: {
                        room_id: "!prevroom",
                        event_id: "$someevent",
                    },
                },
                ts: ts0,
            }),
            mkMembership({
                event: true,
                room: roomId,
                user: alice,
                target: aliceMember,
                ts: ts0 + 1,
                mship: KnownMembership.Join,
                name: "Alice",
            }),
            mkEvent({
                event: true,
                type: "m.room.join_rules",
                room: roomId,
                user: alice,
                content: {
                    join_rule: "invite",
                },
                ts: ts0 + 2,
            }),
            mkEvent({
                event: true,
                type: "m.room.history_visibility",
                room: roomId,
                user: alice,
                content: {
                    history_visibility: "invited",
                },
                ts: ts0 + 3,
            }),
            mkEvent({
                event: true,
                type: "m.room.encryption",
                room: roomId,
                user: alice,
                content: {
                    algorithm: "m.megolm.v1.aes-sha2",
                },
                ts: ts0 + 4,
            }),
            mkMembership({
                event: true,
                room: roomId,
                user: alice,
                skey: "@bob:example.org",
                target: bobMember,
                ts: ts0 + 5,
                mship: KnownMembership.Invite,
                name: "Bob",
            }),
        ];
    }

    function mkMixedHiddenAndShownEvents() {
        const roomId = "!room:id";
        const userId = "@alice:example.org";
        const ts0 = Date.now();

        return [
            TestUtilsMatrix.mkMessage({
                event: true,
                room: roomId,
                user: userId,
                ts: ts0,
            }),
            TestUtilsMatrix.mkEvent({
                event: true,
                type: "org.example.a_hidden_event",
                room: roomId,
                user: userId,
                content: {},
                ts: ts0 + 1,
            }),
        ];
    }

    function isReadMarkerVisible(rmContainer?: Element) {
        return !!rmContainer?.children.length;
    }

    function getLogicalRowSelector() {
        return ".mx_EventTile, .mx_GenericEventListSummary, .mx_MessagePanel_myReadMarker";
    }

    function getLogicalPreviousRow(element?: Element): Element | null {
        if (!element) return null;

        let rowContainer: Element | null = element;
        while (rowContainer?.parentElement) {
            const parent: Element = rowContainer.parentElement;
            if (parent.matches(".mx_RoomView_MessageList") || parent.matches("[data-testid='virtuoso-item-list']")) {
                break;
            }
            rowContainer = parent;
        }

        let previous = rowContainer?.previousElementSibling ?? null;
        while (previous) {
            const rows = previous.matches(getLogicalRowSelector())
                ? [previous]
                : Array.from(previous.querySelectorAll(getLogicalRowSelector()));
            if (rows.length > 0) {
                return rows[rows.length - 1];
            }
            previous = previous.previousElementSibling;
        }

        return null;
    }

    function getLogicalRows(container: ParentNode): Element[] {
        return Array.from(container.querySelectorAll(getLogicalRowSelector()));
    }

    it("should show the events", function () {
        const { container } = render(getComponent({ events }), clientAndSDKContextRenderOptions(client, sdkContext));

        // just check we have the right number of tiles for now
        const tiles = container.getElementsByClassName("mx_EventTile");
        expect(tiles.length).toEqual(10);
    });

    it("should collapse adjacent member events", function () {
        const { container } = render(
            getComponent({ events: mkMelsEvents() }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );

        // just check we have the right number of tiles for now
        const tiles = container.getElementsByClassName("mx_EventTile");
        expect(tiles.length).toEqual(2);

        const summaryTiles = container.getElementsByClassName("mx_GenericEventListSummary");
        expect(summaryTiles.length).toEqual(1);
    });

    it("should insert the read-marker in the right place", function () {
        const { container } = render(
            getComponent({
                events,
                readMarkerEventId: events[4].getId(),
                readMarkerVisible: true,
            }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );

        const tiles = container.getElementsByClassName("mx_EventTile");

        // find the <li> which wraps the read marker
        const [rm] = container.getElementsByClassName("mx_MessagePanel_myReadMarker");

        // it should follow the <li> which wraps the event tile for event 4
        const eventContainer = tiles[4];
        expect(getLogicalPreviousRow(rm)).toEqual(eventContainer);
    });

    it("should show the read-marker that fall in summarised events after the summary", function () {
        const melsEvents = mkMelsEvents();
        const { container } = render(
            getComponent({
                events: melsEvents,
                readMarkerEventId: melsEvents[4].getId(),
                readMarkerVisible: true,
            }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );

        const [summary] = container.getElementsByClassName("mx_GenericEventListSummary");

        // find the <li> which wraps the read marker
        const [rm] = container.getElementsByClassName("mx_MessagePanel_myReadMarker");

        expect(getLogicalPreviousRow(rm)).toEqual(summary);

        // read marker should be visible given props and not at the last event
        expect(isReadMarkerVisible(rm)).toBeTruthy();
    });

    it("should hide the read-marker at the end of summarised events", function () {
        const melsEvents = mkMelsEventsOnly();

        const { container } = render(
            getComponent({
                events: melsEvents,
                readMarkerEventId: melsEvents[9].getId(),
                readMarkerVisible: true,
            }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );

        const [summary] = container.getElementsByClassName("mx_GenericEventListSummary");

        // find the <li> which wraps the read marker
        const [rm] = container.getElementsByClassName("mx_MessagePanel_myReadMarker");

        expect(getLogicalPreviousRow(rm)).toEqual(summary);

        // read marker should be hidden given props and at the last event
        expect(isReadMarkerVisible(rm)).toBeFalsy();
    });

    it("shows a ghost read-marker when the read-marker moves", function () {
        // fake the clock so that we can test the velocity animation.
        jest.useFakeTimers();

        const { container, rerender } = render(
            <div>
                {getComponent({
                    events,
                    readMarkerEventId: events[4].getId(),
                    readMarkerVisible: true,
                })}
            </div>,
            clientAndSDKContextRenderOptions(client, sdkContext),
        );

        const tiles = container.getElementsByClassName("mx_EventTile");

        // find the <li> which wraps the read marker
        const [rm] = container.getElementsByClassName("mx_MessagePanel_myReadMarker");
        expect(getLogicalPreviousRow(rm)).toEqual(tiles[4]);

        rerender(
            <div>
                {getComponent({
                    events,
                    readMarkerEventId: events[6].getId(),
                    readMarkerVisible: true,
                })}
            </div>,
        );

        // now there should be two RM containers
        const readMarkers = container.getElementsByClassName("mx_MessagePanel_myReadMarker");

        expect(readMarkers.length).toEqual(2);

        // the first should be the ghost
        expect(getLogicalPreviousRow(readMarkers[0])).toEqual(tiles[4]);
        const hr: HTMLElement = readMarkers[0].children[0] as HTMLElement;

        // the second should be the real thing
        expect(getLogicalPreviousRow(readMarkers[1])).toEqual(tiles[6]);

        // advance the clock, and then let the browser run an animation frame to let the animation start
        jest.advanceTimersByTime(1500);
        expect(hr.style.opacity).toEqual("0");
    });

    it("should collapse creation events", function () {
        const events = mkCreationEvents();
        const createEvent = events.find((event) => event.getType() === "m.room.create")!;
        const encryptionEvent = events.find((event) => event.getType() === "m.room.encryption")!;
        client.getRoom.mockImplementation((id) => (id === createEvent!.getRoomId() ? room : null));
        TestUtilsMatrix.upsertRoomStateEvents(room, events);

        const { container } = render(getComponent({ events }), clientAndSDKContextRenderOptions(client, sdkContext));

        // we expect that
        // - the room creation event, the room encryption event, and Alice inviting Bob,
        //   should be outside of the room creation summary
        // - all other events should be inside the room creation summary

        const tiles = container.getElementsByClassName("mx_EventTile");

        expect(tiles[0].getAttribute("data-event-id")).toEqual(createEvent.getId());
        expect(tiles[1].getAttribute("data-event-id")).toEqual(encryptionEvent.getId());

        const [summaryTile] = container.getElementsByClassName("mx_GenericEventListSummary");

        const summaryEventTiles = summaryTile.getElementsByClassName("mx_EventTile");
        // every event except for the room creation, room encryption, and Bob's
        // invite event should be in the event summary
        expect(summaryEventTiles.length).toEqual(tiles.length - 3);
    });

    it("should not collapse beacons as part of creation events", function () {
        const events = mkCreationEvents();
        const creationEvent = events.find((event) => event.getType() === "m.room.create")!;
        const beaconInfoEvent = makeBeaconInfoEvent(creationEvent.getSender()!, creationEvent.getRoomId()!, {
            isLive: true,
        });
        const combinedEvents = [...events, beaconInfoEvent];
        TestUtilsMatrix.upsertRoomStateEvents(room, combinedEvents);
        const { container } = render(
            getComponent({ events: combinedEvents }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );

        const [summaryTile] = container.getElementsByClassName("mx_GenericEventListSummary");

        // beacon body is not in the summary
        expect(summaryTile.getElementsByClassName("mx_MBeaconBody").length).toBe(0);
        // beacon tile is rendered
        expect(container.getElementsByClassName("mx_MBeaconBody").length).toBe(1);
    });

    it("should hide read-marker at the end of creation event summary", function () {
        const events = mkCreationEvents();
        const createEvent = events.find((event) => event.getType() === "m.room.create");
        client.getRoom.mockImplementation((id) => (id === createEvent!.getRoomId() ? room : null));
        TestUtilsMatrix.upsertRoomStateEvents(room, events);

        const { container } = render(
            getComponent({
                events,
                readMarkerEventId: events[5].getId(),
                readMarkerVisible: true,
            }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );

        // find the <li> which wraps the read marker
        const [rm] = container.getElementsByClassName("mx_MessagePanel_myReadMarker");

        const [messageList] = container.getElementsByClassName("mx_RoomView_MessageList");
        const rows = getLogicalRows(messageList);
        const contentRows = rows.filter((row) => !row.classList.contains("mx_MessagePanel_myReadMarker"));
        expect(contentRows.length).toEqual(7); // 6 events + the NewRoomIntro
        expect(getLogicalPreviousRow(rm)?.getAttribute("data-scroll-tokens")).toContain(events[5].getId()!);

        // read marker should be hidden given props and at the last event
        expect(isReadMarkerVisible(rm)).toBeFalsy();
    });

    it("should render Date separators for the events", function () {
        const events = mkOneDayEvents();
        const { queryAllByRole } = render(
            getComponent({ events }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
        const dates = queryAllByRole("separator");

        expect(dates.length).toEqual(1);
    });

    it("appends events into summaries during forward pagination without changing key", () => {
        const events = mkMelsEvents().slice(1, 11);

        const { container, rerender } = render(
            getComponent({ events }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
        let els = container.getElementsByClassName("mx_GenericEventListSummary");
        expect(els.length).toEqual(1);
        expect(els[0].getAttribute("data-testid")).toEqual("eventlistsummary-" + events[0].getId());
        expect(els[0].getAttribute("data-scroll-tokens")?.split(",")).toHaveLength(10);

        const updatedEvents = [
            ...events,
            TestUtilsMatrix.mkMembership({
                event: true,
                room: "!room:id",
                user: "@user:id",
                target: bobMember,
                ts: Date.now(),
                mship: KnownMembership.Join,
                prevMship: KnownMembership.Join,
                name: "A user",
            }),
        ];
        rerender(getComponent({ events: updatedEvents }));

        els = container.getElementsByClassName("mx_GenericEventListSummary");
        expect(els.length).toEqual(1);
        expect(els[0].getAttribute("data-testid")).toEqual("eventlistsummary-" + events[0].getId());
        expect(els[0].getAttribute("data-scroll-tokens")?.split(",")).toHaveLength(11);
    });

    it("prepends events into summaries during backward pagination without changing key", () => {
        const events = mkMelsEvents().slice(1, 11);

        const { container, rerender } = render(
            getComponent({ events }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
        let els = container.getElementsByClassName("mx_GenericEventListSummary");
        expect(els.length).toEqual(1);
        expect(els[0].getAttribute("data-testid")).toEqual("eventlistsummary-" + events[0].getId());
        expect(els[0].getAttribute("data-scroll-tokens")?.split(",")).toHaveLength(10);

        const updatedEvents = [
            TestUtilsMatrix.mkMembership({
                event: true,
                room: "!room:id",
                user: "@user:id",
                target: bobMember,
                ts: Date.now(),
                mship: KnownMembership.Join,
                prevMship: KnownMembership.Join,
                name: "A user",
            }),
            ...events,
        ];
        rerender(getComponent({ events: updatedEvents }));

        els = container.getElementsByClassName("mx_GenericEventListSummary");
        expect(els.length).toEqual(1);
        expect(els[0].getAttribute("data-testid")).toEqual("eventlistsummary-" + events[0].getId());
        expect(els[0].getAttribute("data-scroll-tokens")?.split(",")).toHaveLength(11);
    });

    it("assigns different keys to summaries that get split up", () => {
        const events = mkMelsEvents().slice(1, 11);

        const { container, rerender } = render(
            getComponent({ events }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
        let els = container.getElementsByClassName("mx_GenericEventListSummary");
        expect(els.length).toEqual(1);
        expect(els[0].getAttribute("data-testid")).toEqual(`eventlistsummary-${events[0].getId()}`);
        expect(els[0].getAttribute("data-scroll-tokens")?.split(",")).toHaveLength(10);

        const updatedEvents = [
            ...events.slice(0, 5),
            TestUtilsMatrix.mkMessage({
                event: true,
                room: "!room:id",
                user: "@user:id",
                msg: "Hello!",
            }),
            ...events.slice(5, 10),
        ];
        rerender(getComponent({ events: updatedEvents }));

        // summaries split becuase room messages are not summarised
        els = container.getElementsByClassName("mx_GenericEventListSummary");
        expect(els.length).toEqual(2);
        expect(els[0].getAttribute("data-testid")).toEqual(`eventlistsummary-${events[0].getId()}`);
        expect(els[0].getAttribute("data-scroll-tokens")?.split(",")).toHaveLength(5);

        expect(els[1].getAttribute("data-testid")).toEqual(`eventlistsummary-${events[5].getId()}`);
        expect(els[1].getAttribute("data-scroll-tokens")?.split(",")).toHaveLength(5);
    });

    // We test this because setting lookups can be *slow*, and we don't want
    // them to happen in this code path
    it("doesn't lookup showHiddenEventsInTimeline while rendering", () => {
        // We're only interested in the setting lookups that happen on every render,
        // rather than those happening on first mount, so let's get those out of the way
        const { rerender } = render(getComponent({ events: [] }), clientAndSDKContextRenderOptions(client, sdkContext));

        // Set up our spy and re-render with new events
        const settingsSpy = jest.spyOn(SettingsStore, "getValue").mockClear();

        rerender(getComponent({ events: mkMixedHiddenAndShownEvents() }));

        expect(settingsSpy).not.toHaveBeenCalledWith("showHiddenEventsInTimeline");
        settingsSpy.mockRestore();
    });

    it("should group hidden event reactions into an event list summary", () => {
        const events = [
            TestUtilsMatrix.mkEvent({
                event: true,
                type: "m.reaction",
                room: "!room:id",
                user: "@user:id",
                content: {},
                ts: 1,
            }),
            TestUtilsMatrix.mkEvent({
                event: true,
                type: "m.reaction",
                room: "!room:id",
                user: "@user:id",
                content: {},
                ts: 2,
            }),
            TestUtilsMatrix.mkEvent({
                event: true,
                type: "m.reaction",
                room: "!room:id",
                user: "@user:id",
                content: {},
                ts: 3,
            }),
        ];
        const { container } = render(
            getComponent({ events }, { showHiddenEvents: true }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );

        const els = container.getElementsByClassName("mx_GenericEventListSummary");
        expect(els.length).toEqual(1);
        expect(els[0].getAttribute("data-scroll-tokens")?.split(",")).toHaveLength(3);
    });

    it("should handle large numbers of hidden events quickly", () => {
        // Increase the length of the loop here to test performance issues with
        // rendering

        const events: MatrixEvent[] = [];
        for (let i = 0; i < 100; i++) {
            events.push(
                TestUtilsMatrix.mkEvent({
                    event: true,
                    type: "unknown.event.type",
                    content: { key: "value" },
                    room: "!room:id",
                    user: "@user:id",
                    ts: 1000000 + i,
                }),
            );
        }
        const { asFragment } = render(
            getComponent({ events }, { showHiddenEvents: false }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should handle lots of room creation events quickly", () => {
        // Increase the length of the loop here to test performance issues with
        // rendering

        const events = [TestUtilsMatrix.mkRoomCreateEvent("@user:id", "!room:id")];
        for (let i = 0; i < 100; i++) {
            events.push(
                TestUtilsMatrix.mkMembership({
                    mship: KnownMembership.Join,
                    prevMship: KnownMembership.Join,
                    room: "!room:id",
                    user: "@user:id",
                    event: true,
                    skey: "123",
                }),
            );
        }
        const { asFragment } = render(
            getComponent({ events }, { showHiddenEvents: false }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should handle lots of membership events quickly", () => {
        // Increase the length of the loop here to test performance issues with
        // rendering

        const events: MatrixEvent[] = [];
        for (let i = 0; i < 100; i++) {
            events.push(
                TestUtilsMatrix.mkMembership({
                    mship: KnownMembership.Join,
                    prevMship: KnownMembership.Join,
                    room: "!room:id",
                    user: "@user:id",
                    event: true,
                    skey: "123",
                }),
            );
        }
        const { asFragment } = render(
            getComponent({ events }, { showHiddenEvents: true }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
        const cpt = asFragment();

        // Ignore properties that change every time
        cpt.querySelectorAll("li").forEach((li) => {
            li.setAttribute("data-scroll-tokens", "__scroll_tokens__");
            li.setAttribute("data-testid", "__testid__");
        });

        expect(cpt).toMatchSnapshot();
    });

    it("should set lastSuccessful=true on non-last event if last event is not eligible for special receipt", () => {
        client.getRoom.mockImplementation((id) => (id === room.roomId ? room : null));
        const events = [
            TestUtilsMatrix.mkMessage({
                event: true,
                room: room.roomId,
                user: client.getSafeUserId(),
                ts: 1000,
            }),
            TestUtilsMatrix.mkEvent({
                event: true,
                room: room.roomId,
                user: client.getSafeUserId(),
                ts: 1000,
                type: "m.room.topic",
                skey: "",
                content: { topic: "TOPIC" },
            }),
        ];
        const { container } = render(
            getComponent({ events, showReadReceipts: true }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );

        const tiles = container.getElementsByClassName("mx_EventTile");
        expect(tiles.length).toEqual(2);
        expect(within(tiles[0] as HTMLElement).queryByRole("status")).toHaveAccessibleName("Your message was sent");
        expect(within(tiles[1] as HTMLElement).queryByRole("status")).not.toBeInTheDocument();
    });

    it("should set lastSuccessful=false on non-last event if last event has a receipt from someone else", () => {
        client.getRoom.mockImplementation((id) => (id === room.roomId ? room : null));
        const events = [
            TestUtilsMatrix.mkMessage({
                event: true,
                room: room.roomId,
                user: client.getSafeUserId(),
                ts: 1000,
            }),
            TestUtilsMatrix.mkMessage({
                event: true,
                room: room.roomId,
                user: "@other:user",
                ts: 1001,
            }),
        ];
        room.addReceiptToStructure(
            events[1].getId()!,
            ReceiptType.Read,
            "@other:user",
            {
                ts: 1001,
            },
            true,
        );
        const { container } = render(
            getComponent({ events, showReadReceipts: true }),
            clientAndSDKContextRenderOptions(client, sdkContext),
        );

        const tiles = container.getElementsByClassName("mx_EventTile");
        expect(tiles.length).toEqual(2);
        expect(within(tiles[0] as HTMLElement).queryByRole("status")).not.toBeInTheDocument();
        expect(within(tiles[1] as HTMLElement).queryByRole("status")).not.toBeInTheDocument();
    });
});

describe("shouldFormContinuation", () => {
    it("does not form continuations from thread roots which have summaries", () => {
        const message1 = TestUtilsMatrix.mkMessage({
            event: true,
            room: "!room:id",
            user: "@user:id",
            msg: "Here is a message in the main timeline",
        });

        const message2 = TestUtilsMatrix.mkMessage({
            event: true,
            room: "!room:id",
            user: "@user:id",
            msg: "And here's another message in the main timeline",
        });

        const threadRoot = TestUtilsMatrix.mkMessage({
            event: true,
            room: "!room:id",
            user: "@user:id",
            msg: "Here is a thread",
        });
        jest.spyOn(threadRoot, "isThreadRoot", "get").mockReturnValue(true);

        const message3 = TestUtilsMatrix.mkMessage({
            event: true,
            room: "!room:id",
            user: "@user:id",
            msg: "And here's another message in the main timeline after the thread root",
        });

        const client = createTestClient();
        expect(shouldFormContinuation(message1, message2, client, false)).toEqual(true);
        expect(shouldFormContinuation(message2, threadRoot, client, false)).toEqual(true);
        expect(shouldFormContinuation(threadRoot, message3, client, false)).toEqual(true);

        const thread = {
            length: 1,
            replyToEvent: {},
        } as unknown as Thread;
        jest.spyOn(threadRoot, "getThread").mockReturnValue(thread);
        expect(shouldFormContinuation(message2, threadRoot, client, false)).toEqual(false);
        expect(shouldFormContinuation(threadRoot, message3, client, false)).toEqual(false);
    });
});
