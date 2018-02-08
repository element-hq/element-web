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

function twelveHourTime(date, showSeconds=false) {
    let hours = date.getHours() % 12;
    const minutes = pad(date.getMinutes());
    const ampm = date.getHours() >= 12 ? _t('PM') : _t('AM');
    hours = hours ? hours : 12; // convert 0 -> 12
    if (showSeconds) {
        const seconds = pad(date.getSeconds());
        return `${hours}:${minutes}:${seconds}${ampm}`;
    }
    return `${hours}:${minutes}${ampm}`;
}

export function formatDate(date, showTwelveHour=false) {
    const now = new Date();
    const days = getDaysArray();
    const months = getMonthsArray();
    if (date.toDateString() === now.toDateString()) {
        return formatTime(date, showTwelveHour);
    } else if (now.getTime() - date.getTime() < 6 * 24 * 60 * 60 * 1000) {
        // TODO: use standard date localize function provided in counterpart
        return _t('%(weekDayName)s %(time)s', {
            weekDayName: days[date.getDay()],
            time: formatTime(date, showTwelveHour),
        });
    } else if (now.getFullYear() === date.getFullYear()) {
        // TODO: use standard date localize function provided in counterpart
        return _t('%(weekDayName)s, %(monthName)s %(day)s %(time)s', {
            weekDayName: days[date.getDay()],
            monthName: months[date.getMonth()],
            day: date.getDate(),
            time: formatTime(date, showTwelveHour),
        });
    }
    return formatFullDate(date, showTwelveHour);
}

export function formatFullDateNoTime(date) {
    const days = getDaysArray();
    const months = getMonthsArray();
    return _t('%(weekDayName)s, %(monthName)s %(day)s %(fullYear)s', {
        weekDayName: days[date.getDay()],
        monthName: months[date.getMonth()],
        day: date.getDate(),
        fullYear: date.getFullYear(),
    });
}

export function formatFullDate(date, showTwelveHour=false) {
    const days = getDaysArray();
    const months = getMonthsArray();
    return _t('%(weekDayName)s, %(monthName)s %(day)s %(fullYear)s %(time)s', {
        weekDayName: days[date.getDay()],
        monthName: months[date.getMonth()],
        day: date.getDate(),
        fullYear: date.getFullYear(),
        time: formatFullTime(date, showTwelveHour),
    });
}

export function formatFullTime(date, showTwelveHour=false) {
    if (showTwelveHour) {
        return twelveHourTime(date, true);
    }
    return pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
}

export function formatTime(date, showTwelveHour=false) {
    if (showTwelveHour) {
        return twelveHourTime(date);
    }
    return pad(date.getHours()) + ':' + pad(date.getMinutes());
}

const MILLIS_IN_DAY = 86400000;
export function wantsDateSeparator(prevEventDate, nextEventDate) {
    if (!nextEventDate || !prevEventDate) {
        return false;
    }
    // Return early for events that are > 24h apart
    if (Math.abs(prevEventDate.getTime() - nextEventDate.getTime()) > MILLIS_IN_DAY) {
        return true;
    }

    // Compare weekdays
    return prevEventDate.getDay() !== nextEventDate.getDay();
}
