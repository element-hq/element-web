/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export default class CustomBrandModule {
    static moduleApiVersion = "^1.2.0";
    /**
     * 
     * @param {import("@element-hq/element-web-module-api").Api} api 
     */
    constructor(api) {
        this.api = api;
        this.api.brand.registerTitleRenderer(({errorDidOccur, notificationCount, notificationsEnabled, roomId, roomName}) => {
            return `MyBrand | ${errorDidOccur ? "ERROR" : "OK"} | notifs=${notificationCount} | notifsenabled=${notificationsEnabled} | roomId=${roomId} | roomName=${roomName}`
        });
        this.api.brand.registerFaviconRenderer(() => {
            return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAGMUExURQAAAHZNgHhuiXZQgXqYlX3Kon3IonZOgJPQsXrHoF0AGHmglnVLf7POxIOGlpjStXpwi5TRsoXLqHt5jY7OrorNq4fMqZ//4HZTgnZPgXuqmXjUonXEnFK4hHZNgHZNgHZMgHZMgHpqiY7Cq5LRsZDPr4rNq2vBlXZNgHZNgHZNgHZPgJTRsozOrHZKf3ZNgHZNgICUl5PQsYHKpVgAFXZNgHZNgI3PrZTRsofNqWkAXHZNgHZNgI3OrZTRsoPMp28CanZNgHZNgIzOrYmen4/Rr0/BhXU4enZNgHZNgIzOrImhoHZQgXhXg3lriXZPgXZNgJrTtorIqnZNgHZMgHZOgHZNgHZNgIvNrIvRrXE0d3ZNgHZNgHZNgHZNgITLp4/Pr4/ProPKpnZNgHZNgHZNgHZNgGK+j1y8i3ZLf3dQgY2tpZfUtZbStH1tjH91j5LCrZbTtJTKsJTMsZrOtZbQs5XSs4yppH1sjIWNmZXOspfStIJ9k3VIfpvTt5vVt3ZMgHZNgJjStf///3HnC34AAABpdFJOUwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAECQkJAwgFI6TBwL+oUAQEVTpr82QDKxpu0xcBIxNt7zADPSZt4CADOSRt/ogCASgsbfL78D0BGP51lawLASVlUBjK6DMgIKObGLJ6B0cEAwV2SrsAAAABYktHRIP8tM/SAAAAB3RJTUUH6QYXDRw74LVdRgAAAMhJREFUGNNjYMAAjEzMLKxsQMAIAiABdkkpaRlZDk4uRjl5sICCopKyiqqaOreGphZIgEc7Mys7J1dHl1dP3wAkwGeYl19QmJtrZGxiagYS4DcvKs4tKc21sLSytgEL2JYVlldUVtnZOzg6gQWcq6trarNcXN3cPTzBAl519d4+Db5+Av4GAVCBwKDgxoaQ0LBwsKGCEU3VkVHRjTFOjLFxIAGh+ITEJGHr5JTUsDSwGSKi6Rli4ozyYYxhEKeD/MUmwQgFmJ4HALFlKaeL1fmEAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDI1LTA2LTIzVDEzOjI4OjU5KzAwOjAwkTuBLgAAACV0RVh0ZGF0ZTptb2RpZnkAMjAyNS0wNi0yM1QxMzoyODo1OSswMDowMOBmOZIAAAAodEVYdGRhdGU6dGltZXN0YW1wADIwMjUtMDYtMjNUMTM6Mjg6NTkrMDA6MDC3cxhNAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAABJRU5ErkJggg==`;
        })
    }
    async load() {}
}
