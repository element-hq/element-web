/*
Copyright 2016, 2019, 2021 The Matrix.org Foundation C.I.C.

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

import { _t } from '../../languageHandler';
import { MatrixClientPeg } from "../../MatrixClientPeg";
import BaseCard from "../views/right_panel/BaseCard";
import { replaceableComponent } from "../../utils/replaceableComponent";
import TimelinePanel from "./TimelinePanel";
import Spinner from "../views/elements/Spinner";

interface IProps {
    onClose(): void;
}

/*
 * Component which shows the global notification list using a TimelinePanel
 */
@replaceableComponent("structures.NotificationPanel")
export default class NotificationPanel extends React.PureComponent<IProps> {
    render() {
        const emptyState = (<div className="mx_RightPanel_empty mx_NotificationPanel_empty">
            <h2>{_t('You’re all caught up')}</h2>
            <p>{_t('You have no visible notifications.')}</p>
        </div>);

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
                    tileShape="notif"
                    empty={emptyState}
                    alwaysShowTimestamps={true}
                />
            );
        } else {
            console.error("No notifTimelineSet available!");
            content = <Spinner />;
        }

        return <BaseCard className="mx_NotificationPanel" onClose={this.props.onClose} withoutScrollContainer>
            { content }
        </BaseCard>;
    }
}
