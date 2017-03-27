/*
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

const PHONE_NUMBER_REGEXP = /^[0-9 -\.]+$/;

/*
 * Do basic validation to determine if the given input could be
 * a valid phone number.
 *
 * @param {String} phoneNumber The string to validate. This could be
 *     either an international format number (MSISDN or e.164) or
 *     a national-format number.
 * @return True if the number could be a valid phone number, otherwise false.
 */
export function looksValid(phoneNumber) {
    return PHONE_NUMBER_REGEXP.test(phoneNumber);
}

export const COUNTRIES = [
    {
        "iso2": "GB",
        "name": "United Kingdom",
        "prefix": "44",
    },
    {
        "iso2": "US",
        "name": "United States",
        "prefix": "1",
    },
    {
        "iso2": "AF",
        "name": "Afghanistan",
        "prefix": "93",
    },
    {
        "iso2": "AX",
        "name": "\u00c5land Islands",
        "prefix": "358",
    },
    {
        "iso2": "AL",
        "name": "Albania",
        "prefix": "355",
    },
    {
        "iso2": "DZ",
        "name": "Algeria",
        "prefix": "213",
    },
    {
        "iso2": "AS",
        "name": "American Samoa",
        "prefix": "1",
    },
    {
        "iso2": "AD",
        "name": "Andorra",
        "prefix": "376",
    },
    {
        "iso2": "AO",
        "name": "Angola",
        "prefix": "244",
    },
    {
        "iso2": "AI",
        "name": "Anguilla",
        "prefix": "1",
    },
    {
        "iso2": "AQ",
        "name": "Antarctica",
        "prefix": "672",
    },
    {
        "iso2": "AG",
        "name": "Antigua & Barbuda",
        "prefix": "1",
    },
    {
        "iso2": "AR",
        "name": "Argentina",
        "prefix": "54",
    },
    {
        "iso2": "AM",
        "name": "Armenia",
        "prefix": "374",
    },
    {
        "iso2": "AW",
        "name": "Aruba",
        "prefix": "297",
    },
    {
        "iso2": "AU",
        "name": "Australia",
        "prefix": "61",
    },
    {
        "iso2": "AT",
        "name": "Austria",
        "prefix": "43",
    },
    {
        "iso2": "AZ",
        "name": "Azerbaijan",
        "prefix": "994",
    },
    {
        "iso2": "BS",
        "name": "Bahamas",
        "prefix": "1",
    },
    {
        "iso2": "BH",
        "name": "Bahrain",
        "prefix": "973",
    },
    {
        "iso2": "BD",
        "name": "Bangladesh",
        "prefix": "880",
    },
    {
        "iso2": "BB",
        "name": "Barbados",
        "prefix": "1",
    },
    {
        "iso2": "BY",
        "name": "Belarus",
        "prefix": "375",
    },
    {
        "iso2": "BE",
        "name": "Belgium",
        "prefix": "32",
    },
    {
        "iso2": "BZ",
        "name": "Belize",
        "prefix": "501",
    },
    {
        "iso2": "BJ",
        "name": "Benin",
        "prefix": "229",
    },
    {
        "iso2": "BM",
        "name": "Bermuda",
        "prefix": "1",
    },
    {
        "iso2": "BT",
        "name": "Bhutan",
        "prefix": "975",
    },
    {
        "iso2": "BO",
        "name": "Bolivia",
        "prefix": "591",
    },
    {
        "iso2": "BA",
        "name": "Bosnia",
        "prefix": "387",
    },
    {
        "iso2": "BW",
        "name": "Botswana",
        "prefix": "267",
    },
    {
        "iso2": "BV",
        "name": "Bouvet Island",
        "prefix": "47",
    },
    {
        "iso2": "BR",
        "name": "Brazil",
        "prefix": "55",
    },
    {
        "iso2": "IO",
        "name": "British Indian Ocean Territory",
        "prefix": "246",
    },
    {
        "iso2": "VG",
        "name": "British Virgin Islands",
        "prefix": "1",
    },
    {
        "iso2": "BN",
        "name": "Brunei",
        "prefix": "673",
    },
    {
        "iso2": "BG",
        "name": "Bulgaria",
        "prefix": "359",
    },
    {
        "iso2": "BF",
        "name": "Burkina Faso",
        "prefix": "226",
    },
    {
        "iso2": "BI",
        "name": "Burundi",
        "prefix": "257",
    },
    {
        "iso2": "KH",
        "name": "Cambodia",
        "prefix": "855",
    },
    {
        "iso2": "CM",
        "name": "Cameroon",
        "prefix": "237",
    },
    {
        "iso2": "CA",
        "name": "Canada",
        "prefix": "1",
    },
    {
        "iso2": "CV",
        "name": "Cape Verde",
        "prefix": "238",
    },
    {
        "iso2": "BQ",
        "name": "Caribbean Netherlands",
        "prefix": "599",
    },
    {
        "iso2": "KY",
        "name": "Cayman Islands",
        "prefix": "1",
    },
    {
        "iso2": "CF",
        "name": "Central African Republic",
        "prefix": "236",
    },
    {
        "iso2": "TD",
        "name": "Chad",
        "prefix": "235",
    },
    {
        "iso2": "CL",
        "name": "Chile",
        "prefix": "56",
    },
    {
        "iso2": "CN",
        "name": "China",
        "prefix": "86",
    },
    {
        "iso2": "CX",
        "name": "Christmas Island",
        "prefix": "61",
    },
    {
        "iso2": "CC",
        "name": "Cocos (Keeling) Islands",
        "prefix": "61",
    },
    {
        "iso2": "CO",
        "name": "Colombia",
        "prefix": "57",
    },
    {
        "iso2": "KM",
        "name": "Comoros",
        "prefix": "269",
    },
    {
        "iso2": "CG",
        "name": "Congo - Brazzaville",
        "prefix": "242",
    },
    {
        "iso2": "CD",
        "name": "Congo - Kinshasa",
        "prefix": "243",
    },
    {
        "iso2": "CK",
        "name": "Cook Islands",
        "prefix": "682",
    },
    {
        "iso2": "CR",
        "name": "Costa Rica",
        "prefix": "506",
    },
    {
        "iso2": "HR",
        "name": "Croatia",
        "prefix": "385",
    },
    {
        "iso2": "CU",
        "name": "Cuba",
        "prefix": "53",
    },
    {
        "iso2": "CW",
        "name": "Cura\u00e7ao",
        "prefix": "599",
    },
    {
        "iso2": "CY",
        "name": "Cyprus",
        "prefix": "357",
    },
    {
        "iso2": "CZ",
        "name": "Czech Republic",
        "prefix": "420",
    },
    {
        "iso2": "CI",
        "name": "C\u00f4te d\u2019Ivoire",
        "prefix": "225",
    },
    {
        "iso2": "DK",
        "name": "Denmark",
        "prefix": "45",
    },
    {
        "iso2": "DJ",
        "name": "Djibouti",
        "prefix": "253",
    },
    {
        "iso2": "DM",
        "name": "Dominica",
        "prefix": "1",
    },
    {
        "iso2": "DO",
        "name": "Dominican Republic",
        "prefix": "1",
    },
    {
        "iso2": "EC",
        "name": "Ecuador",
        "prefix": "593",
    },
    {
        "iso2": "EG",
        "name": "Egypt",
        "prefix": "20",
    },
    {
        "iso2": "SV",
        "name": "El Salvador",
        "prefix": "503",
    },
    {
        "iso2": "GQ",
        "name": "Equatorial Guinea",
        "prefix": "240",
    },
    {
        "iso2": "ER",
        "name": "Eritrea",
        "prefix": "291",
    },
    {
        "iso2": "EE",
        "name": "Estonia",
        "prefix": "372",
    },
    {
        "iso2": "ET",
        "name": "Ethiopia",
        "prefix": "251",
    },
    {
        "iso2": "FK",
        "name": "Falkland Islands",
        "prefix": "500",
    },
    {
        "iso2": "FO",
        "name": "Faroe Islands",
        "prefix": "298",
    },
    {
        "iso2": "FJ",
        "name": "Fiji",
        "prefix": "679",
    },
    {
        "iso2": "FI",
        "name": "Finland",
        "prefix": "358",
    },
    {
        "iso2": "FR",
        "name": "France",
        "prefix": "33",
    },
    {
        "iso2": "GF",
        "name": "French Guiana",
        "prefix": "594",
    },
    {
        "iso2": "PF",
        "name": "French Polynesia",
        "prefix": "689",
    },
    {
        "iso2": "TF",
        "name": "French Southern Territories",
        "prefix": "262",
    },
    {
        "iso2": "GA",
        "name": "Gabon",
        "prefix": "241",
    },
    {
        "iso2": "GM",
        "name": "Gambia",
        "prefix": "220",
    },
    {
        "iso2": "GE",
        "name": "Georgia",
        "prefix": "995",
    },
    {
        "iso2": "DE",
        "name": "Germany",
        "prefix": "49",
    },
    {
        "iso2": "GH",
        "name": "Ghana",
        "prefix": "233",
    },
    {
        "iso2": "GI",
        "name": "Gibraltar",
        "prefix": "350",
    },
    {
        "iso2": "GR",
        "name": "Greece",
        "prefix": "30",
    },
    {
        "iso2": "GL",
        "name": "Greenland",
        "prefix": "299",
    },
    {
        "iso2": "GD",
        "name": "Grenada",
        "prefix": "1",
    },
    {
        "iso2": "GP",
        "name": "Guadeloupe",
        "prefix": "590",
    },
    {
        "iso2": "GU",
        "name": "Guam",
        "prefix": "1",
    },
    {
        "iso2": "GT",
        "name": "Guatemala",
        "prefix": "502",
    },
    {
        "iso2": "GG",
        "name": "Guernsey",
        "prefix": "44",
    },
    {
        "iso2": "GN",
        "name": "Guinea",
        "prefix": "224",
    },
    {
        "iso2": "GW",
        "name": "Guinea-Bissau",
        "prefix": "245",
    },
    {
        "iso2": "GY",
        "name": "Guyana",
        "prefix": "592",
    },
    {
        "iso2": "HT",
        "name": "Haiti",
        "prefix": "509",
    },
    {
        "iso2": "HM",
        "name": "Heard & McDonald Islands",
        "prefix": "672",
    },
    {
        "iso2": "HN",
        "name": "Honduras",
        "prefix": "504",
    },
    {
        "iso2": "HK",
        "name": "Hong Kong",
        "prefix": "852",
    },
    {
        "iso2": "HU",
        "name": "Hungary",
        "prefix": "36",
    },
    {
        "iso2": "IS",
        "name": "Iceland",
        "prefix": "354",
    },
    {
        "iso2": "IN",
        "name": "India",
        "prefix": "91",
    },
    {
        "iso2": "ID",
        "name": "Indonesia",
        "prefix": "62",
    },
    {
        "iso2": "IR",
        "name": "Iran",
        "prefix": "98",
    },
    {
        "iso2": "IQ",
        "name": "Iraq",
        "prefix": "964",
    },
    {
        "iso2": "IE",
        "name": "Ireland",
        "prefix": "353",
    },
    {
        "iso2": "IM",
        "name": "Isle of Man",
        "prefix": "44",
    },
    {
        "iso2": "IL",
        "name": "Israel",
        "prefix": "972",
    },
    {
        "iso2": "IT",
        "name": "Italy",
        "prefix": "39",
    },
    {
        "iso2": "JM",
        "name": "Jamaica",
        "prefix": "1",
    },
    {
        "iso2": "JP",
        "name": "Japan",
        "prefix": "81",
    },
    {
        "iso2": "JE",
        "name": "Jersey",
        "prefix": "44",
    },
    {
        "iso2": "JO",
        "name": "Jordan",
        "prefix": "962",
    },
    {
        "iso2": "KZ",
        "name": "Kazakhstan",
        "prefix": "7",
    },
    {
        "iso2": "KE",
        "name": "Kenya",
        "prefix": "254",
    },
    {
        "iso2": "KI",
        "name": "Kiribati",
        "prefix": "686",
    },
    {
        "iso2": "KW",
        "name": "Kuwait",
        "prefix": "965",
    },
    {
        "iso2": "KG",
        "name": "Kyrgyzstan",
        "prefix": "996",
    },
    {
        "iso2": "LA",
        "name": "Laos",
        "prefix": "856",
    },
    {
        "iso2": "LV",
        "name": "Latvia",
        "prefix": "371",
    },
    {
        "iso2": "LB",
        "name": "Lebanon",
        "prefix": "961",
    },
    {
        "iso2": "LS",
        "name": "Lesotho",
        "prefix": "266",
    },
    {
        "iso2": "LR",
        "name": "Liberia",
        "prefix": "231",
    },
    {
        "iso2": "LY",
        "name": "Libya",
        "prefix": "218",
    },
    {
        "iso2": "LI",
        "name": "Liechtenstein",
        "prefix": "423",
    },
    {
        "iso2": "LT",
        "name": "Lithuania",
        "prefix": "370",
    },
    {
        "iso2": "LU",
        "name": "Luxembourg",
        "prefix": "352",
    },
    {
        "iso2": "MO",
        "name": "Macau",
        "prefix": "853",
    },
    {
        "iso2": "MK",
        "name": "Macedonia",
        "prefix": "389",
    },
    {
        "iso2": "MG",
        "name": "Madagascar",
        "prefix": "261",
    },
    {
        "iso2": "MW",
        "name": "Malawi",
        "prefix": "265",
    },
    {
        "iso2": "MY",
        "name": "Malaysia",
        "prefix": "60",
    },
    {
        "iso2": "MV",
        "name": "Maldives",
        "prefix": "960",
    },
    {
        "iso2": "ML",
        "name": "Mali",
        "prefix": "223",
    },
    {
        "iso2": "MT",
        "name": "Malta",
        "prefix": "356",
    },
    {
        "iso2": "MH",
        "name": "Marshall Islands",
        "prefix": "692",
    },
    {
        "iso2": "MQ",
        "name": "Martinique",
        "prefix": "596",
    },
    {
        "iso2": "MR",
        "name": "Mauritania",
        "prefix": "222",
    },
    {
        "iso2": "MU",
        "name": "Mauritius",
        "prefix": "230",
    },
    {
        "iso2": "YT",
        "name": "Mayotte",
        "prefix": "262",
    },
    {
        "iso2": "MX",
        "name": "Mexico",
        "prefix": "52",
    },
    {
        "iso2": "FM",
        "name": "Micronesia",
        "prefix": "691",
    },
    {
        "iso2": "MD",
        "name": "Moldova",
        "prefix": "373",
    },
    {
        "iso2": "MC",
        "name": "Monaco",
        "prefix": "377",
    },
    {
        "iso2": "MN",
        "name": "Mongolia",
        "prefix": "976",
    },
    {
        "iso2": "ME",
        "name": "Montenegro",
        "prefix": "382",
    },
    {
        "iso2": "MS",
        "name": "Montserrat",
        "prefix": "1",
    },
    {
        "iso2": "MA",
        "name": "Morocco",
        "prefix": "212",
    },
    {
        "iso2": "MZ",
        "name": "Mozambique",
        "prefix": "258",
    },
    {
        "iso2": "MM",
        "name": "Myanmar",
        "prefix": "95",
    },
    {
        "iso2": "NA",
        "name": "Namibia",
        "prefix": "264",
    },
    {
        "iso2": "NR",
        "name": "Nauru",
        "prefix": "674",
    },
    {
        "iso2": "NP",
        "name": "Nepal",
        "prefix": "977",
    },
    {
        "iso2": "NL",
        "name": "Netherlands",
        "prefix": "31",
    },
    {
        "iso2": "NC",
        "name": "New Caledonia",
        "prefix": "687",
    },
    {
        "iso2": "NZ",
        "name": "New Zealand",
        "prefix": "64",
    },
    {
        "iso2": "NI",
        "name": "Nicaragua",
        "prefix": "505",
    },
    {
        "iso2": "NE",
        "name": "Niger",
        "prefix": "227",
    },
    {
        "iso2": "NG",
        "name": "Nigeria",
        "prefix": "234",
    },
    {
        "iso2": "NU",
        "name": "Niue",
        "prefix": "683",
    },
    {
        "iso2": "NF",
        "name": "Norfolk Island",
        "prefix": "672",
    },
    {
        "iso2": "KP",
        "name": "North Korea",
        "prefix": "850",
    },
    {
        "iso2": "MP",
        "name": "Northern Mariana Islands",
        "prefix": "1",
    },
    {
        "iso2": "NO",
        "name": "Norway",
        "prefix": "47",
    },
    {
        "iso2": "OM",
        "name": "Oman",
        "prefix": "968",
    },
    {
        "iso2": "PK",
        "name": "Pakistan",
        "prefix": "92",
    },
    {
        "iso2": "PW",
        "name": "Palau",
        "prefix": "680",
    },
    {
        "iso2": "PS",
        "name": "Palestine",
        "prefix": "970",
    },
    {
        "iso2": "PA",
        "name": "Panama",
        "prefix": "507",
    },
    {
        "iso2": "PG",
        "name": "Papua New Guinea",
        "prefix": "675",
    },
    {
        "iso2": "PY",
        "name": "Paraguay",
        "prefix": "595",
    },
    {
        "iso2": "PE",
        "name": "Peru",
        "prefix": "51",
    },
    {
        "iso2": "PH",
        "name": "Philippines",
        "prefix": "63",
    },
    {
        "iso2": "PN",
        "name": "Pitcairn Islands",
        "prefix": "870",
    },
    {
        "iso2": "PL",
        "name": "Poland",
        "prefix": "48",
    },
    {
        "iso2": "PT",
        "name": "Portugal",
        "prefix": "351",
    },
    {
        "iso2": "PR",
        "name": "Puerto Rico",
        "prefix": "1",
    },
    {
        "iso2": "QA",
        "name": "Qatar",
        "prefix": "974",
    },
    {
        "iso2": "RO",
        "name": "Romania",
        "prefix": "40",
    },
    {
        "iso2": "RU",
        "name": "Russia",
        "prefix": "7",
    },
    {
        "iso2": "RW",
        "name": "Rwanda",
        "prefix": "250",
    },
    {
        "iso2": "RE",
        "name": "R\u00e9union",
        "prefix": "262",
    },
    {
        "iso2": "WS",
        "name": "Samoa",
        "prefix": "685",
    },
    {
        "iso2": "SM",
        "name": "San Marino",
        "prefix": "378",
    },
    {
        "iso2": "SA",
        "name": "Saudi Arabia",
        "prefix": "966",
    },
    {
        "iso2": "SN",
        "name": "Senegal",
        "prefix": "221",
    },
    {
        "iso2": "RS",
        "name": "Serbia",
        "prefix": "381 p",
    },
    {
        "iso2": "SC",
        "name": "Seychelles",
        "prefix": "248",
    },
    {
        "iso2": "SL",
        "name": "Sierra Leone",
        "prefix": "232",
    },
    {
        "iso2": "SG",
        "name": "Singapore",
        "prefix": "65",
    },
    {
        "iso2": "SX",
        "name": "Sint Maarten",
        "prefix": "1",
    },
    {
        "iso2": "SK",
        "name": "Slovakia",
        "prefix": "421",
    },
    {
        "iso2": "SI",
        "name": "Slovenia",
        "prefix": "386",
    },
    {
        "iso2": "SB",
        "name": "Solomon Islands",
        "prefix": "677",
    },
    {
        "iso2": "SO",
        "name": "Somalia",
        "prefix": "252",
    },
    {
        "iso2": "ZA",
        "name": "South Africa",
        "prefix": "27",
    },
    {
        "iso2": "GS",
        "name": "South Georgia & South Sandwich Islands",
        "prefix": "500",
    },
    {
        "iso2": "KR",
        "name": "South Korea",
        "prefix": "82",
    },
    {
        "iso2": "SS",
        "name": "South Sudan",
        "prefix": "211",
    },
    {
        "iso2": "ES",
        "name": "Spain",
        "prefix": "34",
    },
    {
        "iso2": "LK",
        "name": "Sri Lanka",
        "prefix": "94",
    },
    {
        "iso2": "BL",
        "name": "St. Barth\u00e9lemy",
        "prefix": "590",
    },
    {
        "iso2": "SH",
        "name": "St. Helena",
        "prefix": "290 n",
    },
    {
        "iso2": "KN",
        "name": "St. Kitts & Nevis",
        "prefix": "1",
    },
    {
        "iso2": "LC",
        "name": "St. Lucia",
        "prefix": "1",
    },
    {
        "iso2": "MF",
        "name": "St. Martin",
        "prefix": "590",
    },
    {
        "iso2": "PM",
        "name": "St. Pierre & Miquelon",
        "prefix": "508",
    },
    {
        "iso2": "VC",
        "name": "St. Vincent & Grenadines",
        "prefix": "1",
    },
    {
        "iso2": "SD",
        "name": "Sudan",
        "prefix": "249",
    },
    {
        "iso2": "SR",
        "name": "Suriname",
        "prefix": "597",
    },
    {
        "iso2": "SJ",
        "name": "Svalbard & Jan Mayen",
        "prefix": "47",
    },
    {
        "iso2": "SZ",
        "name": "Swaziland",
        "prefix": "268",
    },
    {
        "iso2": "SE",
        "name": "Sweden",
        "prefix": "46",
    },
    {
        "iso2": "CH",
        "name": "Switzerland",
        "prefix": "41",
    },
    {
        "iso2": "SY",
        "name": "Syria",
        "prefix": "963",
    },
    {
        "iso2": "ST",
        "name": "S\u00e3o Tom\u00e9 & Pr\u00edncipe",
        "prefix": "239",
    },
    {
        "iso2": "TW",
        "name": "Taiwan",
        "prefix": "886",
    },
    {
        "iso2": "TJ",
        "name": "Tajikistan",
        "prefix": "992",
    },
    {
        "iso2": "TZ",
        "name": "Tanzania",
        "prefix": "255",
    },
    {
        "iso2": "TH",
        "name": "Thailand",
        "prefix": "66",
    },
    {
        "iso2": "TL",
        "name": "Timor-Leste",
        "prefix": "670",
    },
    {
        "iso2": "TG",
        "name": "Togo",
        "prefix": "228",
    },
    {
        "iso2": "TK",
        "name": "Tokelau",
        "prefix": "690",
    },
    {
        "iso2": "TO",
        "name": "Tonga",
        "prefix": "676",
    },
    {
        "iso2": "TT",
        "name": "Trinidad & Tobago",
        "prefix": "1",
    },
    {
        "iso2": "TN",
        "name": "Tunisia",
        "prefix": "216",
    },
    {
        "iso2": "TR",
        "name": "Turkey",
        "prefix": "90",
    },
    {
        "iso2": "TM",
        "name": "Turkmenistan",
        "prefix": "993",
    },
    {
        "iso2": "TC",
        "name": "Turks & Caicos Islands",
        "prefix": "1",
    },
    {
        "iso2": "TV",
        "name": "Tuvalu",
        "prefix": "688",
    },
    {
        "iso2": "VI",
        "name": "U.S. Virgin Islands",
        "prefix": "1",
    },
    {
        "iso2": "UG",
        "name": "Uganda",
        "prefix": "256",
    },
    {
        "iso2": "UA",
        "name": "Ukraine",
        "prefix": "380",
    },
    {
        "iso2": "AE",
        "name": "United Arab Emirates",
        "prefix": "971",
    },
    {
        "iso2": "UY",
        "name": "Uruguay",
        "prefix": "598",
    },
    {
        "iso2": "UZ",
        "name": "Uzbekistan",
        "prefix": "998",
    },
    {
        "iso2": "VU",
        "name": "Vanuatu",
        "prefix": "678",
    },
    {
        "iso2": "VA",
        "name": "Vatican City",
        "prefix": "39",
    },
    {
        "iso2": "VE",
        "name": "Venezuela",
        "prefix": "58",
    },
    {
        "iso2": "VN",
        "name": "Vietnam",
        "prefix": "84",
    },
    {
        "iso2": "WF",
        "name": "Wallis & Futuna",
        "prefix": "681",
    },
    {
        "iso2": "EH",
        "name": "Western Sahara",
        "prefix": "212",
    },
    {
        "iso2": "YE",
        "name": "Yemen",
        "prefix": "967",
    },
    {
        "iso2": "ZM",
        "name": "Zambia",
        "prefix": "260",
    },
    {
        "iso2": "ZW",
        "name": "Zimbabwe",
        "prefix": "263",
    },
];
