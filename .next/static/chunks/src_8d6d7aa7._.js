(globalThis.TURBOPACK = globalThis.TURBOPACK || []).push(["static/chunks/src_8d6d7aa7._.js", {

"[project]/src/hooks/useDebounce.ts [app-client] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname, k: __turbopack_refresh__, m: module } = __turbopack_context__;
{
__turbopack_context__.s({
    "useDebounce": (()=>useDebounce)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
function useDebounce(value, delay) {
    _s();
    const [debouncedValue, setDebouncedValue] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(value);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useDebounce.useEffect": ()=>{
            const timer = setTimeout({
                "useDebounce.useEffect.timer": ()=>{
                    setDebouncedValue(value);
                }
            }["useDebounce.useEffect.timer"], delay);
            return ({
                "useDebounce.useEffect": ()=>{
                    clearTimeout(timer);
                }
            })["useDebounce.useEffect"];
        }
    }["useDebounce.useEffect"], [
        value,
        delay
    ]);
    return debouncedValue;
}
_s(useDebounce, "KDuPAtDOgxm8PU6legVJOb3oOmA=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(module, globalThis.$RefreshHelpers$);
}
}}),
"[project]/src/components/home/BitcoinMap.tsx [app-client] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname, k: __turbopack_refresh__, m: module } = __turbopack_context__;
{
__turbopack_context__.s({
    "BitcoinMap": (()=>BitcoinMap)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$hooks$2f$useDebounce$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/hooks/useDebounce.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
// Funchal coordinates
const FUNCHAL_LAT = 32.6497;
const FUNCHAL_LON = -16.9082;
const RADIUS_KM = 30;
// API Key - should be moved to environment variable
const BTCMAP_API_KEY = ("TURBOPACK compile-time value", "your_api_key_here");
// Fallback data in case API fails
const fallbackBusinesses = [
    {
        id: '1',
        name: 'Bitcoin Beach Madeira',
        tags: [
            'beach',
            'bar',
            'restaurant'
        ]
    },
    {
        id: '2',
        name: 'Digital Nomad Hub',
        tags: [
            'coworking',
            'community'
        ]
    }
];
// Calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371 // Earth's radius in km
    ;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function BitcoinMap() {
    _s();
    const [isMounted, setIsMounted] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [businesses, setBusinesses] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [searchQuery, setSearchQuery] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('');
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const debouncedSearchQuery = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$hooks$2f$useDebounce$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useDebounce"])(searchQuery, 300);
    // Memoized fetch function
    const fetchBusinesses = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "BitcoinMap.useCallback[fetchBusinesses]": async ()=>{
            try {
                if ("TURBOPACK compile-time falsy", 0) {
                    "TURBOPACK unreachable";
                }
                const controller = new AbortController();
                const timeoutId = setTimeout({
                    "BitcoinMap.useCallback[fetchBusinesses].timeoutId": ()=>controller.abort()
                }["BitcoinMap.useCallback[fetchBusinesses].timeoutId"], 10000) // 10s timeout
                ;
                const response = await fetch('https://api.btcmap.org/v2/venues', {
                    headers: {
                        'Authorization': `Bearer ${BTCMAP_API_KEY}`,
                        'Accept': 'application/json'
                    },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('API Response:', errorText);
                    throw new Error(`Failed to fetch venues: ${response.status} - ${errorText}`);
                }
                const data = await response.json();
                // Transform and filter the data
                const simplifiedData = data.map({
                    "BitcoinMap.useCallback[fetchBusinesses].simplifiedData": (business)=>({
                            id: business.id,
                            name: business.name,
                            tags: business.tags || [],
                            lat: business.lat,
                            lon: business.lon
                        })
                }["BitcoinMap.useCallback[fetchBusinesses].simplifiedData"]).filter({
                    "BitcoinMap.useCallback[fetchBusinesses].simplifiedData": (business)=>{
                        if (!business.lat || !business.lon) return false;
                        const distance = calculateDistance(FUNCHAL_LAT, FUNCHAL_LON, business.lat, business.lon);
                        return distance <= RADIUS_KM;
                    }
                }["BitcoinMap.useCallback[fetchBusinesses].simplifiedData"]);
                setBusinesses(simplifiedData);
                setError(null);
            } catch (err) {
                console.error('Error fetching businesses:', err);
                setError('Failed to load businesses. Please try again later.');
                setBusinesses(fallbackBusinesses);
            } finally{
                setLoading(false);
            }
        }
    }["BitcoinMap.useCallback[fetchBusinesses]"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "BitcoinMap.useEffect": ()=>{
            setIsMounted(true);
            fetchBusinesses();
        }
    }["BitcoinMap.useEffect"], [
        fetchBusinesses
    ]);
    // Memoized filtered businesses
    const filteredBusinesses = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "BitcoinMap.useMemo[filteredBusinesses]": ()=>{
            if (!debouncedSearchQuery) return businesses;
            const query = debouncedSearchQuery.toLowerCase();
            return businesses.filter({
                "BitcoinMap.useMemo[filteredBusinesses]": (business)=>business.name.toLowerCase().includes(query) || business.tags?.some({
                        "BitcoinMap.useMemo[filteredBusinesses]": (tag)=>tag.toLowerCase().includes(query)
                    }["BitcoinMap.useMemo[filteredBusinesses]"])
            }["BitcoinMap.useMemo[filteredBusinesses]"]);
        }
    }["BitcoinMap.useMemo[filteredBusinesses]"], [
        businesses,
        debouncedSearchQuery
    ]);
    if (!isMounted) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "w-full h-[300px] bg-ocean/10 rounded-lg animate-pulse flex items-center justify-center",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-forest/60",
                children: "Loading map..."
            }, void 0, false, {
                fileName: "[project]/src/components/home/BitcoinMap.tsx",
                lineNumber: 135,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/components/home/BitcoinMap.tsx",
            lineNumber: 134,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "w-full h-[400px] rounded-lg overflow-hidden border border-sand/20 shadow-lg",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "w-full h-full bg-ocean/5 flex items-center justify-center",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-center space-y-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-bitcoin text-2xl",
                                "aria-hidden": "true",
                                children: "🗺️"
                            }, void 0, false, {
                                fileName: "[project]/src/components/home/BitcoinMap.tsx",
                                lineNumber: 146,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-forest/60",
                                children: "Interactive map coming soon"
                            }, void 0, false, {
                                fileName: "[project]/src/components/home/BitcoinMap.tsx",
                                lineNumber: 147,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                href: "https://btcmap.org/community/free-madeira",
                                target: "_blank",
                                rel: "noopener noreferrer",
                                className: "text-sm text-bitcoin hover:text-bitcoin/80 inline-block",
                                children: "View on BTCMap.org →"
                            }, void 0, false, {
                                fileName: "[project]/src/components/home/BitcoinMap.tsx",
                                lineNumber: 148,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/home/BitcoinMap.tsx",
                        lineNumber: 145,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/components/home/BitcoinMap.tsx",
                    lineNumber: 144,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/home/BitcoinMap.tsx",
                lineNumber: 143,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "space-y-4",
                "aria-labelledby": "search-heading",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                            id: "search-heading",
                            className: "text-lg font-semibold text-sand",
                            children: "Search Bitcoin-Accepting Businesses"
                        }, void 0, false, {
                            fileName: "[project]/src/components/home/BitcoinMap.tsx",
                            lineNumber: 163,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/home/BitcoinMap.tsx",
                        lineNumber: 162,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "relative",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                            type: "text",
                            placeholder: "Search Bitcoin-accepting businesses...",
                            value: searchQuery,
                            onChange: (e)=>setSearchQuery(e.target.value),
                            className: "w-full px-4 py-2 rounded-lg border border-sand/20 bg-white/5 text-sand placeholder-forest/40 focus:outline-none focus:ring-2 focus:ring-bitcoin/20",
                            "aria-label": "Search businesses"
                        }, void 0, false, {
                            fileName: "[project]/src/components/home/BitcoinMap.tsx",
                            lineNumber: 168,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/home/BitcoinMap.tsx",
                        lineNumber: 167,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-sm text-forest/60",
                                children: [
                                    "Found ",
                                    filteredBusinesses.length,
                                    " business",
                                    filteredBusinesses.length !== 1 ? 'es' : '',
                                    " within ",
                                    RADIUS_KM,
                                    "km of Funchal"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/home/BitcoinMap.tsx",
                                lineNumber: 180,
                                columnNumber: 11
                            }, this),
                            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-sm text-bitcoin",
                                role: "alert",
                                children: error
                            }, void 0, false, {
                                fileName: "[project]/src/components/home/BitcoinMap.tsx",
                                lineNumber: 184,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/home/BitcoinMap.tsx",
                        lineNumber: 179,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/home/BitcoinMap.tsx",
                lineNumber: 161,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/home/BitcoinMap.tsx",
        lineNumber: 141,
        columnNumber: 5
    }, this);
}
_s(BitcoinMap, "3kxb/LLd4kPZLIloEQZmztwD85E=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$hooks$2f$useDebounce$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useDebounce"]
    ];
});
_c = BitcoinMap;
var _c;
__turbopack_context__.k.register(_c, "BitcoinMap");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(module, globalThis.$RefreshHelpers$);
}
}}),
}]);

//# sourceMappingURL=src_8d6d7aa7._.js.map