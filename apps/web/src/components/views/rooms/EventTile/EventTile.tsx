/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, type JSX, type ReactNode } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { TileErrorView, useCreateAutoDisposedViewModel, type TileErrorViewLayout } from "@element-hq/web-shared-components";

import { Layout } from "../../../../settings/enums/Layout";
import { useSettingValue } from "../../../../hooks/useSettings";
import { TileErrorViewModel } from "../../../../viewmodels/message-body/TileErrorViewModel";
import { EventTilePresenter, type EventTileProps as EventTilePresenterProps } from "./EventTilePresenter";

export type { EventTileHandle } from "./EventTilePresenter";
export type { EventTileOps, GetRelationsForEvent, ReadReceiptProps } from "./types";

/** Props for {@link EventTile}. */
export interface EventTileProps extends EventTilePresenterProps {
    /** Wraps the tile in an error boundary. Defaults to `true`. */
    withErrorBoundary?: boolean;
}

interface EventTileErrorFallbackProps {
    error: Error;
    layout: Layout;
    mxEvent: MatrixEvent;
}

function EventTileErrorFallback({ error, layout, mxEvent }: Readonly<EventTileErrorFallbackProps>): JSX.Element {
    const developerMode = useSettingValue("developerMode");
    const vm = useCreateAutoDisposedViewModel(
        () => new TileErrorViewModel({ error, layout: layout as TileErrorViewLayout, mxEvent, developerMode: !!developerMode }),
    );

    useEffect(() => { vm.setError(error); }, [error, vm]);
    useEffect(() => { vm.setLayout(layout as TileErrorViewLayout); }, [layout, vm]);
    useEffect(() => { vm.setDeveloperMode(!!developerMode); }, [developerMode, vm]);

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

class EventTileErrorBoundary extends React.Component<EventTileErrorBoundaryProps, EventTileErrorBoundaryState> {
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

/** Renders a single timeline event tile via {@link EventTilePresenter}. */
export function EventTile(props: Readonly<EventTileProps>): JSX.Element {
    const { withErrorBoundary = true, layout = Layout.Group, forExport = false, ...rest } = props;
    const tileProps = { ...rest, layout, forExport };
    const tile = <EventTilePresenter {...tileProps} />;

    if (!withErrorBoundary) {
        return tile;
    }

    return (
        <EventTileErrorBoundary mxEvent={tileProps.mxEvent} layout={tileProps.layout}>
            {tile}
        </EventTileErrorBoundary>
    );
}
