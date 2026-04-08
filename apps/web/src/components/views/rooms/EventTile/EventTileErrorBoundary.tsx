/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, type ReactNode, type JSX } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import {
    TileErrorView,
    type TileErrorViewLayout,
    useCreateAutoDisposedViewModel,
} from "@element-hq/web-shared-components";

import { useSettingValue } from "../../../../hooks/useSettings";
import { type Layout } from "../../../../settings/enums/Layout";
import { TileErrorViewModel } from "../../../../viewmodels/message-body/TileErrorViewModel";

/**
 * Props for the event-tile fallback rendered after the tile error boundary catches a render failure.
 */
interface EventTileErrorFallbackProps {
    error: Error;
    layout: Layout;
    mxEvent: MatrixEvent;
}

function EventTileErrorFallback({ error, layout, mxEvent }: Readonly<EventTileErrorFallbackProps>): JSX.Element {
    const developerMode = useSettingValue("developerMode");
    const vm = useCreateAutoDisposedViewModel(
        () => new TileErrorViewModel({ error, layout: layout as TileErrorViewLayout, mxEvent, developerMode }),
    );

    useEffect(() => {
        vm.setError(error);
    }, [error, vm]);

    useEffect(() => {
        vm.setLayout(layout as TileErrorViewLayout);
    }, [layout, vm]);

    useEffect(() => {
        vm.setDeveloperMode(developerMode);
    }, [developerMode, vm]);

    return <TileErrorView vm={vm} className="mx_EventTile mx_EventTile_info mx_EventTile_content" />;
}

interface EventTileErrorBoundaryProps {
    children: ReactNode;
    layout: Layout;
    mxEvent: MatrixEvent;
}

interface EventTileErrorBoundaryState {
    error?: Error;
}

export class EventTileErrorBoundary extends React.Component<EventTileErrorBoundaryProps, EventTileErrorBoundaryState> {
    public constructor(props: EventTileErrorBoundaryProps) {
        super(props);
        this.state = {};
    }

    public static getDerivedStateFromError(error: Error): Partial<EventTileErrorBoundaryState> {
        return { error };
    }

    public render(): ReactNode {
        if (this.state.error) {
            return (
                <EventTileErrorFallback
                    error={this.state.error}
                    layout={this.props.layout}
                    mxEvent={this.props.mxEvent}
                />
            );
        }

        return this.props.children;
    }
}
