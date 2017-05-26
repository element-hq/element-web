/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd

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

'use strict';
import { _t } from './languageHandler';

function getDaysArray() {
    return [
        _t('Sun'),
        _t('Mon'),
        _t('Tue'),
        _t('Wed'),
        _t('Thu'),
        _t('Fri'),
        _t('Sat'),
    ];
}

function getMonthsArray() {
    return [
        _t('Jan'),
        _t('Feb'),
        _t('Mar'),
        _t('Apr'),
        _t('May'),
        _t('Jun'),
        _t('Jul'),
        _t('Aug'),
        _t('Sep'),
        _t('Oct'),
        _t('Nov'),
        _t('Dec'),
    ];
}

function pad(n) {
    return (n < 10 ? '0' : '') + n;
}

function twelveHourTime(date) {
    let hours = date.getHours() % 12;
    const minutes = pad(date.getMinutes());
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = pad(hours ? hours : 12);
    return `${hours}:${minutes} ${ampm}`;
}

module.exports = {
    formatDate: function(date) {
        var now = new Date();
        const days = getDaysArray();
        const months = getMonthsArray();
        if (date.toDateString() === now.toDateString()) {
            return this.formatTime(date);
        }
        else if (now.getTime() - date.getTime() < 6 * 24 * 60 * 60 * 1000) {
            // TODO: use standard date localize function provided in counterpart
            return _t('%(weekDayName)s %(time)s', {weekDayName: days[date.getDay()], time: this.formatTime(date)});
        }
        else if (now.getFullYear() === date.getFullYear()) {
            // TODO: use standard date localize function provided in counterpart
            return _t('%(weekDayName)s, %(monthName)s %(day)s %(time)s', {
                weekDayName: days[date.getDay()],
                monthName: months[date.getMonth()],
                day: date.getDate(),
                time: this.formatTime(date),
            });
        }
        return this.formatFullDate(date);
    },

    formatFullDate: function(date) {
        const days = getDaysArray();
        const months = getMonthsArray();
        return _t('%(weekDayName)s, %(monthName)s %(day)s %(fullYear)s %(time)s', {
            weekDayName: days[date.getDay()],
            monthName: months[date.getMonth()],
            day: date.getDate(),
            fullYear: date.getFullYear(),
            time: this.formatTime(date),
        });
    },

    formatTime: function(date, showTwelveHour=false) {
        if (showTwelveHour) {
          return twelveHourTime(date);
        }
        return pad(date.getHours()) + ':' + pad(date.getMinutes());
    },
};
