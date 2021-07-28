// Type definitions for exported methods

declare class posthog {
    /**
     * This function initializes a new instance of the PostHog capturing object.
     * All new instances are added to the main posthog object as sub properties (such as
     * posthog.library_name) and also returned by this function. To define a
     * second instance on the page, you would call:
     *
     *     posthog.init('new token', { your: 'config' }, 'library_name');
     *
     * and use it like so:
     *
     *     posthog.library_name.capture(...);
     *
     * @param {String} token   Your PostHog API token
     * @param {Object} [config]  A dictionary of config options to override. <a href="https://github.com/posthog/posthog-js/blob/6e0e873/src/posthog-core.js#L57-L91">See a list of default config options</a>.
     * @param {String} [name]    The name for the new posthog instance that you want created
     */
    static init(token: string, config?: posthog.Config, name?: string): posthog

    /**
     * Clears super properties and generates a new random distinct_id for this instance.
     * Useful for clearing data when a user logs out.
     */
    static reset(reset_device_id?: boolean): void

    /**
     * Capture an event. This is the most important and
     * frequently used PostHog function.
     *
     * ### Usage:
     *
     *     // capture an event named 'Registered'
     *     posthog.capture('Registered', {'Gender': 'Male', 'Age': 21});
     *
     *     // capture an event using navigator.sendBeacon
     *     posthog.capture('Left page', {'duration_seconds': 35}, {transport: 'sendBeacon'});
     *
     * @param {String} event_name The name of the event. This can be anything the user does - 'Button Click', 'Sign Up', 'Item Purchased', etc.
     * @param {Object} [properties] A set of properties to include with the event you're sending. These describe the user who did the event or details about the event itself.
     * @param {Object} [options] Optional configuration for this capture request.
     * @param {String} [options.transport] Transport method for network request ('XHR' or 'sendBeacon').
     */
    static capture(
        event_name: string,
        properties?: posthog.Properties,
        options?: { transport: 'XHR' | 'sendBeacon' }
    ): posthog.CaptureResult

    /**
     * Capture a page view event, which is currently ignored by the server.
     * This function is called by default on page load unless the
     * capture_pageview configuration variable is false.
     *
     * @param {String} [page] The url of the page to record. If you don't include this, it defaults to the current url.
     * @api private
     */
    static capture_pageview(page?: string): void

    /**
     * Register a set of super properties, which are included with all
     * events. This will overwrite previous super property values.
     *
     * ### Usage:
     *
     *     // register 'Gender' as a super property
     *     posthog.register({'Gender': 'Female'});
     *
     *     // register several super properties when a user signs up
     *     posthog.register({
     *         'Email': 'jdoe@example.com',
     *         'Account Type': 'Free'
     *     });
     *
     * @param {Object} properties An associative array of properties to store about the user
     * @param {Number} [days] How many days since the user's last visit to store the super properties
     */
    static register(properties: posthog.Properties, days?: number): void

    /**
     * Register a set of super properties only once. This will not
     * overwrite previous super property values, unlike register().
     *
     * ### Usage:
     *
     *     // register a super property for the first time only
     *     posthog.register_once({
     *         'First Login Date': new Date().toISOString()
     *     });
     *
     * ### Notes:
     *
     * If default_value is specified, current super properties
     * with that value will be overwritten.
     *
     * @param {Object} properties An associative array of properties to store about the user
     * @param {*} [default_value] Value to override if already set in super properties (ex: 'False') Default: 'None'
     * @param {Number} [days] How many days since the users last visit to store the super properties
     */
    static register_once(properties: posthog.Properties, default_value?: posthog.Property, days?: number): void

    /**
     * Delete a super property stored with the current user.
     *
     * @param {String} property The name of the super property to remove
     */
    static unregister(property: string): void

    /**
     * Identify a user with a unique ID instead of a PostHog
     * randomly generated distinct_id. If the method is never called,
     * then unique visitors will be identified by a UUID generated
     * the first time they visit the site.
     *
     * If user properties are passed, they are also sent to posthog.
     *
     * ### Usage:
     *
     *      posthog.identify('[user unique id]')
     *      posthog.identify('[user unique id]', { email: 'john@example.com' })
     *      posthog.identify('[user unique id]', {}, { referral_code: '12345' })
     *
     * ### Notes:
     *
     * You can call this function to overwrite a previously set
     * unique ID for the current user. PostHog cannot translate
     * between IDs at this time, so when you change a user's ID
     * they will appear to be a new user.
     *
     * When used alone, posthog.identify will change the user's
     * distinct_id to the unique ID provided. When used in tandem
     * with posthog.alias, it will allow you to identify based on
     * unique ID and map that back to the original, anonymous
     * distinct_id given to the user upon her first arrival to your
     * site (thus connecting anonymous pre-signup activity to
     * post-signup activity). Though the two work together, do not
     * call identify() at the same time as alias(). Calling the two
     * at the same time can cause a race condition, so it is best
     * practice to call identify on the original, anonymous ID
     * right after you've aliased it.
     *
     * @param {String} [unique_id] A string that uniquely identifies a user. If not provided, the distinct_id currently in the persistent store (cookie or localStorage) will be used.
     * @param {Object} [userProperties] Optional: An associative array of properties to store about the user
     * @param {Object} [userPropertiesToSetOnce] Optional: An associative array of properties to store about the user. If property is previously set, this does not override that value.
     */
    static identify(
        unique_id?: string,
        userPropertiesToSet?: posthog.Properties,
        userPropertiesToSetOnce?: posthog.Properties
    ): void

    /**
     * Create an alias, which PostHog will use to link two distinct_ids going forward (not retroactively).
     * Multiple aliases can map to the same original ID, but not vice-versa. Aliases can also be chained - the
     * following is a valid scenario:
     *
     *     posthog.alias('new_id', 'existing_id');
     *     ...
     *     posthog.alias('newer_id', 'new_id');
     *
     * If the original ID is not passed in, we will use the current distinct_id - probably the auto-generated GUID.
     *
     * ### Notes:
     *
     * The best practice is to call alias() when a unique ID is first created for a user
     * (e.g., when a user first registers for an account and provides an email address).
     * alias() should never be called more than once for a given user, except to
     * chain a newer ID to a previously new ID, as described above.
     *
     * @param {String} alias A unique identifier that you want to use for this user in the future.
     * @param {String} [original] The current identifier being used for this user.
     */
    static alias(alias: string, original?: string): posthog.CaptureResult | number

    /**
     * Update the configuration of a posthog library instance.
     *
     * The default config is:
     *
     *     {
     *       // HTTP method for capturing requests
     *       api_method: 'POST'
     *
     *       // transport for sending requests ('XHR' or 'sendBeacon')
     *       // NB: sendBeacon should only be used for scenarios such as
     *       // page unload where a "best-effort" attempt to send is
     *       // acceptable; the sendBeacon API does not support callbacks
     *       // or any way to know the result of the request. PostHog
     *       // capturing via sendBeacon will not support any event-
     *       // batching or retry mechanisms.
     *       api_transport: 'XHR'
     *
     *       // Automatically capture clicks, form submissions and change events
     *       autocapture: true
     *
     *       // Capture rage clicks (beta) - useful for session recording
     *       rageclick: false
     *
     *       // super properties cookie expiration (in days)
     *       cookie_expiration: 365
     *
     *       // super properties span subdomains
     *       cross_subdomain_cookie: true
     *
     *       // debug mode
     *       debug: false
     *
     *       // if this is true, the posthog cookie or localStorage entry
     *       // will be deleted, and no user persistence will take place
     *       disable_persistence: false
     *
     *       // if this is true, PostHog will automatically determine
     *       // City, Region and Country data using the IP address of
     *       //the client
     *       ip: true
     *
     *       // opt users out of capturing by this PostHog instance by default
     *       opt_out_capturing_by_default: false
     *
     *       // opt users out of browser data storage by this PostHog instance by default
     *       opt_out_persistence_by_default: false
     *
     *       // persistence mechanism used by opt-in/opt-out methods - cookie
     *       // or localStorage - falls back to cookie if localStorage is unavailable
     *       opt_out_capturing_persistence_type: 'localStorage'
     *
     *       // customize the name of cookie/localStorage set by opt-in/opt-out methods
     *       opt_out_capturing_cookie_prefix: null
     *
     *       // type of persistent store for super properties (cookie/
     *       // localStorage) if set to 'localStorage', any existing
     *       // posthog cookie value with the same persistence_name
     *       // will be transferred to localStorage and deleted
     *       persistence: 'cookie'
     *
     *       // name for super properties persistent store
     *       persistence_name: ''
     *
     *       // names of properties/superproperties which should never
     *       // be sent with capture() calls
     *       property_blacklist: []
     *
     *       // if this is true, posthog cookies will be marked as
     *       // secure, meaning they will only be transmitted over https
     *       secure_cookie: false
     *
     *       // should we capture a page view on page load
     *       capture_pageview: true
     *
     *       // if you set upgrade to be true, the library will check for
     *       // a cookie from our old js library and import super
     *       // properties from it, then the old cookie is deleted
     *       // The upgrade config option only works in the initialization,
     *       // so make sure you set it when you create the library.
     *       upgrade: false
     *
     *       // extra HTTP request headers to set for each API request, in
     *       // the format {'Header-Name': value}
     *       xhr_headers: {}
     *
     *       // protocol for fetching in-app message resources, e.g.
     *       // 'https://' or 'http://'; defaults to '//' (which defers to the
     *       // current page's protocol)
     *       inapp_protocol: '//'
     *
     *       // whether to open in-app message link in new tab/window
     *       inapp_link_new_window: false
     *
     *      // a set of rrweb config options that PostHog users can configure
     *      // see https://github.com/rrweb-io/rrweb/blob/master/guide.md
     *      session_recording: {
     *         blockClass: 'ph-no-capture',
     *         blockSelector: null,
     *         ignoreClass: 'ph-ignore-input',
     *         maskAllInputs: false,
     *         maskInputOptions: {},
     *         maskInputFn: null,
     *         slimDOMOptions: {},
     *         collectFonts: false
     *      }
     *
     *      // prevent autocapture from capturing any attribute names on elements
     *      mask_all_element_attributes: false
     *
     *      // prevent autocapture from capturing textContent on all elements
     *      mask_all_text: false
     *
     *      // will disable requests to the /decide endpoint (please review documentation for details)
     *      // autocapture, feature flags, compression and session recording will be disabled when set to `true`
     *      advanced_disable_decide: false
     *
     *     }
     *
     *
     * @param {Object} config A dictionary of new configuration values to update
     */
    static set_config(config: posthog.Config): void

    /**
     * returns the current config object for the library.
     */
    static get_config<T extends keyof posthog.Config>(prop_name: T): posthog.Config[T]

    /**
     * Returns the value of the super property named property_name. If no such
     * property is set, get_property() will return the undefined value.
     *
     * ### Notes:
     *
     * get_property() can only be called after the PostHog library has finished loading.
     * init() has a loaded function available to handle this automatically. For example:
     *
     *     // grab value for 'user_id' after the posthog library has loaded
     *     posthog.init('YOUR PROJECT TOKEN', {
     *         loaded: function(posthog) {
     *             user_id = posthog.get_property('user_id');
     *         }
     *     });
     *
     * @param {String} property_name The name of the super property you want to retrieve
     */
    static get_property(property_name: string): posthog.Property | undefined

    /**
     * Returns the current distinct id of the user. This is either the id automatically
     * generated by the library or the id that has been passed by a call to identify().
     *
     * ### Notes:
     *
     * get_distinct_id() can only be called after the PostHog library has finished loading.
     * init() has a loaded function available to handle this automatically. For example:
     *
     *     // set distinct_id after the posthog library has loaded
     *     posthog.init('YOUR PROJECT TOKEN', {
     *         loaded: function(posthog) {
     *             distinct_id = posthog.get_distinct_id();
     *         }
     *     });
     */
    static get_distinct_id(): string

    /**
     * Opt the user out of data capturing and cookies/localstorage for this PostHog instance
     *
     * ### Usage
     *
     *     // opt user out
     *     posthog.opt_out_capturing();
     *
     *     // opt user out with different cookie configuration from PostHog instance
     *     posthog.opt_out_capturing({
     *         cookie_expiration: 30,
     *         secure_cookie: true
     *     });
     *
     * @param {Object} [options] A dictionary of config options to override
     * @param {boolean} [options.clear_persistence=true] If true, will delete all data stored by the sdk in persistence
     * @param {string} [options.persistence_type=localStorage] Persistence mechanism used - cookie or localStorage - falls back to cookie if localStorage is unavailable
     * @param {string} [options.cookie_prefix=__ph_opt_in_out] Custom prefix to be used in the cookie/localstorage name
     * @param {Number} [options.cookie_expiration] Number of days until the opt-in cookie expires (overrides value specified in this PostHog instance's config)
     * @param {boolean} [options.cross_subdomain_cookie] Whether the opt-in cookie is set as cross-subdomain or not (overrides value specified in this PostHog instance's config)
     * @param {boolean} [options.secure_cookie] Whether the opt-in cookie is set as secure or not (overrides value specified in this PostHog instance's config)
     */
    static opt_out_capturing(options?: posthog.OptInOutCapturingOptions): void

    /**
     * Opt the user in to data capturing and cookies/localstorage for this PostHog instance
     *
     * ### Usage
     *
     *     // opt user in
     *     posthog.opt_in_capturing();
     *
     *     // opt user in with specific event name, properties, cookie configuration
     *     posthog.opt_in_capturing({
     *         capture_event_name: 'User opted in',
     *         capture_event_properties: {
     *             'Email': 'jdoe@example.com'
     *         },
     *         cookie_expiration: 30,
     *         secure_cookie: true
     *     });
     *
     * @param {Object} [options] A dictionary of config options to override
     * @param {function} [options.capture] Function used for capturing a PostHog event to record the opt-in action (default is this PostHog instance's capture method)
     * @param {string} [options.capture_event_name=$opt_in] Event name to be used for capturing the opt-in action
     * @param {Object} [options.capture_properties] Set of properties to be captured along with the opt-in action
     * @param {boolean} [options.enable_persistence=true] If true, will re-enable sdk persistence
     * @param {string} [options.persistence_type=localStorage] Persistence mechanism used - cookie or localStorage - falls back to cookie if localStorage is unavailable
     * @param {string} [options.cookie_prefix=__ph_opt_in_out] Custom prefix to be used in the cookie/localstorage name
     * @param {Number} [options.cookie_expiration] Number of days until the opt-in cookie expires (overrides value specified in this PostHog instance's config)
     * @param {boolean} [options.cross_subdomain_cookie] Whether the opt-in cookie is set as cross-subdomain or not (overrides value specified in this PostHog instance's config)
     * @param {boolean} [options.secure_cookie] Whether the opt-in cookie is set as secure or not (overrides value specified in this PostHog instance's config)
     */
    static opt_in_capturing(options?: posthog.OptInOutCapturingOptions): void

    /**
     * Check whether the user has opted out of data capturing and cookies/localstorage for this PostHog instance
     *
     * ### Usage
     *
     *     const has_opted_out = posthog.has_opted_out_capturing();
     *     // use has_opted_out value
     *
     * @param {Object} [options] A dictionary of config options to override
     * @param {string} [options.persistence_type=localStorage] Persistence mechanism used - cookie or localStorage - falls back to cookie if localStorage is unavailable
     * @param {string} [options.cookie_prefix=__ph_opt_in_out] Custom prefix to be used in the cookie/localstorage name
     * @returns {boolean} current opt-out status
     */
    static has_opted_out_capturing(options?: posthog.HasOptedInOutCapturingOptions): boolean

    /**
     * Check whether the user has opted in to data capturing and cookies/localstorage for this PostHog instance
     *
     * ### Usage
     *
     *     const has_opted_in = posthog.has_opted_in_capturing();
     *     // use has_opted_in value
     *
     * @param {Object} [options] A dictionary of config options to override
     * @param {string} [options.persistence_type=localStorage] Persistence mechanism used - cookie or localStorage - falls back to cookie if localStorage is unavailable
     * @param {string} [options.cookie_prefix=__ph_opt_in_out] Custom prefix to be used in the cookie/localstorage name
     * @returns {boolean} current opt-in status
     */
    static has_opted_in_capturing(options?: posthog.HasOptedInOutCapturingOptions): boolean

    /**
     * Clear the user's opt in/out status of data capturing and cookies/localstorage for this PostHog instance
     *
     * ### Usage
     *
     *     // clear user's opt-in/out status
     *     posthog.clear_opt_in_out_capturing();
     *
     *     // clear user's opt-in/out status with specific cookie configuration - should match
     *     // configuration used when opt_in_capturing/opt_out_capturing methods were called.
     *     posthog.clear_opt_in_out_capturing({
     *         cookie_expiration: 30,
     *         secure_cookie: true
     *     });
     *
     * @param {Object} [options] A dictionary of config options to override
     * @param {boolean} [options.enable_persistence=true] If true, will re-enable sdk persistence
     * @param {string} [options.persistence_type=localStorage] Persistence mechanism used - cookie or localStorage - falls back to cookie if localStorage is unavailable
     * @param {string} [options.cookie_prefix=__ph_opt_in_out] Custom prefix to be used in the cookie/localstorage name
     * @param {Number} [options.cookie_expiration] Number of days until the opt-in cookie expires (overrides value specified in this PostHog instance's config)
     * @param {boolean} [options.cross_subdomain_cookie] Whether the opt-in cookie is set as cross-subdomain or not (overrides value specified in this PostHog instance's config)
     * @param {boolean} [options.secure_cookie] Whether the opt-in cookie is set as secure or not (overrides value specified in this PostHog instance's config)
     */
    static clear_opt_in_out_capturing(options?: posthog.ClearOptInOutCapturingOptions): void

    /*
     * See if feature flag is enabled for user.
     *
     * ### Usage:
     *
     *     if(posthog.isFeatureEnabled('beta-feature')) { // do something }
     *
     * @param {Object|String} prop Key of the feature flag.
     * @param {Object|String} options (optional) If {send_event: false}, we won't send an $feature_flag_call event to PostHog.
     */
    static isFeatureEnabled(key: string, options?: posthog.isFeatureEnabledOptions): boolean

    /*
     * See if feature flags are available.
     *
     * ### Usage:
     *
     *     posthog.onFeatureFlags(function(featureFlags) { // do something })
     *
     * @param {Function} [callback] The callback function will be called once the feature flags are ready. It'll return a list of feature flags enabled for the user.
     */
    static onFeatureFlags(callback: (flags: string[]) => void): false | undefined

    /*
     * Reload all feature flags for the user.
     *
     * ### Usage:
     *
     *     posthog.reloadFeatureFlags()
     */
    static reloadFeatureFlags(): void

    static toString(): string

    /* Will log all capture requests to the Javascript console, including event properties for easy debugging */
    static debug(): void

    /*
     * Starts session recording and updates disable_session_recording to false.
     * Used for manual session recording management. By default, session recording is enabled and
     * starts automatically.
     *
     * ### Usage:
     *
     *     posthog.startSessionRecording()
     */
    static startSessionRecording(): void

    /*
     * Stops session recording and updates disable_session_recording to true.
     *
     * ### Usage:
     *
     *     posthog.stopSessionRecording()
     */
    static stopSessionRecording(): void

    /*
     * Check if session recording is currently running.
     *
     * ### Usage:
     *
     *     const isSessionRecordingOn = posthog.sessionRecordingStarted()
     */
    static sessionRecordingStarted(): boolean
}

declare namespace posthog {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    type Property = any;
    type Properties = Record<string, Property>;
    type CaptureResult = { event: string; properties: Properties } | undefined;
    type CaptureCallback = (response: any, data: any) => void;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    interface Config {
        api_host?: string
        api_method?: string
        api_transport?: string
        autocapture?: boolean
        rageclick?: boolean
        cdn?: string
        cross_subdomain_cookie?: boolean
        persistence?: 'localStorage' | 'cookie' | 'memory'
        persistence_name?: string
        cookie_name?: string
        loaded?: (posthog_instance: typeof posthog) => void
        store_google?: boolean
        save_referrer?: boolean
        test?: boolean
        verbose?: boolean
        img?: boolean
        capture_pageview?: boolean
        debug?: boolean
        cookie_expiration?: number
        upgrade?: boolean
        disable_session_recording?: boolean
        disable_persistence?: boolean
        disable_cookie?: boolean
        secure_cookie?: boolean
        ip?: boolean
        opt_out_capturing_by_default?: boolean
        opt_out_persistence_by_default?: boolean
        opt_out_capturing_persistence_type?: 'localStorage' | 'cookie'
        opt_out_capturing_cookie_prefix?: string | null
        respect_dnt?: boolean
        property_blacklist?: string[]
        xhr_headers?: { [header_name: string]: string }
        inapp_protocol?: string
        inapp_link_new_window?: boolean
        request_batching?: boolean
        sanitize_properties?: (properties: posthog.Properties, event_name: string) => posthog.Properties
        properties_string_max_length?: number
        mask_all_element_attributes?: boolean
        mask_all_text?: boolean
        advanced_disable_decide?: boolean
    }

    interface OptInOutCapturingOptions {
        clear_persistence: boolean
        persistence_type: string
        cookie_prefix: string
        cookie_expiration: number
        cross_subdomain_cookie: boolean
        secure_cookie: boolean
    }

    interface HasOptedInOutCapturingOptions {
        persistence_type: string
        cookie_prefix: string
    }

    interface ClearOptInOutCapturingOptions {
        enable_persistence: boolean
        persistence_type: string
        cookie_prefix: string
        cookie_expiration: number
        cross_subdomain_cookie: boolean
        secure_cookie: boolean
    }

    interface isFeatureEnabledOptions {
        send_event: boolean
    }

    export class persistence {
        static properties(): posthog.Properties

        static load(): void

        static save(): void

        static remove(): void

        static clear(): void

        /**
         * @param {Object} props
         * @param {*=} default_value
         * @param {number=} days
         */
        static register_once(props: Properties, default_value?: Property, days?: number): boolean

        /**
         * @param {Object} props
         * @param {number=} days
         */
        static register(props: posthog.Properties, days?: number): boolean

        static unregister(prop: string): void

        static update_campaign_params(): void

        static update_search_keyword(referrer: string): void

        static update_referrer_info(referrer: string): void

        static get_referrer_info(): posthog.Properties

        static safe_merge(props: posthog.Properties): posthog.Properties

        static update_config(config: posthog.Config): void

        static set_disabled(disabled: boolean): void

        static set_cross_subdomain(cross_subdomain: boolean): void

        static get_cross_subdomain(): boolean

        static set_secure(secure: boolean): void

        static set_event_timer(event_name: string, timestamp: Date): void

        static remove_event_timer(event_name: string): Date | undefined
    }

    export class people {
        /*
         * Set properties on a user record.
         *
         * ### Usage:
         *
         *     posthog.people.set('gender', 'm');
         *
         *     // or set multiple properties at once
         *     posthog.people.set({
         *         'Company': 'Acme',
         *         'Plan': 'Premium',
         *         'Upgrade date': new Date()
         *     });
         *     // properties can be strings, integers, dates, or lists
         *
         * @param {Object|String} prop If a string, this is the name of the property. If an object, this is an associative array of names and values.
         * @param {*} [to] A value to set on the given property name
         * @param {Function} [callback] If provided, the callback will be called after capturing the event.
         */
        static set(
            prop: posthog.Properties | string,
            to?: posthog.Property,
            callback?: posthog.CaptureCallback
        ): posthog.Properties

        /*
         * Set properties on a user record, only if they do not yet exist.
         * This will not overwrite previous people property values, unlike
         * people.set().
         *
         * ### Usage:
         *
         *     posthog.people.set_once('First Login Date', new Date());
         *
         *     // or set multiple properties at once
         *     posthog.people.set_once({
         *         'First Login Date': new Date(),
         *         'Starting Plan': 'Premium'
         *     });
         *
         *     // properties can be strings, integers or dates
         *
         * @param {Object|String} prop If a string, this is the name of the property. If an object, this is an associative array of names and values.
         * @param {*} [to] A value to set on the given property name
         * @param {Function} [callback] If provided, the callback will be called after capturing the event.
         */
        static set_once(
            prop: posthog.Properties | string,
            to?: posthog.Property,
            callback?: posthog.CaptureCallback
        ): posthog.Properties

        static toString(): string
    }

    export class featureFlags {
        static getFlags(): string[]

        static reloadFeatureFlags(): void

        /*
         * See if feature flag is enabled for user.
         *
         * ### Usage:
         *
         *     if(posthog.isFeatureEnabled('beta-feature')) { // do something }
         *
         * @param {Object|String} prop Key of the feature flag.
         * @param {Object|String} options (optional) If {send_event: false}, we won't send an $feature_flag_call event to PostHog.
         */
        static isFeatureEnabled(key: string, options?: { send_event?: boolean }): boolean

        /*
         * See if feature flags are available.
         *
         * ### Usage:
         *
         *     posthog.onFeatureFlags(function(featureFlags) { // do something })
         *
         * @param {Function} [callback] The callback function will be called once the feature flags are ready. It'll return a list of feature flags enabled for the user.
         */
        static onFeatureFlags(callback: (flags: string[]) => void): false | undefined
    }

    export class feature_flags extends featureFlags {}
}

export type PostHog = typeof posthog;

export default posthog;
