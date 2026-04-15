"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recomputeProgress = recomputeProgress;
exports.createSessionRecord = createSessionRecord;
exports.getCategoryCoverage = getCategoryCoverage;
exports.getRecommendations = getRecommendations;
exports.getReadinessSnapshot = getReadinessSnapshot;
exports.generateRoutePlan = generateRoutePlan;
exports.isValidRoutePlan = isValidRoutePlan;
exports.buildCoachTip = buildCoachTip;
exports.buildSessionSummary = buildSessionSummary;
const mock_data_1 = require("@/lib/mock-data");
function average(values) {
    if (!values.length) {
        return 0;
    }
    return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}
function daysSince(date) {
    if (!date) {
        return 999;
    }
    const then = new Date(date).getTime();
    const now = new Date("2026-04-14T12:00:00").getTime();
    return Math.max(0, Math.floor((now - then) / (1000 * 60 * 60 * 24)));
}
function getSkillStatus(attemptsCount, averageRating, lastPracticedAt) {
    if (attemptsCount === 0) {
        return "not_attempted";
    }
    if (attemptsCount >= 3 && averageRating >= 4 && daysSince(lastPracticedAt) <= 14) {
        return "confident";
    }
    return "needs_work";
}
function recomputeProgress(skills, sessions) {
    return skills.map((skill) => {
        const attempts = sessions
            .flatMap((session) => session.practicedSkills
            .filter((entry) => entry.skillId === skill.id)
            .map((entry) => ({ date: session.date, rating: entry.rating })))
            .sort((a, b) => a.date.localeCompare(b.date));
        const attemptsCount = attempts.length;
        const averageRating = average(attempts.map((attempt) => attempt.rating));
        const lastPracticedAt = attempts.at(-1)?.date;
        const recencyPenalty = Math.min(daysSince(lastPracticedAt) / 21, 1);
        const confidenceScore = Number(Math.max(0, Math.min(100, averageRating * 20 + attemptsCount * 8 - recencyPenalty * 20)).toFixed(0));
        return {
            skillId: skill.id,
            attemptsCount,
            averageRating,
            lastPracticedAt,
            confidenceScore,
            status: getSkillStatus(attemptsCount, averageRating, lastPracticedAt)
        };
    });
}
function createSessionRecord(input) {
    return {
        id: `session-${Math.random().toString(36).slice(2, 8)}`,
        date: input.date,
        durationMinutes: input.durationMinutes,
        areaDriven: input.areaDriven,
        roadTypes: input.roadTypes,
        practicedSkills: input.skillRatings,
        notes: input.notes,
        parentComment: input.parentComment,
        weather: input.weather,
        trafficLevel: input.trafficLevel,
        conditions: input.conditions
    };
}
function getCategoryCoverage(skills, progress) {
    const categories = [...new Set(skills.map((skill) => skill.category))];
    return categories.map((category) => {
        const skillsInCategory = skills.filter((skill) => skill.category === category);
        const progressInCategory = progress.filter((entry) => skillsInCategory.some((skill) => skill.id === entry.skillId));
        const attemptedPercent = (progressInCategory.filter((entry) => entry.attemptsCount > 0).length / skillsInCategory.length) * 100;
        const confidentPercent = (progressInCategory.filter((entry) => entry.status === "confident").length / skillsInCategory.length) * 100;
        const coverageScore = Number((0.5 * attemptedPercent + 0.5 * confidentPercent).toFixed(0));
        return {
            category,
            attemptedPercent: Number(attemptedPercent.toFixed(0)),
            confidentPercent: Number(confidentPercent.toFixed(0)),
            coverageScore
        };
    });
}
function getRecommendations(profile, skills, progress) {
    const targetDateBoost = profile.targetTestDate ? 10 : 0;
    return progress
        .map((entry) => {
        const skill = skills.find((item) => item.id === entry.skillId);
        const neverAttempted = entry.attemptsCount === 0 ? 40 : 0;
        const confidenceGap = Math.max(0, 5 - entry.averageRating) * 12;
        const recencyGap = Math.min(daysSince(entry.lastPracticedAt) * 2, 30);
        const testBoost = skill.requiredForTest ? 18 : 6;
        const priorityScore = Math.round(neverAttempted + confidenceGap + recencyGap + testBoost + targetDateBoost);
        const reasons = [];
        if (entry.attemptsCount === 0) {
            reasons.push("Never practiced yet");
        }
        if (entry.averageRating > 0 && entry.averageRating < 3.5) {
            reasons.push("Recent ratings are still low");
        }
        if (daysSince(entry.lastPracticedAt) > 10) {
            reasons.push("Overdue for another repetition");
        }
        if (skill.requiredForTest) {
            reasons.push("Important for the road test");
        }
        return {
            skillId: skill.id,
            label: skill.label,
            category: skill.category,
            priorityScore,
            reasons
        };
    })
        .sort((a, b) => b.priorityScore - a.priorityScore);
}
function getReadinessSnapshot(state) {
    const coverage = getCategoryCoverage(state.skills, state.progress);
    const recommendations = getRecommendations(state.profile, state.skills, state.progress);
    const overdueSkills = state.progress.filter((entry) => daysSince(entry.lastPracticedAt) > 10);
    const totalHours = Number((state.sessions.reduce((sum, session) => sum + session.durationMinutes, 0) / 60).toFixed(1));
    const coverageAverage = average(coverage.map((entry) => entry.coverageScore));
    const criticalScore = average(state.progress
        .filter((entry) => state.skills.find((skill) => skill.id === entry.skillId)?.requiredForTest)
        .map((entry) => entry.confidenceScore));
    const consistencyScore = Math.max(30, 100 - overdueSkills.length * 10);
    const readinessScore = Math.round(coverageAverage * 0.35 + criticalScore * 0.45 + consistencyScore * 0.2);
    return {
        readinessScore,
        totalHours,
        overdueSkills,
        topRecommendations: recommendations.slice(0, 3),
        coverage
    };
}
const californiaRouteLibrary = {
    "highway-on-ramp": {
        title: "Lawrence Expressway to 101 merge",
        address: "Lawrence Expy & US-101 South On-Ramp, Sunnyvale, CA",
        reason: "Gives one clean ramp-speed practice rep before freeway traffic picks up.",
        tag: "highway-on-ramp",
        latitude: 37.3768,
        longitude: -121.9969
    },
    "freeway-connector": {
        title: "Short freeway connector segment",
        address: "US-101 Connector near Mathilda Ave, Sunnyvale, CA",
        reason: "Adds a second merge and a simple lane positioning rep on the freeway.",
        tag: "freeway-connector",
        latitude: 37.3907,
        longitude: -122.0416
    },
    arterial: {
        title: "Stevens Creek multi-lane stretch",
        address: "Stevens Creek Blvd near Tantau Ave, Cupertino, CA",
        reason: "Useful for steady speed control and cleaner lane centering.",
        tag: "arterial",
        latitude: 37.3233,
        longitude: -122.0126
    },
    "busy-intersection": {
        title: "Signalized left-turn intersection",
        address: "El Camino Real & Sunnyvale Saratoga Rd, Sunnyvale, CA",
        reason: "Targets gap judgment for unprotected left turns without forcing a long route.",
        tag: "busy-intersection",
        latitude: 37.3516,
        longitude: -122.0325
    },
    "signalized-left": {
        title: "Second left-turn rep",
        address: "Homestead Rd & Wolfe Rd, Cupertino, CA",
        reason: "Adds another left-turn opportunity to repeat the decision-making pattern.",
        tag: "signalized-left",
        latitude: 37.3371,
        longitude: -122.0147
    },
    "multi-lane-arterial": {
        title: "Three-lane boulevard section",
        address: "De Anza Blvd near McClellan Rd, Cupertino, CA",
        reason: "Good for mirror-signal-blind-spot lane changes.",
        tag: "multi-lane-arterial",
        latitude: 37.3155,
        longitude: -122.0324
    },
    boulevard: {
        title: "Boulevard return leg",
        address: "Bollinger Rd near Miller Ave, Cupertino, CA",
        reason: "Lets the driver repeat lane changes while returning to the starting area.",
        tag: "boulevard",
        latitude: 37.3098,
        longitude: -122.0415
    },
    "residential-grid": {
        title: "Stop-sign neighborhood loop",
        address: "Heritage District residential grid, Sunnyvale, CA",
        reason: "Multiple four-way stop reps in a calmer environment.",
        tag: "residential-grid",
        latitude: 37.3686,
        longitude: -122.0363
    },
    curbside: {
        title: "Quiet curbside block",
        address: "Merritt Dr curbside block, Cupertino, CA",
        reason: "Works well for repeated parallel parking setup attempts.",
        tag: "curbside",
        latitude: 37.3077,
        longitude: -122.0306
    },
    "well-lit-loop": {
        title: "Evening visibility loop",
        address: "Main St Cupertino and nearby collector roads, Cupertino, CA",
        reason: "A safe, well-lit route for building night driving confidence.",
        tag: "well-lit-loop",
        latitude: 37.3230,
        longitude: -122.0397
    }
};
const newYorkRouteLibrary = {
    "highway-on-ramp": {
        title: "BQE entrance merge practice",
        address: "Meeker Ave entrance to I-278, Brooklyn, NY",
        reason: "Provides a realistic highway merge rep with a defined acceleration lane.",
        tag: "highway-on-ramp",
        latitude: 40.7144,
        longitude: -73.9489
    },
    "freeway-connector": {
        title: "Brooklyn-Queens Expressway connector",
        address: "I-278 connector near Brooklyn Navy Yard, Brooklyn, NY",
        reason: "Adds a short connector segment for highway positioning and merge timing.",
        tag: "freeway-connector",
        latitude: 40.6998,
        longitude: -73.9793
    },
    arterial: {
        title: "Queens Boulevard multi-lane segment",
        address: "Queens Blvd near 63rd Dr, Queens, NY",
        reason: "Useful for lane centering, scanning, and pace control on a broad urban arterial.",
        tag: "arterial",
        latitude: 40.7297,
        longitude: -73.8608
    },
    "busy-intersection": {
        title: "Signalized left-turn practice intersection",
        address: "Northern Blvd & 80th St, Queens, NY",
        reason: "Good for urban unprotected-left judgment with predictable signal timing.",
        tag: "busy-intersection",
        latitude: 40.7578,
        longitude: -73.8893
    },
    "signalized-left": {
        title: "Second protected-to-unprotected turn rep",
        address: "Queens Blvd & Yellowstone Blvd, Queens, NY",
        reason: "Adds another turn decision in a busier city-grid setting.",
        tag: "signalized-left",
        latitude: 40.7292,
        longitude: -73.8515
    },
    "multi-lane-arterial": {
        title: "Atlantic Avenue lane-change stretch",
        address: "Atlantic Ave near Pennsylvania Ave, Brooklyn, NY",
        reason: "Works well for mirror-signal-blind-spot lane changes in city traffic.",
        tag: "multi-lane-arterial",
        latitude: 40.6755,
        longitude: -73.8944
    },
    boulevard: {
        title: "Eastern Parkway return leg",
        address: "Eastern Pkwy near Utica Ave, Brooklyn, NY",
        reason: "Lets the learner repeat multi-lane positioning while returning to the starting area.",
        tag: "boulevard",
        latitude: 40.6682,
        longitude: -73.9310
    },
    "residential-grid": {
        title: "Park Slope stop-sign loop",
        address: "Residential grid near 7th Ave & Carroll St, Brooklyn, NY",
        reason: "Multiple four-way stop reps in a calmer neighborhood street network.",
        tag: "residential-grid",
        latitude: 40.6773,
        longitude: -73.9808
    },
    curbside: {
        title: "Quiet curbside parking block",
        address: "Residential curb near 76th Rd, Forest Hills, NY",
        reason: "Good for parallel parking setup without heavy through traffic.",
        tag: "curbside",
        latitude: 40.7198,
        longitude: -73.8441
    },
    "well-lit-loop": {
        title: "Evening visibility practice loop",
        address: "Austin St and nearby collectors, Forest Hills, NY",
        reason: "A well-lit urban loop for building night-driving comfort.",
        tag: "well-lit-loop",
        latitude: 40.7192,
        longitude: -73.8448
    }
};
function buildGenericRouteLibrary(anchor) {
    return {
        "highway-on-ramp": {
            title: `${anchor.city} highway merge rep`,
            address: `Major on-ramp near ${anchor.city}, ${anchor.stateCode}`,
            reason: "Provides a controlled merge opportunity for acceleration-lane practice.",
            tag: "highway-on-ramp",
            latitude: anchor.latitude + 0.018,
            longitude: anchor.longitude + 0.02
        },
        "freeway-connector": {
            title: `${anchor.city} connector segment`,
            address: `Short freeway connector near ${anchor.city}, ${anchor.stateCode}`,
            reason: "Adds a second merge and freeway positioning repetition.",
            tag: "freeway-connector",
            latitude: anchor.latitude + 0.026,
            longitude: anchor.longitude - 0.012
        },
        arterial: {
            title: `${anchor.city} arterial segment`,
            address: `Multi-lane arterial near ${anchor.city}, ${anchor.stateCode}`,
            reason: "Useful for lane centering and steady speed control.",
            tag: "arterial",
            latitude: anchor.latitude + 0.008,
            longitude: anchor.longitude + 0.016
        },
        "busy-intersection": {
            title: `${anchor.city} intersection practice`,
            address: `Signalized intersection near downtown ${anchor.city}, ${anchor.stateCode}`,
            reason: "Targets gap judgment and left-turn timing.",
            tag: "busy-intersection",
            latitude: anchor.latitude + 0.011,
            longitude: anchor.longitude - 0.008
        },
        "signalized-left": {
            title: `${anchor.city} second turn rep`,
            address: `Secondary turn intersection near ${anchor.city}, ${anchor.stateCode}`,
            reason: "Adds another left-turn repetition in the same drive.",
            tag: "signalized-left",
            latitude: anchor.latitude - 0.006,
            longitude: anchor.longitude + 0.013
        },
        "multi-lane-arterial": {
            title: `${anchor.city} lane-change stretch`,
            address: `Three-lane corridor near ${anchor.city}, ${anchor.stateCode}`,
            reason: "Builds mirror-signal-blind-spot lane-change consistency.",
            tag: "multi-lane-arterial",
            latitude: anchor.latitude - 0.013,
            longitude: anchor.longitude + 0.019
        },
        boulevard: {
            title: `${anchor.city} return boulevard`,
            address: `Broad return road near ${anchor.city}, ${anchor.stateCode}`,
            reason: "Lets the learner repeat lane positioning on the way back.",
            tag: "boulevard",
            latitude: anchor.latitude - 0.017,
            longitude: anchor.longitude - 0.015
        },
        "residential-grid": {
            title: `${anchor.city} neighborhood stop loop`,
            address: `Residential stop-sign grid near ${anchor.city}, ${anchor.stateCode}`,
            reason: "Calmer streets for repeated stop-sign practice.",
            tag: "residential-grid",
            latitude: anchor.latitude + 0.004,
            longitude: anchor.longitude - 0.02
        },
        curbside: {
            title: `${anchor.city} curbside parking block`,
            address: `Quiet curb near ${anchor.city}, ${anchor.stateCode}`,
            reason: "Useful for parallel parking setup and curb approach repetition.",
            tag: "curbside",
            latitude: anchor.latitude - 0.01,
            longitude: anchor.longitude - 0.01
        },
        "well-lit-loop": {
            title: `${anchor.city} evening visibility loop`,
            address: `Well-lit collectors near ${anchor.city}, ${anchor.stateCode}`,
            reason: "A safe evening loop for building night-driving confidence.",
            tag: "well-lit-loop",
            latitude: anchor.latitude + 0.009,
            longitude: anchor.longitude - 0.018
        }
    };
}
function getRouteLibrary(anchor) {
    const stateCode = anchor.stateCode;
    if (stateCode === "CA") {
        return californiaRouteLibrary;
    }
    if (stateCode === "NY") {
        return newYorkRouteLibrary;
    }
    return buildGenericRouteLibrary(anchor);
}
const stateNameToCode = {
    alabama: "AL",
    alaska: "AK",
    arizona: "AZ",
    arkansas: "AR",
    california: "CA",
    colorado: "CO",
    connecticut: "CT",
    delaware: "DE",
    florida: "FL",
    georgia: "GA",
    hawaii: "HI",
    idaho: "ID",
    illinois: "IL",
    indiana: "IN",
    iowa: "IA",
    kansas: "KS",
    kentucky: "KY",
    louisiana: "LA",
    maine: "ME",
    maryland: "MD",
    massachusetts: "MA",
    michigan: "MI",
    minnesota: "MN",
    mississippi: "MS",
    missouri: "MO",
    montana: "MT",
    nebraska: "NE",
    nevada: "NV",
    "new hampshire": "NH",
    "new jersey": "NJ",
    "new mexico": "NM",
    "new york": "NY",
    "north carolina": "NC",
    "north dakota": "ND",
    ohio: "OH",
    oklahoma: "OK",
    oregon: "OR",
    pennsylvania: "PA",
    "rhode island": "RI",
    "south carolina": "SC",
    "south dakota": "SD",
    tennessee: "TN",
    texas: "TX",
    utah: "UT",
    vermont: "VT",
    virginia: "VA",
    washington: "WA",
    "west virginia": "WV",
    wisconsin: "WI",
    wyoming: "WY"
};
const cityCoordinateLibrary = {
    "sunnyvale,ca": { city: "Sunnyvale", stateCode: "CA", latitude: 37.3688, longitude: -122.0363 },
    "santa clara,ca": { city: "Santa Clara", stateCode: "CA", latitude: 37.3541, longitude: -121.9552 },
    "mountain view,ca": { city: "Mountain View", stateCode: "CA", latitude: 37.3861, longitude: -122.0839 },
    "cupertino,ca": { city: "Cupertino", stateCode: "CA", latitude: 37.323, longitude: -122.0322 },
    "brooklyn,ny": { city: "Brooklyn", stateCode: "NY", latitude: 40.6782, longitude: -73.9442 },
    "queens,ny": { city: "Queens", stateCode: "NY", latitude: 40.7282, longitude: -73.7949 },
    "manhattan,ny": { city: "Manhattan", stateCode: "NY", latitude: 40.7831, longitude: -73.9712 },
    "new york,ny": { city: "New York", stateCode: "NY", latitude: 40.7128, longitude: -74.006 },
    "seattle,wa": { city: "Seattle", stateCode: "WA", latitude: 47.6062, longitude: -122.3321 },
    "bothell,wa": { city: "Bothell", stateCode: "WA", latitude: 47.7601, longitude: -122.2054 },
    "bellevue,wa": { city: "Bellevue", stateCode: "WA", latitude: 47.6101, longitude: -122.2015 },
    "redmond,wa": { city: "Redmond", stateCode: "WA", latitude: 47.674, longitude: -122.1215 },
    "everett,wa": { city: "Everett", stateCode: "WA", latitude: 47.9789, longitude: -122.2021 }
};
function inferStateCodeFromLocation(startLocation, fallbackStateCode) {
    const normalized = startLocation.toLowerCase();
    const directCodeMatch = normalized.match(/\b([A-Z]{2})\b/i)?.[1]?.toUpperCase();
    if (directCodeMatch && (0, mock_data_1.getStateMetadataByCode)(directCodeMatch).code === directCodeMatch) {
        return directCodeMatch;
    }
    for (const [stateName, stateCode] of Object.entries(stateNameToCode)) {
        if (normalized.includes(stateName)) {
            return stateCode;
        }
    }
    return fallbackStateCode;
}
function extractCityName(startLocation, fallbackCity) {
    const firstPart = startLocation
        .split(",")[0]
        ?.trim()
        .replace(/\s+/g, " ");
    return firstPart || fallbackCity;
}
function geocodeStartLocation(startLocation, fallbackStateCode) {
    const stateCode = inferStateCodeFromLocation(startLocation, fallbackStateCode);
    const state = (0, mock_data_1.getStateMetadataByCode)(stateCode);
    const city = extractCityName(startLocation, state.defaultCity);
    const normalizedKey = `${city.toLowerCase()},${stateCode.toLowerCase()}`;
    const directMatch = cityCoordinateLibrary[normalizedKey];
    if (directMatch) {
        return directMatch;
    }
    const statewideMatch = Object.values(cityCoordinateLibrary).find((entry) => entry.stateCode === stateCode && entry.city.toLowerCase() === city.toLowerCase());
    if (statewideMatch) {
        return statewideMatch;
    }
    return {
        city,
        stateCode,
        latitude: state.latitude,
        longitude: state.longitude
    };
}
function generateRoutePlan(skills, recommendations, request) {
    const fallbackStateCode = skills[0]?.stateCode ?? "CA";
    const selectedSkills = skills.filter((skill) => request.skillIds.includes(skill.id));
    const tags = [...new Set(selectedSkills.flatMap((skill) => skill.routeTags))];
    const difficultyMinutes = request.difficulty === "gentle" ? 18 : request.difficulty === "stretch" ? 30 : 24;
    const startPoint = geocodeStartLocation(request.startLocation, fallbackStateCode);
    const routeLibrary = getRouteLibrary(startPoint);
    const segments = tags.slice(0, 4).map((tag, index) => {
        const segment = routeLibrary[tag] ?? {
            title: `Practice stop ${index + 1}`,
            address: `${request.startLocation}`,
            reason: "Selected to reinforce the current priority skill mix.",
            tag,
            latitude: startPoint.latitude + (index + 1) * 0.005,
            longitude: startPoint.longitude + (index % 2 === 0 ? 0.007 : -0.006)
        };
        return {
            id: `${tag}-${index}`,
            etaMinutes: 5 + index * 6,
            ...segment
        };
    });
    const recommendationLabels = recommendations
        .filter((entry) => request.skillIds.includes(entry.skillId))
        .map((entry) => entry.label.toLowerCase());
    return {
        id: `route-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        startLocation: request.startLocation,
        startLatitude: startPoint.latitude,
        startLongitude: startPoint.longitude,
        estimatedMinutes: difficultyMinutes,
        difficulty: request.difficulty,
        prioritySkillIds: request.skillIds,
        explanation: `This loop starts near ${request.startLocation} and focuses on ${recommendationLabels.join(", ")}. It balances realistic reps with lower-risk segments so the learner can repeat weak skills without an overly long drive.`,
        segments
    };
}
function isValidRoutePlan(route) {
    if (!route) {
        return false;
    }
    const validStart = typeof route.startLatitude === "number" &&
        Number.isFinite(route.startLatitude) &&
        typeof route.startLongitude === "number" &&
        Number.isFinite(route.startLongitude);
    const validSegments = Array.isArray(route.segments) &&
        route.segments.every((segment) => typeof segment.latitude === "number" &&
            Number.isFinite(segment.latitude) &&
            typeof segment.longitude === "number" &&
            Number.isFinite(segment.longitude));
    return validStart && validSegments;
}
function buildCoachTip(recommendations) {
    const top = recommendations[0];
    const second = recommendations[1];
    if (!top) {
        return "Keep logging drives to unlock a sharper next-practice recommendation.";
    }
    if (!second) {
        return `Next session: focus on ${top.label.toLowerCase()} and give yourself at least three clean repetitions.`;
    }
    return `Your best next session would pair ${top.label.toLowerCase()} with ${second.label.toLowerCase()} so you can work one stress point and one supporting skill in the same drive.`;
}
function buildSessionSummary(skills, input) {
    const sorted = [...input.skillRatings].sort((a, b) => b.rating - a.rating);
    const strengths = sorted
        .filter((entry) => entry.rating >= 4)
        .map((entry) => skills.find((skill) => skill.id === entry.skillId)?.label.toLowerCase())
        .filter(Boolean);
    const weakSpots = sorted
        .filter((entry) => entry.rating <= 3)
        .map((entry) => skills.find((skill) => skill.id === entry.skillId)?.label.toLowerCase())
        .filter(Boolean);
    const strengthsText = strengths.length ? strengths.join(" and ") : "basic comfort behind the wheel";
    const weakText = weakSpots.length ? weakSpots.join(" and ") : "building consistency";
    return `This session showed solid progress with ${strengthsText}, while ${weakText} still need more repetition. Keep the next practice short and intentional so confidence builds without adding too much pressure.`;
}
