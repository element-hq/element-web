/*
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
import PropTypes from 'prop-types';
import MatrixClientPeg from "../../../MatrixClientPeg";
import { _t } from '../../../languageHandler';
import sdk from "../../../index";
import {wantsDateSeparator} from '../../../DateUtils';
import SettingsStore from '../../../settings/SettingsStore';

export default class MessageEditHistoryDialog extends React.Component {
    static propTypes = {
        mxEvent: PropTypes.object.isRequired,
    };

    componentWillMount() {
        this.loadMoreEdits = this.loadMoreEdits.bind(this);
        this.setState({
            events: [],
            nextBatch: null,
            isLoading: true,
            isTwelveHour: SettingsStore.getValue("showTwelveHourTimestamps"),
        });
    }

    async loadMoreEdits(backwards) {
        if (backwards || (!this.state.nextBatch && !this.state.isLoading)) {
            // bail out on backwards as we only paginate in one direction
            return false;
        }
        const opts = {token: this.state.nextBatch};
        const roomId = this.props.mxEvent.getRoomId();
        const eventId = this.props.mxEvent.getId();
        const result = await MatrixClientPeg.get().relations(
            roomId, eventId, "m.replace", "m.room.message", opts);
        //console.log(`loadMoreEdits: got ${result.}`)
        let resolve;
        const promise = new Promise(r => resolve = r);
        this.setState({
            events: this.state.events.concat(result.events),
            nextBatch: result.nextBatch,
            isLoading: false,
        }, () => {
            const hasMoreResults = !!this.state.nextBatch;
            resolve(hasMoreResults);
        });
        return promise;
    }

    componentDidMount() {
        this.loadMoreEdits();
    }

    _renderEdits() {
        const EditHistoryMessage = sdk.getComponent('elements.EditHistoryMessage');
        const DateSeparator = sdk.getComponent('messages.DateSeparator');
        const nodes = [];
        let lastEvent;
        this.state.events.forEach(e => {
            if (!lastEvent || wantsDateSeparator(lastEvent.getDate(), e.getDate())) {
                nodes.push(<li key={e.getTs() + "~"}><DateSeparator ts={e.getTs()} /></li>);
            }
            nodes.push(<EditHistoryMessage key={e.getId()} mxEvent={e} isTwelveHour={this.state.isTwelveHour} />);
            lastEvent = e;
        });
        return nodes;
    }

    render() {
        let content;
        if (this.state.error) {
            content = this.state.error;
        } else if (this.state.isLoading) {
            const Spinner = sdk.getComponent("elements.Spinner");
            content = <Spinner />;
        } else {
            const ScrollPanel = sdk.getComponent("structures.ScrollPanel");
            content = (<ScrollPanel
                className="mx_MessageEditHistoryDialog_scrollPanel"
                onFillRequest={ this.loadMoreEdits }
                stickyBottom={false}
                startAtBottom={false}
            >
                <ul className="mx_MessageEditHistoryDialog_edits mx_MessagePanel_alwaysShowTimestamps">{this._renderEdits()}</ul>
            </ScrollPanel>);
        }
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        return (
            <BaseDialog className='mx_MessageEditHistoryDialog' hasCancel={true}
                        onFinished={this.props.onFinished} title={_t("Message edits")}>
                {content}
            </BaseDialog>
        );
    }
}
