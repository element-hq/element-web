/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2018 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef, type JSX, type ReactNode } from "react";
import { type NumberSize, Resizable } from "re-resizable";
import { type Direction } from "re-resizable/lib/resizer";
import { type WebPanelResize } from "@matrix-org/analytics-events/types/typescript/WebPanelResize";

import { PosthogAnalytics } from "../../PosthogAnalytics.ts";
import { SDKContext } from "../../contexts/SDKContext.ts";

const MIN_TIMELINE_WIDTH = 360;
const PREFERRED_TIMELINE_WIDTH = 500;

interface IProps {
    collapsedRhs?: boolean;
    panel?: JSX.Element;
    children: ReactNode;
    /**
     * A unique identifier for this panel split.
     *
     * This is appended to the key used to store the panel size in localStorage, allowing the widths of different
     * panels to be stored.
     */
    sizeKey?: string;
    /**
     * The size to use for the panel component if one isn't persisted in storage. Defaults to 320.
     */
    defaultSize: number;

    analyticsRoomType: WebPanelResize["roomType"];
}

export default class MainSplit extends React.Component<IProps> {
    public static contextType = SDKContext;
    declare public context: React.ContextType<typeof SDKContext>;

    public static defaultProps = {
        defaultSize: 320,
    };

    private readonly mainSplitRef = createRef<HTMLDivElement>();
    private readonly resizeObserver: ResizeObserver;

    public constructor(props: IProps, context: React.ContextType<typeof SDKContext>) {
        super(props, context);

        this.resizeObserver = new ResizeObserver(this.onMainSplitResize);
    }

    public componentDidMount(): void {
        if (!this.mainSplitRef.current) return;

        this.resizeObserver.observe(this.mainSplitRef.current);
        this.setMainSplitWidth(this.mainSplitRef.current.getBoundingClientRect().width);
    }

    public componentWillUnmount(): void {
        this.resizeObserver.disconnect();
    }

    private onResizeStart = (): void => {
        this.context.resizeNotifier.startResizing();
    };

    private onResize = (): void => {
        this.context.resizeNotifier.notifyRightHandleResized();
    };

    private get sizeSettingStorageKey(): string {
        let key = "mx_rhs_size";
        if (!!this.props.sizeKey) {
            key += `_${this.props.sizeKey}`;
        }
        return key;
    }

    private onResizeStop = (
        event: MouseEvent | TouchEvent,
        direction: Direction,
        elementRef: HTMLElement,
        delta: NumberSize,
    ): void => {
        const newSize = this.loadSidePanelSize().width + delta.width;
        this.context.resizeNotifier.stopResizing();
        window.localStorage.setItem(this.sizeSettingStorageKey, newSize.toString());

        PosthogAnalytics.instance.trackEvent<WebPanelResize>({
            eventName: "WebPanelResize",
            panel: "right",
            roomType: this.props.analyticsRoomType,
            size: newSize,
        });
    };

    private loadSidePanelSize(): { height: string | number; width: number } {
        let rhsSize = parseInt(window.localStorage.getItem(this.sizeSettingStorageKey)!, 10);

        if (isNaN(rhsSize)) {
            rhsSize = this.props.defaultSize;
        }

        return {
            height: "100%",
            width: rhsSize,
        };
    }

    private onMainSplitResize = (entries: ResizeObserverEntry[]): void => {
        if (!entries[0]) return;

        this.setMainSplitWidth(entries[0].contentRect.width);
    };

    private setMainSplitWidth(width: number): void {
        this.mainSplitRef.current?.style.setProperty("--mx-main-split-width", `${Math.round(width)}px`);
        this.mainSplitRef.current?.style.setProperty("--mx-min-timeline-width", `${MIN_TIMELINE_WIDTH}px`);
        this.mainSplitRef.current?.style.setProperty("--mx-preferred-timeline-width", `${PREFERRED_TIMELINE_WIDTH}px`);
    }

    public render(): React.ReactNode {
        const bodyView = React.Children.only(this.props.children);
        const panelView = this.props.panel;

        const hasResizer = !this.props.collapsedRhs && panelView;

        let children;
        if (hasResizer) {
            children = (
                <Resizable
                    key={this.props.sizeKey}
                    defaultSize={this.loadSidePanelSize()}
                    minWidth={320}
                    maxWidth="50%"
                    enable={{
                        top: false,
                        right: false,
                        bottom: false,
                        left: true,
                        topRight: false,
                        bottomRight: false,
                        bottomLeft: false,
                        topLeft: false,
                    }}
                    onResizeStart={this.onResizeStart}
                    onResize={this.onResize}
                    onResizeStop={this.onResizeStop}
                    className="mx_RightPanel_ResizeWrapper"
                    handleClasses={{ left: "mx_ResizeHandle--horizontal" }}
                >
                    {panelView}
                </Resizable>
            );
        }

        return (
            <div className="mx_MainSplit" ref={this.mainSplitRef}>
                {bodyView}
                {children}
            </div>
        );
    }
}
