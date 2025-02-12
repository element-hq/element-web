/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2022 The Matrix.org Foundation C.I.C.
Copyright 2018 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ContextType, type CSSProperties, type MutableRefObject, type ReactNode } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import WidgetUtils from "../../../utils/WidgetUtils";
import AppTile from "./AppTile";
import WidgetStore from "../../../stores/WidgetStore";
import MatrixClientContext from "../../../contexts/MatrixClientContext";

interface IProps {
    persistentWidgetId: string;
    persistentRoomId: string;
    pointerEvents?: CSSProperties["pointerEvents"];
    movePersistedElement: MutableRefObject<(() => void) | undefined>;
    children?: ReactNode;
}

export default class PersistentApp extends React.Component<IProps> {
    public static contextType = MatrixClientContext;
    declare public context: ContextType<typeof MatrixClientContext>;
    private room: Room;

    public constructor(props: IProps, context: ContextType<typeof MatrixClientContext>) {
        super(props, context);
        this.room = context.getRoom(this.props.persistentRoomId)!;
    }

    public render(): JSX.Element | null {
        const app = WidgetStore.instance.get(this.props.persistentWidgetId, this.props.persistentRoomId);
        if (!app) return null;

        return (
            <AppTile
                key={app.id}
                app={app}
                fullWidth={true}
                room={this.room}
                userId={this.context.getSafeUserId()}
                creatorUserId={app.creatorUserId}
                widgetPageTitle={WidgetUtils.getWidgetDataTitle(app)}
                waitForIframeLoad={app.waitForIframeLoad}
                miniMode={true}
                showMenubar={false}
                pointerEvents={this.props.pointerEvents}
                movePersistedElement={this.props.movePersistedElement}
                overlay={this.props.children}
            />
        );
    }
}
