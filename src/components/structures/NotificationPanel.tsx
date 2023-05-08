/*
Copyright 2016 - 2022 The Matrix.org Foundation C.I.C.

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
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../languageHandler";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import BaseCard from "../views/right_panel/BaseCard";
import TimelinePanel from "./TimelinePanel";
import Spinner from "../views/elements/Spinner";
import { Layout } from "../../settings/enums/Layout";
import RoomContext, { TimelineRenderingType } from "../../contexts/RoomContext";
import Measured from "../views/elements/Measured";
import Heading from "../views/typography/Heading";

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
            <div className="mx_RightPanel_empty mx_NotificationPanel_empty">
                <h2>{_t("You're all caught up")}</h2>
                <p>{_t("You have no visible notifications.")}</p>
            </div>
        );

        let content;
        const timelineSet = MatrixClientPeg.get().getNotifTimelineSet();
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
            <RoomContext.Provider
                value={{
                    ...this.context,
                    timelineRenderingType: TimelineRenderingType.Notification,
                    narrow: this.state.narrow,
                }}
            >
                <BaseCard
                    header={
                        <div className="mx_BaseCard_header_title">
                            <Heading size="h4" className="mx_BaseCard_header_title_heading">
                                {_t("Notifications")}
                            </Heading>
                        </div>
                    }
                    /**
                     * Need to rename this CSS class to something more generic
                     * Will be done once all the panels are using a similar layout
                     */
                    className="mx_ThreadPanel"
                    onClose={this.props.onClose}
                    withoutScrollContainer={true}
                >
                    {this.card.current && <Measured sensor={this.card.current} onMeasurement={this.onMeasurement} />}
                    {content}
                </BaseCard>
            </RoomContext.Provider>
        );
    }
}
