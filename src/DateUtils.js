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

'use strict';
import { _t } from './languageHandler';

function getDaysArray() {
    var days = [];
    days.push(_t('Sun'));
    days.push(_t('Mon'));
    days.push(_t('Tue'));
    days.push(_t('Wed'));
    days.push(_t('Thu'));
    days.push(_t('Fri'));
    days.push(_t('Sat'));
    return days;
}

function getMonthsArray() {
    var months = [];
    months.push(_t('Jan'));
    months.push(_t('Feb'));
    months.push(_t('Mar'));
    months.push(_t('Apr'));
    months.push(_t('May'));
    months.push(_t('Jun'));
    months.push(_t('Jul'));
    months.push(_t('Aug'));
    months.push(_t('Sep'));
    months.push(_t('Oct'));
    months.push(_t('Nov'));
    months.push(_t('Dec'));
    return months;
}

function pad(n) {
    return (n < 10 ? '0' : '') + n;
}

module.exports = {
    formatDate: function(date) {
        // date.toLocaleTimeString is completely system dependent.
        // just go 24h for now
        const days = getDaysArray();
        const months = getMonthsArray();

        // TODO: use standard date localize function provided in counterpart
        var hoursAndMinutes = pad(date.getHours()) + ':' + pad(date.getMinutes());
        var now = new Date();
        if (date.toDateString() === now.toDateString()) {
            return hoursAndMinutes;
        }
        else if (now.getTime() - date.getTime() < 6 * 24 * 60 * 60 * 1000) {
            // TODO: use standard date localize function provided in counterpart
            return _t('%(weekDayName)s %(time)s', {weekDayName: days[date.getDay()], time: hoursAndMinutes});
        }
        else if (now.getFullYear() === date.getFullYear()) {
            // TODO: use standard date localize function provided in counterpart
            return _t('%(weekDayName)s, %(monthName)s %(day)s %(time)s', {weekDayName: days[date.getDay()], monthName: months[date.getMonth()], day: date.getDate(), time: hoursAndMinutes});
        }
        else {
            return this.formatFullDate(date);
        }
    },

    formatFullDate: function(date) {
        const days = getDaysArray();
        const months = getMonthsArray();
        var hoursAndMinutes = pad(date.getHours()) + ':' + pad(date.getMinutes());
        return _t('%(weekDayName)s, %(monthName)s %(day)s %(fullYear)s %(time)s', {weekDayName: days[date.getDay()], monthName: months[date.getMonth()], day: date.getDate(), fullYear: date.getFullYear(),time: hoursAndMinutes});
    },

    formatTime: function(date) {
        return pad(date.getHours()) + ':' + pad(date.getMinutes());
    }
};
