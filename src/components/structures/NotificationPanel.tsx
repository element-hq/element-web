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
import NotificationsIcon from "@vector-im/compound-design-tokens/assets/web/icons/notifications";

import { _t } from "../../languageHandler";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import BaseCard from "../views/right_panel/BaseCard";
import TimelinePanel from "./TimelinePanel";
import Spinner from "../views/elements/Spinner";
import { Layout } from "../../settings/enums/Layout";
import RoomContext, { TimelineRenderingType } from "../../contexts/RoomContext";
import Measured from "../views/elements/Measured";
import Heading from "../views/typography/Heading";
import EmptyState from "../views/right_panel/EmptyState";

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
    public declare context: React.ContextType<typeof RoomContext>;

    private card = React.createRef<HTMLDivElement>();

    public constructor(props: IProps, context: React.ContextType<typeof RoomContext>) {
        super(props, context);

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
                            <Heading size="4" className="mx_BaseCard_header_title_heading">
                                {_t("notifications|enable_prompt_toast_title")}
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
