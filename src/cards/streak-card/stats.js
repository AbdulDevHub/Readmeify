import fetch from 'node-fetch';

/**
 * Build a GraphQL query for a contribution graph
 *
 * @param {string} user - GitHub username to get graphs for
 * @param {number} year - Year to get graph for
 * @returns {string} GraphQL query
 */
function buildContributionGraphQuery(user, year) {
    const start = `${year}-01-01T00:00:00Z`;
    const end = `${year}-12-31T23:59:59Z`;
    return `query {
        user(login: "${user}") {
            createdAt
            contributionsCollection(from: "${start}", to: "${end}") {
                contributionYears
                contributionCalendar {
                    weeks {
                        contributionDays {
                            contributionCount
                            date
                        }
                    }
                }
            }
        }
    }`;
}

/**
 * Execute multiple requests and handle GitHub API rate limits and errors
 *
 * @param {string} user - GitHub username to get graphs for
 * @param {number[]} years - Years to get graphs for
 * @returns {Promise<Object.<number, Object>>} List of GraphQL response objects with years as keys
 */
async function executeContributionGraphRequests(user, years) {
    const responses = {};
    const tokens = new Map();

    // Build requests for each year
    const requests = years.map(async (year) => {
        tokens.set(year, getGitHubToken());
        const query = buildContributionGraphQuery(user, year);
        
        async function makeRequest(retryCount = 0) {
            try {
                const response = await fetch('https://api.github.com/graphql', {
                    method: 'POST',
                    headers: {
                        'Authorization': `bearer ${tokens.get(year)}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/vnd.github.v4.idl',
                        'User-Agent': 'GitHub-Readme-Streak-Stats'
                    },
                    body: JSON.stringify({ query })
                });

                const data = await response.json();

                if (!data || !data.data || data.errors) {
                    const message = data?.errors?.[0]?.message || data?.message || "An API error occurred.";
                    const errorType = data?.errors?.[0]?.type;

                    if (errorType === "NOT_FOUND") {
                        throw new Error("Could not find a user with that name.");
                    }

                    if (message.includes("rate limit exceeded")) {
                        removeGitHubToken(tokens.get(year));
                        if (retryCount < 1) {
                            tokens.set(year, getGitHubToken());
                            return makeRequest(retryCount + 1);
                        }
                    }

                    console.error(`Failed to decode response for ${user}'s ${year} contributions. ${message}`);
                    return null;
                }

                return data;
            } catch (error) {
                console.error(`Error fetching data for ${user}'s ${year} contributions:`, error);
                return null;
            }
        }

        const result = await makeRequest();
        if (result) {
            responses[year] = result;
        }
    });

    await Promise.all(requests);
    return responses;
}

/**
 * Get all HTTP request responses for user's contributions
 *
 * @param {string} user - GitHub username to get graphs for
 * @param {number|null} startingYear - Override the minimum year to get graphs for
 * @returns {Promise<Object[]>} List of contribution graph response objects
 */
export async function getContributionGraphs(user, startingYear = null) {
    const currentYear = new Date().getFullYear();
    const responses = await executeContributionGraphRequests(user, [currentYear]);

    const userCreatedDateTimeString = responses[currentYear]?.data?.user?.createdAt;
    
    if (!userCreatedDateTimeString) {
        throw new Error("Failed to retrieve contributions. This is likely a GitHub API issue.");
    }

    const userCreatedYear = parseInt(userCreatedDateTimeString.split('-')[0]);
    const minimumYear = Math.max(startingYear || userCreatedYear, 2005);

    const yearsToRequest = Array.from(
        { length: currentYear - minimumYear }, 
        (_, i) => minimumYear + i
    );

    const contributionYears = responses[currentYear]?.data?.user?.contributionsCollection?.contributionYears || [];
    const firstContributionYear = contributionYears[contributionYears.length - 1] || userCreatedYear;

    if (firstContributionYear < 2005) {
        yearsToRequest.unshift(firstContributionYear);
    }

    const additionalResponses = await executeContributionGraphRequests(user, yearsToRequest);
    return { ...responses, ...additionalResponses };
}

// Global token storage
let globalTokens = null;

/**
 * Get all tokens from environment variables (TOKEN, TOKEN2, TOKEN3, etc.)
 * @returns {string[]} List of tokens
 */
function getGitHubTokens() {
    if (globalTokens) {
        return globalTokens;
    }

    const tokens = [];
    if (process.env.TOKEN) {
        tokens.push(process.env.TOKEN);
    }

    let index = 2;
    while (process.env[`TOKEN${index}`]) {
        tokens.push(process.env[`TOKEN${index}`]);
        index++;
    }

    globalTokens = tokens;
    return tokens;
}

/**
 * Get a token from the token pool
 * @returns {string} GitHub token
 * @throws {Error} if no tokens are available
 */
function getGitHubToken() {
    const allTokens = getGitHubTokens();
    if (allTokens.length === 0) {
        throw new Error("There is no GitHub token available.");
    }
    return allTokens[Math.floor(Math.random() * allTokens.length)];
}

/**
 * Remove a token from the token pool
 * @param {string} token - Token to remove
 * @throws {Error} if no tokens are available after removing the token
 */
function removeGitHubToken(token) {
    globalTokens = globalTokens.filter(t => t !== token);
    if (globalTokens.length === 0) {
        throw new Error(
            "We are being rate-limited! Check <a href='https://git.io/streak-ratelimit' font-weight='bold'>git.io/streak-ratelimit</a> for details."
        );
    }
}

/**
 * Get an array of all dates with the number of contributions
 *
 * @param {Object.<number, Object>} contributionGraphs - List of GraphQL response objects by year
 * @returns {Object.<string, number>} Y-M-D dates mapped to the number of contributions
 */
export function getContributionDates(contributionGraphs) {
    const contributions = {};
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    Object.entries(contributionGraphs)
        .sort(([a], [b]) => a - b)
        .forEach(([_, graph]) => {
            const weeks = graph.data.user.contributionsCollection.contributionCalendar.weeks;
            weeks.forEach(week => {
                week.contributionDays.forEach(day => {
                    const { date, contributionCount } = day;
                    if (date <= today || (date === tomorrow && contributionCount > 0)) {
                        contributions[date] = contributionCount;
                    }
                });
            });
        });

    return contributions;
}

/**
 * Normalize names of days of the week (eg. ["Sunday", " mon", "TUE"] -> ["Sun", "Mon", "Tue"])
 *
 * @param {string[]} days - List of days of the week
 * @returns {string[]} List of normalized days of the week
 */
export function normalizeDays(days) {
    const validDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return days
        .map(day => {
            if (!day) return null;
            const normalized = day.trim().toLowerCase();
            const capitalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
            const shortened = capitalized.slice(0, 3);
            return validDays.includes(shortened) ? shortened : null;
        })
        .filter(Boolean);
}

/**
 * Check if a day is an excluded day of the week
 *
 * @param {string} date - Date to check (Y-m-d)
 * @param {string[]} excludedDays - List of days of the week to exclude
 * @returns {boolean} True if the day is excluded, false otherwise
 */
function isExcludedDay(date, excludedDays) {
    if (!excludedDays.length) return false;
    const day = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
    return excludedDays.includes(day);
}

/**
 * Get a stats array with the contribution count, daily streak, and dates
 *
 * @param {Object.<string, number>} contributions - Y-M-D contribution dates with contribution counts
 * @param {string[]} excludedDays - List of days of the week to exclude
 * @returns {Object} Streak stats
 */
export function getContributionStats(contributions, excludedDays = []) {
    if (Object.keys(contributions).length === 0) {
        throw new Error("No contributions found.");
    }

    const dates = Object.keys(contributions).sort();
    const today = dates[dates.length - 1];
    const first = dates[0];

    const stats = {
        mode: "daily",
        totalContributions: 0,
        firstContribution: "",
        longestStreak: {
            start: first,
            end: first,
            length: 0
        },
        currentStreak: {
            start: first,
            end: first,
            length: 0
        },
        excludedDays
    };

    dates.forEach(date => {
        const count = contributions[date];
        stats.totalContributions += count;

        if (count > 0 || (stats.currentStreak.length > 0 && isExcludedDay(date, excludedDays))) {
            stats.currentStreak.length++;
            stats.currentStreak.end = date;

            if (stats.currentStreak.length === 1) {
                stats.currentStreak.start = date;
            }

            if (!stats.firstContribution) {
                stats.firstContribution = date;
            }

            if (stats.currentStreak.length > stats.longestStreak.length) {
                stats.longestStreak = { ...stats.currentStreak };
            }
        } else if (date !== today) {
            stats.currentStreak = {
                start: today,
                end: today,
                length: 0
            };
        }
    });

    return stats;
}

/**
 * Get the previous Sunday of a given date
 *
 * @param {string} date - Date to get previous Sunday of (Y-m-d)
 * @returns {string} Previous Sunday
 */
function getPreviousSunday(date) {
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    d.setDate(d.getDate() - dayOfWeek);
    return d.toISOString().split('T')[0];
}

/**
 * Get a stats array with the contribution count, weekly streak, and dates
 *
 * @param {Object.<string, number>} contributions - Y-M-D contribution dates with contribution counts
 * @returns {Object} Streak stats
 */
export function getWeeklyContributionStats(contributions) {
    if (Object.keys(contributions).length === 0) {
        throw new Error("No contributions found.");
    }

    const dates = Object.keys(contributions).sort();
    const thisWeek = getPreviousSunday(dates[dates.length - 1]);
    const first = dates[0];
    const firstWeek = getPreviousSunday(first);

    const stats = {
        mode: "weekly",
        totalContributions: 0,
        firstContribution: "",
        longestStreak: {
            start: firstWeek,
            end: firstWeek,
            length: 0
        },
        currentStreak: {
            start: firstWeek,
            end: firstWeek,
            length: 0
        }
    };

    const weeks = {};
    Object.entries(contributions).forEach(([date, count]) => {
        const week = getPreviousSunday(date);
        weeks[week] = (weeks[week] || 0) + (count > 0 ? count : 0);

        if (count > 0 && !stats.firstContribution) {
            stats.firstContribution = date;
        }
    });

    Object.entries(weeks).forEach(([week, count]) => {
        stats.totalContributions += count;

        if (count > 0) {
            stats.currentStreak.length++;
            stats.currentStreak.end = week;

            if (stats.currentStreak.length === 1) {
                stats.currentStreak.start = week;
            }

            if (stats.currentStreak.length > stats.longestStreak.length) {
                stats.longestStreak = { ...stats.currentStreak };
            }
        } else if (week !== thisWeek) {
            stats.currentStreak = {
                start: thisWeek,
                end: thisWeek,
                length: 0
            };
        }
    });

    return stats;
}
