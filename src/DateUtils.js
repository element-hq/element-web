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

import UserSettingsStore from './UserSettingsStore';
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad(n) {
    return (n < 10 ? '0' : '') + n;
}

function twentyFourHour(date) {
    let hours = date.getHours() % 12;
    let minutes = pad(date.getMinutes());
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = pad(hours ? hours : 12);
    minutes = pad(minutes);
    return hours + ':' + minutes + ' ' + ampm;
}

module.exports = {
    formatDate: function(date) {
        var now = new Date();
        if (date.toDateString() === now.toDateString()) {
            return this.formatTime(date);
        }
        else if (now.getTime() - date.getTime() < 6 * 24 * 60 * 60 * 1000) {
            return days[date.getDay()] + " " + this.formatTime(date);
        }
        else if (now.getFullYear() === date.getFullYear()) {
            return days[date.getDay()] + ", " + months[date.getMonth()] + " " + date.getDate() + " " + this.formatTime(date);
        }
        else {
            return this.formatFullDate(date);
        }
    },

    formatFullDate: function(date) {
        return days[date.getDay()] + ", " + months[date.getMonth()] + " " + date.getDate() + " " + date.getFullYear() + " " + this.formatTime(date);
    },

    formatTime: function(date) {
        if (UserSettingsStore.getSyncedSetting('showTwelveHourTimestamps')) {
          return twentyFourHour(date);
        }
        return pad(date.getHours()) + ':' + pad(date.getMinutes());
    },
};
