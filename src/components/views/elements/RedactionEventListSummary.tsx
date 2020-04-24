/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
import {MatrixClient} from "matrix-js-sdk/src/client";
import {MatrixEvent} from "matrix-js-sdk/src/models/event";

import { _t } from "../../../languageHandler";
import * as sdk from "../../../index";
import MatrixClientContext from "../../../contexts/MatrixClientContext";

interface IProps {
    // An array of member events to summarise
    events: MatrixEvent[];
    // An array of EventTiles to render when expanded
    children: React.ReactChildren;
    // The minimum number of events needed to trigger summarisation
    threshold?: number;
    // Called when the ELS expansion is toggled
    onToggle: () => void;
    // Whether or not to begin with state.expanded=true
    startExpanded?: boolean;
}

export default class RedactionEventListSummary extends React.Component<IProps> {
    static displayName = "RedactionEventListSummary";

    static defaultProps = {
        threshold: 2,
    };

    static contextType = MatrixClientContext;

    shouldComponentUpdate(nextProps) {
        // Update if
        //  - The number of summarised events has changed
        //  - or if the summary is about to toggle to become collapsed
        //  - or if there are fewEvents, meaning the child eventTiles are shown as-is
        return (
            nextProps.events.length !== this.props.events.length ||
            nextProps.events.length < this.props.threshold
        );
    }

    render() {
        const count = this.props.events.length;
        const redactionSender = this.props.events[0].getUnsigned().redacted_because.sender;

        let avatarMember = this.props.events[0].sender;
        let summaryText = _t("%(count)s messages deleted", { count });
        if (redactionSender !== this.context.getUserId()) {
            const room = (this.context as MatrixClient).getRoom(redactionSender || this.props.events[0].getSender());
            avatarMember = room && room.getMember(redactionSender);
            const name = avatarMember ? avatarMember.name : redactionSender;
            summaryText = _t("%(count)s messages deleted by %(name)s", { count, name });
        }

        const EventListSummary = sdk.getComponent("views.elements.EventListSummary");
        return <EventListSummary
            events={this.props.events}
            threshold={this.props.threshold}
            onToggle={this.props.onToggle}
            startExpanded={this.props.startExpanded}
            children={this.props.children}
            summaryMembers={[avatarMember]}
            summaryText={summaryText} />;
    }
}
