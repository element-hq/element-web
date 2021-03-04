/*
Copyright 2016 OpenMarket Ltd
Copyright 2019 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import PropTypes from "prop-types";

import { _t } from '../../languageHandler';
import {MatrixClientPeg} from "../../MatrixClientPeg";
import * as sdk from "../../index";
import BaseCard from "../views/right_panel/BaseCard";

/*
 * Component which shows the global notification list using a TimelinePanel
 */
class NotificationPanel extends React.Component {
    static propTypes = {
        onClose: PropTypes.func.isRequired,
    };

    render() {
        // wrap a TimelinePanel with the jump-to-event bits turned off.
        const TimelinePanel = sdk.getComponent("structures.TimelinePanel");
        const Loader = sdk.getComponent("elements.Spinner");

        const emptyState = (<div className="mx_RightPanel_empty mx_NotificationPanel_empty">
            <h2>{_t('You’re all caught up')}</h2>
            <p>{_t('You have no visible notifications.')}</p>
        </div>);

        let content;
        const timelineSet = MatrixClientPeg.get().getNotifTimelineSet();
        if (timelineSet) {
            content = (
                <TimelinePanel
                    manageReadReceipts={false}
                    manageReadMarkers={false}
                    timelineSet={timelineSet}
                    showUrlPreview={false}
                    tileShape="notif"
                    empty={emptyState}
                />
            );
        } else {
            console.error("No notifTimelineSet available!");
            content = <Loader />;
        }

        return <BaseCard className="mx_NotificationPanel" onClose={this.props.onClose} withoutScrollContainer>
            { content }
        </BaseCard>;
    }
}

export default NotificationPanel;
