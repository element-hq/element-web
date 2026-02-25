/*
Copyright 2024 New Vector Ltd.
Copyright 2016-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import NotificationsIcon from "@vector-im/compound-design-tokens/assets/web/icons/notifications";

import { _t } from "../../languageHandler";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import BaseCard from "../views/right_panel/BaseCard";
import TimelinePanel from "./TimelinePanel";
import Spinner from "../views/elements/Spinner";
import { Layout } from "../../settings/enums/Layout";
import RoomContext, { TimelineRenderingType } from "../../contexts/RoomContext";
import Measured from "../views/elements/Measured";
import EmptyState from "../views/right_panel/EmptyState";
import { ScopedRoomContextProvider } from "../../contexts/ScopedRoomContext.tsx";

interface IProps {
    onClose(): void;
}

interface IState {
    narrow: boolean;
}

/*
 * Component which shows the global notification list using a TimelinePanel
 */
export default class NotificationPanel extends React.PureComponent<IProps, IState> {
    public static contextType = RoomContext;
    declare public context: React.ContextType<typeof RoomContext>;

    private card = React.createRef<HTMLDivElement>();

    public constructor(props: IProps) {
        super(props);

        this.state = {
            narrow: false,
        };
    }

    private onMeasurement = (narrow: boolean): void => {
        this.setState({ narrow });
    };

    public render(): React.ReactNode {
        const emptyState = (
            <EmptyState
                Icon={NotificationsIcon}
                title={_t("notif_panel|empty_heading")}
                description={_t("notif_panel|empty_description")}
            />
        );

        let content: JSX.Element;
        const timelineSet = MatrixClientPeg.safeGet().getNotifTimelineSet();
        if (timelineSet) {
            // wrap a TimelinePanel with the jump-to-event bits turned off.
            content = (
                <TimelinePanel
                    manageReadReceipts={false}
                    manageReadMarkers={false}
                    timelineSet={timelineSet}
                    showUrlPreview={false}
                    empty={emptyState}
                    alwaysShowTimestamps={true}
                    layout={Layout.Group}
                />
            );
        } else {
            logger.error("No notifTimelineSet available!");
            content = <Spinner />;
        }

        return (
            <ScopedRoomContextProvider
                {...this.context}
                timelineRenderingType={TimelineRenderingType.Notification}
                narrow={this.state.narrow}
            >
                <BaseCard
                    header={_t("notifications|enable_prompt_toast_title")}
                    /**
                     * Need to rename this CSS class to something more generic
                     * Will be done once all the panels are using a similar layout
                     */
                    className="mx_ThreadPanel"
                    onClose={this.props.onClose}
                    withoutScrollContainer={true}
                >
                    <Measured sensor={this.card} onMeasurement={this.onMeasurement} />
                    {content}
                </BaseCard>
            </ScopedRoomContextProvider>
        );
    }
}
