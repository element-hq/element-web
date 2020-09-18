/*
Copyright 2015, 2016 OpenMarket Ltd

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

import { _t } from '../../../languageHandler';


export default class PresenceLabel extends React.Component {
    static propTypes = {
        // number of milliseconds ago this user was last active.
        // zero = unknown
        activeAgo: PropTypes.number,

        // if true, activeAgo is an approximation and "Now" should
        // be shown instead
        currentlyActive: PropTypes.bool,

        // offline, online, etc
        presenceState: PropTypes.string,
    };

    static defaultProps = {
        activeAgo: -1,
        presenceState: null,
    };

    // Return duration as a string using appropriate time units
    // XXX: This would be better handled using a culture-aware library, but we don't use one yet.
    getDuration(time) {
        if (!time) return;
        const t = parseInt(time / 1000);
        const s = t % 60;
        const m = parseInt(t / 60) % 60;
        const h = parseInt(t / (60 * 60)) % 24;
        const d = parseInt(t / (60 * 60 * 24));
        if (t < 60) {
            if (t < 0) {
                return _t("%(duration)ss", {duration: 0});
            }
            return _t("%(duration)ss", {duration: s});
        }
        if (t < 60 * 60) {
            return _t("%(duration)sm", {duration: m});
        }
        if (t < 24 * 60 * 60) {
            return _t("%(duration)sh", {duration: h});
        }
        return _t("%(duration)sd", {duration: d});
    }

    getPrettyPresence(presence, activeAgo, currentlyActive) {
        if (!currentlyActive && activeAgo !== undefined && activeAgo > 0) {
            const duration = this.getDuration(activeAgo);
            if (presence === "online") return _t("Online for %(duration)s", { duration: duration });
            if (presence === "unavailable") return _t("Idle for %(duration)s", { duration: duration }); // XXX: is this actually right?
            if (presence === "offline") return _t("Offline for %(duration)s", { duration: duration });
            return _t("Unknown for %(duration)s", { duration: duration });
        } else {
            if (presence === "online") return _t("Online");
            if (presence === "unavailable") return _t("Idle"); // XXX: is this actually right?
            if (presence === "offline") return _t("Offline");
            return _t("Unknown");
        }
    }

    render() {
        return (
            <div className="mx_PresenceLabel">
                { this.getPrettyPresence(this.props.presenceState, this.props.activeAgo, this.props.currentlyActive) }
            </div>
        );
    }
}
