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

var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

module.exports = {
    formatDate: function(date) {
        // date.toLocaleTimeString is completely system dependent.
        // just go 24h for now
        function pad(n) {
            return (n < 10 ? '0' : '') + n;
        }

        var now = new Date();
        if (date.toDateString() === now.toDateString()) {
            return pad(date.getHours()) + ':' + pad(date.getMinutes());
        }
        else if (now.getTime() - date.getTime() < 6 * 24 * 60 * 60 * 1000) {
            return days[date.getDay()] + " " + pad(date.getHours()) + ':' + pad(date.getMinutes());
        }
        else if (now.getFullYear() === date.getFullYear()) {
            return days[date.getDay()] + ", " + months[date.getMonth()] + " " + date.getDate() + " " + pad(date.getHours()) + ':' + pad(date.getMinutes());
        }
        else {
            return days[date.getDay()] + ", " + months[date.getMonth()] + " " + date.getDate() + " " + date.getFullYear() + " " + pad(date.getHours()) + ':' + pad(date.getMinutes());
        }
    }
}

