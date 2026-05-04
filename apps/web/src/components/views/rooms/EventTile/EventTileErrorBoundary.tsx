/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode, type JSX } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { TileErrorView, type TileErrorViewLayout } from "@element-hq/web-shared-components";

import { useSettingValue } from "../../../../hooks/useSettings";
import { Layout } from "../../../../settings/enums/Layout";
import {
    TileErrorViewModel,
    type TileErrorViewModelProps,
} from "../../../../viewmodels/message-body/TileErrorViewModel";

interface EventTileErrorBoundaryProps {
    children: ReactNode;
    layout: Layout;
    mxEvent: MatrixEvent;
}

interface EventTileErrorBoundaryState {
    error?: Error;
}

interface EventTileErrorBoundaryInnerProps extends EventTileErrorBoundaryProps {
    developerMode: boolean;
}

class EventTileErrorBoundaryInner extends React.Component<
    EventTileErrorBoundaryInnerProps,
    EventTileErrorBoundaryState
> {
    private fallbackViewModel?: TileErrorViewModel;

    public constructor(props: EventTileErrorBoundaryInnerProps) {
        super(props);
        this.state = {};
    }

    public static getDerivedStateFromError(error: Error): Partial<EventTileErrorBoundaryState> {
        return { error };
    }

    public componentDidUpdate(
        prevProps: EventTileErrorBoundaryInnerProps,
        prevState: EventTileErrorBoundaryState,
    ): void {
        if (!this.state.error) return;

        const shouldUpdateViewModel =
            prevState.error !== this.state.error ||
            prevProps.layout !== this.props.layout ||
            prevProps.mxEvent !== this.props.mxEvent ||
            prevProps.developerMode !== this.props.developerMode;
        if (!shouldUpdateViewModel) return;

        this.fallbackViewModel?.setProps(this.buildTileErrorViewModelProps(this.state.error));
    }

    public componentWillUnmount(): void {
        this.fallbackViewModel?.dispose();
    }

    private buildTileErrorViewModelProps(error: Error): TileErrorViewModelProps {
        return {
            error,
            layout: this.getTileErrorLayout(),
            mxEvent: this.props.mxEvent,
            developerMode: this.props.developerMode,
        };
    }

    private getTileErrorLayout(): TileErrorViewLayout {
        switch (this.props.layout) {
            case Layout.Bubble:
                return "bubble";
            case Layout.IRC:
                return "irc";
            case Layout.Group:
            default:
                return "group";
        }
    }

    private getFallbackViewModel(error: Error): TileErrorViewModel {
        this.fallbackViewModel ??= new TileErrorViewModel(this.buildTileErrorViewModelProps(error));
        return this.fallbackViewModel;
    }

    public render(): ReactNode {
        if (this.state.error) {
            return (
                <TileErrorView
                    vm={this.getFallbackViewModel(this.state.error)}
                    className="mx_EventTile mx_EventTile_info mx_EventTile_content"
                />
            );
        }

        return this.props.children;
    }
}

/** Wraps an event tile in a React error boundary and renders a tile-shaped fallback if rendering fails. */
export function EventTileErrorBoundary(props: Readonly<EventTileErrorBoundaryProps>): JSX.Element {
    const developerMode = useSettingValue("developerMode");

    return <EventTileErrorBoundaryInner {...props} developerMode={developerMode} />;
}
