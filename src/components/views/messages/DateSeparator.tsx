/*
Copyright 2018 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2015 - 2021 The Matrix.org Foundation C.I.C.

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

import { _t } from '../../../languageHandler';
import { formatFullDateNoTime } from '../../../DateUtils';
import { replaceableComponent } from "../../../utils/replaceableComponent";

function getDaysArray(): string[] {
    return [
        _t('Sunday'),
        _t('Monday'),
        _t('Tuesday'),
        _t('Wednesday'),
        _t('Thursday'),
        _t('Friday'),
        _t('Saturday'),
    ];
}

interface IProps {
    ts: number;
    forExport?: boolean;
}

@replaceableComponent("views.messages.DateSeparator")
export default class DateSeparator extends React.Component<IProps> {
    private getLabel() {
        const date = new Date(this.props.ts);

        // During the time the archive is being viewed, a specific day might not make sense, so we return the full date
        if (this.props.forExport) return formatFullDateNoTime(date);

        const today = new Date();
        const yesterday = new Date();
        const days = getDaysArray();
        yesterday.setDate(today.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return _t('Today');
        } else if (date.toDateString() === yesterday.toDateString()) {
            return _t('Yesterday');
        } else if (today.getTime() - date.getTime() < 6 * 24 * 60 * 60 * 1000) {
            return days[date.getDay()];
        } else {
            return formatFullDateNoTime(date);
        }
    }

    render() {
        // ARIA treats <hr/>s as separators, here we abuse them slightly so manually treat this entire thing as one
        // tab-index=-1 to allow it to be focusable but do not add tab stop for it, primarily for screen readers
        return <h2 className="mx_DateSeparator" role="separator" tabIndex={-1} aria-label={this.getLabel()}>
            <hr role="none" />
            <div aria-hidden="true">{ this.getLabel() }</div>
            <hr role="none" />
        </h2>;
    }
}
