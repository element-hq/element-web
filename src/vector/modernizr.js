/*!
 * modernizr v3.13.0
 * Build https://modernizr.com/download?-cors-cryptography-cssanimations-cssfilters-displaytable-es5date-es5function-es5object-es5undefined-es6array-es6collections-es6string-fetch-flexbox-json-localstorage-objectfit-promises-resizeobserver-sandbox-svg-svgasimg-svgfilters-urlparser-urlsearchparams-webaudio-dontmin
 *
 * Copyright (c)
 *  Faruk Ates
 *  Paul Irish
 *  Alex Sexton
 *  Ryan Seddon
 *  Patrick Kettner
 *  Stu Cox
 *  Richard Herrera
 *  Veeck

 * MIT License
 */

/*
 * Modernizr tests which native CSS3 and HTML5 features are available in the
 * current UA and makes the results available to you in two ways: as properties on
 * a global `Modernizr` object, and as classes on the `<html>` element. This
 * information allows you to progressively enhance your pages with a granular level
 * of control over the experience.
*/

;(function(scriptGlobalObject, window, document, undefined){

  var tests = [];
  

  /**
   * ModernizrProto is the constructor for Modernizr
   *
   * @class
   * @access public
   */
  var ModernizrProto = {
    _version: '3.13.0',

    // Any settings that don't work as separate modules
    // can go in here as configuration.
    _config: {
      'classPrefix': '',
      'enableClasses': false,
      'enableJSClass': true,
      'usePrefixes': true
    },

    // Queue of tests
    _q: [],

    // Stub these for people who are listening
    on: function(test, cb) {
      // I don't really think people should do this, but we can
      // safe guard it a bit.
      // -- NOTE:: this gets WAY overridden in src/addTest for actual async tests.
      // This is in case people listen to synchronous tests. I would leave it out,
      // but the code to *disallow* sync tests in the real version of this
      // function is actually larger than this.
      var self = this;
      setTimeout(function() {
        cb(self[test]);
      }, 0);
    },

    addTest: function(name, fn, options) {
      tests.push({name: name, fn: fn, options: options});
    },

    addAsyncTest: function(fn) {
      tests.push({name: null, fn: fn});
    }
  };

  

  // Fake some of Object.create so we can force non test results to be non "own" properties.
  var Modernizr = function() {};
  Modernizr.prototype = ModernizrProto;

  // Leak modernizr globally when you `require` it rather than force it here.
  // Overwrite name so constructor name is nicer :D
  Modernizr = new Modernizr();

  

  var classes = [];
  

  /**
   * is returns a boolean if the typeof an obj is exactly type.
   *
   * @access private
   * @function is
   * @param {*} obj - A thing we want to check the type of
   * @param {string} type - A string to compare the typeof against
   * @returns {boolean} true if the typeof the first parameter is exactly the specified type, false otherwise
   */
  function is(obj, type) {
    return typeof obj === type;
  }

  ;

  /**
   * Run through all tests and detect their support in the current UA.
   *
   * @access private
   * @returns {void}
   */
  function testRunner() {
    var featureNames;
    var feature;
    var aliasIdx;
    var result;
    var nameIdx;
    var featureName;
    var featureNameSplit;

    for (var featureIdx in tests) {
      if (tests.hasOwnProperty(featureIdx)) {
        featureNames = [];
        feature = tests[featureIdx];
        // run the test, throw the return value into the Modernizr,
        // then based on that boolean, define an appropriate className
        // and push it into an array of classes we'll join later.
        //
        // If there is no name, it's an 'async' test that is run,
        // but not directly added to the object. That should
        // be done with a post-run addTest call.
        if (feature.name) {
          featureNames.push(feature.name.toLowerCase());

          if (feature.options && feature.options.aliases && feature.options.aliases.length) {
            // Add all the aliases into the names list
            for (aliasIdx = 0; aliasIdx < feature.options.aliases.length; aliasIdx++) {
              featureNames.push(feature.options.aliases[aliasIdx].toLowerCase());
            }
          }
        }

        // Run the test, or use the raw value if it's not a function
        result = is(feature.fn, 'function') ? feature.fn() : feature.fn;

        // Set each of the names on the Modernizr object
        for (nameIdx = 0; nameIdx < featureNames.length; nameIdx++) {
          featureName = featureNames[nameIdx];
          // Support dot properties as sub tests. We don't do checking to make sure
          // that the implied parent tests have been added. You must call them in
          // order (either in the test, or make the parent test a dependency).
          //
          // Cap it to TWO to make the logic simple and because who needs that kind of subtesting
          // hashtag famous last words
          featureNameSplit = featureName.split('.');

          if (featureNameSplit.length === 1) {
            Modernizr[featureNameSplit[0]] = result;
          } else {
            // cast to a Boolean, if not one already or if it doesnt exist yet (like inputtypes)
            if (!Modernizr[featureNameSplit[0]] || Modernizr[featureNameSplit[0]] && !(Modernizr[featureNameSplit[0]] instanceof Boolean)) {
              Modernizr[featureNameSplit[0]] = new Boolean(Modernizr[featureNameSplit[0]]);
            }

            Modernizr[featureNameSplit[0]][featureNameSplit[1]] = result;
          }

          classes.push((result ? '' : 'no-') + featureNameSplit.join('-'));
        }
      }
    }
  }
  ;

  /**
   * If the browsers follow the spec, then they would expose vendor-specific styles as:
   *   elem.style.WebkitBorderRadius
   * instead of something like the following (which is technically incorrect):
   *   elem.style.webkitBorderRadius
   *
   * WebKit ghosts their properties in lowercase but Opera & Moz do not.
   * Microsoft uses a lowercase `ms` instead of the correct `Ms` in IE8+
   *   erik.eae.net/archives/2008/03/10/21.48.10/
   *
   * More here: github.com/Modernizr/Modernizr/issues/issue/21
   *
   * @access private
   * @returns {string} The string representing the vendor-specific style properties
   */
  var omPrefixes = 'Moz O ms Webkit';
  

  var cssomPrefixes = (ModernizrProto._config.usePrefixes ? omPrefixes.split(' ') : []);
  ModernizrProto._cssomPrefixes = cssomPrefixes;
  

  /**
   * contains checks to see if a string contains another string
   *
   * @access private
   * @function contains
   * @param {string} str - The string we want to check for substrings
   * @param {string} substr - The substring we want to search the first string for
   * @returns {boolean} true if and only if the first string 'str' contains the second string 'substr'
   */
  function contains(str, substr) {
    return !!~('' + str).indexOf(substr);
  }

  ;

  /**
   * docElement is a convenience wrapper to grab the root element of the document
   *
   * @access private
   * @returns {HTMLElement|SVGElement} The root element of the document
   */
  var docElement = document.documentElement;
  

  /**
   * A convenience helper to check if the document we are running in is an SVG document
   *
   * @access private
   * @returns {boolean}
   */
  var isSVG = docElement.nodeName.toLowerCase() === 'svg';

  

  /**
   * createElement is a convenience wrapper around document.createElement. Since we
   * use createElement all over the place, this allows for (slightly) smaller code
   * as well as abstracting away issues with creating elements in contexts other than
   * HTML documents (e.g. SVG documents).
   *
   * @access private
   * @function createElement
   * @returns {HTMLElement|SVGElement} An HTML or SVG element
   */
  function createElement() {
    if (typeof document.createElement !== 'function') {
      // This is the case in IE7, where the type of createElement is "object".
      // For this reason, we cannot call apply() as Object is not a Function.
      return document.createElement(arguments[0]);
    } else if (isSVG) {
      return document.createElementNS.call(document, 'http://www.w3.org/2000/svg', arguments[0]);
    } else {
      return document.createElement.apply(document, arguments);
    }
  }

  ;

  /**
   * Create our "modernizr" element that we do most feature tests on.
   *
   * @access private
   */
  var modElem = {
    elem: createElement('modernizr')
  };

  // Clean up this element
  Modernizr._q.push(function() {
    delete modElem.elem;
  });

  

  var mStyle = {
    style: modElem.elem.style
  };

  // kill ref for gc, must happen before mod.elem is removed, so we unshift on to
  // the front of the queue.
  Modernizr._q.unshift(function() {
    delete mStyle.style;
  });

  

  /**
   * getBody returns the body of a document, or an element that can stand in for
   * the body if a real body does not exist
   *
   * @access private
   * @function getBody
   * @returns {HTMLElement|SVGElement} Returns the real body of a document, or an
   * artificially created element that stands in for the body
   */
  function getBody() {
    // After page load injecting a fake body doesn't work so check if body exists
    var body = document.body;

    if (!body) {
      // Can't use the real body create a fake one.
      body = createElement(isSVG ? 'svg' : 'body');
      body.fake = true;
    }

    return body;
  }

  ;

  /**
   * injectElementWithStyles injects an element with style element and some CSS rules
   *
   * @access private
   * @function injectElementWithStyles
   * @param {string} rule - String representing a css rule
   * @param {Function} callback - A function that is used to test the injected element
   * @param {number} [nodes] - An integer representing the number of additional nodes you want injected
   * @param {string[]} [testnames] - An array of strings that are used as ids for the additional nodes
   * @returns {boolean} the result of the specified callback test
   */
  function injectElementWithStyles(rule, callback, nodes, testnames) {
    var mod = 'modernizr';
    var style;
    var ret;
    var node;
    var docOverflow;
    var div = createElement('div');
    var body = getBody();

    if (parseInt(nodes, 10)) {
      // In order not to give false positives we create a node for each test
      // This also allows the method to scale for unspecified uses
      while (nodes--) {
        node = createElement('div');
        node.id = testnames ? testnames[nodes] : mod + (nodes + 1);
        div.appendChild(node);
      }
    }

    style = createElement('style');
    style.type = 'text/css';
    style.id = 's' + mod;

    // IE6 will false positive on some tests due to the style element inside the test div somehow interfering offsetHeight, so insert it into body or fakebody.
    // Opera will act all quirky when injecting elements in documentElement when page is served as xml, needs fakebody too. #270
    (!body.fake ? div : body).appendChild(style);
    body.appendChild(div);

    if (style.styleSheet) {
      style.styleSheet.cssText = rule;
    } else {
      style.appendChild(document.createTextNode(rule));
    }
    div.id = mod;

    if (body.fake) {
      //avoid crashing IE8, if background image is used
      body.style.background = '';
      //Safari 5.13/5.1.4 OSX stops loading if ::-webkit-scrollbar is used and scrollbars are visible
      body.style.overflow = 'hidden';
      docOverflow = docElement.style.overflow;
      docElement.style.overflow = 'hidden';
      docElement.appendChild(body);
    }

    ret = callback(div, rule);
    // If this is done after page load we don't want to remove the body so check if body exists
    if (body.fake && body.parentNode) {
      body.parentNode.removeChild(body);
      docElement.style.overflow = docOverflow;
      // Trigger layout so kinetic scrolling isn't disabled in iOS6+
      // eslint-disable-next-line
      docElement.offsetHeight;
    } else {
      div.parentNode.removeChild(div);
    }

    return !!ret;
  }

  ;

  /**
   * domToCSS takes a camelCase string and converts it to hyphen-case
   * e.g. boxSizing -> box-sizing
   *
   * @access private
   * @function domToCSS
   * @param {string} name - String name of camelCase prop we want to convert
   * @returns {string} The hyphen-case version of the supplied name
   */
  function domToCSS(name) {
    return name.replace(/([A-Z])/g, function(str, m1) {
      return '-' + m1.toLowerCase();
    }).replace(/^ms-/, '-ms-');
  }

  ;


  /**
   * wrapper around getComputedStyle, to fix issues with Firefox returning null when
   * called inside of a hidden iframe
   *
   * @access private
   * @function computedStyle
   * @param {HTMLElement|SVGElement} elem - The element we want to find the computed styles of
   * @param {string|null} [pseudo] - An optional pseudo element selector (e.g. :before), of null if none
   * @param {string} prop - A CSS property
   * @returns {CSSStyleDeclaration} the value of the specified CSS property
   */
  function computedStyle(elem, pseudo, prop) {
    var result;

    if ('getComputedStyle' in window) {
      result = getComputedStyle.call(window, elem, pseudo);
      var console = window.console;

      if (result !== null) {
        if (prop) {
          result = result.getPropertyValue(prop);
        }
      } else {
        if (console) {
          var method = console.error ? 'error' : 'log';
          console[method].call(console, 'getComputedStyle returning null, its possible modernizr test results are inaccurate');
        }
      }
    } else {
      result = !pseudo && elem.currentStyle && elem.currentStyle[prop];
    }

    return result;
  }

  ;

  /**
   * nativeTestProps allows for us to use native feature detection functionality if available.
   * some prefixed form, or false, in the case of an unsupported rule
   *
   * @access private
   * @function nativeTestProps
   * @param {Array} props - An array of property names
   * @param {string} value - A string representing the value we want to check via @supports
   * @returns {boolean|undefined} A boolean when @supports exists, undefined otherwise
   */
  // Accepts a list of property names and a single value
  // Returns `undefined` if native detection not available
  function nativeTestProps(props, value) {
    var i = props.length;
    // Start with the JS API: https://www.w3.org/TR/css3-conditional/#the-css-interface
    if ('CSS' in window && 'supports' in window.CSS) {
      // Try every prefixed variant of the property
      while (i--) {
        if (window.CSS.supports(domToCSS(props[i]), value)) {
          return true;
        }
      }
      return false;
    }
    // Otherwise fall back to at-rule (for Opera 12.x)
    else if ('CSSSupportsRule' in window) {
      // Build a condition string for every prefixed variant
      var conditionText = [];
      while (i--) {
        conditionText.push('(' + domToCSS(props[i]) + ':' + value + ')');
      }
      conditionText = conditionText.join(' or ');
      return injectElementWithStyles('@supports (' + conditionText + ') { #modernizr { position: absolute; } }', function(node) {
        return computedStyle(node, null, 'position') === 'absolute';
      });
    }
    return undefined;
  }
  ;

  /**
   * cssToDOM takes a hyphen-case string and converts it to camelCase
   * e.g. box-sizing -> boxSizing
   *
   * @access private
   * @function cssToDOM
   * @param {string} name - String name of hyphen-case prop we want to convert
   * @returns {string} The camelCase version of the supplied name
   */
  function cssToDOM(name) {
    return name.replace(/([a-z])-([a-z])/g, function(str, m1, m2) {
      return m1 + m2.toUpperCase();
    }).replace(/^-/, '');
  }

  ;

  // testProps is a generic CSS / DOM property test.

  // In testing support for a given CSS property, it's legit to test:
  //    `elem.style[styleName] !== undefined`
  // If the property is supported it will return an empty string,
  // if unsupported it will return undefined.

  // We'll take advantage of this quick test and skip setting a style
  // on our modernizr element, but instead just testing undefined vs
  // empty string.

  // Property names can be provided in either camelCase or hyphen-case.

  function testProps(props, prefixed, value, skipValueTest) {
    skipValueTest = is(skipValueTest, 'undefined') ? false : skipValueTest;

    // Try native detect first
    if (!is(value, 'undefined')) {
      var result = nativeTestProps(props, value);
      if (!is(result, 'undefined')) {
        return result;
      }
    }

    // Otherwise do it properly
    var afterInit, i, propsLength, prop, before;

    // If we don't have a style element, that means we're running async or after
    // the core tests, so we'll need to create our own elements to use.

    // Inside of an SVG element, in certain browsers, the `style` element is only
    // defined for valid tags. Therefore, if `modernizr` does not have one, we
    // fall back to a less used element and hope for the best.
    // For strict XHTML browsers the hardly used samp element is used.
    var elems = ['modernizr', 'tspan', 'samp'];
    while (!mStyle.style && elems.length) {
      afterInit = true;
      mStyle.modElem = createElement(elems.shift());
      mStyle.style = mStyle.modElem.style;
    }

    // Delete the objects if we created them.
    function cleanElems() {
      if (afterInit) {
        delete mStyle.style;
        delete mStyle.modElem;
      }
    }

    propsLength = props.length;
    for (i = 0; i < propsLength; i++) {
      prop = props[i];
      before = mStyle.style[prop];

      if (contains(prop, '-')) {
        prop = cssToDOM(prop);
      }

      if (mStyle.style[prop] !== undefined) {

        // If value to test has been passed in, do a set-and-check test.
        // 0 (integer) is a valid property value, so check that `value` isn't
        // undefined, rather than just checking it's truthy.
        if (!skipValueTest && !is(value, 'undefined')) {

          // Needs a try catch block because of old IE. This is slow, but will
          // be avoided in most cases because `skipValueTest` will be used.
          try {
            mStyle.style[prop] = value;
          } catch (e) {}

          // If the property value has changed, we assume the value used is
          // supported. If `value` is empty string, it'll fail here (because
          // it hasn't changed), which matches how browsers have implemented
          // CSS.supports()
          if (mStyle.style[prop] !== before) {
            cleanElems();
            return prefixed === 'pfx' ? prop : true;
          }
        }
        // Otherwise just return true, or the property name if this is a
        // `prefixed()` call
        else {
          cleanElems();
          return prefixed === 'pfx' ? prop : true;
        }
      }
    }
    cleanElems();
    return false;
  }

  ;

  /**
   * List of JavaScript DOM values used for tests
   *
   * @memberOf Modernizr
   * @name Modernizr._domPrefixes
   * @optionName Modernizr._domPrefixes
   * @optionProp domPrefixes
   * @access public
   * @example
   *
   * Modernizr._domPrefixes is exactly the same as [_prefixes](#modernizr-_prefixes), but rather
   * than hyphen-case properties, all properties are their Capitalized variant
   *
   * ```js
   * Modernizr._domPrefixes === [ "Moz", "O", "ms", "Webkit" ];
   * ```
   */
  var domPrefixes = (ModernizrProto._config.usePrefixes ? omPrefixes.toLowerCase().split(' ') : []);
  ModernizrProto._domPrefixes = domPrefixes;
  

  /**
   * fnBind is a super small [bind](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind) polyfill.
   *
   * @access private
   * @function fnBind
   * @param {Function} fn - a function you want to change `this` reference to
   * @param {object} that - the `this` you want to call the function with
   * @returns {Function} The wrapped version of the supplied function
   */
  function fnBind(fn, that) {
    return function() {
      return fn.apply(that, arguments);
    };
  }

  ;

  /**
   * testDOMProps is a generic DOM property test; if a browser supports
   *   a certain property, it won't return undefined for it.
   *
   * @access private
   * @function testDOMProps
   * @param {Array<string>} props - An array of properties to test for
   * @param {object} obj - An object or Element you want to use to test the parameters again
   * @param {boolean|object} elem - An Element to bind the property lookup again. Use `false` to prevent the check
   * @returns {boolean|*} returns `false` if the prop is unsupported, otherwise the value that is supported
   */
  function testDOMProps(props, obj, elem) {
    var item;

    for (var i in props) {
      if (props[i] in obj) {

        // return the property name as a string
        if (elem === false) {
          return props[i];
        }

        item = obj[props[i]];

        // let's bind a function
        if (is(item, 'function')) {
          // bind to obj unless overridden
          return fnBind(item, elem || obj);
        }

        // return the unbound function or obj or value
        return item;
      }
    }
    return false;
  }

  ;

  /**
   * testPropsAll tests a list of DOM properties we want to check against.
   * We specify literally ALL possible (known and/or likely) properties on
   * the element including the non-vendor prefixed one, for forward-
   * compatibility.
   *
   * @access private
   * @function testPropsAll
   * @param {string} prop - A string of the property to test for
   * @param {string|object} [prefixed] - An object to check the prefixed properties on. Use a string to skip
   * @param {HTMLElement|SVGElement} [elem] - An element used to test the property and value against
   * @param {string} [value] - A string of a css value
   * @param {boolean} [skipValueTest] - An boolean representing if you want to test if value sticks when set
   * @returns {string|boolean} returns the string version of the property, or `false` if it is unsupported
   */
  function testPropsAll(prop, prefixed, elem, value, skipValueTest) {

    var ucProp = prop.charAt(0).toUpperCase() + prop.slice(1),
      props = (prop + ' ' + cssomPrefixes.join(ucProp + ' ') + ucProp).split(' ');

    // did they call .prefixed('boxSizing') or are we just testing a prop?
    if (is(prefixed, 'string') || is(prefixed, 'undefined')) {
      return testProps(props, prefixed, value, skipValueTest);

      // otherwise, they called .prefixed('requestAnimationFrame', window[, elem])
    } else {
      props = (prop + ' ' + (domPrefixes).join(ucProp + ' ') + ucProp).split(' ');
      return testDOMProps(props, prefixed, elem);
    }
  }

  // Modernizr.testAllProps() investigates whether a given style property,
  // or any of its vendor-prefixed variants, is recognized
  //
  // Note that the property names must be provided in the camelCase variant.
  // Modernizr.testAllProps('boxSizing')
  ModernizrProto.testAllProps = testPropsAll;

  

  /**
   * testAllProps determines whether a given CSS property is supported in the browser
   *
   * @memberOf Modernizr
   * @name Modernizr.testAllProps
   * @optionName Modernizr.testAllProps()
   * @optionProp testAllProps
   * @access public
   * @function testAllProps
   * @param {string} prop - String naming the property to test (either camelCase or hyphen-case)
   * @param {string} [value] - String of the value to test
   * @param {boolean} [skipValueTest=false] - Whether to skip testing that the value is supported when using non-native detection
   * @returns {string|boolean} returns the string version of the property, or `false` if it is unsupported
   * @example
   *
   * testAllProps determines whether a given CSS property, in some prefixed form,
   * is supported by the browser.
   *
   * ```js
   * testAllProps('boxSizing')  // true
   * ```
   *
   * It can optionally be given a CSS value in string form to test if a property
   * value is valid
   *
   * ```js
   * testAllProps('display', 'block') // true
   * testAllProps('display', 'penguin') // false
   * ```
   *
   * A boolean can be passed as a third parameter to skip the value check when
   * native detection (@supports) isn't available.
   *
   * ```js
   * testAllProps('shapeOutside', 'content-box', true);
   * ```
   */
  function testAllProps(prop, value, skipValueTest) {
    return testPropsAll(prop, undefined, undefined, value, skipValueTest);
  }

  ModernizrProto.testAllProps = testAllProps;

  
/*!
{
  "name": "CSS Animations",
  "property": "cssanimations",
  "caniuse": "css-animation",
  "polyfills": ["transformie", "csssandpaper"],
  "tags": ["css"],
  "warnings": ["Android < 4 will pass this test, but can only animate a single property at a time"],
  "notes": [{
    "name": "Article: 'Dispelling the Android CSS animation myths'",
    "href": "https://web.archive.org/web/20180602074607/https://daneden.me/2011/12/14/putting-up-with-androids-bullshit/"
  }]
}
!*/
/* DOC
Detects whether or not elements can be animated using CSS
*/

  Modernizr.addTest('cssanimations', testAllProps('animationName', 'a', true));


  /**
   * testStyles injects an element with style element and some CSS rules
   *
   * @memberOf Modernizr
   * @name Modernizr.testStyles
   * @optionName Modernizr.testStyles()
   * @optionProp testStyles
   * @access public
   * @function testStyles
   * @param {string} rule - String representing a css rule
   * @param {Function} callback - A function that is used to test the injected element
   * @param {number} [nodes] - An integer representing the number of additional nodes you want injected
   * @param {string[]} [testnames] - An array of strings that are used as ids for the additional nodes
   * @returns {boolean}
   * @example
   *
   * `Modernizr.testStyles` takes a CSS rule and injects it onto the current page
   * along with (possibly multiple) DOM elements. This lets you check for features
   * that can not be detected by simply checking the [IDL](https://developer.mozilla.org/en-US/docs/Mozilla/Developer_guide/Interface_development_guide/IDL_interface_rules).
   *
   * ```js
   * Modernizr.testStyles('#modernizr { width: 9px; color: papayawhip; }', function(elem, rule) {
   *   // elem is the first DOM node in the page (by default #modernizr)
   *   // rule is the first argument you supplied - the CSS rule in string form
   *
   *   addTest('widthworks', elem.style.width === '9px')
   * });
   * ```
   *
   * If your test requires multiple nodes, you can include a third argument
   * indicating how many additional div elements to include on the page. The
   * additional nodes are injected as children of the `elem` that is returned as
   * the first argument to the callback.
   *
   * ```js
   * Modernizr.testStyles('#modernizr {width: 1px}; #modernizr2 {width: 2px}', function(elem) {
   *   document.getElementById('modernizr').style.width === '1px'; // true
   *   document.getElementById('modernizr2').style.width === '2px'; // true
   *   elem.firstChild === document.getElementById('modernizr2'); // true
   * }, 1);
   * ```
   *
   * By default, all of the additional elements have an ID of `modernizr[n]`, where
   * `n` is its index (e.g. the first additional, second overall is `#modernizr2`,
   * the second additional is `#modernizr3`, etc.).
   * If you want to have more meaningful IDs for your function, you can provide
   * them as the fourth argument, as an array of strings
   *
   * ```js
   * Modernizr.testStyles('#foo {width: 10px}; #bar {height: 20px}', function(elem) {
   *   elem.firstChild === document.getElementById('foo'); // true
   *   elem.lastChild === document.getElementById('bar'); // true
   * }, 2, ['foo', 'bar']);
   * ```
   */
  var testStyles = ModernizrProto.testStyles = injectElementWithStyles;
  
/*!
{
  "name": "CSS Display table",
  "property": "displaytable",
  "caniuse": "css-table",
  "authors": ["scottjehl"],
  "tags": ["css"],
  "builderAliases": ["css_displaytable"],
  "notes": [{
    "name": "Detects for all additional table display values",
    "href": "https://pastebin.com/Gk9PeVaQ"
  }]
}
!*/
/* DOC
`display: table` and `table-cell` test. (both are tested under one name `table-cell` )
*/

  // If a document is in rtl mode this test will fail so we force ltr mode on the injected
  // element https://github.com/Modernizr/Modernizr/issues/716
  testStyles('#modernizr{display: table; direction: ltr}#modernizr div{display: table-cell; padding: 10px}', function(elem) {
    var ret;
    var child = elem.childNodes;
    ret = child[0].offsetLeft < child[1].offsetLeft;
    Modernizr.addTest('displaytable', ret, {aliases: ['display-table']});
  }, 2);


  /**
   * List of property values to set for css tests. See ticket #21
   * https://github.com/modernizr/modernizr/issues/21
   *
   * @memberOf Modernizr
   * @name Modernizr._prefixes
   * @optionName Modernizr._prefixes
   * @optionProp prefixes
   * @access public
   * @example
   *
   * Modernizr._prefixes is the internal list of prefixes that we test against
   * inside of things like [prefixed](#modernizr-prefixed) and [prefixedCSS](#-code-modernizr-prefixedcss). It is simply
   * an array of hyphen-case vendor prefixes you can use within your code.
   *
   * Some common use cases include
   *
   * Generating all possible prefixed version of a CSS property
   * ```js
   * var rule = Modernizr._prefixes.join('transform: rotate(20deg); ');
   *
   * rule === 'transform: rotate(20deg); webkit-transform: rotate(20deg); moz-transform: rotate(20deg); o-transform: rotate(20deg); ms-transform: rotate(20deg);'
   * ```
   *
   * Generating all possible prefixed version of a CSS value
   * ```js
   * rule = 'display:' +  Modernizr._prefixes.join('flex; display:') + 'flex';
   *
   * rule === 'display:flex; display:-webkit-flex; display:-moz-flex; display:-o-flex; display:-ms-flex; display:flex'
   * ```
   */
  // we use ['',''] rather than an empty array in order to allow a pattern of .`join()`ing prefixes to test
  // values in feature detects to continue to work
  var prefixes = (ModernizrProto._config.usePrefixes ? ' -webkit- -moz- -o- -ms- '.split(' ') : ['','']);

  // expose these for the plugin API. Look in the source for how to join() them against your input
  ModernizrProto._prefixes = prefixes;

  
/*!
{
  "name": "CSS Supports",
  "property": "supports",
  "caniuse": "css-featurequeries",
  "tags": ["css"],
  "builderAliases": ["css_supports"],
  "notes": [{
    "name": "W3C Spec (The @supports rule)",
    "href": "https://dev.w3.org/csswg/css3-conditional/#at-supports"
  }, {
    "name": "Related Github Issue",
    "href": "https://github.com/Modernizr/Modernizr/issues/648"
  }, {
    "name": "W3C Spec (The CSSSupportsRule interface)",
    "href": "https://dev.w3.org/csswg/css3-conditional/#the-csssupportsrule-interface"
  }]
}
!*/

  var newSyntax = 'CSS' in window && 'supports' in window.CSS;
  var oldSyntax = 'supportsCSS' in window;
  Modernizr.addTest('supports', newSyntax || oldSyntax);

/*!
{
  "name": "CSS Filters",
  "property": "cssfilters",
  "caniuse": "css-filters",
  "polyfills": ["polyfilter"],
  "tags": ["css"],
  "builderAliases": ["css_filters"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/CSS/filter"
  }]
}
!*/

  Modernizr.addTest('cssfilters', function() {
    if (Modernizr.supports) {
      return testAllProps('filter', 'blur(2px)');
    } else {
      var el = createElement('a');
      el.style.cssText = prefixes.join('filter:blur(2px); ');
      // https://github.com/Modernizr/Modernizr/issues/615
      // documentMode is needed for false positives in oldIE, please see issue above
      return !!el.style.length && ((document.documentMode === undefined || document.documentMode > 9));
    }
  });


/*!
{
  "name": "Flexbox",
  "property": "flexbox",
  "caniuse": "flexbox",
  "tags": ["css"],
  "notes": [{
    "name": "The _new_ flexbox",
    "href": "https://www.w3.org/TR/css-flexbox-1/"
  }],
  "warnings": [
    "A `true` result for this detect does not imply that the `flex-wrap` property is supported; see the `flexwrap` detect."
  ]
}
!*/
/* DOC
Detects support for the Flexible Box Layout model, a.k.a. Flexbox, which allows easy manipulation of layout order and sizing within a container.
*/

  Modernizr.addTest('flexbox', testAllProps('flexBasis', '1px', true));


  /**
   * atRule returns a given CSS property at-rule (eg @keyframes), possibly in
   * some prefixed form, or false, in the case of an unsupported rule
   *
   * @memberOf Modernizr
   * @name Modernizr.atRule
   * @optionName Modernizr.atRule()
   * @optionProp atRule
   * @access public
   * @function atRule
   * @param {string} prop - String name of the @-rule to test for
   * @returns {string|boolean} The string representing the (possibly prefixed)
   * valid version of the @-rule, or `false` when it is unsupported.
   * @example
   * ```js
   *  var keyframes = Modernizr.atRule('@keyframes');
   *
   *  if (keyframes) {
   *    // keyframes are supported
   *    // could be `@-webkit-keyframes` or `@keyframes`
   *  } else {
   *    // keyframes === `false`
   *  }
   * ```
   */
  var atRule = function(prop) {
    var length = prefixes.length;
    var cssrule = window.CSSRule;
    var rule;

    if (typeof cssrule === 'undefined') {
      return undefined;
    }

    if (!prop) {
      return false;
    }

    // remove literal @ from beginning of provided property
    prop = prop.replace(/^@/, '');

    // CSSRules use underscores instead of dashes
    rule = prop.replace(/-/g, '_').toUpperCase() + '_RULE';

    if (rule in cssrule) {
      return '@' + prop;
    }

    for (var i = 0; i < length; i++) {
      // prefixes gives us something like -o-, and we want O_
      var prefix = prefixes[i];
      var thisRule = prefix.toUpperCase() + '_' + rule;

      if (thisRule in cssrule) {
        return '@-' + prefix.toLowerCase() + '-' + prop;
      }
    }

    return false;
  };

  ModernizrProto.atRule = atRule;

  

  /**
   * prefixed returns the prefixed or nonprefixed property name variant of your input
   *
   * @memberOf Modernizr
   * @name Modernizr.prefixed
   * @optionName Modernizr.prefixed()
   * @optionProp prefixed
   * @access public
   * @function prefixed
   * @param {string} prop - String name of the property to test for
   * @param {object} [obj] - An object to test for the prefixed properties on
   * @param {HTMLElement} [elem] - An element used to test specific properties against
   * @returns {string|boolean} The string representing the (possibly prefixed) valid
   * version of the property, or `false` when it is unsupported.
   * @example
   *
   * Modernizr.prefixed takes a string css value in the DOM style camelCase (as
   * opposed to the css style hyphen-case) form and returns the (possibly prefixed)
   * version of that property that the browser actually supports.
   *
   * For example, in older Firefox...
   * ```js
   * prefixed('boxSizing')
   * ```
   * returns 'MozBoxSizing'
   *
   * In newer Firefox, as well as any other browser that support the unprefixed
   * version would simply return `boxSizing`. Any browser that does not support
   * the property at all, it will return `false`.
   *
   * By default, prefixed is checked against a DOM element. If you want to check
   * for a property on another object, just pass it as a second argument
   *
   * ```js
   * var rAF = prefixed('requestAnimationFrame', window);
   *
   * raf(function() {
   *  renderFunction();
   * })
   * ```
   *
   * Note that this will return _the actual function_ - not the name of the function.
   * If you need the actual name of the property, pass in `false` as a third argument
   *
   * ```js
   * var rAFProp = prefixed('requestAnimationFrame', window, false);
   *
   * rafProp === 'WebkitRequestAnimationFrame' // in older webkit
   * ```
   *
   * One common use case for prefixed is if you're trying to determine which transition
   * end event to bind to, you might do something like...
   * ```js
   * var transEndEventNames = {
   *     'WebkitTransition' : 'webkitTransitionEnd', * Saf 6, Android Browser
   *     'MozTransition'    : 'transitionend',       * only for FF < 15
   *     'transition'       : 'transitionend'        * IE10, Opera, Chrome, FF 15+, Saf 7+
   * };
   *
   * var transEndEventName = transEndEventNames[ Modernizr.prefixed('transition') ];
   * ```
   *
   * If you want a similar lookup, but in hyphen-case, you can use [prefixedCSS](#modernizr-prefixedcss).
   */
  var prefixed = ModernizrProto.prefixed = function(prop, obj, elem) {
    if (prop.indexOf('@') === 0) {
      return atRule(prop);
    }

    if (prop.indexOf('-') !== -1) {
      // Convert hyphen-case to camelCase
      prop = cssToDOM(prop);
    }
    if (!obj) {
      return testPropsAll(prop, 'pfx');
    } else {
      // Testing DOM property e.g. Modernizr.prefixed('requestAnimationFrame', window) // 'mozRequestAnimationFrame'
      return testPropsAll(prop, obj, elem);
    }
  };

  
/*!
{
  "name": "CSS Object Fit",
  "caniuse": "object-fit",
  "property": "objectfit",
  "tags": ["css"],
  "builderAliases": ["css_objectfit"],
  "notes": [{
    "name": "Opera Article on Object Fit",
    "href": "https://dev.opera.com/articles/css3-object-fit-object-position/"
  }]
}
!*/

  Modernizr.addTest('objectfit', !!prefixed('objectFit'), {aliases: ['object-fit']});

/*!
{
  "name": "ES5 Date",
  "property": "es5date",
  "notes": [{
    "name": "ECMAScript 5.1 Language Specification",
    "href": "https://www.ecma-international.org/ecma-262/5.1/"
  }],
  "polyfills": ["es5shim"],
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "tags": ["es5"]
}
!*/
/* DOC
Check if browser implements ECMAScript 5 Date per specification.
*/

  Modernizr.addTest('es5date', function() {
    var isoDate = '2013-04-12T06:06:37.307Z',
      canParseISODate = false;
    try {
      canParseISODate = !!Date.parse(isoDate);
    } catch (e) {
      // no ISO date parsing yet
    }
    return !!(Date.now &&
      Date.prototype &&
      Date.prototype.toISOString &&
      Date.prototype.toJSON &&
      canParseISODate);
  });

/*!
{
  "name": "ES5 Function",
  "property": "es5function",
  "notes": [{
    "name": "ECMAScript 5.1 Language Specification",
    "href": "https://www.ecma-international.org/ecma-262/5.1/"
  }],
  "polyfills": ["es5shim"],
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "tags": ["es5"]
}
!*/
/* DOC
Check if browser implements ECMAScript 5 Function per specification.
*/

  Modernizr.addTest('es5function', function() {
    return !!(Function.prototype && Function.prototype.bind);
  });

/*!
{
  "name": "ES5 Object",
  "property": "es5object",
  "notes": [{
    "name": "ECMAScript 5.1 Language Specification",
    "href": "https://www.ecma-international.org/ecma-262/5.1/"
  }],
  "polyfills": ["es5shim", "es5sham"],
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "tags": ["es5"]
}
!*/
/* DOC
Check if browser implements ECMAScript 5 Object per specification.
*/

  Modernizr.addTest('es5object', function() {
    return !!(Object.keys &&
      Object.create &&
      Object.getPrototypeOf &&
      Object.getOwnPropertyNames &&
      Object.isSealed &&
      Object.isFrozen &&
      Object.isExtensible &&
      Object.getOwnPropertyDescriptor &&
      Object.defineProperty &&
      Object.defineProperties &&
      Object.seal &&
      Object.freeze &&
      Object.preventExtensions);
  });

/*!
{
  "name": "ES5 Immutable Undefined",
  "property": "es5undefined",
  "notes": [{
    "name": "ECMAScript 5.1 Language Specification",
    "href": "https://www.ecma-international.org/ecma-262/5.1/"
  }, {
    "name": "original implementation of detect code",
    "href": "https://kangax.github.io/compat-table/es5/"
  }],
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "tags": ["es5"]
}
!*/
/* DOC
Check if browser prevents assignment to global `undefined` per ECMAScript 5.
*/

  Modernizr.addTest('es5undefined', function() {
    var result, originalUndefined;
    try {
      originalUndefined = window.undefined;
      window.undefined = 12345;
      result = typeof window.undefined === 'undefined';
      window.undefined = originalUndefined;
    } catch (e) {
      return false;
    }
    return result;
  });

/*!
{
  "name": "ES6 Array",
  "property": "es6array",
  "notes": [{
    "name": "unofficial ECMAScript 6 draft specification",
    "href": "https://web.archive.org/web/20180825202128/https://tc39.github.io/ecma262/"
  }],
  "polyfills": ["es6shim"],
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "warnings": ["ECMAScript 6 is still a only a draft, so this detect may not match the final specification or implementations."],
  "tags": ["es6"]
}
!*/
/* DOC
Check if browser implements ECMAScript 6 Array per specification.
*/

  Modernizr.addTest('es6array', !!(Array.prototype &&
    Array.prototype.copyWithin &&
    Array.prototype.fill &&
    Array.prototype.find &&
    Array.prototype.findIndex &&
    Array.prototype.keys &&
    Array.prototype.entries &&
    Array.prototype.values &&
    Array.from &&
    Array.of));

/*!
{
  "name": "ES6 Collections",
  "property": "es6collections",
  "notes": [{
    "name": "unofficial ECMAScript 6 draft specification",
    "href": "https://web.archive.org/web/20180825202128/https://tc39.github.io/ecma262/"
  }],
  "polyfills": ["es6shim", "weakmap"],
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "warnings": ["ECMAScript 6 is still a only a draft, so this detect may not match the final specification or implementations."],
  "tags": ["es6"]
}
!*/
/* DOC
Check if browser implements ECMAScript 6 Map, Set, WeakMap and WeakSet
*/

  Modernizr.addTest('es6collections', !!(
    window.Map && window.Set && window.WeakMap && window.WeakSet
  ));

/*!
{
  "name": "ES6 Promises",
  "property": "promises",
  "caniuse": "promises",
  "polyfills": ["es6promises"],
  "authors": ["Krister Kari", "Jake Archibald"],
  "tags": ["es6"],
  "notes": [{
    "name": "The ES6 promises spec",
    "href": "https://github.com/domenic/promises-unwrapping"
  }, {
    "name": "Chromium dashboard - ES6 Promises",
    "href": "https://www.chromestatus.com/features/5681726336532480"
  }, {
    "name": "JavaScript Promises: an Introduction",
    "href": "https://developers.google.com/web/fundamentals/primers/promises/"
  }]
}
!*/
/* DOC
Check if browser implements ECMAScript 6 Promises per specification.
*/

  Modernizr.addTest('promises', function() {
    return 'Promise' in window &&
    // Some of these methods are missing from
    // Firefox/Chrome experimental implementations
    'resolve' in window.Promise &&
    'reject' in window.Promise &&
    'all' in window.Promise &&
    'race' in window.Promise &&
    // Older version of the spec had a resolver object
    // as the arg rather than a function
    (function() {
      var resolve;
      new window.Promise(function(r) { resolve = r; });
      return typeof resolve === 'function';
    }());
  });

/*!
{
  "name": "ES6 String",
  "property": "es6string",
  "notes": [{
    "name": "unofficial ECMAScript 6 draft specification",
    "href": "https://web.archive.org/web/20180825202128/https://tc39.github.io/ecma262/"
  }],
  "polyfills": ["es6shim"],
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "warnings": ["ECMAScript 6 is still a only a draft, so this detect may not match the final specification or implementations."],
  "tags": ["es6"]
}
!*/
/* DOC
Check if browser implements ECMAScript 6 String per specification.
*/

  Modernizr.addTest('es6string', !!(String.fromCodePoint &&
    String.raw &&
    String.prototype.codePointAt &&
    String.prototype.repeat &&
    String.prototype.startsWith &&
    String.prototype.endsWith &&
    String.prototype.includes));

/*!
{
  "name": "SVG",
  "property": "svg",
  "caniuse": "svg",
  "tags": ["svg"],
  "authors": ["Erik Dahlstrom"],
  "polyfills": [
    "svgweb",
    "raphael",
    "amplesdk",
    "canvg",
    "svg-boilerplate",
    "sie",
    "dojogfx",
    "fabricjs"
  ]
}
!*/
/* DOC
Detects support for SVG in `<embed>` or `<object>` elements.
*/

  Modernizr.addTest('svg', !!document.createElementNS && !!document.createElementNS('http://www.w3.org/2000/svg', 'svg').createSVGRect);


  /**
   * hasOwnProp is a shim for hasOwnProperty that is needed for Safari 2.0 support
   *
   * @author kangax
   * @access private
   * @function hasOwnProp
   * @param {object} object - The object to check for a property
   * @param {string} property - The property to check for
   * @returns {boolean}
   */

  // hasOwnProperty shim by kangax needed for Safari 2.0 support
  var hasOwnProp;

  (function() {
    var _hasOwnProperty = ({}).hasOwnProperty;
    /* istanbul ignore else */
    /* we have no way of testing IE 5.5 or safari 2,
     * so just assume the else gets hit */
    if (!is(_hasOwnProperty, 'undefined') && !is(_hasOwnProperty.call, 'undefined')) {
      hasOwnProp = function(object, property) {
        return _hasOwnProperty.call(object, property);
      };
    }
    else {
      hasOwnProp = function(object, property) { /* yes, this can give false positives/negatives, but most of the time we don't care about those */
        return ((property in object) && is(object.constructor.prototype[property], 'undefined'));
      };
    }
  })();

  

  /**
   * setClasses takes an array of class names and adds them to the root element
   *
   * @access private
   * @function setClasses
   * @param {string[]} classes - Array of class names
   */
  // Pass in an and array of class names, e.g.:
  //  ['no-webp', 'borderradius', ...]
  function setClasses(classes) {
    var className = docElement.className;
    var classPrefix = Modernizr._config.classPrefix || '';

    if (isSVG) {
      className = className.baseVal;
    }

    // Change `no-js` to `js` (independently of the `enableClasses` option)
    // Handle classPrefix on this too
    if (Modernizr._config.enableJSClass) {
      var reJS = new RegExp('(^|\\s)' + classPrefix + 'no-js(\\s|$)');
      className = className.replace(reJS, '$1' + classPrefix + 'js$2');
    }

    if (Modernizr._config.enableClasses) {
      // Add the new classes
      if (classes.length > 0) {
        className += ' ' + classPrefix + classes.join(' ' + classPrefix);
      }
      if (isSVG) {
        docElement.className.baseVal = className;
      } else {
        docElement.className = className;
      }
    }
  }

  ;


  // _l tracks listeners for async tests, as well as tests that execute after the initial run
  ModernizrProto._l = {};

  /**
   * Modernizr.on is a way to listen for the completion of async tests. Being
   * asynchronous, they may not finish before your scripts run. As a result you
   * will get a possibly false negative `undefined` value.
   *
   * @memberOf Modernizr
   * @name Modernizr.on
   * @access public
   * @function on
   * @param {string} feature - String name of the feature detect
   * @param {Function} cb - Callback function returning a Boolean - true if feature is supported, false if not
   * @returns {void}
   * @example
   *
   * ```js
   * Modernizr.on('flash', function( result ) {
   *   if (result) {
   *    // the browser has flash
   *   } else {
   *     // the browser does not have flash
   *   }
   * });
   * ```
   */
  ModernizrProto.on = function(feature, cb) {
    // Create the list of listeners if it doesn't exist
    if (!this._l[feature]) {
      this._l[feature] = [];
    }

    // Push this test on to the listener list
    this._l[feature].push(cb);

    // If it's already been resolved, trigger it on next tick
    if (Modernizr.hasOwnProperty(feature)) {
      // Next Tick
      setTimeout(function() {
        Modernizr._trigger(feature, Modernizr[feature]);
      }, 0);
    }
  };

  /**
   * _trigger is the private function used to signal test completion and run any
   * callbacks registered through [Modernizr.on](#modernizr-on)
   *
   * @memberOf Modernizr
   * @name Modernizr._trigger
   * @access private
   * @function _trigger
   * @param {string} feature - string name of the feature detect
   * @param {Function|boolean} [res] - A feature detection function, or the boolean =
   * result of a feature detection function
   * @returns {void}
   */
  ModernizrProto._trigger = function(feature, res) {
    if (!this._l[feature]) {
      return;
    }

    var cbs = this._l[feature];

    // Force async
    setTimeout(function() {
      var i, cb;
      for (i = 0; i < cbs.length; i++) {
        cb = cbs[i];
        cb(res);
      }
    }, 0);

    // Don't trigger these again
    delete this._l[feature];
  };

  /**
   * addTest allows you to define your own feature detects that are not currently
   * included in Modernizr (under the covers it's the exact same code Modernizr
   * uses for its own [feature detections](https://github.com/Modernizr/Modernizr/tree/master/feature-detects)).
   * Just like the official detects, the result
   * will be added onto the Modernizr object, as well as an appropriate className set on
   * the html element when configured to do so
   *
   * @memberOf Modernizr
   * @name Modernizr.addTest
   * @optionName Modernizr.addTest()
   * @optionProp addTest
   * @access public
   * @function addTest
   * @param {string|object} feature - The string name of the feature detect, or an
   * object of feature detect names and test
   * @param {Function|boolean} test - Function returning true if feature is supported,
   * false if not. Otherwise a boolean representing the results of a feature detection
   * @returns {object} the Modernizr object to allow chaining
   * @example
   *
   * The most common way of creating your own feature detects is by calling
   * `Modernizr.addTest` with a string (preferably just lowercase, without any
   * punctuation), and a function you want executed that will return a boolean result
   *
   * ```js
   * Modernizr.addTest('itsTuesday', function() {
   *  var d = new Date();
   *  return d.getDay() === 2;
   * });
   * ```
   *
   * When the above is run, it will set Modernizr.itstuesday to `true` when it is tuesday,
   * and to `false` every other day of the week. One thing to notice is that the names of
   * feature detect functions are always lowercased when added to the Modernizr object. That
   * means that `Modernizr.itsTuesday` will not exist, but `Modernizr.itstuesday` will.
   *
   *
   *  Since we only look at the returned value from any feature detection function,
   *  you do not need to actually use a function. For simple detections, just passing
   *  in a statement that will return a boolean value works just fine.
   *
   * ```js
   * Modernizr.addTest('hasjquery', 'jQuery' in window);
   * ```
   *
   * Just like before, when the above runs `Modernizr.hasjquery` will be true if
   * jQuery has been included on the page. Not using a function saves a small amount
   * of overhead for the browser, as well as making your code much more readable.
   *
   * Finally, you also have the ability to pass in an object of feature names and
   * their tests. This is handy if you want to add multiple detections in one go.
   * The keys should always be a string, and the value can be either a boolean or
   * function that returns a boolean.
   *
   * ```js
   * var detects = {
   *  'hasjquery': 'jQuery' in window,
   *  'itstuesday': function() {
   *    var d = new Date();
   *    return d.getDay() === 2;
   *  }
   * }
   *
   * Modernizr.addTest(detects);
   * ```
   *
   * There is really no difference between the first methods and this one, it is
   * just a convenience to let you write more readable code.
   */
  function addTest(feature, test) {

    if (typeof feature === 'object') {
      for (var key in feature) {
        if (hasOwnProp(feature, key)) {
          addTest(key, feature[ key ]);
        }
      }
    } else {

      feature = feature.toLowerCase();
      var featureNameSplit = feature.split('.');
      var last = Modernizr[featureNameSplit[0]];

      // Again, we don't check for parent test existence. Get that right, though.
      if (featureNameSplit.length === 2) {
        last = last[featureNameSplit[1]];
      }

      if (typeof last !== 'undefined') {
        // we're going to quit if you're trying to overwrite an existing test
        // if we were to allow it, we'd do this:
        //   var re = new RegExp("\\b(no-)?" + feature + "\\b");
        //   docElement.className = docElement.className.replace( re, '' );
        // but, no rly, stuff 'em.
        return Modernizr;
      }

      test = typeof test === 'function' ? test() : test;

      // Set the value (this is the magic, right here).
      if (featureNameSplit.length === 1) {
        Modernizr[featureNameSplit[0]] = test;
      } else {
        // cast to a Boolean, if not one already
        if (Modernizr[featureNameSplit[0]] && !(Modernizr[featureNameSplit[0]] instanceof Boolean)) {
          Modernizr[featureNameSplit[0]] = new Boolean(Modernizr[featureNameSplit[0]]);
        }

        Modernizr[featureNameSplit[0]][featureNameSplit[1]] = test;
      }

      // Set a single class (either `feature` or `no-feature`)
      setClasses([(!!test && test !== false ? '' : 'no-') + featureNameSplit.join('-')]);

      // Trigger the event
      Modernizr._trigger(feature, test);
    }

    return Modernizr; // allow chaining.
  }

  // After all the tests are run, add self to the Modernizr prototype
  Modernizr._q.push(function() {
    ModernizrProto.addTest = addTest;
  });

  

/*!
{
  "name": "SVG as an <img> tag source",
  "property": "svgasimg",
  "caniuse": "svg-img",
  "tags": ["svg"],
  "aliases": ["svgincss"],
  "authors": ["Chris Coyier"],
  "notes": [{
    "name": "HTML5 Spec",
    "href": "https://www.w3.org/TR/html5/embedded-content-0.html#the-img-element"
  }]
}
!*/


  // Original Async test by Stu Cox
  // https://gist.github.com/chriscoyier/8774501

  // Now a Sync test based on good results here
  // https://codepen.io/chriscoyier/pen/bADFx

  // Note http://www.w3.org/TR/SVG11/feature#Image is *supposed* to represent
  // support for the `<image>` tag in SVG, not an SVG file linked from an `<img>`
  // tag in HTML – but it’s a heuristic which works
  Modernizr.addTest('svgasimg', document.implementation.hasFeature('http://www.w3.org/TR/SVG11/feature#Image', '1.1'));

/*!
{
  "name": "SVG filters",
  "property": "svgfilters",
  "caniuse": "svg-filters",
  "tags": ["svg"],
  "builderAliases": ["svg_filters"],
  "authors": ["Erik Dahlstrom"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/SVG11/filters.html"
  }]
}
!*/

  // Should fail in Safari: https://stackoverflow.com/questions/9739955/feature-detecting-support-for-svg-filters.
  Modernizr.addTest('svgfilters', function() {
    var result = false;
    try {
      result = 'SVGFEColorMatrixElement' in window &&
        SVGFEColorMatrixElement.SVG_FECOLORMATRIX_TYPE_SATURATE === 2;
    }
    catch (e) {}
    return result;
  });

/*!
{
  "name": "URL parser",
  "property": "urlparser",
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://url.spec.whatwg.org/"
  }],
  "polyfills": ["urlparser"],
  "authors": ["Ron Waldon (@jokeyrhyme)"],
  "tags": ["url"]
}
!*/
/* DOC
Check if browser implements the URL constructor for parsing URLs.
*/

  Modernizr.addTest('urlparser', function() {
    var url;
    try {
      // have to actually try use it, because Safari defines a dud constructor
      url = new URL('http://modernizr.com/');
      return url.href === 'http://modernizr.com/';
    } catch (e) {
      return false;
    }
  });

/*!
{
  "property": "urlsearchparams",
  "caniuse": "urlsearchparams",
  "tags": ["querystring", "url"],
  "authors": ["Cătălin Mariș"],
  "name": "URLSearchParams API",
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://url.spec.whatwg.org/#interface-urlsearchparams"
  }, {
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams"
  }]
}
!*/
/* DOC
Detects support for an API that provides utility methods for working with the query string of a URL.
*/

  Modernizr.addTest('urlsearchparams', 'URLSearchParams' in window);

/*!
{
  "name": "Cross-Origin Resource Sharing",
  "property": "cors",
  "caniuse": "cors",
  "authors": ["Theodoor van Donge"],
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/HTTP/Access_control_CORS"
  }],
  "polyfills": ["pmxdr", "ppx", "flxhr"]
}
!*/
/* DOC
Detects support for Cross-Origin Resource Sharing: method of performing XMLHttpRequests across domains.
*/

  Modernizr.addTest('cors', 'XMLHttpRequest' in window && 'withCredentials' in new XMLHttpRequest());

/*!
{
  "name": "Web Cryptography",
  "property": "cryptography",
  "caniuse": "cryptography",
  "tags": ["crypto"],
  "authors": ["roblarsen"],
  "notes": [{
    "name": "W3C Editor's Draft Spec",
    "href": "https://www.w3.org/TR/WebCryptoAPI/"
  }],
  "polyfills": ["polycrypt"]
}
!*/
/* DOC
Detects support for the cryptographic functionality available under window.crypto.subtle
*/

  var crypto = prefixed('crypto', window);
  Modernizr.addTest('crypto', !!prefixed('subtle', crypto));

/*!
{
  "name": "iframe[sandbox] Attribute",
  "property": "sandbox",
  "caniuse": "iframe-sandbox",
  "tags": ["iframe"],
  "builderAliases": ["iframe_sandbox"],
  "notes": [
  {
    "name": "WHATWG Spec",
    "href": "https://html.spec.whatwg.org/multipage/embedded-content.html#attr-iframe-sandbox"
  }],
  "knownBugs": ["False-positive on Firefox < 29"]
}
!*/
/* DOC
Test for `sandbox` attribute in iframes.
*/

  Modernizr.addTest('sandbox', 'sandbox' in createElement('iframe'));

/*!
{
  "name": "JSON",
  "property": "json",
  "caniuse": "json",
  "notes": [{
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Glossary/JSON"
  }],
  "polyfills": ["json2"]
}
!*/
/* DOC
Detects native support for JSON handling functions.
*/

  // this will also succeed if you've loaded the JSON2.js polyfill ahead of time
  //   ... but that should be obvious. :)

  Modernizr.addTest('json', 'JSON' in window && 'parse' in JSON && 'stringify' in JSON);

/*!
{
  "name": "Fetch API",
  "property": "fetch",
  "tags": ["network"],
  "caniuse": "fetch",
  "notes": [{
    "name": "WHATWG Spec",
    "href": "https://fetch.spec.whatwg.org/"
  }],
  "polyfills": ["fetch"]
}
!*/
/* DOC
Detects support for the fetch API, a modern replacement for XMLHttpRequest.
*/

  Modernizr.addTest('fetch', 'fetch' in window);

/*!
{
  "name": "Local Storage",
  "property": "localstorage",
  "caniuse": "namevalue-storage",
  "tags": ["storage"],
  "polyfills": [
    "joshuabell-polyfill",
    "cupcake",
    "storagepolyfill",
    "amplifyjs",
    "yui-cacheoffline"
  ]
}
!*/

  // In FF4, if disabled, window.localStorage should === null.

  // Normally, we could not test that directly and need to do a
  //   `('localStorage' in window)` test first because otherwise Firefox will
  //   throw bugzil.la/365772 if cookies are disabled

  // Similarly, in Chrome with "Block third-party cookies and site data" enabled,
  // attempting to access `window.sessionStorage` will throw an exception. crbug.com/357625

  // Also in iOS5 Private Browsing mode, attempting to use localStorage.setItem
  // will throw the exception:
  //   QUOTA_EXCEEDED_ERROR DOM Exception 22.
  // Peculiarly, getItem and removeItem calls do not throw.

  // Because we are forced to try/catch this, we'll go aggressive.

  // Just FWIW: IE8 Compat mode supports these features completely:
  //   www.quirksmode.org/dom/html5.html
  // But IE8 doesn't support either with local files

  Modernizr.addTest('localstorage', function() {
    var mod = 'modernizr';
    try {
      localStorage.setItem(mod, mod);
      localStorage.removeItem(mod);
      return true;
    } catch (e) {
      return false;
    }
  });

/*!
{
  "name": "ResizeObserver",
  "property": "resizeobserver",
  "caniuse": "resizeobserver",
  "tags": ["ResizeObserver"],
  "authors": ["Christian Andersson"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://www.w3.org/TR/resize-observer/"
  }, {
    "name": "MDN Docs",
    "href": "https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver"
  }, {
    "name": "Web.dev Article",
    "href": "https://web.dev/resize-observer/"
  }, {
    "name": "Digital Ocean tutorial",
    "href": "https://www.digitalocean.com/community/tutorials/js-resize-observer"
  }]
}
!*/

/* DOC
Detects support for ResizeObserver.
*/

  Modernizr.addTest('resizeobserver', 'ResizeObserver' in window);

/*!
{
  "name": "Web Audio API",
  "property": "webaudio",
  "caniuse": "audio-api",
  "polyfills": ["xaudiojs", "dynamicaudiojs", "audiolibjs"],
  "tags": ["audio", "media"],
  "builderAliases": ["audio_webaudio_api"],
  "authors": ["Addy Osmani"],
  "notes": [{
    "name": "W3C Spec",
    "href": "https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html"
  }]
}
!*/
/* DOC
Detects the older non standard webaudio API, (as opposed to the standards based AudioContext API)
*/

  Modernizr.addTest('webaudio', function() {
    var prefixed = 'webkitAudioContext' in window;
    var unprefixed = 'AudioContext' in window;

    if (Modernizr._config.usePrefixes) {
      return prefixed || unprefixed;
    }
    return unprefixed;
  });


  // Run each test
  testRunner();

  delete ModernizrProto.addTest;
  delete ModernizrProto.addAsyncTest;

  // Run the things that are supposed to run after the tests
  for (var i = 0; i < Modernizr._q.length; i++) {
    Modernizr._q[i]();
  }

  // Leak Modernizr namespace
  scriptGlobalObject.Modernizr = Modernizr;


;

})(window, window, document);
